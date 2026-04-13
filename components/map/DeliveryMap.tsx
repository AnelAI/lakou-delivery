"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Courier, Delivery, LocationUpdate } from "@/lib/types";
import { getPusherClient, ADMIN_CHANNEL, EVENTS } from "@/lib/pusher-client";
import { getOsrmRoute } from "@/lib/osrm";

interface Props {
  couriers: Courier[];
  deliveries: Delivery[];
  selectedCourierId?: string | null;
  onCourierClick?: (courier: Courier) => void;
}

export function DeliveryMap({ couriers, deliveries, selectedCourierId, onCourierClick }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const markersRef = useRef<Map<string, unknown>>(new Map());
  const deliveryMarkersRef = useRef<unknown[]>([]);
  const trailsRef = useRef<Map<string, [number, number][]>>(new Map());
  const trailLinesRef = useRef<Map<string, unknown>>(new Map());
  const deliveryRouteCacheRef = useRef<Map<string, [number, number][]>>(new Map());
  const [isLoaded, setIsLoaded] = useState(false);

  // Bizerte, Tunisie
  const DEFAULT_CENTER: [number, number] = [37.2744, 9.8739];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available": return "#22c55e";
      case "busy": return "#3b82f6";
      case "paused": return "#eab308";
      default: return "#6b7280";
    }
  };

  const createCourierIcon = useCallback((L: typeof import("leaflet"), courier: Courier) => {
    const color = getStatusColor(courier.status);
    const hasAlert = courier.alerts && courier.alerts.length > 0;
    const svg = `
      <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="18" r="16" fill="${color}" stroke="white" stroke-width="3"/>
        ${hasAlert ? '<circle cx="32" cy="6" r="6" fill="#ef4444"/>' : ''}
        <text x="20" y="23" font-size="14" text-anchor="middle" fill="white">🏍️</text>
        <polygon points="20,46 13,30 27,30" fill="${color}"/>
      </svg>
    `;
    return L.divIcon({
      html: svg,
      iconSize: [40, 50],
      iconAnchor: [20, 50],
      popupAnchor: [0, -50],
      className: "",
    });
  }, []);

  const createDeliveryIcon = useCallback((L: typeof import("leaflet"), type: "pickup" | "delivery") => {
    const color = type === "pickup" ? "#8b5cf6" : "#f97316";
    const emoji = type === "pickup" ? "📦" : "🏠";
    const svg = `
      <svg width="32" height="40" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="14" r="12" fill="${color}" stroke="white" stroke-width="2"/>
        <text x="16" y="19" font-size="12" text-anchor="middle" fill="white">${emoji}</text>
        <polygon points="16,38 10,22 22,22" fill="${color}"/>
      </svg>
    `;
    return L.divIcon({
      html: svg,
      iconSize: [32, 40],
      iconAnchor: [16, 40],
      popupAnchor: [0, -40],
      className: "",
    });
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    import("leaflet").then((L) => {
      // Fix default icon issue with Next.js
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current!, {
        center: DEFAULT_CENTER,
        zoom: 13,
        zoomControl: true,
      });

      // CartoDB Positron — style épuré proche de Google Maps
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          subdomains: "abcd",
          maxZoom: 20,
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
        }
      ).addTo(map);

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

  // Update courier markers
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current) return;

    import("leaflet").then((L) => {
      const map = mapInstanceRef.current as import("leaflet").Map;
      const existingIds = new Set<string>();

      couriers.forEach((courier) => {
        if (!courier.currentLat || !courier.currentLng) return;
        existingIds.add(courier.id);

        const latlng: [number, number] = [courier.currentLat, courier.currentLng];
        const icon = createCourierIcon(L, courier);

        const popupContent = `
          <div class="p-2 min-w-[160px]">
            <div class="font-bold text-gray-800">${courier.name}</div>
            <div class="text-sm text-gray-500">${courier.phone}</div>
            <div class="mt-1 text-xs">
              <span class="inline-block px-2 py-0.5 rounded-full ${
                courier.status === "available" ? "bg-green-100 text-green-700" :
                courier.status === "busy" ? "bg-blue-100 text-blue-700" :
                courier.status === "paused" ? "bg-yellow-100 text-yellow-700" :
                "bg-gray-100 text-gray-600"
              }">
                ${courier.status === "available" ? "Disponible" :
                  courier.status === "busy" ? "En livraison" :
                  courier.status === "paused" ? "En pause" : "Hors ligne"}
              </span>
            </div>
            ${courier.speed > 0 ? `<div class="text-xs text-gray-500 mt-1">Vitesse: ${Math.round(courier.speed)} km/h</div>` : ""}
            ${courier.deliveries?.length ? `<div class="text-xs text-blue-600 mt-1">${courier.deliveries.length} course(s) en cours</div>` : ""}
          </div>
        `;

        if (markersRef.current.has(courier.id)) {
          const marker = markersRef.current.get(courier.id) as import("leaflet").Marker;
          marker.setLatLng(latlng);
          marker.setIcon(icon);
          marker.setPopupContent(popupContent);
        } else {
          const marker = L.marker(latlng, { icon })
            .addTo(map)
            .bindPopup(popupContent);

          if (onCourierClick) {
            marker.on("click", () => onCourierClick(courier));
          }
          markersRef.current.set(courier.id, marker);
        }
      });

      // Remove markers for couriers no longer in list or without position
      markersRef.current.forEach((marker, id) => {
        if (!existingIds.has(id)) {
          (marker as import("leaflet").Marker).remove();
          markersRef.current.delete(id);
        }
      });
    });
  }, [couriers, isLoaded, createCourierIcon, onCourierClick]);

  // Update delivery markers + real road routes via OSRM
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current) return;

    const activeDeliveries = deliveries.filter((d) =>
      ["assigned", "picked_up", "pending"].includes(d.status)
    );

    const draw = async () => {
      // Pre-fetch routes for all non-pending deliveries
      const routes = new Map<string, [number, number][] | null>();
      await Promise.all(
        activeDeliveries
          .filter((d) => d.status !== "pending")
          .map(async (d) => {
            const cacheKey = `${d.id}-${d.status}`;
            if (deliveryRouteCacheRef.current.has(cacheKey)) {
              routes.set(d.id, deliveryRouteCacheRef.current.get(cacheKey)!);
            } else {
              const route = await getOsrmRoute([
                [d.pickupLat, d.pickupLng],
                [d.deliveryLat, d.deliveryLng],
              ]);
              if (route) deliveryRouteCacheRef.current.set(cacheKey, route);
              routes.set(d.id, route);
            }
          })
      );

      import("leaflet").then((L) => {
        const map = mapInstanceRef.current as import("leaflet").Map;

        // Clear existing delivery markers
        deliveryMarkersRef.current.forEach((m) =>
          (m as import("leaflet").Marker).remove()
        );
        deliveryMarkersRef.current = [];

        activeDeliveries.forEach((delivery) => {
          const pickupIcon = createDeliveryIcon(L, "pickup");
          const deliveryIcon = createDeliveryIcon(L, "delivery");
          const courierName = delivery.courier?.name ?? "";

          const pickupMarker = L.marker(
            [delivery.pickupLat, delivery.pickupLng],
            { icon: pickupIcon }
          )
            .addTo(map)
            .bindPopup(
              `<div class="p-2"><div class="font-bold text-purple-700">📦 Collecte</div><div class="text-sm">${delivery.pickupAddress}</div><div class="text-xs text-gray-500">Client : ${delivery.customerName}</div>${courierName ? `<div class="text-xs text-blue-600 mt-1">🏍️ ${courierName}</div>` : ""}</div>`
            );

          const deliveryMarker = L.marker(
            [delivery.deliveryLat, delivery.deliveryLng],
            { icon: deliveryIcon }
          )
            .addTo(map)
            .bindPopup(
              `<div class="p-2"><div class="font-bold text-orange-700">🏠 Livraison</div><div class="text-sm">${delivery.deliveryAddress}</div><div class="text-xs text-gray-500">${delivery.orderNumber}</div></div>`
            );

          deliveryMarkersRef.current.push(pickupMarker, deliveryMarker);

          if (delivery.status !== "pending") {
            const roadRoute = routes.get(delivery.id);
            if (roadRoute && roadRoute.length >= 2) {
              // Tracé routier réel (OSRM)
              const color =
                delivery.status === "picked_up" ? "#f97316" : "#3b82f6";
              const line = L.polyline(roadRoute, {
                color,
                weight: 4,
                opacity: 0.65,
                lineCap: "round",
                lineJoin: "round",
              }).addTo(map);
              deliveryMarkersRef.current.push(line);
            } else {
              // Fallback : ligne droite si OSRM indisponible
              const line = L.polyline(
                [
                  [delivery.pickupLat, delivery.pickupLng],
                  [delivery.deliveryLat, delivery.deliveryLng],
                ],
                { color: "#3b82f6", weight: 2, opacity: 0.4, dashArray: "6,6" }
              ).addTo(map);
              deliveryMarkersRef.current.push(line);
            }
          }
        });
      });
    };

    draw();
  }, [deliveries, isLoaded, createDeliveryIcon]);

  // Center map on selected courier
  useEffect(() => {
    if (!isLoaded || !selectedCourierId || !mapInstanceRef.current) return;
    const courier = couriers.find((c) => c.id === selectedCourierId);
    if (courier?.currentLat && courier?.currentLng) {
      const map = mapInstanceRef.current as import("leaflet").Map;
      map.setView([courier.currentLat, courier.currentLng], 15, { animate: true });
      const marker = markersRef.current.get(courier.id) as import("leaflet").Marker | undefined;
      marker?.openPopup();
    }
  }, [selectedCourierId, couriers, isLoaded]);

  // Real-time location updates via Pusher — smooth movement + GPS trail
  useEffect(() => {
    const client = getPusherClient();
    const channel = client.subscribe(ADMIN_CHANNEL);

    channel.bind(EVENTS.COURIER_LOCATION_UPDATE, (data: LocationUpdate) => {
      if (!isLoaded || !mapInstanceRef.current) return;

      import("leaflet").then((L) => {
        const map = mapInstanceRef.current as import("leaflet").Map;
        const latlng: [number, number] = [data.lat, data.lng];

        // ── Update or create marker ──────────────────────────────────────────
        const marker = markersRef.current.get(data.courierId);
        if (marker) {
          // Smooth CSS transition on the marker element
          const el = (marker as import("leaflet").Marker).getElement();
          if (el) el.style.transition = "transform 0.9s linear";
          (marker as import("leaflet").Marker).setLatLng(latlng);
        } else {
          const color = getStatusColor(data.status);
          const svg = `<svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="18" r="16" fill="${color}" stroke="white" stroke-width="3"/><text x="20" y="23" font-size="14" text-anchor="middle" fill="white">🏍️</text><polygon points="20,46 13,30 27,30" fill="${color}"/></svg>`;
          const icon = L.divIcon({ html: svg, iconSize: [40, 50], iconAnchor: [20, 50], popupAnchor: [0, -50], className: "" });
          const newMarker = L.marker(latlng, { icon }).addTo(map);
          markersRef.current.set(data.courierId, newMarker);
        }

        // ── GPS trail ─────────────────────────────────────────────────────────
        const trail = trailsRef.current.get(data.courierId) ?? [];
        trail.push(latlng);
        if (trail.length > 150) trail.shift();
        trailsRef.current.set(data.courierId, trail);

        if (trail.length >= 2) {
          const existingLine = trailLinesRef.current.get(data.courierId);
          if (existingLine) {
            (existingLine as import("leaflet").Polyline).setLatLngs(trail);
          } else {
            const line = L.polyline(trail, {
              color: getStatusColor(data.status),
              weight: 3,
              opacity: 0.5,
              lineCap: "round",
              lineJoin: "round",
              dashArray: undefined,
            }).addTo(map);
            trailLinesRef.current.set(data.courierId, line);
          }
        }
      });
    });

    return () => {
      channel.unbind(EVENTS.COURIER_LOCATION_UPDATE);
      client.unsubscribe(ADMIN_CHANNEL);
      // Clean up trail polylines
      trailLinesRef.current.forEach((line) =>
        (line as import("leaflet").Polyline).remove()
      );
      trailLinesRef.current.clear();
      trailsRef.current.clear();
    };
  }, [isLoaded]);

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
    </div>
  );
}
