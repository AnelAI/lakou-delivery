import Pusher from "pusher-js";
import { PUSHER_KEY, PUSHER_CLUSTER } from "./config";

let instance: Pusher | null = null;

export function getPusher(): Pusher {
  if (!instance) {
    instance = new Pusher(PUSHER_KEY, { cluster: PUSHER_CLUSTER });
  }
  return instance;
}

export const ADMIN_CHANNEL = "lakou-admin";
export const EVENTS = {
  DELIVERIES_UPDATED: "deliveries-updated",
  DELIVERIES_NEW: "delivery-new",
  DELIVERY_ASSIGNED: "delivery-assigned",
  COURIER_LOCATION_UPDATE: "courier-location-update",
};

export function courierChannel(id: string) {
  return `courier-${id}`;
}
