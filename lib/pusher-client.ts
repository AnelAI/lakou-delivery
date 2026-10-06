import PusherClient from "pusher-js";

// Singleton client — shared across components
let client: PusherClient | null = null;

// Without a key/cluster (e.g. env vars not set for a Vercel Preview build),
// `new PusherClient()` throws and the whole page crashes. Fall back to a
// no-op client instead: the app works, just without live updates.
function createNoopClient(): PusherClient {
  const channel = { bind() {}, unbind() {}, unbind_all() {} };
  return {
    subscribe: () => channel,
    unsubscribe() {},
    disconnect() {},
  } as unknown as PusherClient;
}

export function getPusherClient(): PusherClient {
  if (!client) {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!key || !cluster) {
      console.warn("[pusher] NEXT_PUBLIC_PUSHER_KEY/CLUSTER missing — live updates disabled");
      client = createNoopClient();
    } else {
      client = new PusherClient(key, { cluster });
    }
  }
  return client;
}

export function disconnectPusher() {
  client?.disconnect();
  client = null;
}

export const ADMIN_CHANNEL = "admin";
export const courierChannel  = (id: string) => `courier-${id}`;

export const EVENTS = {
  COURIERS_UPDATED:           "couriers-updated",
  DELIVERIES_NEW:             "deliveries-new",
  DELIVERIES_UPDATED:         "deliveries-updated",
  ALERTS_NEW:                 "alerts-new",
  ALERTS_UPDATED:             "alerts-updated",
  COURIER_LOCATION_UPDATE:    "courier-location-update",
  DELIVERY_ASSIGNED:          "delivery-assigned",
  DELIVERY_ACKNOWLEDGED:      "delivery-acknowledged",
  DELIVERY_REFUSED:           "delivery-refused",
  DELIVERY_ARRIVED:           "delivery-arrived",
} as const;
