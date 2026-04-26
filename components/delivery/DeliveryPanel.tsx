"use client";

import { useState } from "react";
import type { Courier, Delivery } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Package, MapPin, Clock, Truck, Plus, AlertTriangle,
  ChevronRight, ChevronDown, Phone, DollarSign, Search, X,
} from "lucide-react";
import { DeliveryDetailModal } from "./DeliveryDetailModal";

const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: "🍽️", patisserie: "🧁", boucherie: "🥩",
  volaillerie: "🐔", fromagerie: "🧀", supermarche: "🛒",
  pharmacie: "💊", eau: "💧", course: "📦",
};

const STATUS_META: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending:   { label: "En attente", bg: "bg-stone-100",   text: "text-stone-600",  dot: "bg-stone-400"  },
  assigned:  { label: "Assignée",   bg: "bg-blue-50",     text: "text-blue-700",   dot: "bg-blue-500"   },
  picked_up: { label: "En route",   bg: "bg-purple-50",   text: "text-purple-700", dot: "bg-purple-500" },
  delivered: { label: "Livrée",     bg: "bg-lime-100",    text: "text-green-700",  dot: "bg-lime-400"   },
  cancelled: { label: "Annulée",    bg: "bg-red-50",      text: "text-red-600",    dot: "bg-red-400"    },
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

// ── Group deliveries by customer (name + phone) ────────────────────────────
interface CustomerGroup {
  key: string;
  customerName: string;
  customerPhone: string;
  deliveries: Delivery[];
  totalPrice: number;
  hasUnlocated: boolean;
  hasUrgent: boolean;
  earliestCreatedAt: string;
}

function groupByCustomer(deliveries: Delivery[]): CustomerGroup[] {
  const map = new Map<string, CustomerGroup>();

  for (const d of deliveries) {
    // Group key: phone takes priority (unique), fallback to name
    const key = d.customerPhone?.trim() || d.customerName.trim().toLowerCase();

    if (!map.has(key)) {
      map.set(key, {
        key,
        customerName: d.customerName,
        customerPhone: d.customerPhone ?? "",
        deliveries: [],
        totalPrice: 0,
        hasUnlocated: false,
        hasUrgent: false,
        earliestCreatedAt: d.createdAt,
      });
    }

    const group = map.get(key)!;
    group.deliveries.push(d);
    group.totalPrice += d.price ?? 0;
    if (d.locationConfirmed === false) group.hasUnlocated = true;
    if (d.priority > 0) group.hasUrgent = true;
    if (d.createdAt < group.earliestCreatedAt) group.earliestCreatedAt = d.createdAt;
  }

  // Sort groups: urgent first, then by earliest createdAt
  return [...map.values()].sort((a, b) => {
    if (a.hasUrgent !== b.hasUrgent) return a.hasUrgent ? -1 : 1;
    return a.earliestCreatedAt.localeCompare(b.earliestCreatedAt);
  });
}

// ── Single delivery row inside a group ────────────────────────────────────
function DeliveryRow({
  delivery,
  onClick,
}: {
  delivery: Delivery;
  onClick: () => void;
}) {
  const s = STATUS_META[delivery.status] ?? STATUS_META.pending;
  const emoji = CATEGORY_EMOJI[delivery.category ?? ""] ?? (delivery.merchantId ? "📦" : "💬");

  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left border-t border-gray-100 first:border-t-0"
    >
      <span className="text-lg flex-shrink-0 mt-0.5">{emoji}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${s.bg} ${s.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {s.label}
          </span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {delivery.locationConfirmed === false && (
              <AlertTriangle size={11} className="text-amber-500" />
            )}
            {delivery.price != null && (
              <span className="text-xs font-semibold text-green-600">
                {delivery.price.toFixed(2)} DT
              </span>
            )}
            <ChevronRight size={13} className="text-gray-300" />
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <MapPin size={9} className="text-purple-400 flex-shrink-0" />
            <span className="truncate">{delivery.pickupAddress}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <MapPin size={9} className="text-orange-400 flex-shrink-0" />
            <span className="truncate">{delivery.deliveryAddress}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-1">
          {delivery.courier ? (
            <span className="text-xs text-blue-600 flex items-center gap-0.5 font-medium">
              <Truck size={9} /> {delivery.courier.name}
            </span>
          ) : (
            <span className="text-xs font-semibold" style={{ color: "#FF3B2F", cursor: "pointer" }}>Non assignée →</span>
          )}
          <span className="text-xs text-gray-400 flex items-center gap-0.5">
            <Clock size={9} />
            {formatDistanceToNow(new Date(delivery.createdAt), { addSuffix: true, locale: fr })}
          </span>
        </div>
      </div>
    </button>
  );
}

