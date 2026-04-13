import PusherClient from "pusher-js";

// Singleton client — shared across components
let client: PusherClient | null = null;

export function getPusherClient(): PusherClient {
  if (!client) {
    client = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });
  }
  return client;
}

export function disconnectPusher() {
  client?.disconnect();
  client = null;
}

export const ADMIN_CHANNEL = "admin";
export const courierChannel = (id: string) => `courier-${id}`;

export const EVENTS = {
  COURIERS_UPDATED:        "couriers-updated",
  DELIVERIES_NEW:          "deliveries-new",
  DELIVERIES_UPDATED:      "deliveries-updated",
  ALERTS_NEW:              "alerts-new",
  ALERTS_UPDATED:          "alerts-updated",
  COURIER_LOCATION_UPDATE: "courier-location-update",
  DELIVERY_ASSIGNED:       "delivery-assigned",
} as const;
