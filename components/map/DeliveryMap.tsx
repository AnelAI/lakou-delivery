"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Courier, Delivery, LocationUpdate } from "@/lib/types";
import { getPusherClient, ADMIN_CHANNEL, EVENTS } from "@/lib/pusher-client";
import { getOsrmRoute, getOsrmTrip } from "@/lib/osrm";

interface Props {
  couriers: Courier[];
  deliveries: Delivery[];
  selectedCourierId?: string | null;
  onCourierClick?: (courier: Courier) => void;
  courierColors: Map<string, string>;  // courierId → hex color
  visibleIds: Set<string>;             // empty = all visible
}

const DEFAULT_CENTER: [number, number] = [37.2744, 9.8739];

const STATUS_DOT: Record<string, string> = {
  available: "#22c55e",
  busy:      "#3b82f6",
  paused:    "#eab308",
  offline:   "#6b7280",
};

export function DeliveryMap({ couriers, deliveries, selectedCourierId, onCourierClick, courierColors, visibleIds }: Props) {
  const mapRef          = useRef<HTMLDivElement>(null);
  const mapInstanceRef  = useRef<unknown>(null);
  const markersRef      = useRef<Map<string, unknown>>(new Map());
  const delivMarkersRef = useRef<unknown[]>([]);
  const trailsRef       = useRef<Map<string, [number, number][]>>(new Map());
  const trailLinesRef   = useRef<Map<string, unknown>>(new Map());
  const routeCacheRef   = useRef<Map<string, [number, number][]>>(new Map());
  const courierRoutesRef = useRef<Map<string, unknown>>(new Map()); // deliveryId → polyline

  const [isLoaded, setIsLoaded] = useState(false);

  const isVisible = useCallback(
    (courierId: string | null | undefined) =>
      visibleIds.size === 0 || (!!courierId && visibleIds.has(courierId)),
    [visibleIds]
  );

  // Get the map color for a courier (falls back to status-based color)
  const courierColor = useCallback(
    (courierId: string, status?: string) =>
      courierColors.get(courierId) ?? STATUS_DOT[status ?? "offline"] ?? "#6b7280",
    [courierColors]
  );

  // ── Icon factories ──────────────────────────────────────────────────────────
  const createCourierIcon = useCallback((L: typeof import("leaflet"), courier: Courier) => {
    const color   = courierColor(courier.id, courier.status);
    const hasAlert = courier.alerts && courier.alerts.length > 0;
    const svg = `
      <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="18" r="16" fill="${color}" stroke="white" stroke-width="3"/>
        ${hasAlert ? '<circle cx="32" cy="6" r="6" fill="#ef4444"/>' : ""}
        <text x="20" y="23" font-size="14" text-anchor="middle" fill="white">🏍️</text>
        <polygon points="20,46 13,30 27,30" fill="${color}"/>
      </svg>`;
    return L.divIcon({ html: svg, iconSize: [40, 50], iconAnchor: [20, 50], popupAnchor: [0, -50], className: "" });
  }, [courierColor]);

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

  // ── Delivery markers + optimized multi-stop routes ─────────────────────────
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current) return;

    const active = deliveries.filter((d) =>
      ["assigned", "picked_up", "pending"].includes(d.status)
    );

    const draw = async () => {
      // Courier GPS lookup
      const courierPos = new Map(
        couriers
          .filter((c) => c.currentLat && c.currentLng)
          .map((c) => [c.id, [c.currentLat!, c.currentLng!] as [number, number]])
      );

      // ── Group active deliveries by courier ──────────────────────────────────
      // courierGroups[courierId] = array of their active deliveries
      const courierGroups = new Map<string, typeof active>();
      const pending: typeof active = [];

      for (const d of active) {
        if (!d.courierId) { pending.push(d); continue; }
        if (!courierGroups.has(d.courierId)) courierGroups.set(d.courierId, []);
        courierGroups.get(d.courierId)!.push(d);
      }

      // ── For each courier: compute optimized trip ────────────────────────────
      // optimizedRoutes[courierId] = { geometry, stopOrder, distance, duration, orderedDeliveries }
      type CourierTrip = {
        geometry: [number, number][];
        orderedDeliveries: typeof active;  // deliveries in visit order
        distance: number;
        duration: number;
      };
      const courierTrips = new Map<string, CourierTrip>();

      await Promise.all(
        Array.from(courierGroups.entries()).map(async ([courierId, cDelivs]) => {
          const pos = courierPos.get(courierId);
          if (!pos) return; // courier offline, skip route

          // All deliveries already picked_up → heading directly to their destinations
          // Mix of assigned + picked_up: pickups not yet done are stops, then deliveries
          const toPickup   = cDelivs.filter((d) => d.status === "assigned");
          const toDeliver  = cDelivs.filter((d) => d.status === "picked_up");

          if (toPickup.length === 0 && toDeliver.length === 0) return;

          // Unique delivery destinations (deduplicated by lat/lng)
          const destKey = (d: (typeof active)[0]) => `${d.deliveryLat},${d.deliveryLng}`;
          const uniqueDests = [...new Map(cDelivs.map((d) => [destKey(d), d])).values()];

          let geometry: [number, number][] = [];
          let orderedDeliveries: typeof active = [];
          let distance = 0, duration = 0;

          if (toPickup.length >= 2) {
            // ── Multi-stop: optimize pickup order ──────────────────────────────
            const pickupPoints = toPickup.map(
              (d) => [d.pickupLat, d.pickupLng] as [number, number]
            );
            // Use first unique delivery dest as final destination
            // (handles the common case: all same client)
            const finalDest: [number, number] = [
              uniqueDests[0].deliveryLat,
              uniqueDests[0].deliveryLng,
            ];

            const cacheKey = `trip-${courierId}-${toPickup.map((d) => d.id).sort().join("-")}-${Math.round(pos[0] * 1000)}`;
            let trip;
            if (routeCacheRef.current.has(cacheKey)) {
              // cached as serialized TripResult
              const cached = routeCacheRef.current.get(cacheKey)!;
              geometry = cached;
              orderedDeliveries = toPickup; // use as-is for cache hit
              return; // skip re-calculation (route already in cache)
            }
            trip = await getOsrmTrip(pos, pickupPoints, finalDest);

            if (trip) {
              geometry = trip.geometry;
              distance = trip.distance;
              duration = trip.duration;
              // Reorder toPickup deliveries according to optimized stopOrder
              orderedDeliveries = [
                ...trip.stopOrder.map((i) => toPickup[i]),
                ...toDeliver,
              ];
              if (geometry.length > 1) routeCacheRef.current.set(cacheKey, geometry);
            } else {
              // Fallback: keep original order
              orderedDeliveries = [...toPickup, ...toDeliver];
            }

          } else {
            // Single pickup or only deliveries: straight route
            const waypoints: [number, number][] = [pos];
            if (toPickup[0]) waypoints.push([toPickup[0].pickupLat, toPickup[0].pickupLng]);
            // add all delivery destinations
            for (const dd of uniqueDests) waypoints.push([dd.deliveryLat, dd.deliveryLng]);

            const cacheKey = `route-${courierId}-${cDelivs.map((d) => d.id).sort().join("-")}-${Math.round(pos[0] * 1000)}`;
            if (routeCacheRef.current.has(cacheKey)) {
              geometry = routeCacheRef.current.get(cacheKey)!;
            } else {
              geometry = (await getOsrmRoute(waypoints)) ?? waypoints;
              if (geometry.length > 1) routeCacheRef.current.set(cacheKey, geometry);
            }
            orderedDeliveries = [...toPickup, ...toDeliver];
          }

          courierTrips.set(courierId, { geometry, orderedDeliveries, distance, duration });
        })
      );

      // ── Draw everything ─────────────────────────────────────────────────────
      import("leaflet").then((L) => {
        const map = mapInstanceRef.current as import("leaflet").Map;

        delivMarkersRef.current.forEach((m) => (m as import("leaflet").Layer).remove());
        delivMarkersRef.current = [];
        courierRoutesRef.current.forEach((l) => (l as import("leaflet").Layer).remove());
        courierRoutesRef.current.clear();

        // ── Helper: numbered stop icon ──────────────────────────────────────
        const stopIcon = (num: number, color: string) =>
          L.divIcon({
            html: `<svg width="30" height="38" viewBox="0 0 30 38" xmlns="http://www.w3.org/2000/svg">
              <circle cx="15" cy="13" r="11" fill="${color}" stroke="white" stroke-width="2"/>
              <text x="15" y="18" font-size="11" font-weight="bold" text-anchor="middle" fill="white">${num}</text>
              <polygon points="15,36 9,21 21,21" fill="${color}"/>
            </svg>`,
            iconSize: [30, 38], iconAnchor: [15, 38], popupAnchor: [0, -38], className: "",
          });

        const delivIcon = createDeliveryIcon(L, "delivery");

        // ── Draw optimized routes for each courier ──────────────────────────
        courierTrips.forEach((trip, courierId) => {
          const visible = isVisible(courierId);
          const opacity = visible ? 1 : 0.1;
          const courier = couriers.find((c) => c.id === courierId);
          const courierName = courier?.name ?? "";

          // Optimized route polyline — use courier's palette color
          const routeColor = courierColors.get(courierId) ?? "#22c55e";

          if (trip.geometry.length >= 2) {
            const line = L.polyline(trip.geometry, {
              color: routeColor,
              weight: 5,
              opacity: visible ? 0.88 : 0.05,
              lineCap: "round",
              lineJoin: "round",
            }).addTo(map);

            const distKm = trip.distance > 0 ? (trip.distance / 1000).toFixed(1) + " km" : "";
            const durMin = trip.duration > 0 ? Math.round(trip.duration / 60) + " min" : "";
            const label = [
              `🏍️ ${courierName}`,
              `${trip.orderedDeliveries.length} arrêt(s)`,
              distKm, durMin,
            ].filter(Boolean).join(" · ");
            line.bindTooltip(label, { sticky: true });
            courierRoutesRef.current.set(courierId, line);
          }

          // Numbered pickup markers (in visit order)
          trip.orderedDeliveries
            .filter((d) => d.status === "assigned")
            .forEach((d, idx) => {
              const m = L.marker([d.pickupLat, d.pickupLng], {
                icon: stopIcon(idx + 1, routeColor),
                opacity,
              })
                .addTo(map)
                .bindPopup(
                  `<div class="p-2">
                    <div class="font-bold text-purple-700">📦 Collecte #${idx + 1}</div>
                    <div class="text-sm">${d.pickupAddress}</div>
                    <div class="text-xs text-gray-500">Client : ${d.customerName}</div>
                    ${d.notes ? `<div class="text-xs text-gray-600 mt-1">📝 ${d.notes}</div>` : ""}
                    <div class="text-xs text-blue-600 mt-1">🏍️ ${courierName}</div>
                  </div>`
                );
              delivMarkersRef.current.push(m);
            });

          // Delivery destination markers (unique)
          const seen = new Set<string>();
          trip.orderedDeliveries.forEach((d) => {
            const key = `${d.deliveryLat},${d.deliveryLng}`;
            if (seen.has(key)) return;
            seen.add(key);
            const dm = L.marker([d.deliveryLat, d.deliveryLng], { icon: delivIcon, opacity })
              .addTo(map)
              .bindPopup(
                `<div class="p-2">
                  <div class="font-bold text-orange-700">🏠 Livraison</div>
                  <div class="text-sm">${d.deliveryAddress}</div>
                  <div class="text-xs text-gray-500">${d.customerName} · ${d.orderNumber}</div>
                </div>`
              );
            delivMarkersRef.current.push(dm);
          });
        });

        // ── Draw pending deliveries (no courier) ────────────────────────────
        const pickupIcon = createDeliveryIcon(L, "pickup");
        pending.forEach((d) => {
          const pm = L.marker([d.pickupLat, d.pickupLng], { icon: pickupIcon })
            .addTo(map)
            .bindPopup(
              `<div class="p-2"><div class="font-bold text-purple-700">📦 En attente</div><div class="text-sm">${d.pickupAddress}</div><div class="text-xs text-gray-500">${d.customerName}</div></div>`
            );
          const dm = L.marker([d.deliveryLat, d.deliveryLng], { icon: delivIcon })
            .addTo(map)
            .bindPopup(
              `<div class="p-2"><div class="font-bold text-orange-700">🏠 Destination</div><div class="text-sm">${d.deliveryAddress}</div></div>`
            );
          // Simple dashed line for pending
          const line = L.polyline(
            [[d.pickupLat, d.pickupLng], [d.deliveryLat, d.deliveryLng]],
            { color: "#9ca3af", weight: 2, opacity: 0.4, dashArray: "5 5" }
          ).addTo(map);
          delivMarkersRef.current.push(pm, dm, line);
        });

        // ── Draw routes for assigned couriers without GPS (static ref lines) ─
        courierGroups.forEach((cDelivs, courierId) => {
          if (courierTrips.has(courierId)) return; // already handled
          cDelivs.forEach((d) => {
            const line = L.polyline(
              [[d.pickupLat, d.pickupLng], [d.deliveryLat, d.deliveryLng]],
              { color: "#3b82f6", weight: 2, opacity: 0.3, dashArray: "6 4" }
            ).addTo(map);
            delivMarkersRef.current.push(line);
          });
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
        const color  = courierColors.get(data.courierId) ?? STATUS_DOT[data.status] ?? "#6b7280";

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

        // ── Live route: trim consumed path as courier moves ──────────────────
        // Find the route polyline for this courier and shorten it from the front,
        // keeping only the segment ahead of the courier's current position.
        const routeLayer = courierRoutesRef.current.get(data.courierId);
        if (routeLayer) {
          const poly = routeLayer as import("leaflet").Polyline;
          const pts  = poly.getLatLngs() as import("leaflet").LatLng[];
          if (pts.length >= 2) {
            const courierLatLng = L.latLng(data.lat, data.lng);
            // Find the point on the route closest to the courier
            let closestIdx = 0;
            let closestDist = Infinity;
            pts.forEach((p, i) => {
              const d = courierLatLng.distanceTo(p);
              if (d < closestDist) { closestDist = d; closestIdx = i; }
            });
            // Keep from that point forward, prepend exact courier position
            const ahead = pts.slice(closestIdx);
            if (ahead.length >= 1) {
              poly.setLatLngs([courierLatLng, ...ahead]);
            }
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

      {/* ── Legend: one line per visible courier ── */}
      {isLoaded && couriers.some((c) => c.status !== "offline") && (
        <div className="absolute bottom-6 left-3 z-[500] bg-white/90 backdrop-blur-sm rounded-xl shadow border border-gray-100 px-3 py-2 text-xs space-y-1 max-w-[180px]">
          {couriers
            .filter((c) => c.status !== "offline" && isVisible(c.id))
            .map((c) => (
              <div key={c.id} className="flex items-center gap-1.5">
                <span
                  className="w-5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: courierColors.get(c.id) ?? "#6b7280" }}
                />
                <span className="text-gray-700 truncate">{c.name}</span>
              </div>
            ))}
          <div className="flex items-center gap-1.5 pt-0.5 border-t border-gray-100 mt-1">
            <span className="w-5 h-px border-t-2 border-dashed border-gray-400 flex-shrink-0" />
            <span className="text-gray-400">Réf. trajet</span>
          </div>
        </div>
      )}
    </div>
  );
}
