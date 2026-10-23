/*
  # Sync products from local products.ts file
  
  1. Data Updates
    - Update all planter products with corrected image paths and IDs
    - Ensure database matches frontend data source
*/

DELETE FROM products WHERE category = 'pots-planters';

INSERT INTO products (id, name, category, price, images, description) VALUES
('Ridge-Pot', 'Ridge Pot', 'pots-planters', 2499, '["/ridge_pot_1.jpg", "/ridge_pot_2.jpg"]'::jsonb, 'Modern green ribbed planter designed to elevate everyday spaces.'),
('Creamstone-Planter', 'Creamstone Planter', 'pots-planters', 1899, '["/creamstone_planter_2.jpg", "/creamstone_planter_1.jpg"]'::jsonb, 'Handcrafted design featuring natural tones and smooth, timeless contours.'),
('Avora-Planter', 'Avora Planter', 'pots-planters', 1899, '["/Planter/Avora_Planter_1.jpg", "/Planter/Avora_Planter_2.jpg", "/Planter/Avora_Planter_3.jpg", "/Planter/Avora_Planter_4.jpg"]'::jsonb, 'Handcrafted design featuring natural tones and smooth, timeless contours.'),
('Blue-Bloom-Planter', 'Blue Bloom Planter', 'pots-planters', 1899, '["/Planters/Blue_Bloom_Planter_1.jpg", "/Planters/Blue_Bloom_Planter_2.jpg", "/Planters/Blue_Bloom_Planter_3.jpg", "/Planters/Blue_Bloom_Planter_4.jpg", "/Planters/Blue_Bloom_Planter_5.jpg"]'::jsonb, 'Handcrafted design featuring natural tones and smooth, timeless contours.');
