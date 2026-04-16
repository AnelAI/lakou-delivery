import { API_BASE } from "./config";
import type { Delivery, Courier, Stats } from "./types";

export const api = {
  async getStats(): Promise<Stats | null> {
    try { const r = await fetch(`${API_BASE}/api/stats`); return r.ok ? r.json() : null; } catch { return null; }
  },
  async getDeliveries(): Promise<Delivery[]> {
    try { const r = await fetch(`${API_BASE}/api/deliveries`); return r.ok ? r.json() : []; } catch { return []; }
  },
  async getCouriers(): Promise<Courier[]> {
    try { const r = await fetch(`${API_BASE}/api/couriers`); return r.ok ? r.json() : []; } catch { return []; }
  },
  async updateDelivery(id: string, action: string, courierId?: string): Promise<boolean> {
    try {
      const r = await fetch(`${API_BASE}/api/deliveries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(courierId ? { courierId } : {}) }),
      });
      return r.ok;
    } catch { return false; }
  },
  async createDelivery(data: Record<string, unknown>): Promise<{ orderNumber: string } | null> {
    try {
      const r = await fetch(`${API_BASE}/api/deliveries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return r.ok ? r.json() : null;
    } catch { return null; }
  },
};
