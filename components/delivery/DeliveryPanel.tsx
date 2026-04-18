"use client";

import { useState } from "react";
import type { Courier, Delivery } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Package, MapPin, Clock, Phone, ChevronDown,
  CheckCircle, XCircle, Truck, Plus, User, FileText, AlertTriangle,
} from "lucide-react";
import { LocationPickerModal } from "./LocationPickerModal";

const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: "🍽️", patisserie: "🧁", boucherie: "🥩",
  volaillerie: "🐔", fromagerie: "🧀", supermarche: "🛒",
  pharmacie: "💊", eau: "💧", course: "📦",
};

const STATUS_META: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending:   { label: "En attente",  bg: "bg-yellow-50",  text: "text-yellow-700", dot: "bg-yellow-400" },
  assigned:  { label: "Assignée",    bg: "bg-blue-50",    text: "text-blue-700",   dot: "bg-blue-500"   },
  picked_up: { label: "En route",    bg: "bg-purple-50",  text: "text-purple-700", dot: "bg-purple-500" },
  delivered: { label: "Livrée",      bg: "bg-green-50",   text: "text-green-700",  dot: "bg-green-500"  },
  cancelled: { label: "Annulée",     bg: "bg-gray-100",   text: "text-gray-500",   dot: "bg-gray-400"   },
};

interface Props {
  deliveries: Delivery[];
  couriers: Courier[];
  onAssign: (deliveryId: string, courierId: string) => void;
  onStatusChange: (deliveryId: string, action: string) => void;
  onAdd: () => void;
  onConfirmLocation?: (deliveryId: string, lat: number, lng: number) => void;
}

