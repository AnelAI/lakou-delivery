"use client";

import { useState, useEffect } from "react";
import type { Courier, Delivery } from "@/lib/types";
import { DeliveryDetailModal } from "@/components/delivery/DeliveryDetailModal";
import {
  X, Package, MapPin, Phone, Truck, Clock,
  CheckCircle, AlertTriangle, DollarSign, History,
  ArrowRight, Timer, ChevronRight,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  courier: Courier;
  allCouriers: Courier[];
  onClose: () => void;
  onAssign: (deliveryId: string, courierId: string) => void;
  onStatusChange: (deliveryId: string, action: string) => void;
  onConfirmLocation?: (deliveryId: string, lat: number, lng: number) => void;
  onConfirmPickup?: (deliveryId: string, lat: number, lng: number) => void;
}

const STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  pending:   { label: "En attente", color: "text-yellow-700 bg-yellow-50 border-yellow-200", dot: "bg-yellow-400" },
  assigned:  { label: "Assignée",   color: "text-blue-700 bg-blue-50 border-blue-200",       dot: "bg-blue-500"  },
  picked_up: { label: "En route",   color: "text-purple-700 bg-purple-50 border-purple-200", dot: "bg-purple-500"},
  delivered: { label: "Livrée",     color: "text-green-700 bg-green-50 border-green-200",    dot: "bg-green-500" },
  cancelled: { label: "Annulée",    color: "text-gray-500 bg-gray-100 border-gray-200",      dot: "bg-gray-400"  },
};

const COURIER_STATUS_COLOR: Record<string, string> = {
  available: "bg-green-500",
  busy:      "bg-blue-500",
  paused:    "bg-yellow-500",
  offline:   "bg-gray-400",
};

const COURIER_STATUS_LABEL: Record<string, string> = {
  available: "Disponible",
  busy:      "En course",
  paused:    "En pause",
  offline:   "Hors ligne",
};

type Tab = "active" | "history";

function durationMins(from: string | null | undefined, to: string | null | undefined): number | null {
  if (!from || !to) return null;
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000);
}

