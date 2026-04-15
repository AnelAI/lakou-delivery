"use client";

import { useState } from "react";
import type { Courier } from "@/lib/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";
import {
  Phone, MapPin, Package, ChevronRight,
  Wifi, WifiOff, AlertTriangle, Bike, LayoutDashboard,
  Eye, EyeOff,
} from "lucide-react";

interface Props {
  couriers: Courier[];
  selectedId?: string | null;
  onSelect: (courier: Courier) => void;
  onAdd: () => void;
  // Map visibility
  courierColors: Map<string, string>;
  visibleIds: Set<string>;       // empty = all visible
  onToggleVisible: (id: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
}

export function CourierPanel({
  couriers, selectedId, onSelect, onAdd,
  courierColors, visibleIds, onToggleVisible, onShowAll, onHideAll,
}: Props) {
  const [search, setSearch] = useState("");

  const filtered = couriers.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  );
  const statusOrder: Record<string, number> = { busy: 0, available: 1, paused: 2, offline: 3 };
  const sorted = [...filtered].sort(
    (a, b) => (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4)
  );

  const activeCouriers = couriers.filter((c) => c.status !== "offline");
  const visibleCount = visibleIds.size === 0 ? activeCouriers.length : visibleIds.size;
  const isVisible = (id: string) => visibleIds.size === 0 || visibleIds.has(id);

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Header */}
      <div className="p-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
            <Bike size={16} className="text-blue-600" />
            Coursiers
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
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
        {/* Show all / hide all */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500">
            {visibleCount}/{activeCouriers.length} affichés
          </span>
          <div className="flex gap-2">
            <button
              onClick={onShowAll}
              className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5"
            >
              <Eye size={11} /> Tous
            </button>
            <button
              onClick={onHideAll}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5"
            >
              <EyeOff size={11} /> Aucun
            </button>
          </div>
        </div>
      </div>

      {/* Courier list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">Aucun coursier trouvé</div>
        ) : (
          sorted.map((courier) => {
            const color    = courierColors.get(courier.id) ?? "#6b7280";
            const visible  = isVisible(courier.id);
            const isOffline = courier.status === "offline";
            return (
              <div
                key={courier.id}
                className={`border-b border-gray-100 transition-colors ${
                  !visible ? "opacity-40" : ""
                } ${selectedId === courier.id ? "bg-blue-50" : "hover:bg-gray-50"}`}
              >
                <div className="flex items-stretch">
                  {/* Color swatch / visibility toggle */}
                  <button
                    onClick={() => !isOffline && onToggleVisible(courier.id)}
                    disabled={isOffline}
                    className="w-7 flex-shrink-0 flex items-center justify-center transition-opacity"
                    title={visible ? "Masquer sur la carte" : "Afficher sur la carte"}
                    style={{ background: visible && !isOffline ? color + "22" : "transparent" }}
                  >
                    <span
                      className="w-3 h-3 rounded-full border-2"
                      style={{
                        background: visible && !isOffline ? color : "transparent",
                        borderColor: isOffline ? "#9ca3af" : color,
                      }}
                    />
                  </button>

                  {/* Main row (center on map) */}
                  <button
                    onClick={() => onSelect(courier)}
                    className="flex-1 text-left p-2.5 pr-3"
                  >
                    <div className="flex items-center gap-2">
                      {/* Avatar with courier color */}
                      <div className="relative flex-shrink-0">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                          style={{ background: isOffline ? "#9ca3af" : color }}
                        >
                          {courier.name.charAt(0).toUpperCase()}
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                            courier.status === "available" ? "bg-green-500" :
                            courier.status === "busy"      ? "bg-blue-500"  :
                            courier.status === "paused"    ? "bg-yellow-500": "bg-gray-400"
                          }`}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm text-gray-800 truncate">
                            {courier.name}
                          </span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {courier.alerts && courier.alerts.length > 0 && (
                              <AlertTriangle size={12} className="text-red-500" />
                            )}
                            {courier.status !== "offline"
                              ? <Wifi size={11} className="text-green-500" />
                              : <WifiOff size={11} className="text-gray-400" />}
                            <ChevronRight size={12} className="text-gray-400" />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-0.5">
                          <StatusBadge type="courier" value={courier.status} />
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                          {courier.deliveries && courier.deliveries.length > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Package size={9} />
                              {courier.deliveries.length}
                            </span>
                          )}
                          {courier.currentLat && (
                            <span className="flex items-center gap-0.5">
                              <MapPin size={9} />
                              GPS
                            </span>
                          )}
                          {courier.lastSeen && (
                            <span className="truncate">
                              {formatDistanceToNow(new Date(courier.lastSeen), {
                                addSuffix: true, locale: fr,
                              })}
                            </span>
                          )}
                        </div>

                        {courier.phone && (
                          <div className="flex items-center gap-0.5 text-xs text-gray-400 mt-0.5">
                            <Phone size={9} />
                            {courier.phone}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 bg-gray-50">
        <div className="p-2">
          <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
            <div>
              <div className="font-semibold text-green-600">
                {couriers.filter((c) => c.status === "available").length}
              </div>
              <div className="text-gray-500">Dispo</div>
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
        <Link
          href="/couriers"
          className="flex items-center justify-center gap-2 w-full py-2 bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
        >
          <LayoutDashboard size={13} />
          Tableau de bord complet
          <ChevronRight size={12} />
        </Link>
      </div>
    </div>
  );
}
