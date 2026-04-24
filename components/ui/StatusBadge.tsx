"use client";

import type { CourierStatus, DeliveryStatus, AlertSeverity } from "@/lib/types";

const courierStatusConfig: Record<CourierStatus, { label: string; dotColor: string; bg: string; color: string }> = {
  offline:   { label: "Hors ligne",   dotColor: "#C8C8C8", bg: "#F4F4F4",                  color: "#8A8A8A" },
  available: { label: "Disponible",   dotColor: "#B8FF3E", bg: "rgba(184,255,62,0.15)",     color: "#3a7d00" },
  busy:      { label: "En livraison", dotColor: "#FF3B2F", bg: "rgba(255,59,47,0.1)",       color: "#FF3B2F" },
  paused:    { label: "En pause",     dotColor: "#FFB800", bg: "rgba(255,184,0,0.15)",      color: "#8a5e00" },
};

const deliveryStatusConfig: Record<DeliveryStatus, { label: string; bg: string; color: string }> = {
  pending:   { label: "En attente", bg: "#F4F4F4",                       color: "#5A5A5A" },
  assigned:  { label: "Assignée",   bg: "rgba(59,130,246,0.1)",          color: "#1d4ed8" },
  picked_up: { label: "Récupérée",  bg: "rgba(139,92,246,0.1)",          color: "#6d28d9" },
  delivered: { label: "Livrée",     bg: "rgba(184,255,62,0.2)",          color: "#3a7d00" },
  cancelled: { label: "Annulée",    bg: "rgba(255,59,47,0.1)",           color: "#FF3B2F" },
};

const severityConfig: Record<AlertSeverity, { label: string; bg: string; color: string }> = {
  info:     { label: "Info",     bg: "rgba(59,130,246,0.1)",   color: "#1d4ed8" },
  warning:  { label: "Attention",bg: "rgba(255,184,0,0.15)",   color: "#8a5e00" },
  critical: { label: "Critique", bg: "rgba(255,59,47,0.1)",    color: "#FF3B2F" },
};

interface Props {
  type: "courier" | "delivery" | "severity";
  value: string;
}

export function StatusBadge({ type, value }: Props) {
  if (type === "courier") {
    const s = courierStatusConfig[value as CourierStatus] ?? courierStatusConfig.offline;
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px 3px 6px", borderRadius: 999, background: s.bg }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.dotColor, display: "inline-block", flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: s.color, fontFamily: "Inter, sans-serif" }}>{s.label}</span>
      </span>
    );
  }

  if (type === "delivery") {
    const s = deliveryStatusConfig[value as DeliveryStatus] ?? deliveryStatusConfig.pending;
    return (
      <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, background: s.bg, fontSize: 11, fontWeight: 600, color: s.color }}>
        {s.label}
      </span>
    );
  }

  const s = severityConfig[value as AlertSeverity] ?? severityConfig.info;
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, background: s.bg, fontSize: 11, fontWeight: 600, color: s.color }}>
      {s.label}
    </span>
  );
}