// ── Customer group card ───────────────────────────────────────────────────
function GroupCard({
  group,
  onOpenDelivery,
}: {
  group: CustomerGroup;
  onOpenDelivery: (d: Delivery) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const isSingle = group.deliveries.length === 1;

  const borderClass = group.hasUrgent
    ? "border-orange-300"
    : group.hasUnlocated
    ? "border-amber-300"
    : "border-gray-200";

  if (isSingle) {
    const d = group.deliveries[0];
    const s = STATUS_META[d.status] ?? STATUS_META.pending;
    const emoji = CATEGORY_EMOJI[d.category ?? ""] ?? (d.merchantId ? "📦" : "💬");

    return (
      <button
        onClick={() => onOpenDelivery(d)}
        className={`w-full mx-3 mb-3 rounded-2xl border overflow-hidden shadow-sm text-left transition-shadow hover:shadow-md active:scale-[0.99] bg-white ${borderClass}`}
        style={{ width: "calc(100% - 1.5rem)" }}
      >
        <div className="px-4 pt-3 pb-3 flex items-start gap-3">
          <div className="relative flex-shrink-0 mt-0.5">
            <span className="text-2xl">{emoji}</span>
            {d.priority > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border border-white" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-gray-900 text-base leading-tight truncate">
                {d.customerName}
              </span>
              <div className="flex items-center gap-1 flex-shrink-0">
                {d.locationConfirmed === false && (
                  <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    <AlertTriangle size={9} /> À localiser
                  </span>
                )}
                <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                  {s.label}
                </span>
              </div>
            </div>

            <div className="mt-1 space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <MapPin size={10} className="text-purple-400 flex-shrink-0" />
                <span className="truncate">{d.pickupAddress}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <MapPin size={10} className="text-orange-400 flex-shrink-0" />
                <span className="truncate">{d.deliveryAddress}</span>
              </div>
            </div>

            <div className="flex items-center justify-between mt-1.5">
              <div className="flex items-center gap-2">
                {d.courier ? (
                  <span className="text-xs text-blue-600 flex items-center gap-1 font-medium">
                    <Truck size={10} /> {d.courier.name}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">Non assignée</span>
                )}
                {d.price != null && (
                  <span className="text-xs font-semibold text-green-600 flex items-center gap-0.5">
                    <DollarSign size={9} />{d.price.toFixed(2)} DT
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock size={10} />
                  {formatDistanceToNow(new Date(d.createdAt), { addSuffix: true, locale: fr })}
                </span>
                <ChevronRight size={14} className="text-gray-300" />
              </div>
            </div>
          </div>
        </div>
      </button>
    );
  }

  // Multi-delivery group
  return (
    <div
      className={`mx-3 mb-3 rounded-2xl border overflow-hidden shadow-sm bg-white ${borderClass}`}
      style={{ width: "calc(100% - 1.5rem)" }}
    >
      {/* Group header — click to expand/collapse */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
      >
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm flex-shrink-0">
          {group.customerName.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900 text-sm truncate">{group.customerName}</span>
            {group.hasUrgent && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 flex-shrink-0">
                ⚡ Urgent
              </span>
            )}
            {group.hasUnlocated && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0 flex items-center gap-0.5">
                <AlertTriangle size={8} /> À localiser
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-0.5">
            {group.customerPhone && (
              <span className="text-xs text-gray-500 flex items-center gap-0.5">
                <Phone size={9} /> {group.customerPhone}
              </span>
            )}
            <span className="text-xs text-gray-400 flex items-center gap-0.5">
              <Clock size={9} />
              {formatDistanceToNow(new Date(group.earliestCreatedAt), { addSuffix: true, locale: fr })}
            </span>
          </div>
        </div>

        {/* Right summary */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full">
              {group.deliveries.length} arrêts
            </span>
            {group.totalPrice > 0 && (
              <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                {group.totalPrice.toFixed(2)} DT
              </span>
            )}
          </div>
          {expanded
            ? <ChevronDown size={15} className="text-gray-400" />
            : <ChevronRight size={15} className="text-gray-400" />}
        </div>
      </button>

      {/* Delivery rows */}
      {expanded && (
        <div className="border-t border-gray-100">
          {group.deliveries.map((d) => (
            <DeliveryRow
              key={d.id}
              delivery={d}
              onClick={() => onOpenDelivery(d)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Panel ───────────────────────────────────────────────────────────────────
export function DeliveryPanel({
  deliveries, couriers, onAssign, onStatusChange, onAdd, onConfirmLocation, onConfirmPickup,
}: Props) {
  const [activeTab, setActiveTab]           = useState<"pending" | "active" | "history">("pending");
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [searchQuery, setSearchQuery]       = useState("");

  const pending = deliveries.filter((d) => d.status === "pending");
  const active  = deliveries.filter((d) => ["assigned", "picked_up"].includes(d.status));
  const history = deliveries.filter((d) => ["delivered", "cancelled"].includes(d.status));

  const baseList = activeTab === "pending" ? pending : activeTab === "active" ? active : history;

  const displayList = searchQuery.trim()
    ? baseList.filter((d) => {
        const q = searchQuery.toLowerCase();
        return (
          d.customerName.toLowerCase().includes(q) ||
          (d.customerPhone ?? "").includes(q) ||
          d.deliveryAddress.toLowerCase().includes(q) ||
          d.pickupAddress.toLowerCase().includes(q) ||
          d.orderNumber.toLowerCase().includes(q)
        );
      })
    : baseList;

  const groups = groupByCustomer(displayList);

  const tabs = [
    { id: "pending" as const, label: "Attente",    count: pending.length,  color: "text-yellow-600", dot: "bg-yellow-400" },
    { id: "active"  as const, label: "En cours",   count: active.length,   color: "text-blue-600",   dot: "bg-blue-500"   },
    { id: "history" as const, label: "Historique", count: history.length,  color: "text-gray-500",   dot: "bg-gray-400"   },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50 relative">

      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-0" style={{ borderBottom: "1px solid #E8E8E8" }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold flex items-center gap-2" style={{ fontFamily: "Archivo, sans-serif", fontWeight: 800, color: "#0A0A0A" }}>
            <Package size={16} color="#FF3B2F" />
            Courses
          </h2>
          <button
            onClick={onAdd}
            className="hidden md:flex items-center gap-1 text-xs px-3 py-1.5 rounded-full transition-colors font-semibold"
            style={{ background: "#0A0A0A", color: "#FFFFFF", fontFamily: "Archivo, sans-serif", fontWeight: 700, border: "none", cursor: "pointer" }}
          >
            <Plus size={13} /> Nouvelle
          </button>
        </div>

        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-1.5 pb-3 pt-1 text-sm font-medium border-b-2 transition-colors"
              style={{
                borderBottomColor: activeTab === tab.id ? "#FF3B2F" : "transparent",
                color: activeTab === tab.id ? "#FF3B2F" : "#8A8A8A",
              }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className="w-5 h-5 rounded-full text-xs text-white flex items-center justify-center font-bold"
                  style={{ background: activeTab === tab.id ? "#FF3B2F" : "#C8C8C8" }}
                >
                  {tab.count > 9 ? "9+" : tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 bg-white border-b border-gray-100">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Chercher par nom, téléphone, adresse..."
            className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-8 py-2 focus:outline-none focus:ring-1 focus:ring-gray-300 placeholder:text-gray-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto pt-3 pb-20">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <span className="text-5xl mb-3">
              {searchQuery ? "🔍" : activeTab === "pending" ? "⏳" : activeTab === "active" ? "🏍️" : "✅"}
            </span>
            <p className="text-gray-500 font-medium">
              {searchQuery
                ? "Aucun résultat pour cette recherche"
                : activeTab === "pending" ? "Aucune course en attente"
                : activeTab === "active" ? "Aucune course en cours"
                : "Aucun historique"}
            </p>
            {activeTab === "pending" && !searchQuery && (
              <button
                onClick={onAdd}
                className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors"
                style={{ background: "#FF3B2F", color: "#FFFFFF", fontFamily: "Archivo, sans-serif", fontWeight: 700, border: "none", cursor: "pointer" }}
              >
                <Plus size={16} /> Créer une course
              </button>
            )}
          </div>
        ) : (
          groups.map((group) => (
            <GroupCard
              key={group.key}
              group={group}
              onOpenDelivery={setSelectedDelivery}
            />
          ))
        )}
      </div>

      {/* FAB mobile */}
      <button
        onClick={onAdd}
        className="md:hidden absolute bottom-6 right-4 w-14 h-14 text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-10"
        style={{ background: "#FF3B2F" }}
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
