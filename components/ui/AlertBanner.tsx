"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Alert } from "@/lib/types";
import { getPusherClient, ADMIN_CHANNEL, EVENTS } from "@/lib/pusher-client";
import { AlertTriangle, X, Clock, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";

interface Props {
  initialAlerts: Alert[];
}

// Une alerte fraîchement reçue reste affichée en toast ce temps-là,
// puis se replie dans la pastille compacte pour libérer la carte.
const TOAST_DURATION_MS = 8000;
const MAX_TOASTS = 3;

const severityStyles = {
  critical: { background: "#FF3B2F", color: "#FFFFFF", border: "1px solid #C8251A", borderLeft: "4px solid #C8251A" },
  warning:  { background: "#FFFFFF", color: "#0A0A0A", border: "1px solid rgba(255,184,0,0.3)", borderLeft: "4px solid #FFB800" },
  info:     { background: "#FFFFFF", color: "#0A0A0A", border: "1px solid #E8E8E8", borderLeft: "4px solid #0A0A0A" },
};

const alertIcons = {
  unauthorized_pause: <Clock size={14} />,
  route_deviation: <AlertTriangle size={14} />,
  speed_violation: <AlertTriangle size={14} />,
  offline: <AlertTriangle size={14} />,
  acknowledged: <CheckCircle size={14} />,
};

// Une seule entrée par coursier + type d'alerte (la plus récente),
// pour éviter les doublons visuels quand le serveur en recrée une.
function dedupeAlerts(alerts: Alert[]): Alert[] {
  const byKey = new Map<string, Alert>();
  for (const a of alerts) {
    const key = `${a.courierId}:${a.type}`;
    const existing = byKey.get(key);
    if (!existing || new Date(a.createdAt) > new Date(existing.createdAt)) {
      byKey.set(key, a);
    }
  }
  return [...byKey.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function AlertCard({ alert, onResolve }: { alert: Alert; onResolve: (id: string) => void }) {
  return (
    <div
      className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl shadow-lg w-full"
      style={severityStyles[alert.severity as keyof typeof severityStyles] ?? severityStyles.warning}
    >
      <span className="flex-shrink-0 mt-0.5">
        {alertIcons[alert.type as keyof typeof alertIcons] ?? <AlertTriangle size={14} />}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-xs">{alert.courier?.name ?? "Coursier"}</div>
        <div className="text-xs opacity-90 mt-0.5 break-words">{alert.message}</div>
        <div className="text-[11px] opacity-70 mt-0.5">
          {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true, locale: fr })}
        </div>
      </div>
      <button
        onClick={() => onResolve(alert.id)}
        className="flex-shrink-0 opacity-70 hover:opacity-100"
        title="Résoudre l'alerte"
      >
        <X size={15} />
      </button>
    </div>
  );
}

export function AlertBanner({ initialAlerts }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>(initialAlerts.filter((a) => !a.resolved));
  const [expanded, setExpanded] = useState(false);
  // ids des alertes fraîchement reçues, affichées temporairement en toast
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const toastTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timer = toastTimers.current.get(id);
    if (timer) clearTimeout(timer);
    toastTimers.current.delete(id);
    setFreshIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  useEffect(() => {
    const client = getPusherClient();
    const channel = client.subscribe(ADMIN_CHANNEL);

    channel.bind(EVENTS.ALERTS_NEW, (alert: Alert) => {
      setAlerts((prev) => {
        if (prev.some((a) => a.id === alert.id)) return prev;
        return [alert, ...prev];
      });
      // Toast temporaire, puis repli automatique dans la pastille
      setFreshIds((prev) => new Set(prev).add(alert.id));
      const timer = setTimeout(() => dismissToast(alert.id), TOAST_DURATION_MS);
      toastTimers.current.set(alert.id, timer);
    });

    channel.bind(EVENTS.ALERTS_UPDATED, (updated: Alert) => {
      if (updated.resolved) {
        setAlerts((prev) => prev.filter((a) => a.id !== updated.id));
        dismissToast(updated.id);
      } else {
        setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      }
    });

    const timers = toastTimers.current;
    return () => {
      channel.unbind(EVENTS.ALERTS_NEW);
      channel.unbind(EVENTS.ALERTS_UPDATED);
      client.unsubscribe(ADMIN_CHANNEL);
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, [dismissToast]);

  const resolveAlert = async (id: string) => {
    dismissToast(id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    await fetch(`/api/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved: true }),
    });
  };

  const visibleAlerts = dedupeAlerts(alerts);
  if (visibleAlerts.length === 0) return null;

  const toasts = visibleAlerts.filter((a) => freshIds.has(a.id)).slice(0, MAX_TOASTS);
  const hasCritical = visibleAlerts.some((a) => a.severity === "critical");

  return (
    <div className="absolute top-3 right-3 z-[1000] flex flex-col items-end gap-2 w-[300px] max-w-[calc(100vw-24px)] pointer-events-none [&>*]:pointer-events-auto">
      {/* Pastille compacte — seul élément permanent, ne masque pas la carte */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-lg text-xs font-bold"
        style={{
          background: hasCritical ? "#FF3B2F" : "#FFFFFF",
          color: hasCritical ? "#FFFFFF" : "#0A0A0A",
          border: hasCritical ? "1px solid #C8251A" : "1px solid rgba(255,184,0,0.5)",
          fontFamily: "Archivo, sans-serif",
        }}
        title={expanded ? "Réduire les alertes" : "Voir les alertes"}
      >
        <AlertTriangle size={13} />
        {visibleAlerts.length} alerte{visibleAlerts.length > 1 ? "s" : ""}
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {/* Panneau déplié : liste scrollable, hauteur bornée */}
      {expanded && (
        <div
          className="w-full rounded-xl shadow-xl overflow-hidden flex flex-col"
          style={{ background: "#FFFFFF", border: "1px solid #E8E8E8" }}
        >
          <div className="flex flex-col gap-1.5 p-2 overflow-y-auto" style={{ maxHeight: "45vh" }}>
            {visibleAlerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} onResolve={resolveAlert} />
            ))}
          </div>
          <Link
            href="/alerts"
            className="text-center text-xs font-semibold py-2"
            style={{ borderTop: "1px solid #E8E8E8", color: "#FF3B2F", fontFamily: "Archivo, sans-serif" }}
          >
            Voir toutes les alertes →
          </Link>
        </div>
      )}

      {/* Toasts des nouvelles alertes — disparaissent seuls après quelques secondes */}
      {!expanded &&
        toasts.map((alert) => <AlertCard key={alert.id} alert={alert} onResolve={resolveAlert} />)}
    </div>
  );
}

export function AlertsCounter({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{count}</span>
  );
}
