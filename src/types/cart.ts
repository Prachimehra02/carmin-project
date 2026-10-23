
export interface CartItem {
  // Parent product ID (e.g. HDR-DEC-003)
  id: string;

  // Unique variant ID (UUID)
  variant_id: string;

  // Product information
  name: string;

  // Variant pricing
  price: number; // MRP
  sale_price?: number | null; // Selling price

  // Cart quantity
  quantity: number;

  // Variant primary image
  image: string;

  // Variant inventory
  stock_quantity?: number;

  // Selected variant attributes
  variant_attributes?: {
    name: string;
    value: string;
  }[];
}

export interface Cart {
  items: CartItem[];
  total: number;
}
