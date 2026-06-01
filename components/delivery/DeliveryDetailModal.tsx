"use client";

import { useState } from "react";
import type { Courier, Delivery } from "@/lib/types";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  X, MapPin, Package, Phone, Clock, Truck, FileText,
  AlertTriangle, User, CheckCircle, XCircle,
  Trash2, Copy, Check, ChevronDown, Pencil,
} from "lucide-react";
import { LocationPickerModal } from "./LocationPickerModal";

interface Props {
  delivery: Delivery;
  couriers: Courier[];
  onClose: () => void;
  onEdit?: () => void;
  onAssign: (deliveryId: string, courierId: string) => void;
  onStatusChange: (deliveryId: string, action: string) => void;
  onConfirmLocation?: (deliveryId: string, lat: number, lng: number) => void;
  onConfirmPickup?: (deliveryId: string, lat: number, lng: number) => void;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending:   { label: "En attente", color: "text-yellow-600 bg-yellow-50"  },
  assigned:  { label: "Assignée",   color: "text-blue-600 bg-blue-50"      },
  confirmed: { label: "Acceptée",   color: "text-emerald-600 bg-emerald-50" },
  picked_up: { label: "En route",   color: "text-purple-600 bg-purple-50"  },
  delivered: { label: "Livrée",     color: "text-green-600 bg-green-50"    },
  cancelled: { label: "Annulée",    color: "text-gray-500 bg-gray-100"     },
};

const PRIORITY_OPTIONS = [
  { value: 0, label: "Normale",  color: "text-gray-600 bg-gray-100",    dot: "bg-gray-400"   },
  { value: 1, label: "Haute",    color: "text-orange-600 bg-orange-50", dot: "bg-orange-500" },
  { value: 2, label: "Urgente",  color: "text-red-600 bg-red-50",       dot: "bg-red-500"    },
];

