"use client";

import { useState, useEffect } from "react";
import type { Alert } from "@/lib/types";
import { getPusherClient, ADMIN_CHANNEL, EVENTS } from "@/lib/pusher-client";
import { AlertTriangle, X, Clock, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  initialAlerts: Alert[];
}

export function AlertBanner({ initialAlerts }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>(initialAlerts.filter((a) => !a.resolved));

  useEffect(() => {
    const client = getPusherClient();
    const channel = client.subscribe(ADMIN_CHANNEL);

    channel.bind(EVENTS.ALERTS_NEW, (alert: Alert) => {
      setAlerts((prev) => {
        if (prev.some((a) => a.id === alert.id)) return prev;
        return [alert, ...prev];
      });
    });

    channel.bind(EVENTS.ALERTS_UPDATED, (updated: Alert) => {
      if (updated.resolved) {
        setAlerts((prev) => prev.filter((a) => a.id !== updated.id));
      } else {
        setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      }
    });

    return () => {
      channel.unbind(EVENTS.ALERTS_NEW);
      channel.unbind(EVENTS.ALERTS_UPDATED);
      client.unsubscribe(ADMIN_CHANNEL);
    };
  }, []);

  const resolveAlert = async (id: string) => {
    await fetch(`/api/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved: true }),
    });
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  if (alerts.length === 0) return null;

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

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex flex-col gap-2 w-full max-w-lg px-4">
      {alerts.slice(0, 5).map((alert) => (
        <div
          key={alert.id}
          className="flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg"
          style={severityStyles[alert.severity as keyof typeof severityStyles] ?? severityStyles.warning}
        >
          <span className="flex-shrink-0 mt-0.5">
            {alertIcons[alert.type as keyof typeof alertIcons] ?? <AlertTriangle size={14} />}
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">{alert.courier?.name ?? "Coursier"}</div>
            <div className="text-xs opacity-90 mt-0.5">{alert.message}</div>
            <div className="text-xs opacity-70 mt-0.5">
              {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true, locale: fr })}
            </div>
          </div>
          <button onClick={() => resolveAlert(alert.id)} className="flex-shrink-0 opacity-70 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      ))}
      {alerts.length > 5 && (
        <div className="text-center text-xs text-gray-500 bg-white/80 rounded-lg py-1">
          +{alerts.length - 5} autres alertes
        </div>
      )}
    </div>
  );
}

export function AlertsCounter({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{count}</span>
  );
}