export function CourierDeliveriesModal({
  courier, allCouriers, onClose, onAssign, onStatusChange, onConfirmLocation, onConfirmPickup,
}: Props) {
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [tab, setTab] = useState<Tab>("active");
  const [history, setHistory] = useState<Delivery[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const activeDeliveries = (courier.deliveries ?? []).filter(
    (d) => ["assigned", "picked_up"].includes(d.status)
  );
  const pendingDeliveries = (courier.deliveries ?? []).filter(
    (d) => d.status === "pending"
  );
  const allVisible = [...activeDeliveries, ...pendingDeliveries];
  const totalPrice = allVisible.reduce((sum, d) => sum + (d.price ?? 0), 0);

  useEffect(() => {
    if (tab !== "history" || historyLoaded) return;
    setHistoryLoading(true);
    fetch(`/api/deliveries?courierId=${courier.id}`)
      .then((r) => r.json())
      .then((data: Delivery[]) => {
        const past = data
          .filter((d) => d.status === "delivered" || d.status === "cancelled")
          .sort((a, b) => {
            const ta = a.deliveredAt ?? a.createdAt;
            const tb = b.deliveredAt ?? b.createdAt;
            return new Date(tb).getTime() - new Date(ta).getTime();
          });
        setHistory(past);
        setHistoryLoaded(true);
      })
      .catch(() => setHistoryLoaded(true))
      .finally(() => setHistoryLoading(false));
  }, [tab, historyLoaded, courier.id]);

  if (selectedDelivery) {
    return (
      <DeliveryDetailModal
        delivery={selectedDelivery}
        couriers={allCouriers}
        onClose={() => setSelectedDelivery(null)}
        onAssign={(id, cid) => { onAssign(id, cid); setSelectedDelivery(null); }}
        onStatusChange={(id, action) => { onStatusChange(id, action); setSelectedDelivery(null); }}
        onConfirmLocation={onConfirmLocation}
        onConfirmPickup={onConfirmPickup}
      />
    );
  }

  const historyRevenue = history
    .filter((d) => d.status === "delivered")
    .reduce((sum, d) => sum + (d.price ?? 0), 0);

  return (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
                {courier.name.charAt(0).toUpperCase()}
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                COURIER_STATUS_COLOR[courier.status] ?? "bg-gray-400"
              }`} />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-gray-900 text-lg leading-tight">{courier.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-500">{COURIER_STATUS_LABEL[courier.status] ?? courier.status}</span>
                {courier.phone && (
                  <a
                    href={`tel:${courier.phone}`}
                    className="flex items-center gap-1 text-xs text-blue-500 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Phone size={10} /> {courier.phone}
                  </a>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 flex-shrink-0">
          <button
            onClick={() => setTab("active")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              tab === "active"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Truck size={14} />
            En cours
            {allVisible.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                tab === "active" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
              }`}>
                {allVisible.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("history")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              tab === "history"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <History size={14} />
            Historique
            {historyLoaded && history.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                tab === "history" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
              }`}>
                {history.length}
              </span>
            )}
          </button>
        </div>

        {/* ── Tab: En cours ─────────────────────────────────────────────────── */}
        {tab === "active" && (
          <>
            {/* Summary bar */}
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-4 flex-shrink-0">
              <div className="flex items-center gap-1.5 text-sm">
                <Truck size={14} className="text-blue-500" />
                <span className="font-semibold text-gray-800">{activeDeliveries.length}</span>
                <span className="text-gray-500">en cours</span>
              </div>
              {pendingDeliveries.length > 0 && (
                <div className="flex items-center gap-1.5 text-sm">
                  <Clock size={14} className="text-yellow-500" />
                  <span className="font-semibold text-gray-800">{pendingDeliveries.length}</span>
                  <span className="text-gray-500">en attente</span>
                </div>
              )}
              {totalPrice > 0 && (
                <div className="flex items-center gap-1.5 text-sm ml-auto">
                  <DollarSign size={14} className="text-green-500" />
                  <span className="font-semibold text-green-700">{totalPrice.toFixed(2)} DT</span>
                </div>
              )}
            </div>

            {/* Delivery list */}
            <div className="flex-1 overflow-y-auto">
              {allVisible.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400">
                  <Package size={40} className="opacity-30" />
                  <p className="text-sm">Aucune course active</p>
                  <p className="text-xs">Ce coursier n&apos;a pas de livraison en cours</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {allVisible.map((delivery) => {
                    const s = STATUS_META[delivery.status] ?? STATUS_META.pending;
                    return (
                      <button
                        key={delivery.id}
                        onClick={() => setSelectedDelivery(delivery)}
                        className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-semibold text-sm text-gray-800 truncate">
                                {delivery.customerName}
                              </span>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${s.color}`}>
                                {s.label}
                              </span>
                            </div>
                            <p className="text-xs font-mono text-gray-400">{delivery.orderNumber}</p>
                            <div className="mt-2 space-y-1">
                              <div className="flex items-start gap-1.5 text-xs text-gray-600">
                                <Package size={11} className="text-gray-400 mt-0.5 flex-shrink-0" />
                                <span className="truncate">{delivery.pickupAddress}</span>
                              </div>
                              <div className="flex items-start gap-1.5 text-xs text-gray-600">
                                <MapPin size={11} className="text-orange-400 mt-0.5 flex-shrink-0" />
                                <span className="truncate">{delivery.deliveryAddress}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-xs text-gray-400">
                                {formatDistanceToNow(new Date(delivery.createdAt), { addSuffix: true, locale: fr })}
                              </span>
                              {delivery.price != null && (
                                <span className="text-xs font-semibold text-green-600 flex items-center gap-0.5">
                                  <DollarSign size={10} />{delivery.price.toFixed(2)} DT
                                </span>
                              )}
                              {delivery.locationConfirmed === false && (
                                <span className="flex items-center gap-0.5 text-xs text-amber-600">
                                  <AlertTriangle size={10} /> À localiser
                                </span>
                              )}
                              {delivery.distance && (
                                <span className="text-xs text-gray-400">{delivery.distance} km</span>
                              )}
                            </div>
                          </div>
                          <CheckCircle size={14} className="text-gray-300 flex-shrink-0 mt-1" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer stats */}
            {courier.deliveredToday != null && (
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-500 flex-shrink-0">
                <span>Livré aujourd&apos;hui : <strong className="text-gray-700">{courier.deliveredToday}</strong></span>
                {courier.deliveredCount != null && (
                  <span>Total : <strong className="text-gray-700">{courier.deliveredCount}</strong></span>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Tab: Historique ───────────────────────────────────────────────── */}
        {tab === "history" && (
          <>
            {/* History summary bar */}
            {historyLoaded && history.length > 0 && (
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-4 flex-shrink-0">
                <div className="flex items-center gap-1.5 text-sm">
                  <CheckCircle size={14} className="text-green-500" />
                  <span className="font-semibold text-gray-800">
                    {history.filter((d) => d.status === "delivered").length}
                  </span>
                  <span className="text-gray-500">livrées</span>
                </div>
                {history.some((d) => d.status === "cancelled") && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <X size={14} className="text-gray-400" />
                    <span className="font-semibold text-gray-800">
                      {history.filter((d) => d.status === "cancelled").length}
                    </span>
                    <span className="text-gray-500">annulées</span>
                  </div>
                )}
                {historyRevenue > 0 && (
                  <div className="flex items-center gap-1.5 text-sm ml-auto">
                    <DollarSign size={14} className="text-green-500" />
                    <span className="font-semibold text-green-700">{historyRevenue.toFixed(2)} DT</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {historyLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400">
                  <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                  <p className="text-sm">Chargement de l&apos;historique…</p>
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400">
                  <History size={40} className="opacity-30" />
                  <p className="text-sm">Aucun historique</p>
                  <p className="text-xs">Ce coursier n&apos;a pas encore effectué de livraison</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {history.map((delivery) => {
                    const s = STATUS_META[delivery.status] ?? STATUS_META.delivered;
                    const refDate = delivery.deliveredAt ?? delivery.createdAt;
                    const duration = durationMins(delivery.assignedAt, delivery.deliveredAt);
                    return (
                      <button
                        key={delivery.id}
                        onClick={() => setSelectedDelivery(delivery)}
                        className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors group"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                          <div className="flex-1 min-w-0">
                            {/* Top row: name + status badge */}
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <span className="font-semibold text-sm text-gray-800 truncate">
                                {delivery.customerName}
                              </span>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${s.color}`}>
                                {s.label}
                              </span>
                            </div>

                            {/* Order number + date */}
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-mono text-gray-400">{delivery.orderNumber}</span>
                              <span className="text-gray-300">·</span>
                              <span className="text-xs text-gray-400">
                                {format(new Date(refDate), "d MMM yyyy, HH:mm", { locale: fr })}
                              </span>
                            </div>

                            {/* Route: pickup → delivery */}
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                              <Package size={10} className="text-gray-400 flex-shrink-0" />
                              <span className="truncate max-w-[35%]">{delivery.pickupAddress}</span>
                              <ArrowRight size={10} className="text-gray-300 flex-shrink-0" />
                              <MapPin size={10} className="text-orange-400 flex-shrink-0" />
                              <span className="truncate">{delivery.deliveryAddress}</span>
                            </div>

                            {/* Meta: price, duration, distance */}
                            <div className="flex items-center gap-3">
                              {delivery.price != null && (
                                <span className="text-xs font-semibold text-green-600 flex items-center gap-0.5">
                                  <DollarSign size={10} />{delivery.price.toFixed(2)} DT
                                </span>
                              )}
                              {duration != null && delivery.status === "delivered" && (
                                <span className="text-xs text-gray-400 flex items-center gap-0.5">
                                  <Timer size={10} />{duration} min
                                </span>
                              )}
                              {delivery.distance != null && (
                                <span className="text-xs text-gray-400">{delivery.distance} km</span>
                              )}
                            </div>
                          </div>
                          <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-400 flex-shrink-0 mt-1 transition-colors" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
