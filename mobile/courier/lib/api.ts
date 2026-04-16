import { API_BASE } from "./config";
import type { Delivery, CourierInfo } from "./types";

export async function getCourier(id: string): Promise<CourierInfo | null> {
  try {
    const res = await fetch(`${API_BASE}/api/couriers/${id}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function getDeliveries(courierId: string): Promise<Delivery[]> {
  try {
    const res = await fetch(`${API_BASE}/api/deliveries?courierId=${courierId}`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function updateDeliveryStatus(
  deliveryId: string,
  action: "pickup" | "deliver" | "cancel"
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/deliveries/${deliveryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendLocation(
  courierId: string,
  lat: number,
  lng: number,
  speed: number,
  heading: number,
  accuracy: number
): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/tracking`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courierId, lat, lng, speed, heading, accuracy }),
    });
  } catch {
    // silent fail — location will be sent next tick
  }
}