// ── Single delivery card ────────────────────────────────────────────────────
function DeliveryCard({
  delivery, couriers, onAssign, onStatusChange, onConfirmLocation,
}: {
  delivery: Delivery;
  couriers: Courier[];
  onAssign: (deliveryId: string, courierId: string) => void;
  onStatusChange: (deliveryId: string, action: string) => void;
  onConfirmLocation?: (deliveryId: string, lat: number, lng: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [locating, setLocating] = useState(false);
  const status = STATUS_META[delivery.status] ?? STATUS_META.pending;
  const available = couriers.filter((c) => ["available", "busy"].includes(c.status));
  const emoji = CATEGORY_EMOJI[delivery.category ?? ""] ?? "📦";

  const doAssign = (courierId: string) => {
    onAssign(delivery.id, courierId);
    setAssigning(false);
  };

  const doAction = (action: string) => {
    onStatusChange(delivery.id, action);
    setExpanded(false);
  };

  return (
    <div className={`mx-3 mb-3 rounded-2xl border overflow-hidden shadow-sm transition-shadow ${
      expanded ? "shadow-md" : ""
    } ${delivery.priority > 0 ? "border-orange-300" : "border-gray-200"}`}>

      {/* ── Card header ── */}
      <button
        className="w-full text-left px-4 pt-3 pb-2 bg-white"
        onClick={() => { setExpanded(!expanded); setAssigning(false); }}
      >
        <div className="flex items-start gap-3">
          {/* Emoji + priority indicator */}
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
                  <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                    <AlertTriangle size={10} /> À localiser
                  </span>
                )}
                <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                  {status.label}
                </span>
              </div>
            </div>

            {/* Route */}
            <div className="mt-1.5 space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <MapPin size={11} className="text-purple-500 flex-shrink-0" />
                <span className="truncate">{delivery.pickupAddress}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <MapPin size={11} className="text-orange-500 flex-shrink-0" />
                <span className="truncate">{delivery.deliveryAddress}</span>
              </div>
            </div>

            {/* Courier + time */}
            <div className="flex items-center justify-between mt-1.5">
              {delivery.courier ? (
                <span className="text-xs text-blue-600 flex items-center gap-1 font-medium">
                  <Truck size={11} />
                  {delivery.courier.name}
                </span>
              ) : (
                <span className="text-xs text-gray-400">Non assignée</span>
              )}
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock size={10} />
                {formatDistanceToNow(new Date(delivery.createdAt), { addSuffix: true, locale: fr })}
              </span>
            </div>
          </div>

          <ChevronDown size={18} className={`text-gray-400 flex-shrink-0 mt-1 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* ── Primary action — always visible, large touch target ── */}
      {delivery.status === "pending" && (
        <div className="px-3 pb-3 bg-white space-y-2">
          {delivery.locationConfirmed === false && onConfirmLocation && (
            <button
              onClick={(e) => { e.stopPropagation(); setLocating(true); }}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
            >
              <MapPin size={16} />
              Localiser sur la carte
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setAssigning(!assigning); setExpanded(false); }}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
          >
            <User size={16} />
            Assigner un coursier
          </button>
        </div>
      )}

      {delivery.status === "assigned" && (
        <div className="px-3 pb-3 bg-white">
          <button
            onClick={() => doAction("pickup")}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
          >
            <Package size={16} />
            Marquer collectée
          </button>
        </div>
      )}

      {delivery.status === "picked_up" && (
        <div className="px-3 pb-3 bg-white">
          <button
            onClick={() => doAction("deliver")}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
          >
            <CheckCircle size={16} />
            Marquer livrée
          </button>
        </div>
      )}

      {/* ── Courier selection sheet ── */}
      {assigning && available.length > 0 && (
        <div className="px-3 pb-3 bg-blue-50 border-t border-blue-100">
          <p className="text-xs font-semibold text-blue-700 py-2">Choisir un coursier :</p>
          <div className="flex flex-col gap-2">
            {available.map((c) => (
              <button
                key={c.id}
                onClick={() => doAssign(c.id)}
                className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-blue-200 hover:bg-blue-50 transition-colors"
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                  c.status === "available" ? "bg-green-500" : "bg-blue-500"
                }`}>
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                  <p className="text-xs text-gray-500">
                    {c.status === "available" ? "✓ Disponible" : `En course (${c.deliveries?.length ?? 0})`}
                  </p>
                </div>
              </button>
            ))}
          </div>
          {available.length === 0 && (
            <p className="text-xs text-blue-500 py-2">Aucun coursier disponible</p>
          )}
        </div>
      )}

      {/* ── Location picker modal ── */}
      {locating && onConfirmLocation && (
        <LocationPickerModal
          deliveryId={delivery.id}
          deliveryDescription={delivery.deliveryDescription}
          customerName={delivery.customerName}
          onConfirm={(id, lat, lng) => { onConfirmLocation(id, lat, lng); setLocating(false); }}
          onClose={() => setLocating(false)}
        />
      )}

      {/* ── Expanded details ── */}
      {expanded && (
        <div className="bg-gray-50 border-t border-gray-100 px-4 py-3 space-y-3">
          {/* Order info */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="font-mono">{delivery.orderNumber}</span>
            {delivery.priority > 0 && (
              <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                {delivery.priority === 2 ? "🔴 Urgent" : "🟠 Haute priorité"}
              </span>
            )}
          </div>

          {/* Extra info */}
          <div className="space-y-1.5">
            {delivery.customerPhone && (
              <a
                href={`tel:${delivery.customerPhone}`}
                className="flex items-center gap-2 text-sm text-blue-600 font-medium"
              >
                <Phone size={14} />
                {delivery.customerPhone}
              </a>
            )}
            {delivery.deliveryDescription && (
              <div className="flex items-start gap-2 text-sm">
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5 text-amber-500" />
                <span className="text-amber-700 italic">{delivery.deliveryDescription}</span>
              </div>
            )}
            {delivery.notes && (
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <FileText size={14} className="flex-shrink-0 mt-0.5 text-gray-400" />
                <span className="italic">{delivery.notes}</span>
              </div>
            )}
            {delivery.merchant && (
              <div className="text-xs text-gray-500">
                Marchand : <span className="font-medium">{delivery.merchant.name}</span>
              </div>
            )}
            {delivery.distance && (
              <div className="text-xs text-gray-500">Distance : {delivery.distance} km</div>
            )}
          </div>

          {/* Secondary actions */}
          {["pending", "assigned"].includes(delivery.status) && (
            <button
              onClick={() => doAction("cancel")}
              className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 rounded-xl py-2.5 text-sm font-medium hover:bg-red-50 transition-colors"
            >
              <XCircle size={15} />
              Annuler cette course
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Panel ───────────────────────────────────────────────────────────────────
export function DeliveryPanel({ deliveries, couriers, onAssign, onStatusChange, onAdd, onConfirmLocation }: Props) {
  const [activeTab, setActiveTab] = useState<"pending" | "active" | "history">("pending");

  const pending  = deliveries.filter((d) => d.status === "pending");
  const active   = deliveries.filter((d) => ["assigned", "picked_up"].includes(d.status));
  const history  = deliveries.filter((d) => ["delivered", "cancelled"].includes(d.status));

  const displayList = activeTab === "pending" ? pending : activeTab === "active" ? active : history;

  const tabs = [
    { id: "pending"  as const, label: "Attente",    count: pending.length,  color: "text-yellow-600", dot: "bg-yellow-400" },
    { id: "active"   as const, label: "En cours",   count: active.length,   color: "text-blue-600",   dot: "bg-blue-500"   },
    { id: "history"  as const, label: "Historique", count: history.length,  color: "text-gray-500",   dot: "bg-gray-400"   },
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
          {/* On desktop the + button stays in header; on mobile we use FAB */}
          <button
            onClick={onAdd}
            className="hidden md:flex items-center gap-1 text-xs bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600 transition-colors font-semibold"
          >
            <Plus size={13} /> Nouvelle
          </button>
        </div>

        {/* Tabs */}
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
              couriers={couriers}
              onAssign={onAssign}
              onStatusChange={onStatusChange}
              onConfirmLocation={onConfirmLocation}
            />
          ))
        )}
      </div>

      {/* Floating action button — mobile only */}
      <button
        onClick={onAdd}
        className="md:hidden absolute bottom-6 right-4 w-14 h-14 bg-orange-500 hover:bg-orange-600 text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-10"
        aria-label="Nouvelle course"
      >
        <Plus size={24} />
      </button>
    </div>
  );
}
