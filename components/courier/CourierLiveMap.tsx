"use client";

import { useEffect, useRef } from "react";
import type { Delivery } from "@/lib/types";
import { getOsrmRoute } from "@/lib/osrm";

interface Position {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
}

interface Props {
  position: Position | null;
  deliveries: Delivery[];
  targetDeliveryId?: string | null;
}

export function CourierLiveMap({ position, deliveries, targetDeliveryId }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const posMarkerRef = useRef<import("leaflet").CircleMarker | null>(null);
  const accuracyCircleRef = useRef<import("leaflet").Circle | null>(null);
  const headingMarkerRef = useRef<import("leaflet").Marker | null>(null);
  const deliveryMarkersRef = useRef<import("leaflet").Layer[]>([]);
  const secondaryLinesRef = useRef<import("leaflet").Layer[]>([]);
  const activeRouteRef = useRef<import("leaflet").Polyline | null>(null);
  const trailPointsRef = useRef<[number, number][]>([]);
  const trailLineRef = useRef<import("leaflet").Polyline | null>(null);
  // Cache routes par delivery ID + status pour ne pas re-fetcher à chaque update GPS
  const routeCacheRef = useRef<Map<string, [number, number][]>>(new Map());

  // ── Initialiser la carte ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    import("leaflet").then((L) => {
      const center: [number, number] = position
        ? [position.lat, position.lng]
        : [37.2744, 9.8739];

      const map = L.map(mapRef.current!, {
        center,
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
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

      L.control.zoom({ position: "bottomright" }).addTo(map);

      mapInstanceRef.current = map;
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Mettre à jour la position du coursier ────────────────────────────────
  useEffect(() => {
    if (!mapInstanceRef.current || !position) return;

    import("leaflet").then((L) => {
      const map = mapInstanceRef.current!;
      const latlng: [number, number] = [position.lat, position.lng];

      posMarkerRef.current?.remove();
      accuracyCircleRef.current?.remove();
      headingMarkerRef.current?.remove();

      // Cercle de précision GPS
      if (position.accuracy && position.accuracy < 200) {
        accuracyCircleRef.current = L.circle(latlng, {
          radius: position.accuracy,
          color: "#2563eb",
          fillColor: "#3b82f6",
          fillOpacity: 0.08,
          weight: 1,
          opacity: 0.4,
        }).addTo(map);
      }

      // Point de position (bleu)
      posMarkerRef.current = L.circleMarker(latlng, {
        radius: 10,
        color: "white",
        weight: 3,
        fillColor: "#2563eb",
        fillOpacity: 1,
      }).addTo(map);

      // Flèche de cap
      if (position.heading != null) {
        const svg = `
          <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
            <polygon points="20,2 26,24 20,20 14,24" fill="#2563eb" opacity="0.85"
              transform="rotate(${position.heading}, 20, 20)"/>
          </svg>`;
        headingMarkerRef.current = L.marker(latlng, {
          icon: L.divIcon({ html: svg, iconSize: [40, 40], iconAnchor: [20, 20], className: "" }),
          interactive: false,
        }).addTo(map);
      }

      // Trail GPS — tracé du chemin parcouru (200 derniers points)
      trailPointsRef.current.push(latlng);
      if (trailPointsRef.current.length > 200) trailPointsRef.current.shift();

      if (trailPointsRef.current.length >= 2) {
        if (trailLineRef.current) {
          trailLineRef.current.setLatLngs(trailPointsRef.current);
        } else {
          trailLineRef.current = L.polyline(trailPointsRef.current, {
            color: "#2563eb",
            weight: 4,
            opacity: 0.5,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(map);
        }
      }

      // Suivre le coursier (centrage fluide)
      map.panTo(latlng, { animate: true, duration: 0.5 });
    });
  }, [position]);

  // ── Marqueurs de livraison + itinéraire OSRM ─────────────────────────────
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const active = deliveries.filter((d) =>
      ["assigned", "picked_up"].includes(d.status)
    );
    const currentTarget =
      (targetDeliveryId
        ? active.find((d) => d.id === targetDeliveryId)
        : null) ?? active[0] ?? null;

    const draw = async () => {
      // Fetcher l'itinéraire OSRM pour la prochaine destination
      let roadRoute: [number, number][] | null = null;
      if (currentTarget && position) {
        const isPickedUp = currentTarget.status === "picked_up";
        const targetLat = isPickedUp
          ? currentTarget.deliveryLat
          : currentTarget.pickupLat;
        const targetLng = isPickedUp
          ? currentTarget.deliveryLng
          : currentTarget.pickupLng;

        const cacheKey = `${currentTarget.id}-${currentTarget.status}`;
        if (routeCacheRef.current.has(cacheKey)) {
          roadRoute = routeCacheRef.current.get(cacheKey)!;
        } else {
          roadRoute = await getOsrmRoute([
            [position.lat, position.lng],
            [targetLat, targetLng],
          ]);
          if (roadRoute) routeCacheRef.current.set(cacheKey, roadRoute);
        }
      }

      import("leaflet").then((L) => {
        const map = mapInstanceRef.current;
        if (!map) return;

        // Nettoyer les anciens éléments
        deliveryMarkersRef.current.forEach((m) => m.remove());
        secondaryLinesRef.current.forEach((l) => l.remove());
        activeRouteRef.current?.remove();
        deliveryMarkersRef.current = [];
        secondaryLinesRef.current = [];
        activeRouteRef.current = null;

        active.forEach((delivery) => {
          const isTarget = delivery.id === currentTarget?.id;
          const isPickedUp = delivery.status === "picked_up";
          const targetLat = isPickedUp
            ? delivery.deliveryLat
            : delivery.pickupLat;
          const targetLng = isPickedUp
            ? delivery.deliveryLng
            : delivery.pickupLng;

          const color = isPickedUp ? "#f97316" : "#7c3aed";
          const emoji = isPickedUp ? "🏠" : "📦";

          const markerHtml = `
            <div style="position:relative;width:44px;height:54px">
              ${isTarget ? `<div style="position:absolute;top:2px;left:2px;width:40px;height:40px;border-radius:50%;background:${color};opacity:0.25;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite"></div>` : ""}
              <svg width="44" height="54" viewBox="0 0 44 54" xmlns="http://www.w3.org/2000/svg">
                <circle cx="22" cy="20" r="18" fill="${color}" stroke="white" stroke-width="3"/>
                <text x="22" y="26" font-size="14" text-anchor="middle" fill="white">${emoji}</text>
                <polygon points="22,50 14,32 30,32" fill="${color}"/>
              </svg>
            </div>`;

          const icon = L.divIcon({
            html: markerHtml,
            iconSize: [44, 54],
            iconAnchor: [22, 54],
            popupAnchor: [0, -54],
            className: "",
          });

          const popup = `
            <div style="font-family:sans-serif;min-width:150px;padding:6px">
              <div style="font-weight:700;color:${color};margin-bottom:4px">${isPickedUp ? "🏠 Livraison" : "📦 Collecte"}</div>
              <div style="font-size:13px">${isPickedUp ? delivery.deliveryAddress : delivery.pickupAddress}</div>
              <div style="font-size:11px;color:#6b7280;margin-top:3px">Client : ${delivery.customerName}</div>
            </div>`;

          const m = L.marker([targetLat, targetLng], { icon })
            .addTo(map)
            .bindPopup(popup);
          deliveryMarkersRef.current.push(m);

          if (isTarget && roadRoute) {
            // Tracé routier réel (OSRM) pour la prochaine destination
            activeRouteRef.current = L.polyline(roadRoute, {
              color,
              weight: 5,
              opacity: 0.75,
              lineCap: "round",
              lineJoin: "round",
            }).addTo(map);
          } else if (position) {
            // Ligne pointillée pour les destinations secondaires
            const line = L.polyline(
              [[position.lat, position.lng], [targetLat, targetLng]],
              { color: "#9ca3af", weight: 2, opacity: 0.4, dashArray: "6,6" }
            ).addTo(map);
            secondaryLinesRef.current.push(line);
          }
        });
      });
    };

    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveries, targetDeliveryId]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden">
      <div ref={mapRef} className="w-full h-full" />
      <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm text-gray-700 text-xs px-2 py-1 rounded-lg shadow-sm border border-gray-200">
        📍 Position live
      </div>
    </div>
  );
}
