/*
  # Fix planter product image paths
  
  1. Data Updates
    - Update image paths for planter category products to include leading slash
    - Ensures images are correctly resolved from public folder
*/

UPDATE products SET images = '["//ridge_pot_1.jpg", "/ridge_pot_2.jpg"]'::jsonb WHERE id = 'Ridge-Pot';

UPDATE products SET images = '["/creamstone_planter_2.jpg", "/creamstone_planter_1.jpg"]'::jsonb WHERE id = 'Creamstone-Planter';

UPDATE products SET images = '["/Planter/Avora_Planter_1.jpg", "/Planter/Avora_Planter_2.jpg", "/Planter/Avora_Planter_3.jpg", "/Planter/Avora_Planter_4.jpg"]'::jsonb WHERE id = 'Avor-Planter';

UPDATE products SET images = '["/Planters/Blue_Bloom_Planter_1.jpg", "/Planters/Blue_Bloom_Planter_2.jpg", "/Planters/Blue_Bloom_Planter_3.jpg", "/Planters/Blue_Bloom_Planter_4.jpg", "/Planters/Blue_Bloom_Planter_5.jpg"]'::jsonb WHERE id = 'Blue-Bloom-Planter';
