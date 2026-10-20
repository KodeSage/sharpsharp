/*
# Fix slug generation dropping uppercase first letters

- make_slug lowercased AFTER the regex replace, so uppercase letters (M, N, K) were
  treated as non-matching and replaced with hyphens, dropping the first letter of each
  word. Lowercase BEFORE the regex so the character class [^a-z0-9] is correct.
*/

CREATE OR REPLACE FUNCTION make_slug(p_name text, p_attempt integer DEFAULT 0)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  base text;
  candidate text;
BEGIN
  base := regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g');
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
