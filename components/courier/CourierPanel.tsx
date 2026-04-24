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
  Eye, EyeOff, Truck,
} from "lucide-react";

interface Props {
  couriers: Courier[];
  selectedId?: string | null;
  onSelect: (courier: Courier) => void;
  onOpenDeliveries: (courier: Courier) => void;
  onAdd: () => void;
  // Map visibility
  courierColors: Map<string, string>;
  visibleIds: Set<string>;
  onToggleVisible: (id: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
}

export function CourierPanel({
  couriers, selectedId, onSelect, onOpenDeliveries, onAdd,
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
    <div className="flex flex-col h-full bg-white" style={{ borderRight: "1px solid #E8E8E8" }}>
      {/* Header */}
      <div className="p-3" style={{ borderBottom: "1px solid #E8E8E8" }}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold flex items-center gap-2 text-sm" style={{ color: "#0A0A0A", fontFamily: "Archivo, sans-serif", fontWeight: 800 }}>
            <Bike size={15} color="#0A0A0A" />
            Coursiers
            <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "#0A0A0A", color: "#FFFFFF", fontSize: 10 }}>
              {couriers.length}
            </span>
          </h2>
          <button
            onClick={onAdd}
            className="text-xs px-2.5 py-1 rounded-full transition-colors"
            style={{ background: "#FF3B2F", color: "#FFFFFF", fontFamily: "Archivo, sans-serif", fontWeight: 700, border: "none", cursor: "pointer" }}
          >
            + Ajouter
          </button>
        </div>
        <input
          type="text"
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm rounded-lg px-3 py-1.5 focus:outline-none"
          style={{ border: "1px solid #E8E8E8", background: "#F4F4F4", fontSize: 12, color: "#0A0A0A" }}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs" style={{ color: "#5A5A5A" }}>
            {visibleCount}/{activeCouriers.length} affichés
          </span>
          <div className="flex gap-2">
            <button
              onClick={onShowAll}
              className="text-xs flex items-center gap-0.5"
              style={{ color: "#FF3B2F", fontWeight: 700 }}
            >
              <Eye size={11} /> Tous
            </button>
            <button
              onClick={onHideAll}
              className="text-xs flex items-center gap-0.5"
              style={{ color: "#8A8A8A" }}
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
            const color     = courierColors.get(courier.id) ?? "#6b7280";
            const visible   = isVisible(courier.id);
            const isOffline = courier.status === "offline";
            const activeCount = (courier.deliveries ?? []).filter(
              (d) => ["assigned", "picked_up"].includes(d.status)
            ).length;

            return (
              <div
                key={courier.id}
                className="transition-colors"
                style={{
                  borderBottom: "1px solid #F4F4F4",
                  background: selectedId === courier.id ? "rgba(255,59,47,0.04)" : "transparent",
                  borderLeft: selectedId === courier.id ? "3px solid #FF3B2F" : "3px solid transparent",
                }}
              >
                <div className={`flex items-stretch ${!visible ? "opacity-40" : ""}`} style={{ minWidth: 0 }}>
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

                  {/* Main row — click centers map */}
                  <button
                    onClick={() => onSelect(courier)}
                    className="flex-1 min-w-0 text-left p-2.5 overflow-hidden"
                  >
                    <div className="flex items-center gap-2">
                      <div className="relative flex-shrink-0">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                          style={{ background: isOffline ? "#9ca3af" : color }}
                        >
                          {courier.name.charAt(0).toUpperCase()}
                        </div>
                        <span
                          className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white"
                          style={{
                            background:
                              courier.status === "available" ? "#B8FF3E" :
                              courier.status === "busy"      ? "#FF3B2F" :
                              courier.status === "paused"    ? "#FFB800" : "#C8C8C8"
                          }}
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
                              ? <Wifi size={11} color="#3a7d00" />
                              : <WifiOff size={11} color="#C8C8C8" />}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-0.5">
                          <StatusBadge type="courier" value={courier.status} />
                          {activeCount > 0 && (
                            <span className="flex items-center gap-0.5 text-xs font-medium" style={{ color: "#FF3B2F" }}>
                              <Truck size={9} /> {activeCount}
                            </span>
                          )}
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

                  {/* View deliveries button — always visible, fixed width */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenDeliveries(courier); }}
                    className="w-10 flex-shrink-0 flex flex-col items-center justify-center gap-0.5 transition-colors"
                    style={{ color: "#8A8A8A", borderLeft: "1px solid #F4F4F4" }}
                    title="Voir les courses"
                  >
                    <Truck size={14} />
                    <ChevronRight size={11} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid #E8E8E8" }}>
        <div className="p-2">
          <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
            <div>
              <div style={{ fontFamily: "Archivo, sans-serif", fontWeight: 800, fontSize: 16, color: "#3a7d00" }}>
                {couriers.filter((c) => c.status === "available").length}
              </div>
              <div style={{ fontSize: 9, color: "#5A5A5A", textTransform: "uppercase", letterSpacing: "0.06em" }}>Dispo</div>
            </div>
            <div>
              <div style={{ fontFamily: "Archivo, sans-serif", fontWeight: 800, fontSize: 16, color: "#FF3B2F" }}>
                {couriers.filter((c) => c.status === "busy").length}
              </div>
              <div style={{ fontSize: 9, color: "#5A5A5A", textTransform: "uppercase", letterSpacing: "0.06em" }}>En course</div>
            </div>
            <div>
              <div style={{ fontFamily: "Archivo, sans-serif", fontWeight: 800, fontSize: 16, color: "#8A8A8A" }}>
                {couriers.filter((c) => c.status === "offline").length}
              </div>
              <div style={{ fontSize: 9, color: "#5A5A5A", textTransform: "uppercase", letterSpacing: "0.06em" }}>Hors ligne</div>
            </div>
          </div>
        </div>
        <Link
          href="/couriers"
          className="flex items-center justify-center gap-2 w-full py-2 text-xs font-medium transition-colors"
          style={{ background: "#0A0A0A", color: "#FFFFFF", fontFamily: "Archivo, sans-serif", fontWeight: 700 }}
        >
          <LayoutDashboard size={13} />
          Tableau de bord complet
          <ChevronRight size={12} />
        </Link>
      </div>
    </div>
  );
}
