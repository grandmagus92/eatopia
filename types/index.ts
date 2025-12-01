export interface Product {
  id: string
  name: string
  price: number
  category: string
  description?: string
  image_url?: string
  is_available: boolean
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  order_number: string
  total_amount: number
  status: 'pending' | 'processing' | 'completed' | 'cancelled'
  payment_method: string // Ubah menjadi string saja
  customer_name?: string
  customer_phone?: string
  notes?: string
  created_at: string
  items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  product?: Product
  quantity: number
  price: number
  subtotal: number
  notes?: string
  created_at: string
}

export interface CreateOrderData {
  customer_name?: string
  customer_phone?: string
  payment_method: string // Ubah menjadi string saja
  notes?: string
  items: {
    product_id: string
    quantity: number
    price: number
    notes?: string
  }[]
}


export interface ReportData {
  period: string
  revenue: number
  orders: number
  averageOrderValue: number
  bestSellingProduct: string
  bestSellingCategory: string
}

export interface PieDataItem {
  name: string;
  value: number;
  percentage?: number;
  [key: string]: any;
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  quantity: number
  price: number
  subtotal: number
  created_at: string
  products: Product // HARUS 'products' (plural) sesuai dengan query Supabase
}

export interface Order {
  id: string
  order_number: string
  total_amount: number
  status: 'pending' | 'processing' | 'completed' | 'cancelled'
  payment_method: string
  customer_name?: string
  customer_phone?: string
  notes?: string
  created_at: string
  updated_at: string
  order_items: OrderItem[]
}

export interface ReportData {
  period: string;
  revenue: number;
  orders: number;
  averageOrderValue: number;
  bestSellingProduct: string;
  bestSellingCategory: string;
  totalQuantitySold: number;
  bestSellingProductQuantity: number;
  bestSellingCategoryQuantity: number;
  uniqueProductsSold: number;
}

export interface ProductSales {
  product_name: string;
  category: string;
  quantity_sold: number;
  total_revenue: number;
  average_price?: number;
}

export interface CategorySales {
  category: string;
  quantity_sold: number;
  total_revenue: number;
  percentage: number;
}

export interface TimeSeriesData {
  date: string;
  revenue: number;
  orders: number;
  quantity: number;
}

export interface PieDataItem {
  name: string;
  value: number;
  quantity: number;
}

export interface SalesData {
  date: string
  revenue: number
  orders: number
  customers?: number
}
