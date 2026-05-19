"use client";

import { useState, useEffect, useCallback } from "react";
import type { Alert } from "@/lib/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getPusherClient, ADMIN_CHANNEL, EVENTS } from "@/lib/pusher-client";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertTriangle, Clock, MapPin, CheckCircle, ArrowLeft,
  Bell, Package, Bike, Truck, BellOff,
} from "lucide-react";
import Link from "next/link";

// ── Delivery notification stored in localStorage ──────────────────────────
const LS_KEY = "lakou_admin_delivery_notifs";
const MAX_STORED = 100;

interface DeliveryNotif {
  id: string;
  kind: "acknowledged" | "picked_up" | "delivered";
  courierName: string;
  orderNumber: string;
  customerName?: string;
  createdAt: string;
  read: boolean;
}

function loadDeliveryNotifs(): DeliveryNotif[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
  } catch { return []; }
}

function saveDeliveryNotifs(notifs: DeliveryNotif[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(notifs.slice(0, MAX_STORED)));
}

// ── Unified feed item ─────────────────────────────────────────────────────
type FeedItem =
  | { kind: "alert"; data: Alert }
  | { kind: "notif"; data: DeliveryNotif };

// ── Config maps ───────────────────────────────────────────────────────────
const alertTypeLabels: Record<string, string> = {
  unauthorized_pause: "Pause non autorisée",
  route_deviation: "Déviation d'itinéraire",
  speed_violation: "Infraction de vitesse",
  offline: "Hors connexion",
};

const notifConfig: Record<DeliveryNotif["kind"], { label: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
  acknowledged: {
    label: "Course acceptée",
    icon: <CheckCircle size={15} />,
    color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0",
  },
  picked_up: {
    label: "Colis récupéré",
    icon: <Package size={15} />,
    color: "#d97706", bg: "#fffbeb", border: "#fde68a",
  },
  delivered: {
    label: "Livraison terminée",
    icon: <Truck size={15} />,
    color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe",
  },
};

