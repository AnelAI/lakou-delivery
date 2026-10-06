"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Courier, Delivery, Alert, Stats, LocationUpdate } from "@/lib/types";
import { CourierPanel } from "@/components/courier/CourierPanel";
import { DeliveryPanel } from "@/components/delivery/DeliveryPanel";
import { StatsBar } from "@/components/ui/StatsBar";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { ToastContainer, type ToastData } from "@/components/ui/Toast";
import { AddCourierForm } from "@/components/courier/AddCourierForm";
import { AddDeliveryForm } from "@/components/delivery/AddDeliveryForm";
import { CourierDeliveriesModal } from "@/components/courier/CourierDeliveriesModal";
import { getPusherClient, ADMIN_CHANNEL, EVENTS } from "@/lib/pusher-client";
import { useWebPush } from "@/lib/useWebPush";
import { ACTIVE_DELIVERY_STATUSES } from "@/lib/delivery-status";
import {
  RefreshCw, Users, Package, Map as MapIcon, LayoutDashboard, Store, LogOut,
} from "lucide-react";
import Link from "next/link";
import { NotificationBell } from "@/components/ui/NotificationBell";
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

// Finished deliveries older than this are not loaded on the dashboard.
const HISTORY_DAYS = 7;

export default function Dashboard() {
  const router = useRouter();
  useWebPush();
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedCourierId, setSelectedCourierId] = useState<string | null>(null);
  const [courierDeliveriesOpen, setCourierDeliveriesOpen] = useState<Courier | null>(null);
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

  // ── Data loading ───────────────────────────────────────────────────────────
  // Each Pusher event only reloads what it can have changed, and bursts of
  // events (e.g. an action + its own broadcast) are coalesced into one fetch.
  type Resource = "couriers" | "deliveries" | "alerts";
  const pendingRef = useRef<Set<Resource>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (resources: Set<Resource>) => {
    try {
      await Promise.all([
        resources.has("couriers") && fetch("/api/couriers").then(async (r) => {
          if (r.ok) setCouriers(await r.json());
        }),
        resources.has("deliveries") && fetch(`/api/deliveries?historyDays=${HISTORY_DAYS}`).then(async (r) => {
          if (r.ok) setDeliveries(await r.json());
        }),
        resources.has("alerts") && fetch("/api/alerts?resolved=false").then(async (r) => {
          if (r.ok) setAlerts(await r.json());
        }),
      ]);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback((...resources: Resource[]) => {
    resources.forEach((r) => pendingRef.current.add(r));
    if (timerRef.current) return;
    timerRef.current = setTimeout(() => {
      const batch = pendingRef.current;
      pendingRef.current = new Set();
      timerRef.current = null;
      load(batch);
    }, 300);
  }, [load]);

  const fetchAll = useCallback(() => refresh("couriers", "deliveries", "alerts"), [refresh]);

  // Stats are derived from data already loaded instead of polling /api/stats.
  const stats = useMemo<Stats>(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return {
      totalCouriers: couriers.length,
      activeCouriers: couriers.filter((c) => c.status === "available" || c.status === "busy").length,
      pendingDeliveries: deliveries.filter((d) => d.status === "pending").length,
      activeDeliveries: deliveries.filter((d) => (ACTIVE_DELIVERY_STATUSES as readonly string[]).includes(d.status)).length,
      deliveredToday: deliveries.filter(
        (d) => d.status === "delivered" && d.deliveredAt && new Date(d.deliveredAt) >= todayStart
      ).length,
      activeAlerts: alerts.filter((a) => !a.resolved).length,
    };
  }, [couriers, deliveries, alerts]);

  useEffect(() => {
    load(new Set(["couriers", "deliveries", "alerts"]));
    const client = getPusherClient();
    const channel = client.subscribe(ADMIN_CHANNEL);
    channel.bind(EVENTS.COURIERS_UPDATED, () => refresh("couriers"));
    channel.bind(EVENTS.DELIVERIES_NEW, () => refresh("deliveries"));
    // Assigning/finishing a delivery also changes the courier's status.
    channel.bind(EVENTS.DELIVERIES_UPDATED, () => refresh("deliveries", "couriers"));
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
      setAlerts((prev) => (prev.some((a) => a.id === alert.id) ? prev : [alert, ...prev]));
    });
    channel.bind(EVENTS.ALERTS_UPDATED, (updated: Alert) => {
      setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    });
    channel.bind(EVENTS.DELIVERY_ACKNOWLEDGED, (data: { courierName: string; orderNumber: string; customerName: string }) => {
      const id = `${Date.now()}`;
      setToasts((prev) => [...prev, { id, ...data }]);
    });

    // Vérifier toutes les 60s si des coursiers sont passés hors ligne
    // (aucune mise à jour GPS depuis > 5 min → status "offline" + alerte)
    // (seulement si l'onglet est visible : inutile d'appeler l'API en arrière-plan)
    const offlineCheckInterval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/couriers/offline-check", { method: "POST" }).catch(() => {});
    }, 60_000);

    return () => {
      clearInterval(offlineCheckInterval);
      if (timerRef.current) clearTimeout(timerRef.current);
      channel.unbind_all();
      client.unsubscribe(ADMIN_CHANNEL);
    };
  }, [load, refresh]);

  const handleAssign = async (deliveryId: string, courierId: string) => {
    const res = await fetch(`/api/deliveries/${deliveryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "assign", courierId }),
    });
    if (res.ok) refresh("deliveries", "couriers");
  };

  const handleStatusChange = async (deliveryId: string, action: string) => {
    const res = await fetch(`/api/deliveries/${deliveryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) refresh("deliveries", "couriers");
  };

  const handleConfirmLocation = async (deliveryId: string, lat: number, lng: number) => {
    const res = await fetch(`/api/deliveries/${deliveryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm-location", lat, lng }),
    });
    if (res.ok) refresh("deliveries");
  };

  const handleConfirmPickup = async (deliveryId: string, lat: number, lng: number) => {
    const res = await fetch(`/api/deliveries/${deliveryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm-pickup", lat, lng }),
    });
    if (res.ok) refresh("deliveries");
  };

  const activeAlerts = alerts.filter((a) => !a.resolved);
  const pendingDeliveries = deliveries.filter((d) => d.status === "pending").length;

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: "#FAFAF8" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#FF3B2F", borderTopColor: "transparent" }} />
          <p className="font-medium" style={{ color: "#5A5A5A", fontFamily: "Archivo, sans-serif" }}>Chargement de Lakoud Delivery…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "#FAFAF8" }}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* ── Top navbar ──────────────────────────────────────────────────────── */}
      <nav className="bg-white px-3 md:px-4 py-2 md:py-3 flex items-center justify-between z-50 flex-shrink-0 gap-2" style={{ borderBottom: "1px solid #E8E8E8" }}>
        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <LakouLogo size={34} variant="full" />
        </div>

        {/* Stats bar — scrollable, hidden on very small screens */}
        <div className="flex-1 mx-2 md:mx-6 overflow-x-auto hidden sm:block">
          <StatsBar stats={stats} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={fetchAll}
            className="p-2 rounded-lg transition-colors"
            style={{ color: "#5A5A5A", background: "transparent" }}
            title="Actualiser"
          >
            <RefreshCw size={15} />
          </button>
          <NotificationBell activeAlerts={activeAlerts.length} />

          {/* ── Courses button — toujours visible sur mobile ── */}
          <button
            onClick={() => setMobileTab("deliveries")}
            className="md:hidden relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors"
            style={{ background: mobileTab === "deliveries" ? "#FF3B2F" : "rgba(255,59,47,0.08)", color: mobileTab === "deliveries" ? "#FFFFFF" : "#FF3B2F", fontFamily: "Archivo, sans-serif", fontWeight: 700, border: "none", cursor: "pointer" }}
          >
            <Package size={16} />
            Courses
            {pendingDeliveries > 0 && (
              <span className="w-4 h-4 text-white text-xs rounded-full flex items-center justify-center leading-none font-bold" style={{ background: "#FF3B2F" }}>
                {pendingDeliveries > 9 ? "9+" : pendingDeliveries}
              </span>
            )}
          </button>

          <Link
            href="/marchands"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full transition-colors"
            style={{ background: "#0A0A0A", color: "#FFFFFF", fontFamily: "Archivo, sans-serif", fontWeight: 700 }}
          >
            <Store size={13} />
            Marchands
          </Link>
          <Link
            href="/couriers"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full transition-colors"
            style={{ background: "#FF3B2F", color: "#FFFFFF", fontFamily: "Archivo, sans-serif", fontWeight: 700 }}
          >
            <LayoutDashboard size={13} />
            Coursiers
          </Link>
          <Link
            href="/marchands"
            className="sm:hidden p-2 rounded-lg transition-colors"
            style={{ color: "#0A0A0A" }}
            title="Marchands"
          >
            <Store size={18} />
          </Link>
          <Link
            href="/couriers"
            className="sm:hidden p-2 rounded-lg transition-colors"
            style={{ color: "#FF3B2F" }}
            title="Coursiers"
          >
            <LayoutDashboard size={18} />
          </Link>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg transition-colors"
            style={{ color: "#8A8A8A" }}
            title="Se déconnecter"
          >
            <LogOut size={15} />
          </button>
        </div>
      </nav>

      {/* Stats bar mobile (visible sous sm) */}
      <div className="sm:hidden bg-white px-3 py-1.5 overflow-x-auto" style={{ borderBottom: "1px solid #E8E8E8" }}>
        <StatsBar stats={stats} />
      </div>

      {/* ── Desktop layout (md+) : 3 colonnes ──────────────────────────────── */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        {/* Gauche : coursiers */}
        <div className="w-64 flex-shrink-0 border-r border-gray-200">
          <CourierPanel
            couriers={couriers}
            selectedId={selectedCourierId}
            onSelect={(c) => setSelectedCourierId(c.id === selectedCourierId ? null : c.id)}
            onOpenDeliveries={(c) => setCourierDeliveriesOpen(c)}
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
                onOpenDeliveries={(c) => setCourierDeliveriesOpen(c)}
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
        <nav className="absolute bottom-0 left-0 right-0 bg-white flex z-50 safe-area-pb" style={{ borderTop: "1px solid #E8E8E8" }}>
          <button
            onClick={() => setMobileTab("map")}
            className="flex-1 flex flex-col items-center py-2 gap-0.5 text-xs font-medium transition-colors"
            style={{ color: mobileTab === "map" ? "#FF3B2F" : "#8A8A8A" }}
          >
            <MapIcon size={20} />
            <span>Carte</span>
          </button>

          <button
            onClick={() => setMobileTab("couriers")}
            className="flex-1 flex flex-col items-center py-2 gap-0.5 text-xs font-medium transition-colors relative"
            style={{ color: mobileTab === "couriers" ? "#FF3B2F" : "#8A8A8A" }}
          >
            <Users size={20} />
            <span>Coursiers</span>
            {couriers.filter((c) => c.status !== "offline").length > 0 && (
              <span className="absolute top-1.5 right-[calc(50%-16px)] w-4 h-4 text-white text-xs rounded-full flex items-center justify-center leading-none" style={{ background: "#B8FF3E", color: "#0A0A0A" }}>
                {couriers.filter((c) => c.status !== "offline").length}
              </span>
            )}
          </button>

          <button
            onClick={() => setMobileTab("deliveries")}
            className="flex-1 flex flex-col items-center py-2 gap-0.5 text-xs font-medium transition-colors relative"
            style={{ color: mobileTab === "deliveries" ? "#FF3B2F" : "#8A8A8A" }}
          >
            <Package size={20} />
            <span>Livraisons</span>
            {pendingDeliveries > 0 && (
              <span className="absolute top-1.5 right-[calc(50%-16px)] w-4 h-4 text-white text-xs rounded-full flex items-center justify-center leading-none" style={{ background: "#FF3B2F" }}>
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
      {courierDeliveriesOpen && (
        <CourierDeliveriesModal
          courier={courierDeliveriesOpen}
          allCouriers={couriers}
          onClose={() => setCourierDeliveriesOpen(null)}
          onAssign={(id, cid) => { handleAssign(id, cid); setCourierDeliveriesOpen(null); }}
          onStatusChange={(id, action) => { handleStatusChange(id, action); setCourierDeliveriesOpen(null); }}
          onConfirmLocation={handleConfirmLocation}
          onConfirmPickup={handleConfirmPickup}
        />
      )}
    </div>
  );
}
