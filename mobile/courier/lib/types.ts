export interface Delivery {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string | null;
  pickupAddress: string;
  deliveryAddress: string;
  pickupLat: number;
  pickupLng: number;
  deliveryLat: number;
  deliveryLng: number;
  status: "pending" | "assigned" | "picked_up" | "delivered" | "cancelled";
  priority: number;
  notes: string | null;
  category: string | null;
  distance: number | null;
  createdAt: string;
  assignedAt: string | null;
  deliveredAt: string | null;
  merchant: { name: string } | null;
}

export interface CourierInfo {
  id: string;
  name: string;
  phone: string;
  status: string;
  deliveredCount: number;
  deliveredToday: number;
}
