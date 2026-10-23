export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: string;
          name: string;
          slug: string | null;
          sku: string | null;
          category: string;
          buying_price: number;
          price: number;
          discount_percentage: number | null;
          sale_price: number | null;
          images: string[];
          description: string;
          badge: string | null;
          stock_quantity: number;
          featured: boolean;
          is_active: boolean;
          meta_title: string | null;
          meta_description: string | null;
          weight: number | null;
          dimensions: { length: number; width: number; height: number } | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          slug?: string | null;
          sku?: string | null;
          category: string;
          buying_price: number;
          price: number;
          discount_percentage?: number | null;
          sale_price?: number | null;
          images: string[];
          description: string;
          badge?: string | null;
          stock_quantity?: number;
          featured?: boolean;
          is_active?: boolean;
          meta_title?: string | null;
          meta_description?: string | null;
          weight?: number | null;
          dimensions?: { length: number; width: number; height: number } | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string | null;
          sku?: string | null;
          category?: string;
          buying_price?: number;
          price?: number;
          discount_percentage?: number | null;
          sale_price?: number | null;
          images?: string[];
          description?: string;
          badge?: string | null;
          stock_quantity?: number;
          featured?: boolean;
          is_active?: boolean;
          meta_title?: string | null;
          meta_description?: string | null;
          weight?: number | null;
          dimensions?: { length: number; width: number; height: number } | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      orders: {
        Row: {
          id: string;
          user_id: string;
          order_status_id: string | null;
          payment_status_id: string | null;
          return_status_id: string | null;
          tracking_id: string | null;
          subtotal: number;
          shipping_charge: number;
          discount: number;
          grand_total: number;
          tax_amount: number;
          shipping_address: any;
          coupon_code: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          order_status_id?: string | null;
          payment_status_id?: string | null;
          return_status_id?: string | null;
          tracking_id?: string | null;
          subtotal?: number;
          shipping_charge?: number;
          discount?: number;
          grand_total?: number;
          tax_amount?: number;
          shipping_address?: any;
          coupon_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          order_status_id?: string | null;
          payment_status_id?: string | null;
          return_status_id?: string | null;
          tracking_id?: string | null;
          subtotal?: number;
          shipping_charge?: number;
          discount?: number;
          grand_total?: number;
          tax_amount?: number;
          shipping_address?: any;
          coupon_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          quantity: number;
          price: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id: string;
          quantity: number;
          price: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string;
          quantity?: number;
          price?: number;
          created_at?: string;
        };
      };
      addresses: {
        Row: {
          id: string;
          user_id: string;
          full_name: string;
          phone: string;
          address_line_1: string;
          address_line_2: string | null;
          city: string;
          state: string;
          country: string;
          pincode: string;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name: string;
          phone: string;
          address_line_1: string;
          address_line_2?: string | null;
          city: string;
          state: string;
          country?: string;
          pincode: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          full_name?: string;
          phone?: string;
          address_line_1?: string;
          address_line_2?: string | null;
          city?: string;
          state?: string;
          country?: string;
          pincode?: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      reviews: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          rating: number;
          review: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_id: string;
          rating: number;
          review?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          product_id?: string;
          rating?: number;
          review?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      wishlist: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          product_id?: string;
          created_at?: string;
        };
      };
      coupons: {
        Row: {
          id: string;
          code: string;
          type: string;
          value: number;
          minimum_order_amount: number;
          expiry_date: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          type: string;
          value: number;
          minimum_order_amount?: number;
          expiry_date?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          type?: string;
          value?: number;
          minimum_order_amount?: number;
          expiry_date?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_profiles: {
        Row: {
          id: string;
          full_name: string | null;
          phone: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          zip_code: string | null;
          role: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          phone?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          zip_code?: string | null;
          role?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          phone?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          zip_code?: string | null;
          role?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      admin_users: {
        Row: {
          id: string;
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: string;
          created_at?: string;
        };
      };
    };
  };
}
