/*
  # Sync products from products.ts to database
  
  1. Data Updates
    - Insert pots and planters products
    - Insert vases products
    - All products include id, name, category, price, images array, and description
    - Some products include badge field for special promotions
*/

DELETE FROM products WHERE category IN ('pots-planters', 'vases');

INSERT INTO products (id, name, category, price, images, description, badge) VALUES
-- Pots and Planters
('Ridge-Pot', 'Ridge Pot', 'pots-planters', 2499, '["ridge_pot_1.jpg", "ridge_pot_2.jpg"]'::jsonb, 'Modern green ribbed planter designed to elevate everyday spaces.', NULL),
('Creamstone-Planter', 'Creamstone Planter', 'pots-planters', 1899, '["creamstone_planter_2.jpg", "creamstone_planter_1.jpg"]'::jsonb, 'Handcrafted design featuring natural tones and smooth, timeless contours.', NULL),
('Avor-Planter', 'Avora Planter', 'pots-planters', 1899, '["Planter/Avora_Planter_1.jpg", "Planter/Avora_Planter_2.jpg", "Planter/Avora_Planter_3.jpg", "Planter/Avora_Planter_4.jpg"]'::jsonb, 'Handcrafted design featuring natural tones and smooth, timeless contours.', NULL),
('Blue-Bloom-Planter', 'Blue Bloom Planter', 'pots-planters', 1899, '["Planters/Blue_Bloom_Planter_1.jpg", "Planters/Blue_Bloom_Planter_2.jpg", "Planters/Blue_Bloom_Planter_3.jpg", "Planters/Blue_Bloom_Planter_4.jpg", "Planters/Blue_Bloom_Planter_5.jpg"]'::jsonb, 'Handcrafted design featuring natural tones and smooth, timeless contours.', NULL),

-- Vases
('CGV', 'Crystal Glass Vase', 'vases', 3299, '["https://images.pexels.com/photos/1011302/pexels-photo-1011302.jpeg?auto=compress&cs=tinysrgb&w=800", "https://images.pexels.com/photos/1084697/pexels-photo-1084697.jpeg?auto=compress&cs=tinysrgb&w=800"]'::jsonb, 'Elegant crystal glass vase with faceted design that catches the light beautifully', NULL),
('vase-2', 'Ceramic Art Vase', 'vases', 2899, '["https://images.pexels.com/photos/1170979/pexels-photo-1170979.jpeg?auto=compress&cs=tinysrgb&w=800", "https://images.pexels.com/photos/1179815/pexels-photo-1179815.jpeg?auto=compress&cs=tinysrgb&w=800"]'::jsonb, 'Handcrafted ceramic vase with unique artistic glaze finish', NULL),
('vase-3', 'Tall Cylinder Vase', 'vases', 1999, '["https://images.pexels.com/photos/1445416/pexels-photo-1445416.jpeg?auto=compress&cs=tinysrgb&w=800", "https://images.pexels.com/photos/1669754/pexels-photo-1669754.jpeg?auto=compress&cs=tinysrgb&w=800"]'::jsonb, 'Modern tall cylinder vase perfect for long-stemmed flowers', NULL),
('vase-4', 'Vintage Bronze Vase', 'vases', 4299, '["https://images.pexels.com/photos/2255441/pexels-photo-2255441.jpeg?auto=compress&cs=tinysrgb&w=800", "https://images.pexels.com/photos/1797428/pexels-photo-1797428.jpeg?auto=compress&cs=tinysrgb&w=800"]'::jsonb, 'Vintage-inspired bronze vase with ornate detailing', NULL),
('vase-5', 'Minimalist White Vase', 'vases', 1799, '["https://images.pexels.com/photos/1407846/pexels-photo-1407846.jpeg?auto=compress&cs=tinysrgb&w=800", "https://images.pexels.com/photos/1669799/pexels-photo-1669799.jpeg?auto=compress&cs=tinysrgb&w=800"]'::jsonb, 'Pure white minimalist vase with clean lines and simple elegance', NULL),
('vase-6', 'Textured Teal Vase', 'vases', 2599, '["https://images.pexels.com/photos/1058316/pexels-photo-1058316.jpeg?auto=compress&cs=tinysrgb&w=800", "https://images.pexels.com/photos/1030631/pexels-photo-1030631.jpeg?auto=compress&cs=tinysrgb&w=800"]'::jsonb, 'Stunning teal vase with rich textured surface for visual interest', NULL),
('vase-7', 'Glass Bubble Vase', 'vases', 3599, '["https://images.pexels.com/photos/1179863/pexels-photo-1179863.jpeg?auto=compress&cs=tinysrgb&w=800", "https://images.pexels.com/photos/1445417/pexels-photo-1445417.jpeg?auto=compress&cs=tinysrgb&w=800"]'::jsonb, 'Contemporary glass vase with organic bubble form', NULL),
('vase-8', 'Marble Pattern Vase', 'vases', 3199, '["https://images.pexels.com/photos/1643389/pexels-photo-1643389.jpeg?auto=compress&cs=tinysrgb&w=800", "https://images.pexels.com/photos/1669757/pexels-photo-1669757.jpeg?auto=compress&cs=tinysrgb&w=800"]'::jsonb, 'Sophisticated vase featuring elegant marble pattern design', NULL);
