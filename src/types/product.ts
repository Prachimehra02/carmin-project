export interface HsnMaster {
  id: string;
  hsn_code: string;
  description: string;
  gst_percentage: number;
  cgst_percentage: number;
  sgst_percentage: number;
  igst_percentage: number;
  cess_percentage: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  slug?: string;
  sku?: string;
  category: 'pots-planters' | 'vases' | 'sculptures' | 'artifacts' | 'decor-accessories' | 'wall-decor' | 'mirrors' | 'new-arrival';
  buying_price: number;              
  price: number;                     
  discount_percentage?: number | null; 
  sale_price?: number | null;
  product_category?: number | null;
  category_id?: number | null;
  hsn_id?: string | null;
  hsn_code?: string | null;
  gst_percentage?: number | null;
  hsn_master?: HsnMaster | null;
  images: string[];
  description: string;
  badge?: string;
  stock_quantity: number;
  featured: boolean;
  is_active: boolean;
  meta_title?: string | null;
  meta_description?: string | null;
  weight?: number | null;
  dimensions?: { length: number; width: number; height: number } | null;
  created_at?: string;
  updated_at?: string;
}

export interface CarouselSlide {
  id: string;
  title: string;
  title1: string;
  subtitle: string;
  image: string;
  eyebrow?: string;
  buttonText?: string;
  buttonLink?: string;
}
