"use client";

import { useState } from "react";
import type { Courier, Delivery } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Package, MapPin, Clock, Truck, Plus, AlertTriangle, ChevronRight,
} from "lucide-react";
import { DeliveryDetailModal } from "./DeliveryDetailModal";

const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: "🍽️", patisserie: "🧁", boucherie: "🥩",
  volaillerie: "🐔", fromagerie: "🧀", supermarche: "🛒",
  pharmacie: "💊", eau: "💧", course: "📦",
};

const STATUS_META: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending:   { label: "En attente", bg: "bg-yellow-50",  text: "text-yellow-700", dot: "bg-yellow-400" },
  assigned:  { label: "Assignée",   bg: "bg-blue-50",    text: "text-blue-700",   dot: "bg-blue-500"   },
  picked_up: { label: "En route",   bg: "bg-purple-50",  text: "text-purple-700", dot: "bg-purple-500" },
  delivered: { label: "Livrée",     bg: "bg-green-50",   text: "text-green-700",  dot: "bg-green-500"  },
  cancelled: { label: "Annulée",    bg: "bg-gray-100",   text: "text-gray-500",   dot: "bg-gray-400"   },
};

interface Props {
  deliveries: Delivery[];
  couriers: Courier[];
  onAssign: (deliveryId: string, courierId: string) => void;
  onStatusChange: (deliveryId: string, action: string) => void;
  onAdd: () => void;
  onConfirmLocation?: (deliveryId: string, lat: number, lng: number) => void;
  onConfirmPickup?: (deliveryId: string, lat: number, lng: number) => void;
}

// ── Compact delivery card — tap to open detail modal ───────────────────────
function DeliveryCard({
  delivery, onClick,
}: {
  delivery: Delivery;
  onClick: () => void;
}) {
  const status = STATUS_META[delivery.status] ?? STATUS_META.pending;
  const emoji  = CATEGORY_EMOJI[delivery.category ?? ""] ?? (delivery.merchantId ? "📦" : "💬");
  const needsAttention = delivery.locationConfirmed === false || (!delivery.merchantId && delivery.status === "pending");

  return (
    <button
      onClick={onClick}
      className={`w-full mx-3 mb-3 rounded-2xl border overflow-hidden shadow-sm text-left transition-shadow hover:shadow-md active:scale-[0.99] ${
        needsAttention
          ? "border-amber-300 bg-amber-50/30"
          : delivery.priority > 0
          ? "border-orange-300 bg-white"
          : "border-gray-200 bg-white"
      }`}
      style={{ width: "calc(100% - 1.5rem)" }}
    >
      <div className="px-4 pt-3 pb-3 flex items-start gap-3">
        {/* Emoji */}
        <div className="relative flex-shrink-0 mt-0.5">
          <span className="text-2xl">{emoji}</span>
          {delivery.priority > 0 && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border border-white" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Name + status */}
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-gray-900 text-base leading-tight truncate">
              {delivery.customerName}
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
              {delivery.locationConfirmed === false && (
                <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  <AlertTriangle size={9} /> À localiser
                </span>
              )}
              {!delivery.merchantId && delivery.status === "pending" && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                  Libre
                </span>
              )}
              <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </span>
            </div>
          </div>

          {/* Addresses */}
          <div className="mt-1 space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <MapPin size={10} className="text-purple-400 flex-shrink-0" />
              <span className="truncate">{delivery.pickupAddress}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <MapPin size={10} className="text-orange-400 flex-shrink-0" />
              <span className="truncate">{delivery.deliveryAddress}</span>
            </div>
          </div>

          {/* Courier + time */}
          <div className="flex items-center justify-between mt-1.5">
            {delivery.courier ? (
              <span className="text-xs text-blue-600 flex items-center gap-1 font-medium">
                <Truck size={10} /> {delivery.courier.name}
              </span>
            ) : (
              <span className="text-xs text-gray-400">Non assignée</span>
            )}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock size={10} />
                {formatDistanceToNow(new Date(delivery.createdAt), { addSuffix: true, locale: fr })}
              </span>
              <ChevronRight size={14} className="text-gray-300" />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Panel ───────────────────────────────────────────────────────────────────
export function DeliveryPanel({
  deliveries, couriers, onAssign, onStatusChange, onAdd, onConfirmLocation, onConfirmPickup,
}: Props) {
  const [activeTab, setActiveTab]       = useState<"pending" | "active" | "history">("pending");
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);

  const pending = deliveries.filter((d) => d.status === "pending");
  const active  = deliveries.filter((d) => ["assigned", "picked_up"].includes(d.status));
  const history = deliveries.filter((d) => ["delivered", "cancelled"].includes(d.status));

  const displayList = activeTab === "pending" ? pending : activeTab === "active" ? active : history;

  const tabs = [
    { id: "pending" as const, label: "Attente",    count: pending.length,  color: "text-yellow-600", dot: "bg-yellow-400" },
    { id: "active"  as const, label: "En cours",   count: active.length,   color: "text-blue-600",   dot: "bg-blue-500"   },
    { id: "history" as const, label: "Historique", count: history.length,  color: "text-gray-500",   dot: "bg-gray-400"   },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50 relative">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 pt-4 pb-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <Package size={18} className="text-orange-500" />
            Courses
          </h2>
          <button
            onClick={onAdd}
            className="hidden md:flex items-center gap-1 text-xs bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600 transition-colors font-semibold"
          >
            <Plus size={13} /> Nouvelle
          </button>
        </div>

        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 pb-3 pt-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? `border-orange-500 ${tab.color}`
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`w-5 h-5 rounded-full text-xs text-white flex items-center justify-center font-bold ${tab.dot}`}>
                  {tab.count > 9 ? "9+" : tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto pt-3 pb-20">
        {displayList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <span className="text-5xl mb-3">
              {activeTab === "pending" ? "⏳" : activeTab === "active" ? "🏍️" : "✅"}
            </span>
            <p className="text-gray-500 font-medium">
              {activeTab === "pending" ? "Aucune course en attente"
               : activeTab === "active" ? "Aucune course en cours"
               : "Aucun historique"}
            </p>
            {activeTab === "pending" && (
              <button
                onClick={onAdd}
                className="mt-4 flex items-center gap-2 bg-orange-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors"
              >
                <Plus size={16} /> Créer une course
              </button>
            )}
          </div>
        ) : (
          displayList.map((delivery) => (
            <DeliveryCard
              key={delivery.id}
              delivery={delivery}
              onClick={() => setSelectedDelivery(delivery)}
            />
          ))
        )}
      </div>

      {/* FAB mobile */}
      <button
        onClick={onAdd}
        className="md:hidden absolute bottom-6 right-4 w-14 h-14 bg-orange-500 hover:bg-orange-600 text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-10"
        aria-label="Nouvelle course"
      >
        <Plus size={24} />
      </button>

      {/* Detail modal */}
      {selectedDelivery && (
        <DeliveryDetailModal
          delivery={selectedDelivery}
          couriers={couriers}
          onClose={() => setSelectedDelivery(null)}
          onAssign={(id, courierId) => { onAssign(id, courierId); setSelectedDelivery(null); }}
          onStatusChange={(id, action) => { onStatusChange(id, action); setSelectedDelivery(null); }}
          onConfirmLocation={onConfirmLocation}
          onConfirmPickup={onConfirmPickup}
        />
      )}
    </div>
  );
}
