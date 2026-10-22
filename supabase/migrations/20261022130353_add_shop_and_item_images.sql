/*
# Add image support for shops and items

1. New Columns
- `shops.banner_url` (text, nullable) — optional brand banner image URL for the shop header.
- `items.image_url` (text, nullable) — optional product photo for each item.

2. Storage
- Creates a public bucket `shop-images` for uploading shop banners and item photos.
- Storage policies: anon + authenticated can INSERT and SELECT objects in `shop-images`.
  This is a no-auth app (anon-key frontend), so anon needs both upload and read access.
  The bucket is public so images can be served via public URLs without signed tokens.

3. Updated Functions
- `create_shop(payload jsonb)`: now reads `banner_url` from payload and `image_url` from
  each item in the items array.
- `update_shop(p_slug, p_token, payload jsonb)`: now reads `banner_url` from payload and
  `image_url` from each item in the items array.

4. Updated View
- `public_shops` dropped and recreated to include `banner_url`.

5. Updated Grants
- anon SELECT on shops now includes `banner_url`.

6. Security
- No new RLS policies needed on shops/items (existing policies still apply).
- Storage policies are intentionally permissive (public bucket, no-auth app).
*/

-- =========================================================
-- Add columns
-- =========================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'banner_url') THEN
    ALTER TABLE shops ADD COLUMN banner_url text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'image_url') THEN
    ALTER TABLE items ADD COLUMN image_url text;
  END IF;
END $$;

-- =========================================================
-- Update anon SELECT grant on shops to include banner_url
-- =========================================================
REVOKE ALL ON shops FROM anon;
GRANT SELECT (id, slug, name, category, city, whatsapp, hours, tagline, brand_color, banner_url, created_at) ON shops TO anon;

-- =========================================================
-- Recreate public_shops view to include banner_url
-- =========================================================
DROP VIEW IF EXISTS public_shops;
CREATE VIEW public_shops AS
  SELECT
    id, slug, name, category, city, whatsapp, hours, tagline, brand_color, banner_url, created_at
  FROM shops;

ALTER VIEW public_shops SET (security_invoker = true);
GRANT SELECT ON public_shops TO anon, authenticated;

-- =========================================================
-- Storage bucket for shop images
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-images', 'shop-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: anon can upload and read (no-auth app)
DROP POLICY IF EXISTS "anon_upload_shop_images" ON storage.objects;
CREATE POLICY "anon_upload_shop_images"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'shop-images');

DROP POLICY IF EXISTS "anon_read_shop_images" ON storage.objects;
CREATE POLICY "anon_read_shop_images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'shop-images');

DROP POLICY IF EXISTS "anon_update_shop_images" ON storage.objects;
CREATE POLICY "anon_update_shop_images"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'shop-images');

DROP POLICY IF EXISTS "anon_delete_shop_images" ON storage.objects;
CREATE POLICY "anon_delete_shop_images"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'shop-images');

-- =========================================================
-- Recreate create_shop to handle image_url + banner_url
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
  v_banner_url text := NULLIF(payload->>'banner_url', '');
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
      INSERT INTO shops (slug, name, category, city, whatsapp, hours, tagline, brand_color, banner_url)
      VALUES (v_slug, v_name, v_category, v_city, v_whatsapp, v_hours, v_tagline, v_brand_color, v_banner_url)
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
    INSERT INTO items (shop_id, name, price, description, position, available, image_url)
    VALUES (
      v_shop_id,
      v_item->>'name',
      (v_item->>'price')::integer,
      NULLIF(v_item->>'description', ''),
      v_pos,
      COALESCE((v_item->>'available')::boolean, true),
      NULLIF(v_item->>'image_url', '')
    );
    v_pos := v_pos + 1;
  END LOOP;

  RETURN QUERY SELECT v_slug, v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION create_shop(jsonb) TO anon, authenticated;

-- =========================================================
-- Recreate update_shop to handle image_url + banner_url
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
    brand_color = COALESCE(NULLIF(payload->>'brand_color',''), brand_color),
    banner_url = NULLIF(payload->>'banner_url', '')
  WHERE id = v_shop.id;

  DELETE FROM items WHERE shop_id = v_shop.id;
  FOR v_item IN SELECT jsonb_array_elements(v_items) LOOP
    INSERT INTO items (shop_id, name, price, description, position, available, image_url)
    VALUES (
      v_shop.id,
      v_item->>'name',
      (v_item->>'price')::integer,
      NULLIF(v_item->>'description', ''),
      v_pos,
      COALESCE((v_item->>'available')::boolean, true),
      NULLIF(v_item->>'image_url', '')
    );
    v_pos := v_pos + 1;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION update_shop(text, uuid, jsonb) TO anon, authenticated;
