export type CourierStatus = "offline" | "available" | "busy" | "paused";

export interface Merchant {
  id: string;
  osmId?: string | null;
  name: string;
  category: string;
  address?: string | null;
  lat: number;
  lng: number;
  phone?: string | null;
  website?: string | null;
  active: boolean;
  createdAt: string;
}
export type DeliveryStatus = "pending" | "assigned" | "picked_up" | "delivered" | "cancelled";
export type AlertType = "unauthorized_pause" | "route_deviation" | "speed_violation" | "offline";
export type AlertSeverity = "info" | "warning" | "critical";

export interface Courier {
  id: string;
  name: string;
  phone: string;
  photo?: string | null;
  status: CourierStatus;
  currentLat?: number | null;
  currentLng?: number | null;
  lastSeen?: string | null;
  speed: number;
  heading: number;
  deliveries?: Delivery[];
  alerts?: Alert[];
  deliveredCount?: number;
  deliveredToday?: number;
  createdAt: string;
}

export interface Delivery {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  deliveryAddress: string;
  deliveryLat: number;
  deliveryLng: number;
  notes?: string | null;
  deliveryDescription?: string | null;
  locationConfirmed: boolean;
  category?: string | null;
  merchantId?: string | null;
  merchant?: { id: string; name: string; address?: string | null } | null;
  status: DeliveryStatus;
  courierId?: string | null;
  courier?: { id: string; name: string; phone: string } | null;
  priority: number;
  price?: number | null;
  estimatedTime?: number | null;
  distance?: number | null;
  assignedAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
}

export interface Alert {
  id: string;
  courierId: string;
  courier?: { id: string; name: string; phone: string };
  type: AlertType;
  message: string;
  severity: AlertSeverity;
  resolved: boolean;
  resolvedAt?: string | null;
  createdAt: string;
}

export interface Stats {
  totalCouriers: number;
  activeCouriers: number;
  pendingDeliveries: number;
  activeDeliveries: number;
  deliveredToday: number;
  activeAlerts: number;
}

export interface LocationUpdate {
  courierId: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  name: string;
  status: CourierStatus;
  timestamp: string;
}
