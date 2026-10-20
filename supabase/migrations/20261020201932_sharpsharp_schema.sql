/*
# SharpSharp — shops, items, events schema

1. New Tables
- `shops`: id (uuid PK), slug (text unique), name, category, city, whatsapp (digits only,
  international format), hours (text), tagline (nullable), brand_color (hex text default
  '#FF5A1F'), edit_token (uuid default gen_random_uuid()), created_at.
- `items`: id (uuid PK), shop_id (FK shops ON DELETE CASCADE), name, price (int Naira),
  description (nullable), position (int), available (bool default true), created_at.
- `events`: id (uuid PK), shop_id (FK shops ON DELETE CASCADE), type (text: 'view' |
  'order_click'), created_at.
2. Views
- `public_shops`: all columns of `shops` EXCEPT `edit_token`, so anon clients never see
  the secret edit token. Runs as security_invoker so RLS on shops applies.
3. Security — Row Level Security
- RLS enabled on shops, items, events.
- anon + authenticated can SELECT shops (view hides edit_token), SELECT items, INSERT
  events.
- NO direct anon insert/update/delete on shops or items — all mutations go through
  SECURITY DEFINER functions.
4. SECURITY DEFINER functions (granted to anon)
- `create_shop(payload jsonb)`: inserts shop + items in one call; generates unique slug
  from shop name (lowercase, hyphens, -2/-3 suffix if taken); returns (slug, edit_token).
- `update_shop(p_slug text, p_token uuid, payload jsonb)`: verifies token, replaces shop
  fields and full items list.
- `get_shop_stats(p_slug text, p_token uuid)`: returns total views, total order clicks,
  and order clicks in last 7 days; only if token matches.
5. Notes
- Slug generation is race-safe via unique constraint; conflicts are retried with suffixes.
- All functions run as SECURITY DEFINER so they can bypass RLS to insert/update shops
  and items; anon role has EXECUTE but the functions enforce token ownership internally.
*/

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================
-- shops
-- =========================================================
CREATE TABLE IF NOT EXISTS shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  city text NOT NULL,
  whatsapp text NOT NULL,
  hours text NOT NULL,
  tagline text,
  brand_color text NOT NULL DEFAULT '#FF5A1F',
  edit_token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- items
-- =========================================================
CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  price integer NOT NULL,
  description text,
  position integer NOT NULL DEFAULT 0,
  available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS items_shop_id_position_idx ON items(shop_id, position);

-- =========================================================
-- events
-- =========================================================
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('view', 'order_click')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS events_shop_id_created_at_idx ON events(shop_id, created_at DESC);

-- =========================================================
-- public_shops view (no edit_token)
-- =========================================================
CREATE OR REPLACE VIEW public_shops AS
  SELECT
    id, slug, name, category, city, whatsapp, hours, tagline, brand_color, created_at
  FROM shops;

ALTER VIEW public_shops SET (security_invoker = true);

-- =========================================================
-- RLS policies
-- =========================================================
-- shops: anon can read (edit_token still hidden by view; direct select on shops also
-- allowed since view is the read path, but the column-level exposure of edit_token is
-- acceptable because anon policy grants SELECT on shops). To keep edit_token truly
-- hidden from anon, we restrict column privileges: revoke edit_token from anon.
REVOKE ALL ON shops FROM anon;
GRANT SELECT (id, slug, name, category, city, whatsapp, hours, tagline, brand_color, created_at) ON shops TO anon;
GRANT SELECT ON public_shops TO anon, authenticated;
GRANT SELECT ON items TO anon, authenticated;
GRANT INSERT ON events TO anon, authenticated;
GRANT SELECT ON events TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_shops" ON shops;
CREATE POLICY "anon_select_shops"
  ON shops FOR SELECT
  TO anon, authenticated
  USING (true);

-- items: anon can read
DROP POLICY IF EXISTS "anon_select_items" ON items;
CREATE POLICY "anon_select_items"
  ON items FOR SELECT
  TO anon, authenticated
  USING (true);

-- events: anon can insert (analytics) and read
DROP POLICY IF EXISTS "anon_insert_events" ON events;
CREATE POLICY "anon_insert_events"
  ON events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_events" ON events;
CREATE POLICY "anon_select_events"
  ON events FOR SELECT
  TO anon, authenticated
  USING (true);

-- =========================================================
-- Helper: generate unique slug from name
-- =========================================================
CREATE OR REPLACE FUNCTION make_slug(p_name text, p_attempt integer DEFAULT 0)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  base text;
  candidate text;
BEGIN
  base := lower(regexp_replace(trim(p_name), '[^a-z0-9]+', '-', 'g'));
  base := trim(both '-' from base);
  IF base = '' THEN
    base := 'shop';
  END IF;
  IF p_attempt <= 0 THEN
    candidate := base;
  ELSE
    candidate := base || '-' || p_attempt;
  END IF;
  RETURN candidate;
END;
$$;

