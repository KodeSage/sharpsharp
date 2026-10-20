/*
# Lock down anon table-level grants

- Supabase's default grants give anon INSERT/UPDATE/DELETE on every table. The RLS
  policies already block these mutations (no INSERT/UPDATE/DELETE policy on shops or
  items; events only allows INSERT + SELECT), but we revoke the table-level grants too
  so the principle of least privilege holds at both layers.
- anon keeps: SELECT on shops (minus edit_token via column grant), SELECT on items,
  SELECT+INSERT on events, SELECT on public_shops, and EXECUTE on the three SECURITY
  DEFINER functions.
*/

-- items: anon SELECT only (mutations go through update_shop)
REVOKE INSERT, UPDATE, DELETE ON items FROM anon;

-- events: anon SELECT + INSERT only
REVOKE UPDATE, DELETE ON events FROM anon;

-- public_shops: anon SELECT only (a view; INSERT/UPDATE/DELETE would target shops
-- which already has no mutation policies, but revoke anyway for clarity)
REVOKE INSERT, UPDATE, DELETE ON public_shops FROM anon;

-- authenticated gets the same treatment for consistency
REVOKE INSERT, UPDATE, DELETE ON items FROM authenticated;
REVOKE UPDATE, DELETE ON events FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public_shops FROM authenticated;
