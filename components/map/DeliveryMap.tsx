"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Courier, Delivery, LocationUpdate } from "@/lib/types";
import { getPusherClient, ADMIN_CHANNEL, EVENTS } from "@/lib/pusher-client";
import { getOsrmRoute } from "@/lib/osrm";
import { Eye, EyeOff, Users } from "lucide-react";

interface Props {
  couriers: Courier[];
  deliveries: Delivery[];
  selectedCourierId?: string | null;
  onCourierClick?: (courier: Courier) => void;
}

const DEFAULT_CENTER: [number, number] = [37.2744, 9.8739];

const STATUS_COLOR: Record<string, string> = {
  available: "#22c55e",
  busy:      "#3b82f6",
  paused:    "#eab308",
  offline:   "#6b7280",
};

export function DeliveryMap({ couriers, deliveries, selectedCourierId, onCourierClick }: Props) {
  const mapRef          = useRef<HTMLDivElement>(null);
  const mapInstanceRef  = useRef<unknown>(null);
  const markersRef      = useRef<Map<string, unknown>>(new Map());
  const delivMarkersRef = useRef<unknown[]>([]);
  const trailsRef       = useRef<Map<string, [number, number][]>>(new Map());
  const trailLinesRef   = useRef<Map<string, unknown>>(new Map());
  const routeCacheRef   = useRef<Map<string, [number, number][]>>(new Map());
  const courierRoutesRef = useRef<Map<string, unknown>>(new Map()); // deliveryId → polyline

  const [isLoaded, setIsLoaded]         = useState(false);
  const [showFilter, setShowFilter]     = useState(false);
  // Empty set = show all. Non-empty = show only these IDs.
  const [visibleIds, setVisibleIds]     = useState<Set<string>>(new Set());

  const activeCouriers = couriers.filter((c) => c.status !== "offline");

  const isVisible = useCallback(
    (courierId: string | null | undefined) =>
      visibleIds.size === 0 || (!!courierId && visibleIds.has(courierId)),
    [visibleIds]
  );

  const toggleCourier = (id: string) => {
    setVisibleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll  = () => setVisibleIds(new Set());
  const hideAll    = () => setVisibleIds(new Set(activeCouriers.map((c) => c.id)));

  // ── Icon factories ──────────────────────────────────────────────────────────
  const createCourierIcon = useCallback((L: typeof import("leaflet"), courier: Courier) => {
    const color   = STATUS_COLOR[courier.status] ?? "#6b7280";
    const hasAlert = courier.alerts && courier.alerts.length > 0;
    const svg = `
      <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="18" r="16" fill="${color}" stroke="white" stroke-width="3"/>
        ${hasAlert ? '<circle cx="32" cy="6" r="6" fill="#ef4444"/>' : ""}
        <text x="20" y="23" font-size="14" text-anchor="middle" fill="white">🏍️</text>
        <polygon points="20,46 13,30 27,30" fill="${color}"/>
      </svg>`;
    return L.divIcon({ html: svg, iconSize: [40, 50], iconAnchor: [20, 50], popupAnchor: [0, -50], className: "" });
  }, []);

  const createDeliveryIcon = useCallback((L: typeof import("leaflet"), type: "pickup" | "delivery") => {
    const color = type === "pickup" ? "#8b5cf6" : "#f97316";
    const emoji = type === "pickup" ? "📦" : "🏠";
    const svg = `
      <svg width="32" height="40" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="14" r="12" fill="${color}" stroke="white" stroke-width="2"/>
        <text x="16" y="19" font-size="12" text-anchor="middle" fill="white">${emoji}</text>
        <polygon points="16,38 10,22 22,22" fill="${color}"/>
      </svg>`;
    return L.divIcon({ html: svg, iconSize: [32, 40], iconAnchor: [16, 40], popupAnchor: [0, -40], className: "" });
  }, []);

  // ── Init map ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    import("leaflet").then((L) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      const map = L.map(mapRef.current!, { center: DEFAULT_CENTER, zoom: 13 });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd", maxZoom: 20,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/attributions">CARTO</a>',
      }).addTo(map);
      mapInstanceRef.current = map;
      setIsLoaded(true);
    });
    return () => {
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as { remove: () => void }).remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Courier markers (visibility-aware) ─────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current) return;
    import("leaflet").then((L) => {
      const map   = mapInstanceRef.current as import("leaflet").Map;
      const drawn = new Set<string>();

      couriers.forEach((courier) => {
        if (!courier.currentLat || !courier.currentLng) return;
        drawn.add(courier.id);
        const latlng: [number, number] = [courier.currentLat, courier.currentLng];
        const opacity = isVisible(courier.id) ? 1 : 0.15;
        const icon    = createCourierIcon(L, courier);

        const popup = `
          <div class="p-2 min-w-[160px]">
            <div class="font-bold text-gray-800">${courier.name}</div>
            <div class="text-sm text-gray-500">${courier.phone}</div>
            <div class="mt-1 text-xs">
              <span class="inline-block px-2 py-0.5 rounded-full ${
                courier.status === "available" ? "bg-green-100 text-green-700" :
                courier.status === "busy"      ? "bg-blue-100 text-blue-700"  :
                courier.status === "paused"    ? "bg-yellow-100 text-yellow-700" :
                "bg-gray-100 text-gray-600"
              }">
                ${courier.status === "available" ? "Disponible" :
                  courier.status === "busy"      ? "En livraison" :
                  courier.status === "paused"    ? "En pause" : "Hors ligne"}
              </span>
            </div>
            ${courier.speed > 0 ? `<div class="text-xs text-gray-500 mt-1">Vitesse: ${Math.round(courier.speed)} km/h</div>` : ""}
            ${courier.deliveries?.length ? `<div class="text-xs text-blue-600 mt-1">${courier.deliveries.length} course(s) en cours</div>` : ""}
          </div>`;

        if (markersRef.current.has(courier.id)) {
          const m = markersRef.current.get(courier.id) as import("leaflet").Marker;
          m.setLatLng(latlng).setIcon(icon).setOpacity(opacity).setPopupContent(popup);
        } else {
          const m = L.marker(latlng, { icon, opacity }).addTo(map).bindPopup(popup);
          if (onCourierClick) m.on("click", () => onCourierClick(courier));
          markersRef.current.set(courier.id, m);
        }

        // trail line opacity
        const trail = trailLinesRef.current.get(courier.id);
        if (trail) (trail as import("leaflet").Polyline).setStyle({ opacity: isVisible(courier.id) ? 0.5 : 0.05 });
      });

      // Remove stale markers
      markersRef.current.forEach((m, id) => {
        if (!drawn.has(id)) {
          (m as import("leaflet").Marker).remove();
          markersRef.current.delete(id);
        }
      });
    });
  }, [couriers, isLoaded, visibleIds, createCourierIcon, onCourierClick, isVisible]);

  // ── Delivery markers + pickup↔delivery routes + courier→waypoint routes ─────
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current) return;

    const active = deliveries.filter((d) => ["assigned", "picked_up", "pending"].includes(d.status));

    const draw = async () => {
      // Build courier lookup for position
      const courierPos = new Map(
        couriers
          .filter((c) => c.currentLat && c.currentLng)
          .map((c) => [c.id, { lat: c.currentLat!, lng: c.currentLng! }])
      );

      // Pre-fetch all routes needed
      const pickupDelivRoutes = new Map<string, [number, number][] | null>();
      const courierWaypointRoutes = new Map<string, [number, number][] | null>();

      await Promise.all(
        active.flatMap((d) => {
          const tasks = [];

          // Pickup → delivery route (for non-pending)
          if (d.status !== "pending") {
            const cacheKey = `pd-${d.id}-${d.status}`;
            tasks.push(
              (async () => {
                if (routeCacheRef.current.has(cacheKey)) {
                  pickupDelivRoutes.set(d.id, routeCacheRef.current.get(cacheKey)!);
                } else {
                  const r = await getOsrmRoute([
                    [d.pickupLat, d.pickupLng],
                    [d.deliveryLat, d.deliveryLng],
                  ]);
                  if (r) routeCacheRef.current.set(cacheKey, r);
                  pickupDelivRoutes.set(d.id, r);
                }
              })()
            );
          }

          // Courier → next waypoint (only when courier has GPS)
          if (d.courierId && courierPos.has(d.courierId)) {
            const pos = courierPos.get(d.courierId)!;
            // assigned: heading to pickup — picked_up: heading to delivery
            const [destLat, destLng] =
              d.status === "picked_up"
                ? [d.deliveryLat, d.deliveryLng]
                : [d.pickupLat, d.pickupLng];

            const cacheKey = `cw-${d.id}-${Math.round(pos.lat * 1000)}-${Math.round(pos.lng * 1000)}`;
            tasks.push(
              (async () => {
                if (routeCacheRef.current.has(cacheKey)) {
                  courierWaypointRoutes.set(d.id, routeCacheRef.current.get(cacheKey)!);
                } else {
                  const r = await getOsrmRoute([
                    [pos.lat, pos.lng],
                    [destLat, destLng],
                  ]);
                  if (r) routeCacheRef.current.set(cacheKey, r);
                  courierWaypointRoutes.set(d.id, r);
                }
              })()
            );
          }

          return tasks;
        })
      );

      import("leaflet").then((L) => {
        const map = mapInstanceRef.current as import("leaflet").Map;

        // Clear old delivery markers & delivery routes
        delivMarkersRef.current.forEach((m) => (m as import("leaflet").Layer).remove());
        delivMarkersRef.current = [];

        // Clear old courier→waypoint lines
        courierRoutesRef.current.forEach((l) => (l as import("leaflet").Layer).remove());
        courierRoutesRef.current.clear();

        active.forEach((d) => {
          const visible  = isVisible(d.courierId);
          const opacity  = visible ? 1 : 0.12;
          const pickupIcon   = createDeliveryIcon(L, "pickup");
          const delivIcon    = createDeliveryIcon(L, "delivery");
          const courierName  = d.courier?.name ?? "";

          const pm = L.marker([d.pickupLat, d.pickupLng], { icon: pickupIcon, opacity })
            .addTo(map)
            .bindPopup(`<div class="p-2"><div class="font-bold text-purple-700">📦 Collecte</div><div class="text-sm">${d.pickupAddress}</div><div class="text-xs text-gray-500">Client : ${d.customerName}</div>${courierName ? `<div class="text-xs text-blue-600 mt-1">🏍️ ${courierName}</div>` : ""}</div>`);

          const dm = L.marker([d.deliveryLat, d.deliveryLng], { icon: delivIcon, opacity })
            .addTo(map)
            .bindPopup(`<div class="p-2"><div class="font-bold text-orange-700">🏠 Livraison</div><div class="text-sm">${d.deliveryAddress}</div><div class="text-xs text-gray-500">${d.orderNumber}</div></div>`);

          delivMarkersRef.current.push(pm, dm);

          // Pickup ↔ delivery route (reference line, lighter)
          if (d.status !== "pending") {
            const roadRoute = pickupDelivRoutes.get(d.id);
            const lineOpts = {
              color: d.status === "picked_up" ? "#f97316" : "#3b82f6",
              weight: 3,
              opacity: visible ? 0.35 : 0.05,
              lineCap: "round" as const,
              lineJoin: "round" as const,
              dashArray: "8 6",
            };
            const line = roadRoute && roadRoute.length >= 2
              ? L.polyline(roadRoute, lineOpts).addTo(map)
              : L.polyline([[d.pickupLat, d.pickupLng], [d.deliveryLat, d.deliveryLng]], { ...lineOpts, weight: 2 }).addTo(map);
            delivMarkersRef.current.push(line);
          }

          // Courier → next waypoint (solid, animated-looking, prominent)
          const cwRoute = courierWaypointRoutes.get(d.id);
          if (cwRoute && cwRoute.length >= 2) {
            const isPickingUp = d.status === "assigned";
            const color = isPickingUp ? "#22c55e" : "#f97316";
            const line = L.polyline(cwRoute, {
              color,
              weight: 5,
              opacity: visible ? 0.85 : 0.05,
              lineCap: "round",
              lineJoin: "round",
            }).addTo(map);
            // Tooltip on hover
            line.bindTooltip(
              isPickingUp ? `🏍️ → 📦 En route vers collecte (${courierName})` : `🏍️ → 🏠 En route vers livraison (${courierName})`,
              { sticky: true }
            );
            courierRoutesRef.current.set(d.id, line);
          } else if (d.courierId && couriers.find((c) => c.id === d.courierId)?.currentLat) {
            // Fallback straight line
            const pos = courierPos.get(d.courierId!);
            if (pos) {
              const [destLat, destLng] =
                d.status === "picked_up"
                  ? [d.deliveryLat, d.deliveryLng]
                  : [d.pickupLat, d.pickupLng];
              const line = L.polyline([[pos.lat, pos.lng], [destLat, destLng]], {
                color: d.status === "picked_up" ? "#f97316" : "#22c55e",
                weight: 4,
                opacity: visible ? 0.6 : 0.05,
                dashArray: "4 4",
              }).addTo(map);
              courierRoutesRef.current.set(d.id, line);
            }
          }
        });
      });
    };

    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveries, couriers, isLoaded, visibleIds, createDeliveryIcon, isVisible]);

  // ── Center on selected courier ──────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !selectedCourierId || !mapInstanceRef.current) return;
    const c = couriers.find((c) => c.id === selectedCourierId);
    if (c?.currentLat && c?.currentLng) {
      const map = mapInstanceRef.current as import("leaflet").Map;
      map.setView([c.currentLat, c.currentLng], 15, { animate: true });
      (markersRef.current.get(c.id) as import("leaflet").Marker | undefined)?.openPopup();
    }
  }, [selectedCourierId, couriers, isLoaded]);

  // ── Real-time location updates via Pusher ───────────────────────────────────
  useEffect(() => {
    const client  = getPusherClient();
    const channel = client.subscribe(ADMIN_CHANNEL);

    channel.bind(EVENTS.COURIER_LOCATION_UPDATE, (data: LocationUpdate) => {
      if (!isLoaded || !mapInstanceRef.current) return;
      import("leaflet").then((L) => {
        const map    = mapInstanceRef.current as import("leaflet").Map;
        const latlng: [number, number] = [data.lat, data.lng];
        const color  = STATUS_COLOR[data.status] ?? "#6b7280";

        const marker = markersRef.current.get(data.courierId);
        if (marker) {
          const el = (marker as import("leaflet").Marker).getElement();
          if (el) el.style.transition = "transform 0.9s linear";
          (marker as import("leaflet").Marker).setLatLng(latlng);
        } else {
          const svg = `<svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="18" r="16" fill="${color}" stroke="white" stroke-width="3"/><text x="20" y="23" font-size="14" text-anchor="middle" fill="white">🏍️</text><polygon points="20,46 13,30 27,30" fill="${color}"/></svg>`;
          const icon = L.divIcon({ html: svg, iconSize: [40, 50], iconAnchor: [20, 50], popupAnchor: [0, -50], className: "" });
          const m = L.marker(latlng, { icon }).addTo(map);
          markersRef.current.set(data.courierId, m);
        }

        // GPS trail
        const trail = trailsRef.current.get(data.courierId) ?? [];
        trail.push(latlng);
        if (trail.length > 150) trail.shift();
        trailsRef.current.set(data.courierId, trail);

        if (trail.length >= 2) {
          const existing = trailLinesRef.current.get(data.courierId);
          if (existing) {
            (existing as import("leaflet").Polyline).setLatLngs(trail);
          } else {
            const line = L.polyline(trail, {
              color,
              weight: 3,
              opacity: 0.5,
              lineCap: "round",
              lineJoin: "round",
            }).addTo(map);
            trailLinesRef.current.set(data.courierId, line);
          }
        }
      });
    });

    return () => {
      channel.unbind(EVENTS.COURIER_LOCATION_UPDATE);
      client.unsubscribe(ADMIN_CHANNEL);
      trailLinesRef.current.forEach((l) => (l as import("leaflet").Polyline).remove());
      trailLinesRef.current.clear();
      trailsRef.current.clear();
    };
  }, [isLoaded]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full">
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <div className="text-gray-500 flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span>Chargement de la carte...</span>
          </div>
        </div>
      )}
      <div ref={mapRef} className="w-full h-full" />

      {/* ── Courier filter panel ── */}
      {isLoaded && activeCouriers.length > 0 && (
        <div className="absolute top-3 right-3 z-[500]">
          <button
            onClick={() => setShowFilter((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-lg transition-colors ${
              visibleIds.size > 0
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 border border-gray-200"
            }`}
            title="Filtrer par coursier"
          >
            <Users size={13} />
            {visibleIds.size > 0 ? `${visibleIds.size} / ${activeCouriers.length}` : "Tous"}
          </button>

          {showFilter && (
            <div className="mt-1.5 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 min-w-[200px]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-700">Coursiers actifs</span>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="text-xs text-blue-500 hover:underline flex items-center gap-0.5">
                    <Eye size={10} /> Tous
                  </button>
                  <button onClick={hideAll} className="text-xs text-gray-400 hover:underline flex items-center gap-0.5">
                    <EyeOff size={10} /> Aucun
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                {activeCouriers.map((c) => {
                  const checked = visibleIds.size === 0 || visibleIds.has(c.id);
                  const color   = STATUS_COLOR[c.status] ?? "#6b7280";
                  return (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCourier(c.id)}
                        className="rounded"
                      />
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: color }}
                      />
                      <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">{c.name}</span>
                      <span className="text-xs text-gray-400">
                        {c.status === "available" ? "libre" :
                         c.status === "busy"      ? "en course" :
                         c.status === "paused"    ? "pause" : ""}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Legend ── */}
      {isLoaded && (
        <div className="absolute bottom-6 left-3 z-[500] bg-white rounded-xl shadow border border-gray-100 px-3 py-2 text-xs space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-6 h-1 rounded" style={{ background: "#22c55e", display: "inline-block" }} />
            <span className="text-gray-600">En route → collecte</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-1 rounded" style={{ background: "#f97316", display: "inline-block" }} />
            <span className="text-gray-600">En route → livraison</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-1 rounded opacity-50" style={{ background: "#3b82f6", display: "inline-block", border: "1px dashed #3b82f6", height: 0 }} />
            <span className="text-gray-600">Trajet collecte→livraison</span>
          </div>
        </div>
      )}
    </div>
  );
}