-- =========================================================
-- create_shop(payload jsonb) returns (slug text, edit_token uuid)
-- =========================================================
CREATE OR REPLACE FUNCTION create_shop(payload jsonb)
RETURNS TABLE(slug text, edit_token uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := payload->>'name';
  v_category text := payload->>'category';
  v_city text := payload->>'city';
  v_whatsapp text := payload->>'whatsapp';
  v_hours text := payload->>'hours';
  v_tagline text := NULLIF(payload->>'tagline', '');
  v_brand_color text := COALESCE(NULLIF(payload->>'brand_color',''), '#FF5A1F');
  v_items jsonb := COALESCE(payload->'items', '[]'::jsonb);
  v_slug text;
  v_token uuid;
  v_shop_id uuid;
  v_item jsonb;
  v_pos integer := 0;
  v_attempt integer := 0;
BEGIN
  IF v_name IS NULL OR v_whatsapp IS NULL OR v_category IS NULL OR v_city IS NULL OR v_hours IS NULL THEN
    RAISE EXCEPTION 'Missing required shop fields';
  END IF;
  v_whatsapp := regexp_replace(v_whatsapp, '[^0-9]', '', 'g');

  LOOP
    v_slug := make_slug(v_name, v_attempt);
    BEGIN
      INSERT INTO shops (slug, name, category, city, whatsapp, hours, tagline, brand_color)
      VALUES (v_slug, v_name, v_category, v_city, v_whatsapp, v_hours, v_tagline, v_brand_color)
      RETURNING id, edit_token INTO v_shop_id, v_token;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      v_attempt := v_attempt + 1;
      IF v_attempt > 50 THEN
        RAISE EXCEPTION 'Could not generate unique slug after 50 attempts';
      END IF;
    END;
  END LOOP;

  FOR v_item IN SELECT jsonb_array_elements(v_items) LOOP
    INSERT INTO items (shop_id, name, price, description, position, available)
    VALUES (
      v_shop_id,
      v_item->>'name',
      (v_item->>'price')::integer,
      NULLIF(v_item->>'description', ''),
      v_pos,
      COALESCE((v_item->>'available')::boolean, true)
    );
    v_pos := v_pos + 1;
  END LOOP;

  RETURN QUERY SELECT v_slug, v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION create_shop(jsonb) TO anon, authenticated;

-- =========================================================
-- update_shop(p_slug, p_token, payload jsonb)
-- =========================================================
CREATE OR REPLACE FUNCTION update_shop(p_slug text, p_token uuid, payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop shops%ROWTYPE;
  v_items jsonb := COALESCE(payload->'items', '[]'::jsonb);
  v_item jsonb;
  v_pos integer := 0;
BEGIN
  SELECT * INTO v_shop FROM shops WHERE slug = p_slug;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;
  IF v_shop.edit_token IS DISTINCT FROM p_token THEN
    RAISE EXCEPTION 'Invalid edit token';
  END IF;

  UPDATE shops SET
    name = COALESCE(NULLIF(payload->>'name',''), name),
    category = COALESCE(NULLIF(payload->>'category',''), category),
    city = COALESCE(NULLIF(payload->>'city',''), city),
    whatsapp = regexp_replace(COALESCE(NULLIF(payload->>'whatsapp',''), whatsapp), '[^0-9]', '', 'g'),
    hours = COALESCE(NULLIF(payload->>'hours',''), hours),
    tagline = NULLIF(payload->>'tagline', ''),
    brand_color = COALESCE(NULLIF(payload->>'brand_color',''), brand_color)
  WHERE id = v_shop.id;

  DELETE FROM items WHERE shop_id = v_shop.id;
  FOR v_item IN SELECT jsonb_array_elements(v_items) LOOP
    INSERT INTO items (shop_id, name, price, description, position, available)
    VALUES (
      v_shop.id,
      v_item->>'name',
      (v_item->>'price')::integer,
      NULLIF(v_item->>'description', ''),
      v_pos,
      COALESCE((v_item->>'available')::boolean, true)
    );
    v_pos := v_pos + 1;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION update_shop(text, uuid, jsonb) TO anon, authenticated;

-- =========================================================
-- get_shop_stats(p_slug, p_token)
-- =========================================================
CREATE OR REPLACE FUNCTION get_shop_stats(p_slug text, p_token uuid)
RETURNS TABLE(total_views bigint, total_order_clicks bigint, order_clicks_7d bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id uuid;
  v_token uuid;
BEGIN
  SELECT id, edit_token INTO v_shop_id, v_token FROM shops WHERE slug = p_slug;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;
  IF v_token IS DISTINCT FROM p_token THEN
    RAISE EXCEPTION 'Invalid edit token';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN type = 'view' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'order_click' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'order_click' AND created_at >= now() - interval '7 days' THEN 1 ELSE 0 END), 0)
  FROM events
  WHERE shop_id = v_shop_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_shop_stats(text, uuid) TO anon, authenticated;
