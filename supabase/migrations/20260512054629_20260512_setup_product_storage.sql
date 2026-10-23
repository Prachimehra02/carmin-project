/*
  # Setup Product Images Storage Bucket

  1. Storage Bucket
    - Create `products` bucket for storing product images
    - Enable public access for images
    - Set up security policies

  2. Policies
    - Public read access for product images
    - Authenticated users can upload/delete images
*/

-- Create the storage bucket (via SQL trigger/function pattern)
-- Note: In Supabase, buckets are typically created via the UI or API
-- This migration documents the required setup:
-- 1. Create a bucket named "products"
-- 2. Set it to public
-- 3. Allow authenticated users to upload/delete
-- 4. Allow public users to view

-- For now, we document that the bucket should exist
-- The admin panel will handle uploads automatically once bucket is created
