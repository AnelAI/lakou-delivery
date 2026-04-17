import Pusher from "pusher";

// Server-side Pusher instance — used in API routes to trigger events
export const pusher = new Pusher({
  appId:   (process.env.PUSHER_APP_ID   ?? "").trim(),
  key:     (process.env.NEXT_PUBLIC_PUSHER_KEY     ?? "").trim(),
  secret:  (process.env.PUSHER_SECRET   ?? "").trim(),
  cluster: (process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "").trim(),
  useTLS:  true,
});

// ── Channel names ─────────────────────────────────────────────────────────────
export const ADMIN_CHANNEL = "admin";
export const courierChannel  = (id: string)          => `courier-${id}`;
export const orderChannel    = (orderNumber: string) => `order-${orderNumber}`;

// ── Event names ───────────────────────────────────────────────────────────────
export const EVENTS = {
  // Admin channel
  COURIERS_UPDATED:           "couriers-updated",
  DELIVERIES_NEW:             "deliveries-new",
  DELIVERIES_UPDATED:         "deliveries-updated",
  ALERTS_NEW:                 "alerts-new",
  ALERTS_UPDATED:             "alerts-updated",
  COURIER_LOCATION_UPDATE:    "courier-location-update",
  // Courier channel
  DELIVERY_ASSIGNED:          "delivery-assigned",
  // Order channel (customer tracking)
  DELIVERY_STATUS_UPDATE:     "delivery-status-update",
} as const;