export function DeliveryDetailModal({
  delivery, couriers, onClose, onEdit, onAssign, onStatusChange, onConfirmLocation, onConfirmPickup,
}: Props) {
  const [assigning, setAssigning]             = useState(false);
  const [pickingLocation, setPickingLocation] = useState<"pickup" | "delivery" | null>(null);

  // Priority editing
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [currentPriority, setCurrentPriority]       = useState(delivery.priority ?? 0);
  const [savingPriority, setSavingPriority]         = useState(false);

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]           = useState(false);

  // Copy order number
  const [copied, setCopied] = useState(false);

  const available = couriers.filter((c) => ["available", "busy"].includes(c.status));
  const status    = STATUS_META[delivery.status] ?? STATUS_META.pending;
  const priorityMeta = PRIORITY_OPTIONS.find((p) => p.value === currentPriority) ?? PRIORITY_OPTIONS[0];
  const isLibre   = !delivery.merchantId;
  const isActive  = ["pending", "assigned", "picked_up"].includes(delivery.status);

  const savePriority = async (newPriority: number) => {
    setSavingPriority(true);
    try {
      const res = await fetch(`/api/deliveries/${delivery.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-priority", priority: newPriority }),
      });
      if (res.ok) setCurrentPriority(newPriority);
    } finally {
      setSavingPriority(false);
      setShowPriorityPicker(false);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await fetch(`/api/deliveries/${delivery.id}`, { method: "DELETE" });
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  const copyOrderNumber = () => {
    navigator.clipboard.writeText(delivery.orderNumber).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const doAssign = (courierId: string) => { onAssign(delivery.id, courierId); onClose(); };
  const doAction = (action: string)    => { onStatusChange(delivery.id, action); onClose(); };

  return (
    <>
      <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
        <div
          className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          style={{ maxHeight: "92vh" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {/* Status + priority badges row */}
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status.color}`}>
                    {status.label}
                  </span>

                  {/* Priority badge — clickable for admin */}
                  <div className="relative">
                    <button
                      onClick={() => isActive && setShowPriorityPicker((v) => !v)}
                      disabled={!isActive || savingPriority}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 transition-opacity ${priorityMeta.color} ${isActive ? "hover:opacity-80 cursor-pointer" : "cursor-default"}`}
                    >
                      {currentPriority > 0 && <span>⚡</span>}
                      {priorityMeta.label}
                      {isActive && <ChevronDown size={10} className="opacity-50" />}
                    </button>

                    {showPriorityPicker && (
                      <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-10 w-36">
                        {PRIORITY_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => savePriority(opt.value)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors text-left ${currentPriority === opt.value ? "font-bold" : ""}`}
                          >
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${opt.dot}`} />
                            <span className={opt.value === currentPriority ? "text-gray-900" : "text-gray-600"}>{opt.label}</span>
                            {currentPriority === opt.value && <Check size={12} className="ml-auto text-gray-400" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {delivery.locationConfirmed === false && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-amber-700 bg-amber-50">
                      📍 À localiser
                    </span>
                  )}
                  {isLibre && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-purple-700 bg-purple-50">
                      💬 Commande libre
                    </span>
                  )}
                </div>

                <h2 className="font-bold text-gray-900 text-lg leading-tight">{delivery.customerName}</h2>

                {/* Order number — copyable */}
                <button
                  onClick={copyOrderNumber}
                  className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-400 font-mono hover:text-gray-600 transition-colors group"
                >
                  <span>{delivery.orderNumber}</span>
                  {copied
                    ? <Check size={11} className="text-green-500" />
                    : <Copy size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
                </button>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {onEdit && (
                  <button
                    onClick={onEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:bg-indigo-50"
                    style={{ color: "#6366F1", border: "1px solid #E0E0FF" }}
                  >
                    <Pencil size={12} /> Modifier
                  </button>
                )}
                <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors ml-1">
                  <X size={20} className="text-gray-500" />
                </button>
              </div>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto" style={{ background: "#F7F7F7" }}>
          <div className="p-4 space-y-3">

            {/* ── Info bar ───────────────────────────────────────────── */}
            <div className="flex items-center gap-2 flex-wrap">
              {delivery.customerPhone && (
                <a href={`tel:${delivery.customerPhone}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                  style={{ background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" }}>
                  <Phone size={11} /> {delivery.customerPhone}
                </a>
              )}
              <span className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full"
                style={{ background: "#F4F4F4", color: "#6B7280" }}>
                <Clock size={10} />
                {formatDistanceToNow(new Date(delivery.createdAt), { addSuffix: true, locale: fr })}
              </span>
              {delivery.distance && (
                <span className="text-xs px-2.5 py-1.5 rounded-full font-medium"
                  style={{ background: "#F4F4F4", color: "#6B7280" }}>
                  {delivery.distance} km
                </span>
              )}
              {delivery.price != null && (
                <span className="text-xs px-2.5 py-1.5 rounded-full font-bold"
                  style={{ background: "#F0FDF4", color: "#15803D", border: "1px solid #BBF7D0" }}>
                  {delivery.price.toFixed(2)} DT
                </span>
              )}
            </div>

            {/* ── Route card ─────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #EEEEEE" }}>
              {/* Collecte */}
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center pt-0.5">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ background: "#6366F1" }}>C</div>
                    <div className="w-0.5 mt-1.5 mb-1" style={{ height: 28, background: "linear-gradient(to bottom, #6366F1, #EF4444)" }} />
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <p className="text-xs font-bold mb-0.5" style={{ color: "#6366F1" }}>COLLECTE</p>
                    <p className="text-sm font-semibold" style={{ color: "#111827" }}>{delivery.pickupAddress}</p>
                  </div>
                </div>

                {/* Livraison */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: delivery.locationConfirmed === false ? "#FEF3C7" : "#FEE2E2", border: "2px solid white" }}>
                    <MapPin size={14} style={{ color: delivery.locationConfirmed === false ? "#D97706" : "#EF4444" }} />
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-xs font-bold" style={{ color: "#EF4444" }}>LIVRAISON</p>
                      {delivery.locationConfirmed === false && (
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ background: "#FEF3C7", color: "#D97706" }}>À localiser</span>
                      )}
                    </div>
                    <p className="text-sm font-semibold whitespace-pre-wrap" style={{ color: "#111827" }}>{delivery.deliveryAddress}</p>
                    {onConfirmLocation && (
                      <button onClick={() => setPickingLocation("delivery")}
                        className="flex items-center gap-1.5 text-xs font-semibold mt-1.5 px-3 py-1.5 rounded-lg transition-colors"
                        style={delivery.locationConfirmed === false
                          ? { background: "#EA580C", color: "#fff" }
                          : { border: "1px solid #E5E7EB", color: "#5A5A5A" }}>
                        <MapPin size={11} />
                        {delivery.locationConfirmed === false ? "Localiser sur la carte" : "Modifier position"}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes & instructions */}
              {(delivery.notes || delivery.deliveryDescription) && (
                <div className="px-4 pb-4 space-y-2" style={{ borderTop: "1px solid #F5F5F5", paddingTop: 12 }}>
                  {delivery.notes && (
                    <div className="flex items-start gap-2">
                      <FileText size={12} className="shrink-0 mt-0.5" style={{ color: "#9CA3AF" }} />
                      <p className="text-xs whitespace-pre-wrap" style={{ color: "#374151" }}>{delivery.notes}</p>
                    </div>
                  )}
                  {delivery.deliveryDescription && (
                    <div className="flex items-start gap-2 rounded-lg px-2.5 py-2"
                      style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
                      <AlertTriangle size={11} className="shrink-0 mt-0.5" style={{ color: "#D97706" }} />
                      <p className="text-xs whitespace-pre-wrap" style={{ color: "#92400E" }}>{delivery.deliveryDescription}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Coursier ───────────────────────────────────────────── */}
            {delivery.courier && (
              <div className="bg-white rounded-2xl shadow-sm px-4 py-3 flex items-center gap-3"
                style={{ border: "1px solid #EEEEEE" }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ background: "#6366F1" }}>
                  {delivery.courier.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold" style={{ color: "#8A8A8A" }}>COURSIER ASSIGNÉ</p>
                  <p className="text-sm font-semibold truncate" style={{ color: "#111827" }}>{delivery.courier.name}</p>
                </div>
                {delivery.courier.phone && (
                  <a href={`tel:${delivery.courier.phone}`}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                    style={{ background: "#EFF6FF", color: "#2563EB" }}>
                    <Phone size={11} /> Appeler
                  </a>
                )}
              </div>
            )}

            {/* ── Assigner / Changer ─────────────────────────────────── */}
            {isActive && (
              <div className="space-y-2">
                {delivery.status === "pending" && isLibre && delivery.pickupAddress === "Better Call Motaz" && (
                  <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs"
                    style={{ background: "#FFFBEB", border: "1px solid #FDE68A", color: "#92400E" }}>
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" style={{ color: "#D97706" }} />
                    Renseignez le partenaire de collecte avant d&apos;assigner un coursier.
                  </div>
                )}
                {!assigning ? (
                  <button onClick={() => setAssigning(true)}
                    disabled={delivery.status === "pending" && isLibre && delivery.pickupAddress === "Better Call Motaz"}
                    className="w-full flex items-center justify-center gap-2 font-bold rounded-xl py-3 text-sm transition-colors disabled:opacity-40"
                    style={{ background: "#0A0A0A", color: "#fff" }}>
                    <User size={15} />
                    {delivery.courier ? "Changer de coursier" : "Assigner un coursier"}
                  </button>
                ) : (
                  <div className="bg-white rounded-2xl shadow-sm p-3 space-y-2" style={{ border: "1px solid #EEEEEE" }}>
                    <p className="text-xs font-bold" style={{ color: "#5A5A5A" }}>
                      {delivery.courier ? "Choisir un nouveau coursier :" : "Choisir un coursier :"}
                    </p>
                    {available.length === 0 && (
                      <p className="text-xs py-2 text-center" style={{ color: "#9CA3AF" }}>Aucun coursier disponible</p>
                    )}
                    {available.map(c => (
                      <button key={c.id} onClick={() => doAssign(c.id)}
                        className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
                        style={{
                          border: delivery.courier?.id === c.id ? "2px solid #6366F1" : "1px solid #E5E7EB",
                          background: delivery.courier?.id === c.id ? "#F5F3FF" : "#FAFAFA",
                        }}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                          style={{ background: c.status === "available" ? "#22C55E" : "#6366F1" }}>
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-semibold" style={{ color: "#111827" }}>{c.name}</p>
                          <p className="text-xs" style={{ color: "#9CA3AF" }}>
                            {c.status === "available" ? "✓ Disponible" : `En course (${c.deliveries?.length ?? 0})`}
                          </p>
                        </div>
                        {delivery.courier?.id === c.id && (
                          <Check size={14} style={{ color: "#6366F1" }} />
                        )}
                      </button>
                    ))}
                    <button onClick={() => setAssigning(false)}
                      className="w-full text-xs py-1.5 rounded-lg transition-colors"
                      style={{ color: "#9CA3AF" }}>
                      Annuler
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Timeline ───────────────────────────────────────────── */}
            {(() => {
              const steps: {
                key: string;
                label: string;
                sublabel: string;
                at: string | null | undefined;
                icon: string;
                iconBg: string;
                iconColor: string;
                lineColor: string;
                warnAfterMin?: number; // alerte si durée > seuil
              }[] = [
                {
                  key: "created",
                  label: "Créée",
                  sublabel: "Commande enregistrée",
                  at: delivery.createdAt,
                  icon: "📋",
                  iconBg: "#F4F4F4",
                  iconColor: "#6B7280",
                  lineColor: "#D1D5DB",
                },
                {
                  key: "assigned",
                  label: "Assignée",
                  sublabel: delivery.courier ? `à ${delivery.courier.name}` : "Coursier assigné",
                  at: delivery.assignedAt,
                  icon: "👤",
                  iconBg: "#EFF6FF",
                  iconColor: "#2563EB",
                  lineColor: "#BFDBFE",
                  warnAfterMin: 15,
                },
                {
                  key: "confirmed",
                  label: "Acceptée",
                  sublabel: "Le coursier a accepté",
                  at: delivery.confirmedAt,
                  icon: "✅",
                  iconBg: "#ECFDF5",
                  iconColor: "#059669",
                  lineColor: "#A7F3D0",
                  warnAfterMin: 10,
                },
                {
                  key: "picked_up",
                  label: "Collectée",
                  sublabel: "Colis récupéré",
                  at: delivery.pickedUpAt,
                  icon: "📦",
                  iconBg: "#F5F3FF",
                  iconColor: "#7C3AED",
                  lineColor: "#DDD6FE",
                  warnAfterMin: 45,
                },
                {
                  key: "delivered",
                  label: delivery.status === "cancelled" ? "Annulée" : "Livrée",
                  sublabel: delivery.status === "cancelled" ? "Course annulée" : "Livraison confirmée",
                  at: delivery.deliveredAt,
                  icon: delivery.status === "cancelled" ? "❌" : "🏠",
                  iconBg: delivery.status === "cancelled" ? "#FEF2F2" : "#F0FDF4",
                  iconColor: delivery.status === "cancelled" ? "#DC2626" : "#16A34A",
                  lineColor: "#D1D5DB",
                },
              ];

              // Statut "actif" = le dernier step ayant un timestamp
              const statusOrder = ["created", "assigned", "confirmed", "picked_up", "delivered"];
              const currentStatusKey = (() => {
                const s = delivery.status;
                if (s === "pending")   return "created";
                if (s === "assigned")  return "assigned";
                if (s === "confirmed") return "confirmed";
                if (s === "picked_up") return "picked_up";
                return "delivered";
              })();
              const currentIdx = statusOrder.indexOf(currentStatusKey);

              // Calcule la durée entre deux timestamps (en minutes)
              const diffMin = (a: string, b: string) =>
                Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);

              // Timestamps ordonnés pour calculer les deltas
              const timestamps = [
                delivery.createdAt,
                delivery.assignedAt,
                delivery.confirmedAt,
                delivery.pickedUpAt,
                delivery.deliveredAt,
              ];

              return (
                <div className="bg-white rounded-2xl shadow-sm px-4 py-3" style={{ border: "1px solid #EEEEEE" }}>
                  <p className="text-xs font-bold mb-3" style={{ color: "#8A8A8A" }}>SUIVI DE COURSE</p>

                  <div className="space-y-0">
                    {steps.map((step, idx) => {
                      const stepStatusIdx = statusOrder.indexOf(step.key);
                      const isDone    = stepStatusIdx < currentIdx || (step.key === currentStatusKey && step.at);
                      const isCurrent = step.key === currentStatusKey && !step.at && step.key !== "created";
                      const isPending = !isDone && !isCurrent;
                      const isLast    = idx === steps.length - 1;

                      // Durée depuis l'étape précédente
                      let deltaMin: number | null = null;
                      let isLate = false;
                      if (step.at && idx > 0) {
                        const prevAt = timestamps[idx - 1];
                        if (prevAt) {
                          deltaMin = diffMin(prevAt, step.at);
                          if (step.warnAfterMin && deltaMin > step.warnAfterMin) isLate = true;
                        }
                      }
                      // Durée depuis l'étape précédente si c'est l'étape active (en cours)
                      let activeSinceMin: number | null = null;
                      if (!step.at && !isPending && idx > 0) {
                        const prevAt = timestamps[idx - 1];
                        if (prevAt) activeSinceMin = diffMin(prevAt, new Date().toISOString());
                      }

                      return (
                        <div key={step.key} className="flex gap-3">
                          {/* Colonne icône + ligne verticale */}
                          <div className="flex flex-col items-center" style={{ width: 32, flexShrink: 0 }}>
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                              style={{
                                background: isPending ? "#F4F4F4" : step.iconBg,
                                border: isCurrent ? `2px solid ${step.iconColor}` : "2px solid transparent",
                                opacity: isPending ? 0.4 : 1,
                                transition: "all 0.2s",
                              }}
                            >
                              {isPending ? (
                                <span className="w-2 h-2 rounded-full" style={{ background: "#D1D5DB" }} />
                              ) : (
                                <span style={{ fontSize: 14 }}>{step.icon}</span>
                              )}
                            </div>
                            {!isLast && (
                              <div
                                className="flex-1 w-0.5 my-1"
                                style={{
                                  background: isDone ? step.lineColor : "#F0F0F0",
                                  minHeight: 20,
                                }}
                              />
                            )}
                          </div>

                          {/* Contenu */}
                          <div className="flex-1 pb-3" style={{ paddingTop: 4 }}>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p
                                  className="text-sm font-semibold leading-tight"
                                  style={{
                                    color: isPending ? "#D1D5DB" : isCurrent ? step.iconColor : "#111827",
                                  }}
                                >
                                  {step.label}
                                  {isCurrent && (
                                    <span
                                      className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full"
                                      style={{ background: step.iconBg, color: step.iconColor }}
                                    >
                                      EN COURS
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs mt-0.5" style={{ color: isPending ? "#E5E7EB" : "#9CA3AF" }}>
                                  {step.sublabel}
                                </p>
                              </div>

                              <div className="text-right shrink-0">
                                {step.at ? (
                                  <>
                                    <p className="text-xs font-mono font-semibold" style={{ color: "#374151" }}>
                                      {format(new Date(step.at), "HH:mm", { locale: fr })}
                                    </p>
                                    <p className="text-xs font-mono" style={{ color: "#9CA3AF" }}>
                                      {format(new Date(step.at), "dd/MM", { locale: fr })}
                                    </p>
                                  </>
                                ) : isCurrent && activeSinceMin !== null ? (
                                  <p
                                    className="text-xs font-semibold"
                                    style={{ color: (step.warnAfterMin && activeSinceMin > step.warnAfterMin) ? "#DC2626" : step.iconColor }}
                                  >
                                    {activeSinceMin < 60
                                      ? `${activeSinceMin} min`
                                      : `${Math.floor(activeSinceMin / 60)}h${activeSinceMin % 60 > 0 ? String(activeSinceMin % 60).padStart(2, "0") : ""}`}
                                  </p>
                                ) : null}

                                {/* Badge durée entre étapes */}
                                {deltaMin !== null && (
                                  <p
                                    className="text-xs mt-0.5"
                                    style={{ color: isLate ? "#DC2626" : "#9CA3AF" }}
                                  >
                                    {isLate ? "⚠ " : "+ "}
                                    {deltaMin < 60
                                      ? `${deltaMin} min`
                                      : `${Math.floor(deltaMin / 60)}h${deltaMin % 60 > 0 ? String(deltaMin % 60).padStart(2, "0") : ""}`}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ── Actions statut ─────────────────────────────────────── */}
            {isActive && (
              <div className="space-y-2">
                {delivery.status === "assigned" && (
                  <button onClick={() => doAction("pickup")}
                    className="w-full flex items-center justify-center gap-2 font-bold rounded-xl py-3.5 text-sm transition-colors"
                    style={{ background: "#7C3AED", color: "#fff" }}>
                    <Package size={15} /> Marquer collectée
                  </button>
                )}
                {delivery.status === "picked_up" && (
                  <button onClick={() => doAction("deliver")}
                    className="w-full flex items-center justify-center gap-2 font-bold rounded-xl py-3.5 text-sm transition-colors"
                    style={{ background: "#16A34A", color: "#fff" }}>
                    <CheckCircle size={15} /> Marquer livrée
                  </button>
                )}
                {delivery.status === "assigned" && (
                  <button onClick={() => doAction("unassign")}
                    className="w-full flex items-center justify-center gap-2 font-semibold rounded-xl py-2.5 text-sm transition-colors"
                    style={{ border: "1px solid #E5E7EB", color: "#5A5A5A", background: "#FAFAFA" }}>
                    <Truck size={14} /> Désassigner
                  </button>
                )}
                <button onClick={() => doAction("cancel")}
                  className="w-full flex items-center justify-center gap-2 font-semibold rounded-xl py-2.5 text-sm transition-colors"
                  style={{ border: "1px solid #FECACA", color: "#DC2626", background: "#FEF2F2" }}>
                  <XCircle size={14} /> Annuler cette course
                </button>
              </div>
            )}

            {/* ── Supprimer ──────────────────────────────────────────── */}
            <div className="pb-2">
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)}
                  className="w-full flex items-center justify-center gap-2 text-xs py-2.5 rounded-xl transition-colors"
                  style={{ color: "#C4C4C4" }}>
                  <Trash2 size={12} /> Supprimer définitivement
                </button>
              ) : (
                <div className="rounded-2xl p-4 space-y-3" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
                  <p className="text-sm font-bold text-center" style={{ color: "#DC2626" }}>Confirmer la suppression ?</p>
                  <p className="text-xs text-center" style={{ color: "#EF4444" }}>Cette action est irréversible.</p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmDelete(false)}
                      className="flex-1 py-2.5 text-xs font-semibold rounded-xl"
                      style={{ border: "1px solid #E5E7EB", color: "#5A5A5A", background: "#fff" }}>
                      Annuler
                    </button>
                    <button onClick={doDelete} disabled={deleting}
                      className="flex-1 py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-40"
                      style={{ background: "#DC2626", color: "#fff" }}>
                      <Trash2 size={12} /> {deleting ? "…" : "Supprimer"}
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>{/* p-4 space-y-3 */}
          </div>{/* flex-1 overflow-y-auto */}
        </div>
      </div>

      {pickingLocation && (
        <LocationPickerModal
          deliveryId={delivery.id}
          locationType={pickingLocation}
          description={pickingLocation === "delivery" ? delivery.deliveryDescription : null}
          clientNote={delivery.notes ?? undefined}
          customerName={delivery.customerName}
          initialCenter={
            delivery.deliveryLat && delivery.deliveryLng
              ? { lat: delivery.deliveryLat, lng: delivery.deliveryLng }
              : undefined
          }
          onConfirm={(id, lat, lng) => {
            if (pickingLocation === "pickup") {
              if (onConfirmPickup) onConfirmPickup(id, lat, lng);
            }
            if (pickingLocation === "delivery" && onConfirmLocation) onConfirmLocation(id, lat, lng);
            setPickingLocation(null);
          }}
          onClose={() => setPickingLocation(null)}
        />
      )}
    </>
  );
}
