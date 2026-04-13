"use client";

import { useState } from "react";
import type { Courier } from "@/lib/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Phone,
  MapPin,
  Package,
  ChevronRight,
  Wifi,
  WifiOff,
  AlertTriangle,
  Bike,
} from "lucide-react";

interface Props {
  couriers: Courier[];
  selectedId?: string | null;
  onSelect: (courier: Courier) => void;
  onAdd: () => void;
}

export function CourierPanel({ couriers, selectedId, onSelect, onAdd }: Props) {
  const [search, setSearch] = useState("");

  const filtered = couriers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  const statusOrder: Record<string, number> = { busy: 0, available: 1, paused: 2, offline: 3 };
  const sorted = [...filtered].sort(
    (a, b) => (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4)
  );

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Bike size={18} className="text-blue-600" />
            Coursiers
            <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
              {couriers.length}
            </span>
          </h2>
          <button
            onClick={onAdd}
            className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Ajouter
          </button>
        </div>
        <input
          type="text"
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Courier list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">
            Aucun coursier trouvé
          </div>
        ) : (
          sorted.map((courier) => (
            <button
              key={courier.id}
              onClick={() => onSelect(courier)}
              className={`w-full text-left p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                selectedId === courier.id ? "bg-blue-50 border-l-2 border-l-blue-500" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
                      courier.status === "available"
                        ? "bg-green-500"
                        : courier.status === "busy"
                        ? "bg-blue-500"
                        : courier.status === "paused"
                        ? "bg-yellow-500"
                        : "bg-gray-400"
                    }`}
                  >
                    {courier.name.charAt(0).toUpperCase()}
                  </div>
                  {/* Status dot */}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                      courier.status === "available"
                        ? "bg-green-500"
                        : courier.status === "busy"
                        ? "bg-blue-500"
                        : courier.status === "paused"
                        ? "bg-yellow-500"
                        : "bg-gray-400"
                    }`}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-gray-800 truncate">
                      {courier.name}
                    </span>
                    <div className="flex items-center gap-1">
                      {courier.alerts && courier.alerts.length > 0 && (
                        <AlertTriangle size={14} className="text-red-500" />
                      )}
                      {courier.status !== "offline" ? (
                        <Wifi size={12} className="text-green-500" />
                      ) : (
                        <WifiOff size={12} className="text-gray-400" />
                      )}
                      <ChevronRight size={14} className="text-gray-400" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-0.5">
                    <StatusBadge type="courier" value={courier.status} />
                  </div>

                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    {courier.deliveries && courier.deliveries.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Package size={10} />
                        {courier.deliveries.length} course(s)
                      </span>
                    )}
                    {courier.currentLat && (
                      <span className="flex items-center gap-1">
                        <MapPin size={10} />
                        En ligne
                      </span>
                    )}
                    {courier.lastSeen && (
                      <span>
                        {formatDistanceToNow(new Date(courier.lastSeen), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </span>
                    )}
                  </div>

                  {courier.phone && (
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                      <Phone size={10} />
                      {courier.phone}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Summary footer */}
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <div className="font-semibold text-green-600">
              {couriers.filter((c) => c.status === "available").length}
            </div>
            <div className="text-gray-500">Disponibles</div>
          </div>
          <div>
            <div className="font-semibold text-blue-600">
              {couriers.filter((c) => c.status === "busy").length}
            </div>
            <div className="text-gray-500">En course</div>
          </div>
          <div>
            <div className="font-semibold text-gray-500">
              {couriers.filter((c) => c.status === "offline").length}
            </div>
            <div className="text-gray-500">Hors ligne</div>
          </div>
        </div>
      </div>
    </div>
  );
}
