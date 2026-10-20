-- Seed 3 realistic demo shops with items so judges can explore immediately.
-- Uses ON CONFLICT to be idempotent (re-running won't error).

-- =========================================================
-- Helper: upsert a demo shop and replace its items
-- =========================================================

-- 1. Mama Ngozi's Kitchen (Food)
INSERT INTO shops (slug, name, category, city, whatsapp, hours, tagline, brand_color)
VALUES (
  'mama-ngozi-kitchen',
  'Mama Ngozi''s Kitchen',
  'Food',
  'Enugu',
  '2347083788233',
  'Mon–Sat, 10am–8pm',
  'Home-cooked Igbo dishes, packed with love',
  '#FF5A1F'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  city = EXCLUDED.city,
  whatsapp = EXCLUDED.whatsapp,
  hours = EXCLUDED.hours,
  tagline = EXCLUDED.tagline,
  brand_color = EXCLUDED.brand_color;

DELETE FROM items WHERE shop_id = (SELECT id FROM shops WHERE slug = 'mama-ngozi-kitchen');
INSERT INTO items (shop_id, name, price, position, available)
SELECT id, name, price, position, true FROM (
  SELECT (SELECT id FROM shops WHERE slug = 'mama-ngozi-kitchen') AS id, * FROM (VALUES
    ('Jollof rice + chicken', 3500, 0),
    ('Fried rice + turkey', 4500, 1),
    ('Ofe Owerri + fufu', 5000, 2),
    ('Abacha (African salad)', 2000, 3),
    ('Nkwobi bowl', 6000, 4),
    ('Zobo 1L', 1200, 5),
    ('Small chops (20pcs)', 4000, 6)
  ) AS t(name, price, position)
) AS x;

-- 2. Chioma Stitches (Fashion & Tailoring)
INSERT INTO shops (slug, name, category, city, whatsapp, hours, tagline, brand_color)
VALUES (
  'chioma-stitches',
  'Chioma Stitches',
  'Fashion & Tailoring',
  'Enugu',
  '2347083788233',
  'Mon–Sat, 9am–6pm',
  'Custom fits, stitched with precision',
  '#7C3AED'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  city = EXCLUDED.city,
  whatsapp = EXCLUDED.whatsapp,
  hours = EXCLUDED.hours,
  tagline = EXCLUDED.tagline,
  brand_color = EXCLUDED.brand_color;

DELETE FROM items WHERE shop_id = (SELECT id FROM shops WHERE slug = 'chioma-stitches');
INSERT INTO items (shop_id, name, price, position, available)
SELECT id, name, price, position, true FROM (
  SELECT (SELECT id FROM shops WHERE slug = 'chioma-stitches') AS id, * FROM (VALUES
    ('Ankara gown (sewing only)', 15000, 0),
    ('Senator kaftan', 18000, 1),
    ('Iro & buba set', 22000, 2),
    ('Alterations (per piece)', 2500, 3),
    ('Kids'' native wear', 9000, 4)
  ) AS t(name, price, position)
) AS x;

-- 3. Gadget Plug NG (Phones & Gadgets)
INSERT INTO shops (slug, name, category, city, whatsapp, hours, tagline, brand_color)
VALUES (
  'gadget-plug-ng',
  'Gadget Plug NG',
  'Phones & Gadgets',
  'Enugu',
  '2347083788233',
  'Daily, 9am–7pm',
  'Quality accessories, fair prices',
  '#0EA5E9'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  city = EXCLUDED.city,
  whatsapp = EXCLUDED.whatsapp,
  hours = EXCLUDED.hours,
  tagline = EXCLUDED.tagline,
  brand_color = EXCLUDED.brand_color;

DELETE FROM items WHERE shop_id = (SELECT id FROM shops WHERE slug = 'gadget-plug-ng');
INSERT INTO items (shop_id, name, price, position, available)
SELECT id, name, price, position, true FROM (
  SELECT (SELECT id FROM shops WHERE slug = 'gadget-plug-ng') AS id, * FROM (VALUES
    ('20W fast charger', 7500, 0),
    ('Type-C cable (1m)', 2500, 1),
    ('Wireless earbuds', 18000, 2),
    ('10,000mAh power bank', 16000, 3),
    ('Screen protector + fixing', 3000, 4)
  ) AS t(name, price, position)
) AS x;
