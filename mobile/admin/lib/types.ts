export interface Delivery {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string | null;
  pickupAddress: string;
  deliveryAddress: string;
  status: "pending" | "assigned" | "picked_up" | "delivered" | "cancelled";
  priority: number;
  notes: string | null;
  category: string | null;
  createdAt: string;
  courier: { id: string; name: string } | null;
  merchant: { name: string } | null;
}

export interface Courier {
  id: string;
  name: string;
  phone: string;
  status: "available" | "busy" | "paused" | "offline";
  deliveredCount: number;
  deliveredToday: number;
  currentLat: number | null;
  currentLng: number | null;
  lastSeen: string | null;
}

export interface Stats {
  totalCouriers: number;
  activeCouriers: number;
  pendingDeliveries: number;
  activeDeliveries: number;
  deliveredToday: number;
  activeAlerts: number;
}