type Tab = "all" | "alerts" | "notifs";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [deliveryNotifs, setDeliveryNotifs] = useState<DeliveryNotif[]>([]);
  const [alertFilter, setAlertFilter] = useState<"active" | "all" | "resolved">("active");
  const [tab, setTab] = useState<Tab>("all");
  const [loading, setLoading] = useState(true);

  // Load delivery notifs from localStorage
  useEffect(() => {
    setDeliveryNotifs(loadDeliveryNotifs());
  }, []);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    const params = alertFilter === "all" ? "" : `?resolved=${alertFilter === "resolved"}`;
    const res = await fetch(`/api/alerts${params}`);
    if (res.ok) setAlerts(await res.json());
    setLoading(false);
  }, [alertFilter]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  // Real-time Pusher events
  useEffect(() => {
    const client = getPusherClient();
    const channel = client.subscribe(ADMIN_CHANNEL);

    channel.bind(EVENTS.ALERTS_NEW, (alert: Alert) => {
      setAlerts((prev) => prev.some((a) => a.id === alert.id) ? prev : [alert, ...prev]);
    });

    channel.bind(EVENTS.ALERTS_UPDATED, (updated: Alert) => {
      if (updated.resolved) {
        setAlerts((prev) => prev.filter((a) => a.id !== updated.id));
      } else {
        setAlerts((prev) => prev.map((a) => a.id === updated.id ? updated : a));
      }
    });

    // Courier accepted a delivery
    channel.bind(EVENTS.DELIVERY_ACKNOWLEDGED, (data: { courierName: string; orderNumber: string; customerName: string }) => {
      const notif: DeliveryNotif = {
        id: `ack-${Date.now()}`,
        kind: "acknowledged",
        courierName: data.courierName,
        orderNumber: data.orderNumber,
        customerName: data.customerName,
        createdAt: new Date().toISOString(),
        read: false,
      };
      setDeliveryNotifs((prev) => {
        const updated = [notif, ...prev];
        saveDeliveryNotifs(updated);
        return updated;
      });
    });

    // Pickup or delivery completed
    channel.bind(EVENTS.DELIVERIES_UPDATED, (delivery: { status?: string; courier?: { name: string }; orderNumber?: string; customerName?: string }) => {
      if (!delivery.courier || !delivery.orderNumber) return;
      if (delivery.status !== "picked_up" && delivery.status !== "delivered") return;

      const notif: DeliveryNotif = {
        id: `${delivery.status}-${delivery.orderNumber}-${Date.now()}`,
        kind: delivery.status as DeliveryNotif["kind"],
        courierName: delivery.courier.name,
        orderNumber: delivery.orderNumber,
        customerName: delivery.customerName,
        createdAt: new Date().toISOString(),
        read: false,
      };
      setDeliveryNotifs((prev) => {
        const updated = [notif, ...prev];
        saveDeliveryNotifs(updated);
        return updated;
      });
    });

    return () => {
      channel.unbind_all();
      client.unsubscribe(ADMIN_CHANNEL);
    };
  }, []);

  const resolveAlert = async (id: string) => {
    await fetch(`/api/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved: true }),
    });
    fetchAlerts();
  };

  const resolveAllAlerts = async () => {
    const active = alerts.filter((a) => !a.resolved);
    await Promise.all(active.map((a) =>
      fetch(`/api/alerts/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved: true }),
      })
    ));
    fetchAlerts();
  };

  const markAllNotifsRead = () => {
    setDeliveryNotifs((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      saveDeliveryNotifs(updated);
      return updated;
    });
  };

  const clearNotifs = () => {
    setDeliveryNotifs([]);
    localStorage.removeItem(LS_KEY);
  };

  // Build unified feed
  const alertItems: FeedItem[] = alerts.map((a) => ({ kind: "alert", data: a }));
  const notifItems: FeedItem[] = deliveryNotifs.map((n) => ({ kind: "notif", data: n }));

  const feed: FeedItem[] =
    tab === "alerts" ? alertItems :
    tab === "notifs" ? notifItems :
    [...alertItems, ...notifItems].sort((a, b) => {
      const dateA = a.kind === "alert" ? a.data.createdAt : a.data.createdAt;
      const dateB = b.kind === "alert" ? b.data.createdAt : b.data.createdAt;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

  const activeAlerts = alerts.filter((a) => !a.resolved).length;
  const unreadNotifs = deliveryNotifs.filter((n) => !n.read).length;
  const totalUnread = activeAlerts + unreadNotifs;

  return (
    <div className="min-h-screen" style={{ background: "#F4F4F4" }}>
      {/* Header */}
      <div className="bg-white px-6 py-4" style={{ borderBottom: "1px solid #E8E8E8" }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 rounded-lg transition-colors" style={{ color: "#5A5A5A" }}>
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 className="font-bold flex items-center gap-2 text-lg" style={{ fontFamily: "Archivo, sans-serif", color: "#0A0A0A" }}>
                <Bell size={18} color="#FF3B2F" />
                Centre de notifications
                {totalUnread > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ background: "#FF3B2F" }}>
                    {totalUnread}
                  </span>
                )}
              </h1>
              <p className="text-xs mt-0.5" style={{ color: "#8A8A8A" }}>
                {activeAlerts > 0 ? `${activeAlerts} alerte(s) active(s) · ` : ""}
                {unreadNotifs > 0 ? `${unreadNotifs} notification(s) non lue(s)` : "Tout lu"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {tab !== "notifs" && activeAlerts > 0 && (
              <button
                onClick={resolveAllAlerts}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}
              >
                <CheckCircle size={12} /> Résoudre tout
              </button>
            )}
            {tab !== "alerts" && deliveryNotifs.length > 0 && (
              <button
                onClick={clearNotifs}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: "#F4F4F4", color: "#5A5A5A", border: "1px solid #E8E8E8" }}
              >
                <BellOff size={12} /> Effacer
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-5">
        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {([
            { key: "all",    label: "Tout",          count: totalUnread },
            { key: "alerts", label: "Alertes GPS",   count: activeAlerts,  icon: <AlertTriangle size={12} /> },
            { key: "notifs", label: "Livraisons",    count: unreadNotifs,  icon: <Bike size={12} /> },
          ] as const).map(({ key, label, count, icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors"
              style={
                tab === key
                  ? { background: "#0A0A0A", color: "#FFFFFF", fontFamily: "Archivo, sans-serif" }
                  : { background: "#FFFFFF", color: "#5A5A5A", border: "1px solid #E8E8E8" }
              }
            >
              {icon}
              {label}
              {count > 0 && (
                <span
                  className="text-xs px-1.5 py-0 rounded-full"
                  style={{
                    background: tab === key ? "rgba(255,255,255,0.2)" : "#FF3B2F",
                    color: tab === key ? "#FFFFFF" : "#FFFFFF",
                    minWidth: 18, textAlign: "center",
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          ))}

          {/* Alert sub-filter (only when on alerts tab) */}
          {tab === "alerts" && (
            <div className="flex gap-1 ml-auto">
              {(["active", "all", "resolved"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setAlertFilter(f)}
                  className="px-3 py-1 rounded-full text-xs transition-colors"
                  style={
                    alertFilter === f
                      ? { background: "#FF3B2F", color: "#FFFFFF" }
                      : { background: "#FFFFFF", color: "#5A5A5A", border: "1px solid #E8E8E8" }
                  }
                >
                  {f === "active" ? "Actives" : f === "all" ? "Toutes" : "Résolues"}
                </button>
              ))}
            </div>
          )}

          {tab === "notifs" && unreadNotifs > 0 && (
            <button
              onClick={markAllNotifsRead}
              className="ml-auto text-xs px-3 py-1 rounded-full"
              style={{ background: "#FFFFFF", color: "#5A5A5A", border: "1px solid #E8E8E8" }}
            >
              Tout marquer lu
            </button>
          )}
        </div>

        {/* Feed */}
        {loading && tab !== "notifs" ? (
          <div className="text-center py-12" style={{ color: "#8A8A8A" }}>Chargement…</div>
        ) : feed.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl" style={{ border: "1px solid #E8E8E8" }}>
            <Bell size={40} style={{ color: "#C8C8C8", margin: "0 auto 12px" }} />
            <p className="font-semibold" style={{ color: "#0A0A0A", fontFamily: "Archivo, sans-serif" }}>
              Aucune notification
            </p>
            <p className="text-sm mt-1" style={{ color: "#8A8A8A" }}>
              Tout est calme pour l&apos;instant
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {feed.map((item, i) =>
              item.kind === "alert"
                ? <AlertCard key={item.data.id + i} alert={item.data} onResolve={resolveAlert} />
                : <NotifCard key={item.data.id + i} notif={item.data} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Alert card ────────────────────────────────────────────────────────────
function AlertCard({ alert, onResolve }: { alert: Alert; onResolve: (id: string) => void }) {
  const severityColor = alert.severity === "critical" ? "#FF3B2F" : "#FFB800";
  const severityBg    = alert.severity === "critical" ? "#FFF0EE" : "#FFFBF0";
  const severityBd    = alert.severity === "critical" ? "#FFCCC8" : "#FFE8A0";

  return (
    <div
      className="bg-white rounded-xl flex items-start gap-3 p-4 transition-opacity"
      style={{
        border: `1px solid ${alert.resolved ? "#E8E8E8" : severityBd}`,
        background: alert.resolved ? "#FFFFFF" : severityBg,
        opacity: alert.resolved ? 0.55 : 1,
        borderLeft: `3px solid ${alert.resolved ? "#C8C8C8" : severityColor}`,
      }}
    >
      <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: alert.resolved ? "#F4F4F4" : severityBg, color: alert.resolved ? "#8A8A8A" : severityColor, border: `1px solid ${alert.resolved ? "#E8E8E8" : severityBd}` }}>
        <AlertTriangle size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm" style={{ color: "#0A0A0A", fontFamily: "Archivo, sans-serif" }}>
            {alert.courier?.name ?? "Coursier inconnu"}
          </span>
          <StatusBadge type="severity" value={alert.severity} />
          {alert.resolved && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>
              Résolu
            </span>
          )}
        </div>
        <p className="text-sm mt-0.5" style={{ color: "#5A5A5A" }}>
          <span className="font-medium" style={{ color: "#0A0A0A" }}>
            {alertTypeLabels[alert.type] ?? alert.type}
          </span>
          {" "}— {alert.message}
        </p>
        <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: "#8A8A8A" }}>
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true, locale: fr })}
          </span>
          <span>{format(new Date(alert.createdAt), "dd/MM HH:mm")}</span>
          {alert.resolvedAt && (
            <span style={{ color: "#16a34a" }}>
              ✓ {format(new Date(alert.resolvedAt), "dd/MM HH:mm")}
            </span>
          )}
        </div>
      </div>
      {!alert.resolved && (
        <button
          onClick={() => onResolve(alert.id)}
          className="shrink-0 flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-colors"
          style={{ background: "#FFFFFF", color: "#5A5A5A", border: "1px solid #E8E8E8" }}
        >
          <CheckCircle size={11} /> Résoudre
        </button>
      )}
    </div>
  );
}

