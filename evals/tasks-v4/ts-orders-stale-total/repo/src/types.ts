export interface Line {
  sku: string;
  qty: number;
}

export interface Order {
  id: string;
  lines: Line[];
  coupon: string | null;
  totalCents: number;
  createdAt: number;
  updatedAt: number;
}

export interface PriceBreakdown {
  subtotal: number;
  discount: number;
  total: number;
}
