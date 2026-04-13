"use client";

import type { CourierStatus, DeliveryStatus, AlertSeverity } from "@/lib/types";

const courierStatusConfig: Record<CourierStatus, { label: string; className: string }> = {
  offline: { label: "Hors ligne", className: "bg-gray-100 text-gray-600" },
  available: { label: "Disponible", className: "bg-green-100 text-green-700" },
  busy: { label: "En livraison", className: "bg-blue-100 text-blue-700" },
  paused: { label: "En pause", className: "bg-yellow-100 text-yellow-700" },
};

const deliveryStatusConfig: Record<DeliveryStatus, { label: string; className: string }> = {
  pending: { label: "En attente", className: "bg-gray-100 text-gray-600" },
  assigned: { label: "Assignée", className: "bg-blue-100 text-blue-700" },
  picked_up: { label: "Récupérée", className: "bg-purple-100 text-purple-700" },
  delivered: { label: "Livrée", className: "bg-green-100 text-green-700" },
  cancelled: { label: "Annulée", className: "bg-red-100 text-red-600" },
};

const severityConfig: Record<AlertSeverity, { label: string; className: string }> = {
  info: { label: "Info", className: "bg-blue-100 text-blue-700" },
  warning: { label: "Attention", className: "bg-yellow-100 text-yellow-700" },
  critical: { label: "Critique", className: "bg-red-100 text-red-700" },
};

interface Props {
  type: "courier" | "delivery" | "severity";
  value: string;
}

export function StatusBadge({ type, value }: Props) {
  let config = { label: value, className: "bg-gray-100 text-gray-600" };

  if (type === "courier") config = courierStatusConfig[value as CourierStatus] ?? config;
  if (type === "delivery") config = deliveryStatusConfig[value as DeliveryStatus] ?? config;
  if (type === "severity") config = severityConfig[value as AlertSeverity] ?? config;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
