"use client";

import type { Stats } from "@/lib/types";
import { Users, Package, Truck, CheckCircle, AlertTriangle, Clock } from "lucide-react";

interface Props {
  stats: Stats;
}

// Pure display: the dashboard derives the stats from the data it already
// loads, so this component no longer polls /api/stats or subscribes to Pusher.
export function StatsBar({ stats }: Props) {
  const items = [
    { icon: <Users size={14} />, label: "Actifs", value: `${stats.activeCouriers}/${stats.totalCouriers}`, style: { color: "#0A0A0A", background: "#F4F4F4" } },
    { icon: <Clock size={14} />, label: "En attente", value: stats.pendingDeliveries, style: { color: stats.pendingDeliveries > 0 ? "#FF3B2F" : "#5A5A5A", background: stats.pendingDeliveries > 0 ? "rgba(255,59,47,0.08)" : "#F4F4F4" } },
    { icon: <Truck size={14} />, label: "En cours", value: stats.activeDeliveries, style: { color: "#0A0A0A", background: "#F4F4F4" } },
    { icon: <CheckCircle size={14} />, label: "Livrées auj.", value: stats.deliveredToday, style: { color: "#FFFFFF", background: "#0A0A0A" } },
    { icon: <AlertTriangle size={14} />, label: "Alertes", value: stats.activeAlerts, style: { color: stats.activeAlerts > 0 ? "#FF3B2F" : "#8A8A8A", background: stats.activeAlerts > 0 ? "rgba(255,59,47,0.08)" : "#F4F4F4" } },
  ];

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-2 px-3 py-2 rounded-xl flex-shrink-0"
          style={item.style}
        >
          <span style={{ opacity: 0.7, display: "flex" }}>{item.icon}</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "Archivo, sans-serif", lineHeight: 1 }}>{item.value}</div>
            <div style={{ fontSize: 10, opacity: 0.65, marginTop: 1, textTransform: "uppercase" as const, letterSpacing: "0.06em", fontWeight: 600 }}>{item.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