// ── Delivery notification card ────────────────────────────────────────────
function NotifCard({ notif }: { notif: DeliveryNotif }) {
  const cfg = notifConfig[notif.kind];
  return (
    <div
      className="bg-white rounded-xl flex items-start gap-3 p-4"
      style={{
        border: `1px solid ${notif.read ? "#E8E8E8" : cfg.border}`,
        background: notif.read ? "#FFFFFF" : cfg.bg,
        borderLeft: `3px solid ${notif.read ? "#C8C8C8" : cfg.color}`,
      }}
    >
      <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
        {cfg.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm" style={{ color: "#0A0A0A", fontFamily: "Archivo, sans-serif" }}>
            {notif.courierName}
          </span>
          {!notif.read && (
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.color }} />
          )}
        </div>
        <p className="text-sm mt-0.5" style={{ color: "#5A5A5A" }}>
          <span className="font-medium" style={{ color: "#0A0A0A" }}>{cfg.label}</span>
          {" "}· <span className="font-mono text-xs">{notif.orderNumber}</span>
          {notif.customerName && <span> · {notif.customerName}</span>}
        </p>
        <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: "#8A8A8A" }}>
          <Clock size={10} />
          {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: fr })}
          <span className="ml-1">{format(new Date(notif.createdAt), "dd/MM HH:mm")}</span>
        </div>
      </div>
    </div>
  );
}
