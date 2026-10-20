/*
# Fix ambiguous edit_token in create_shop RETURNING

- The `RETURNING id, edit_token` inside create_shop conflicted with the PL/pgSQL
  variable `v_token`. Qualify with table alias to remove ambiguity.
*/

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
      RETURNING shops.id, shops.edit_token INTO v_shop_id, v_token;
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
