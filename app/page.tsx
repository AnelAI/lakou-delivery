"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback } from "react";
import type { Courier, Delivery, Alert, Stats } from "@/lib/types";
import { CourierPanel } from "@/components/courier/CourierPanel";
import { DeliveryPanel } from "@/components/delivery/DeliveryPanel";
import { StatsBar } from "@/components/ui/StatsBar";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { AddCourierForm } from "@/components/courier/AddCourierForm";
import { AddDeliveryForm } from "@/components/delivery/AddDeliveryForm";
import { getPusherClient, ADMIN_CHANNEL, EVENTS } from "@/lib/pusher-client";
import { Bell, RefreshCw, MapPin, Settings } from "lucide-react";
import Link from "next/link";

// Dynamic import for map (client-side only — Leaflet uses window)
const DeliveryMap = dynamic(
  () => import("@/components/map/DeliveryMap").then((m) => m.DeliveryMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">Chargement de la carte...</div>
      </div>
    ),
  }
);

export default function Dashboard() {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalCouriers: 0,
    activeCouriers: 0,
    pendingDeliveries: 0,
    activeDeliveries: 0,
    deliveredToday: 0,
    activeAlerts: 0,
  });
  const [selectedCourierId, setSelectedCourierId] = useState<string | null>(null);
  const [showAddCourier, setShowAddCourier] = useState(false);
  const [showAddDelivery, setShowAddDelivery] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [couriersRes, deliveriesRes, alertsRes, statsRes] = await Promise.all([
        fetch("/api/couriers"),
        fetch("/api/deliveries"),
        fetch("/api/alerts?resolved=false"),
        fetch("/api/stats"),
      ]);

      if (couriersRes.ok) setCouriers(await couriersRes.json());
      if (deliveriesRes.ok) setDeliveries(await deliveriesRes.json());
      if (alertsRes.ok) setAlerts(await alertsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();

    const client = getPusherClient();
    const channel = client.subscribe(ADMIN_CHANNEL);

    channel.bind(EVENTS.COURIERS_UPDATED, fetchAll);
    channel.bind(EVENTS.DELIVERIES_NEW, fetchAll);
    channel.bind(EVENTS.DELIVERIES_UPDATED, fetchAll);
    channel.bind(EVENTS.ALERTS_NEW, (alert: Alert) => {
      setAlerts((prev) => [alert, ...prev]);
    });
    channel.bind(EVENTS.ALERTS_UPDATED, (updated: Alert) => {
      setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    });

    return () => {
      channel.unbind_all();
      client.unsubscribe(ADMIN_CHANNEL);
    };
  }, [fetchAll]);

  const handleAssign = async (deliveryId: string, courierId: string) => {
    const res = await fetch(`/api/deliveries/${deliveryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "assign", courierId }),
    });
    if (res.ok) fetchAll();
  };

  const handleStatusChange = async (deliveryId: string, action: string) => {
    const res = await fetch(`/api/deliveries/${deliveryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) fetchAll();
  };

  const activeAlerts = alerts.filter((a) => !a.resolved);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600 font-medium">Chargement de Lakou Delivery Admin...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top navbar */}
      <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <MapPin size={16} className="text-white" />
            </div>
            <span className="font-bold text-gray-800 text-lg">Lakou Delivery</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              Admin
            </span>
          </div>
        </div>

        <div className="flex-1 mx-6 overflow-x-auto">
          <StatsBar initialStats={stats} />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAll}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Actualiser"
          >
            <RefreshCw size={16} />
          </button>
          <Link
            href="/alerts"
            className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Bell size={16} />
            {activeAlerts.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {activeAlerts.length > 9 ? "9+" : activeAlerts.length}
              </span>
            )}
          </Link>
          <Link
            href="/couriers"
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Settings size={16} />
          </Link>
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Courier panel */}
        <div className="w-64 flex-shrink-0">
          <CourierPanel
            couriers={couriers}
            selectedId={selectedCourierId}
            onSelect={(c) =>
              setSelectedCourierId(c.id === selectedCourierId ? null : c.id)
            }
            onAdd={() => setShowAddCourier(true)}
          />
        </div>

        {/* Center: Map */}
        <div className="flex-1 relative">
          <DeliveryMap
            couriers={couriers}
            deliveries={deliveries}
            selectedCourierId={selectedCourierId}
            onCourierClick={(c) => setSelectedCourierId(c.id)}
          />

          {/* Alert banner (overlays map) */}
          <AlertBanner initialAlerts={activeAlerts} />
        </div>

        {/* Right: Delivery panel */}
        <div className="w-72 flex-shrink-0">
          <DeliveryPanel
            deliveries={deliveries}
            couriers={couriers}
            onAssign={handleAssign}
            onStatusChange={handleStatusChange}
            onAdd={() => setShowAddDelivery(true)}
          />
        </div>
      </div>

      {/* Modals */}
      <AddCourierForm
        isOpen={showAddCourier}
        onClose={() => setShowAddCourier(false)}
        onSuccess={fetchAll}
      />
      <AddDeliveryForm
        isOpen={showAddDelivery}
        onClose={() => setShowAddDelivery(false)}
        onSuccess={fetchAll}
      />
    </div>
  );
}
