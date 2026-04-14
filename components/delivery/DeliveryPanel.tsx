"use client";

import { useState } from "react";
import type { Courier, Delivery } from "@/lib/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Package,
  MapPin,
  Clock,
  User,
  ChevronDown,
  CheckCircle,
  XCircle,
  Truck,
} from "lucide-react";

const CATEGORY_EMOJI: Record<string, string> = {
  restaurant:  "🍽️",
  patisserie:  "🧁",
  boucherie:   "🥩",
  volaillerie: "🐔",
  fromagerie:  "🧀",
  supermarche: "🛒",
  pharmacie:   "💊",
  eau:         "💧",
  course:      "📦",
};

const CATEGORY_LABEL: Record<string, string> = {
  restaurant:  "Restaurant",
  patisserie:  "Pâtisserie",
  boucherie:   "Boucherie",
  volaillerie: "Volaillerie",
  fromagerie:  "Fromagerie",
  supermarche: "Supermarché",
  pharmacie:   "Pharmacie",
  eau:         "Pack d'eau",
  course:      "Course",
};

interface Props {
  deliveries: Delivery[];
  couriers: Courier[];
  onAssign: (deliveryId: string, courierId: string) => void;
  onStatusChange: (deliveryId: string, action: string) => void;
  onAdd: () => void;
}

export function DeliveryPanel({ deliveries, couriers, onAssign, onStatusChange, onAdd }: Props) {
  const [activeTab, setActiveTab] = useState<"pending" | "active" | "history">("pending");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const pending = deliveries.filter((d) => d.status === "pending");
  const active = deliveries.filter((d) => ["assigned", "picked_up"].includes(d.status));
  const history = deliveries.filter((d) => ["delivered", "cancelled"].includes(d.status));

  const displayList =
    activeTab === "pending" ? pending : activeTab === "active" ? active : history;

  const availableCouriers = couriers.filter((c) => ["available", "busy"].includes(c.status));

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Package size={18} className="text-orange-600" />
            Courses
          </h2>
          <button
            onClick={onAdd}
            className="text-xs bg-orange-500 text-white px-2.5 py-1 rounded-lg hover:bg-orange-600 transition-colors"
          >
            + Nouvelle
          </button>
        </div>

        {/* Tabs */}
        <div className="flex rounded-lg bg-gray-100 p-1 gap-1">
          {(["pending", "active", "history"] as const).map((tab) => {
            const count =
              tab === "pending" ? pending.length : tab === "active" ? active.length : history.length;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 text-xs py-1 rounded-md transition-colors ${
                  activeTab === tab
                    ? "bg-white shadow text-gray-800 font-medium"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab === "pending" ? "En attente" : tab === "active" ? "En cours" : "Historique"}
                {count > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                    activeTab === tab ? "bg-orange-100 text-orange-700" : "bg-gray-200 text-gray-600"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Delivery list */}
      <div className="flex-1 overflow-y-auto">
        {displayList.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">
            {activeTab === "pending"
              ? "Aucune course en attente"
              : activeTab === "active"
              ? "Aucune course en cours"
              : "Aucun historique"}
          </div>
        ) : (
          displayList.map((delivery) => (
            <div key={delivery.id} className="border-b border-gray-100">
              <button
                onClick={() => setExpandedId(expandedId === delivery.id ? null : delivery.id)}
                className="w-full text-left p-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-gray-500">
                        {delivery.orderNumber}
                      </span>
                      {delivery.category && (
                        <span className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full border border-orange-100">
                          {CATEGORY_EMOJI[delivery.category] ?? "📦"} {CATEGORY_LABEL[delivery.category] ?? delivery.category}
                        </span>
                      )}
                      {delivery.priority > 0 && (
                        <span className="text-xs bg-red-100 text-red-600 px-1 rounded">
                          Prioritaire
                        </span>
                      )}
                    </div>
                    <div className="font-medium text-sm text-gray-800 mt-0.5">
                      {delivery.customerName}
                    </div>

                    <div className="flex items-start gap-1 mt-1 text-xs text-gray-500">
                      <MapPin size={10} className="mt-0.5 flex-shrink-0 text-purple-500" />
                      <span className="truncate">{delivery.pickupAddress}</span>
                    </div>
                    <div className="flex items-start gap-1 text-xs text-gray-500">
                      <MapPin size={10} className="mt-0.5 flex-shrink-0 text-orange-500" />
                      <span className="truncate">{delivery.deliveryAddress}</span>
                    </div>

                    <div className="flex items-center gap-3 mt-1">
                      <StatusBadge type="delivery" value={delivery.status} />
                      {delivery.courier && (
                        <span className="text-xs text-blue-600 flex items-center gap-1">
                          <Truck size={10} />
                          {delivery.courier.name}
                        </span>
                      )}
                      {delivery.estimatedTime && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock size={10} />
                          ~{delivery.estimatedTime} min
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`text-gray-400 transition-transform flex-shrink-0 mt-1 ${
                      expandedId === delivery.id ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </button>

              {/* Expanded actions */}
              {expandedId === delivery.id && (
                <div className="px-3 pb-3 bg-gray-50 border-t border-gray-100">
                  <div className="pt-2 space-y-2">
                    {/* Details */}
                    <div className="text-xs text-gray-500 space-y-1">
                      {delivery.customerPhone && (
                        <div className="flex items-center gap-1">
                          <User size={10} />
                          {delivery.customerPhone}
                        </div>
                      )}
                      {delivery.distance && (
                        <div>Distance: {delivery.distance} km</div>
                      )}
                      {delivery.notes && (
                        <div className="italic">{delivery.notes}</div>
                      )}
                      <div>
                        {formatDistanceToNow(new Date(delivery.createdAt), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-1.5">
                      {delivery.status === "pending" && (
                        <div>
                          <label className="text-xs text-gray-600 block mb-1">
                            Assigner à un coursier :
                          </label>
                          <select
                            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) {
                                onAssign(delivery.id, e.target.value);
                                setExpandedId(null);
                              }
                            }}
                          >
                            <option value="">Choisir un coursier...</option>
                            {availableCouriers.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} ({c.status === "available" ? "Disponible" : "En course"})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {delivery.status === "assigned" && (
                        <button
                          onClick={() => { onStatusChange(delivery.id, "pickup"); setExpandedId(null); }}
                          className="w-full text-xs bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg hover:bg-purple-200 flex items-center justify-center gap-1"
                        >
                          <Package size={12} />
                          Marquer comme récupérée
                        </button>
                      )}

                      {delivery.status === "picked_up" && (
                        <button
                          onClick={() => { onStatusChange(delivery.id, "deliver"); setExpandedId(null); }}
                          className="w-full text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200 flex items-center justify-center gap-1"
                        >
                          <CheckCircle size={12} />
                          Marquer comme livrée
                        </button>
                      )}

                      {["pending", "assigned"].includes(delivery.status) && (
                        <button
                          onClick={() => { onStatusChange(delivery.id, "cancel"); setExpandedId(null); }}
                          className="w-full text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-100 flex items-center justify-center gap-1"
                        >
                          <XCircle size={12} />
                          Annuler
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
