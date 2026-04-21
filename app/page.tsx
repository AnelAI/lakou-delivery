"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback, useMemo } from "react";
import type { Courier, Delivery, Alert, Stats, LocationUpdate } from "@/lib/types";
import { CourierPanel } from "@/components/courier/CourierPanel";
import { DeliveryPanel } from "@/components/delivery/DeliveryPanel";
import { StatsBar } from "@/components/ui/StatsBar";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { ToastContainer, type ToastData, type ToastType } from "@/components/ui/Toast";
import { AddCourierForm } from "@/components/courier/AddCourierForm";
import { AddDeliveryForm } from "@/components/delivery/AddDeliveryForm";
import { getPusherClient, ADMIN_CHANNEL, EVENTS } from "@/lib/pusher-client";
import {
  Bell, RefreshCw, Users, Package, Map as MapIcon, LayoutDashboard, Store, LogOut,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LakouLogo } from "@/components/ui/LakouLogo";

const DeliveryMap = dynamic(
  () => import("@/components/map/DeliveryMap").then((m) => m.DeliveryMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500 text-sm">Chargement de la carte...</div>
      </div>
    ),
  }
);

type MobileTab = "map" | "couriers" | "deliveries";

export default function Dashboard() {
  const router = useRouter();
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
  const [visibleCourierIds, setVisibleCourierIds] = useState<Set<string>>(new Set()); // empty = all
  const [showAddCourier, setShowAddCourier] = useState(false);
  const [showAddDelivery, setShowAddDelivery] = useState(false);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const dismissToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));
  const [loading, setLoading] = useState(true);
  const [mobileTab, setMobileTab] = useState<MobileTab>("map");

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  // Stable color per courier (assigned in chronological order)
  const PALETTE = [
    "#ef4444","#f97316","#eab308","#22c55e","#14b8a6",
    "#3b82f6","#8b5cf6","#ec4899","#06b6d4","#84cc16",
    "#f43f5e","#a855f7","#0ea5e9","#10b981","#fb923c",
  ];
  const courierColors = useMemo(() => {
    const sorted = [...couriers].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const m = new globalThis.Map<string, string>();
    sorted.forEach((c, i) => m.set(c.id, PALETTE[i % PALETTE.length]));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couriers.map((c) => c.id).join(",")]);

  const toggleCourierVisible = (id: string) =>
    setVisibleCourierIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const showAllCouriers  = () => setVisibleCourierIds(new Set());
  const hideAllCouriers  = () =>
    setVisibleCourierIds(new Set(couriers.filter((c) => c.status !== "offline").map((c) => c.id)));

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
    // Live GPS: update only the moving courier's position in state
    channel.bind(EVENTS.COURIER_LOCATION_UPDATE, (data: LocationUpdate) => {
      setCouriers((prev) =>
        prev.map((c) =>
          c.id === data.courierId
            ? { ...c, currentLat: data.lat, currentLng: data.lng, speed: data.speed, status: data.status }
            : c
        )
      );
    });
    channel.bind(EVENTS.ALERTS_NEW, (alert: Alert) => {
      setAlerts((prev) => [alert, ...prev]);
    });
    channel.bind(EVENTS.ALERTS_UPDATED, (updated: Alert) => {
      setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    });
    channel.bind(EVENTS.DELIVERY_ACKNOWLEDGED, (data: { type?: ToastType; courierName: string; orderNumber: string; customerName: string }) => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, type: data.type ?? "acknowledged", courierName: data.courierName, orderNumber: data.orderNumber, customerName: data.customerName }]);
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

  const handleConfirmLocation = async (deliveryId: string, lat: number, lng: number) => {
    const res = await fetch(`/api/deliveries/${deliveryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm-location", lat, lng }),
    });
    if (res.ok) fetchAll();
  };

  const handleConfirmPickup = async (deliveryId: string, lat: number, lng: number) => {
    const res = await fetch(`/api/deliveries/${deliveryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm-pickup", lat, lng }),
    });
    if (res.ok) fetchAll();
  };

  const activeAlerts = alerts.filter((a) => !a.resolved);
  const pendingDeliveries = deliveries.filter((d) => d.status === "pending").length;

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600 font-medium">Chargement de Lakou Delivery...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* ── Top navbar ──────────────────────────────────────────────────────── */}
      <nav className="bg-white border-b border-gray-200 px-3 md:px-4 py-2 md:py-3 flex items-center justify-between z-50 flex-shrink-0 gap-2">
        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <LakouLogo size={34} variant="full" />
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Admin</span>
        </div>

        {/* Stats bar — scrollable, hidden on very small screens */}
        <div className="flex-1 mx-2 md:mx-6 overflow-x-auto hidden sm:block">
          <StatsBar initialStats={stats} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={fetchAll}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Actualiser"
          >
            <RefreshCw size={15} />
          </button>
          <Link
            href="/alerts"
            className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Alertes"
          >
            <Bell size={15} />
            {activeAlerts.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center leading-none">
                {activeAlerts.length > 9 ? "9+" : activeAlerts.length}
              </span>
            )}
          </Link>

          {/* ── Courses button — toujours visible sur mobile ── */}
          <button
            onClick={() => setMobileTab("deliveries")}
            className={`md:hidden relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              mobileTab === "deliveries"
                ? "bg-orange-500 text-white"
                : "bg-orange-50 text-orange-600 border border-orange-200"
            }`}
          >
            <Package size={16} />
            Courses
            {pendingDeliveries > 0 && (
              <span className="w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center leading-none font-bold">
                {pendingDeliveries > 9 ? "9+" : pendingDeliveries}
              </span>
            )}
          </button>

          <Link
            href="/marchands"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
          >
            <Store size={14} />
            Marchands
          </Link>
          <Link
            href="/couriers"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <LayoutDashboard size={14} />
            Coursiers
          </Link>
          <Link
            href="/marchands"
            className="sm:hidden p-2 text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
            title="Marchands"
          >
            <Store size={18} />
          </Link>
          <Link
            href="/couriers"
            className="sm:hidden p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Coursiers"
          >
            <LayoutDashboard size={18} />
          </Link>
          <button
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Se déconnecter"
          >
            <LogOut size={15} />
          </button>
        </div>
      </nav>

      {/* Stats bar mobile (visible sous sm) */}
      <div className="sm:hidden bg-white border-b border-gray-100 px-3 py-1.5 overflow-x-auto">
        <StatsBar initialStats={stats} />
      </div>

      {/* ── Desktop layout (md+) : 3 colonnes ──────────────────────────────── */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        {/* Gauche : coursiers */}
        <div className="w-64 flex-shrink-0 border-r border-gray-200">
          <CourierPanel
            couriers={couriers}
            selectedId={selectedCourierId}
            onSelect={(c) => setSelectedCourierId(c.id === selectedCourierId ? null : c.id)}
            onAdd={() => setShowAddCourier(true)}
            courierColors={courierColors}
            visibleIds={visibleCourierIds}
            onToggleVisible={toggleCourierVisible}
            onShowAll={showAllCouriers}
            onHideAll={hideAllCouriers}
          />
        </div>

        {/* Centre : carte */}
        <div className="flex-1 relative">
          <DeliveryMap
            couriers={couriers}
            deliveries={deliveries}
            selectedCourierId={selectedCourierId}
            onCourierClick={(c) => setSelectedCourierId(c.id)}
            courierColors={courierColors}
            visibleIds={visibleCourierIds}
          />
          <AlertBanner initialAlerts={activeAlerts} />
        </div>

        {/* Droite : livraisons */}
        <div className="w-72 flex-shrink-0 border-l border-gray-200">
          <DeliveryPanel
            deliveries={deliveries}
            couriers={couriers}
            onAssign={handleAssign}
            onStatusChange={handleStatusChange}
            onAdd={() => setShowAddDelivery(true)}
            onConfirmLocation={handleConfirmLocation}
            onConfirmPickup={handleConfirmPickup}
          />
        </div>
      </div>

      {/* ── Mobile layout (< md) : onglets + bottom nav ─────────────────────── */}
      <div className="md:hidden flex-1 overflow-hidden relative">
        {/* Contenu de l'onglet actif */}
        <div className="h-full">
          {mobileTab === "map" && (
            <div className="h-full relative">
              <DeliveryMap
                couriers={couriers}
                deliveries={deliveries}
                selectedCourierId={selectedCourierId}
                onCourierClick={(c) => { setSelectedCourierId(c.id); }}
                courierColors={courierColors}
                visibleIds={visibleCourierIds}
              />
              <AlertBanner initialAlerts={activeAlerts} />
            </div>
          )}

          {mobileTab === "couriers" && (
            <div className="h-full overflow-y-auto">
              <CourierPanel
                couriers={couriers}
                selectedId={selectedCourierId}
                onSelect={(c) => {
                  setSelectedCourierId(c.id === selectedCourierId ? null : c.id);
                  setMobileTab("map");
                }}
                onAdd={() => setShowAddCourier(true)}
                courierColors={courierColors}
                visibleIds={visibleCourierIds}
                onToggleVisible={toggleCourierVisible}
                onShowAll={showAllCouriers}
                onHideAll={hideAllCouriers}
              />
            </div>
          )}

          {mobileTab === "deliveries" && (
            <div className="h-full overflow-y-auto">
              <DeliveryPanel
                deliveries={deliveries}
                couriers={couriers}
                onAssign={handleAssign}
                onStatusChange={handleStatusChange}
                onAdd={() => setShowAddDelivery(true)}
              />
            </div>
          )}
        </div>

        {/* Bottom navigation bar */}
        <nav className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50 safe-area-pb">
          <button
            onClick={() => setMobileTab("map")}
            className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs font-medium transition-colors ${
              mobileTab === "map" ? "text-blue-600" : "text-gray-500"
            }`}
          >
            <MapIcon size={20} />
            <span>Carte</span>
          </button>

          <button
            onClick={() => setMobileTab("couriers")}
            className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs font-medium transition-colors relative ${
              mobileTab === "couriers" ? "text-blue-600" : "text-gray-500"
            }`}
          >
            <Users size={20} />
            <span>Coursiers</span>
            {couriers.filter((c) => c.status !== "offline").length > 0 && (
              <span className="absolute top-1.5 right-[calc(50%-16px)] w-4 h-4 bg-green-500 text-white text-xs rounded-full flex items-center justify-center leading-none">
                {couriers.filter((c) => c.status !== "offline").length}
              </span>
            )}
          </button>

          <button
            onClick={() => setMobileTab("deliveries")}
            className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs font-medium transition-colors relative ${
              mobileTab === "deliveries" ? "text-blue-600" : "text-gray-500"
            }`}
          >
            <Package size={20} />
            <span>Livraisons</span>
            {pendingDeliveries > 0 && (
              <span className="absolute top-1.5 right-[calc(50%-16px)] w-4 h-4 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center leading-none">
                {pendingDeliveries}
              </span>
            )}
          </button>
        </nav>
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
