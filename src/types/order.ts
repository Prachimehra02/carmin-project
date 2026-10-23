import type { Product } from './product';

// ── Master table interfaces ──

export interface OrderStatusDef {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  sequence: number;
  color: string;
  icon: string;
  show_to_customer: boolean;
  allow_customer_cancel: boolean;
  is_terminal: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentStatusDef {
  id: string;
  code: string;
  name: string;
  color: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReturnStatusDef {
  id: string;
  code: string;
  name: string;
  sequence: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// ── History interfaces ──

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  old_status_id: string | null;
  new_status_id: string;
  changed_by: string | null;
  notes?: string | null;
  created_at: string;
  new_status?: OrderStatusDef;
  old_status?: OrderStatusDef;
}

export interface PaymentStatusHistory {
  id: string;
  order_id: string;
  old_status_id: string | null;
  new_status_id: string;
  changed_by: string | null;
  notes?: string | null;
  created_at: string;
  new_status?: PaymentStatusDef;
  old_status?: PaymentStatusDef;
}

export interface ReturnStatusHistory {
  id: string;
  order_id: string;
  old_status_id: string | null;
  new_status_id: string;
  changed_by: string | null;
  notes?: string | null;
  created_at: string;
  new_status?: ReturnStatusDef;
  old_status?: ReturnStatusDef;
}

// ── Order / OrderItem ──

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  price: number;
  tax_percentage: number;
  tax_amount: number;
  line_total: number;
  hsn_code?: string | null;
  cgst_percentage?: number | null;
  sgst_percentage?: number | null;
  igst_percentage?: number | null;
  cess_percentage?: number | null;
  taxable_amount?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  cess_amount?: number;
  products?: Product;
}

export interface Order {
  id: string;
  order_number: string;

  invoice_number?: string | null;
  invoice_date?: string | null;
  user_id: string;

  order_status_id?: string;
  payment_status_id?: string;
  return_status_id?: string;

  order_status_def?: OrderStatusDef;
  payment_status_def?: PaymentStatusDef;
  return_status_def?: ReturnStatusDef;

  payment_method?: string | null;
  tracking_id?: string | null;
  courier_name?: string | null;
  awb_number?: string | null;
  expected_delivery?: string | null;

  subtotal: number;
  shipping_charge: number;
  discount: number;
  taxable_amount: number;
  tax_amount: number;
  tax_percentage?: number | null;

  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  cess_amount: number;

  place_of_supply_state?: string | null;
  place_of_supply_state_code?: string | null;
  
  grand_total: number;
  shipping_address?: any;
  coupon_code?: string | null;

  order_items?: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  address_line_1: string;
  address_line_2?: string | null;
  city: string;
  state: string;
  country: string;
  pincode: string;
  is_default: boolean;
  landmark?: string | null;
  address_type?: string | null;
  state_code?: string | null;
  district?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  user_id: string;
  product_id: string;
  rating: number;
  review?: string;
  created_at: string;
  updated_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  name?: string | null;
  description?: string | null;
  type: 'percentage' | 'fixed';
  value: number;
  minimum_order_amount: number;
  max_discount_amount: number;
  expiry_date?: string | null;
  start_date?: string | null;
  active: boolean;
  total_usage_limit?: number | null;
  per_customer_usage_limit: number;
  first_order_only: boolean;
  allow_stacking: boolean;
  applicable_scope: 'entire_store' | 'specific_categories' | 'specific_products' | 'specific_customers';
  applicable_categories: string[];
  applicable_product_ids: string[];
  applicable_customer_ids?: string[];
  payment_restriction: 'all' | 'prepaid' | 'cod';
  created_at: string;
  updated_at: string;
  used_count?: number;
  user_used_count?: number;
}

export interface CouponRedemption {
  id: string;
  coupon_id: string;
  user_id: string;
  order_id: string;
  coupon_code: string;
  discount_amount: number;
  redeemed_at: string;
  order?: { order_number: string; created_at: string };
}

export interface PromoPopup {
  id: string;
  title: string;
  subtitle?: string | null;
  coupon_code?: string | null;
  discount_text?: string | null;
  cta_button_text: string;
  cta_destination: string;
  image_url?: string | null;
  background_url?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  active: boolean;
  display_frequency: 'once_per_session' | 'once_per_day' | 'once_until_dismissed' | 'show_again_after_days';
  show_again_after_days: number;
  target_audience: 'all' | 'first_time_visitors' | 'logged_out_only' | 'new_customers_only';
  minimum_order_value: number;
  trigger_type: 'time_delay' | 'exit_intent' | 'scroll_percentage';
  desktop_delay_seconds: number;
  mobile_delay_seconds: number;
  scroll_percentage: number;
  created_at: string;
  updated_at: string;
}

export interface CouponValidationResult {
  valid: boolean;
  discount_amount: number;
  coupon_id: string | null;
  coupon_name: string | null;
  discount_type: string | null;
  discount_value: number | null;
  minimum_order_amount: number | null;
  max_discount_amount: number | null;
  error_message: string | null;
  first_order_only: boolean;
  payment_restriction: string | null;
  applicable_scope: string | null;
  expiry_date: string | null;
  per_customer_usage_limit: number | null;
  total_usage_limit: number | null;
  eligible_total: number;
}
