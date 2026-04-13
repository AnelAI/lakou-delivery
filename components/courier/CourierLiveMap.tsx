"use client";

import { useEffect, useRef } from "react";
import type { Delivery } from "@/lib/types";

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
  const routeLinesRef = useRef<import("leaflet").Layer[]>([]);
  const trailPointsRef = useRef<[number, number][]>([]);
  const trailLineRef = useRef<import("leaflet").Polyline | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    import("leaflet").then((L) => {
      const center: [number, number] = position
        ? [position.lat, position.lng]
        : [36.8065, 10.1815];

      const map = L.map(mapRef.current!, {
        center,
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

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

  // Update courier position on map
  useEffect(() => {
    if (!mapInstanceRef.current || !position) return;

    import("leaflet").then((L) => {
      const map = mapInstanceRef.current!;
      const latlng: [number, number] = [position.lat, position.lng];

      // Remove old markers
      posMarkerRef.current?.remove();
      accuracyCircleRef.current?.remove();
      headingMarkerRef.current?.remove();

      // Accuracy circle
      if (position.accuracy && position.accuracy < 200) {
        accuracyCircleRef.current = L.circle(latlng, {
          radius: position.accuracy,
          color: "#3b82f6",
          fillColor: "#3b82f6",
          fillOpacity: 0.08,
          weight: 1,
          opacity: 0.4,
        }).addTo(map);
      }

      // Position dot (blue)
      posMarkerRef.current = L.circleMarker(latlng, {
        radius: 10,
        color: "white",
        weight: 3,
        fillColor: "#3b82f6",
        fillOpacity: 1,
      }).addTo(map);

      // Heading arrow
      if (position.heading !== undefined && position.heading !== null) {
        const svg = `
          <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
            <polygon points="20,2 26,24 20,20 14,24" fill="#3b82f6" opacity="0.8"
              transform="rotate(${position.heading}, 20, 20)"/>
          </svg>`;
        const icon = L.divIcon({
          html: svg, iconSize: [40, 40], iconAnchor: [20, 20], className: "",
        });
        headingMarkerRef.current = L.marker(latlng, { icon, interactive: false }).addTo(map);
      }

      // GPS trail — append position and keep last 200 points
      trailPointsRef.current.push(latlng);
      if (trailPointsRef.current.length > 200) trailPointsRef.current.shift();

      if (trailPointsRef.current.length >= 2) {
        if (trailLineRef.current) {
          trailLineRef.current.setLatLngs(trailPointsRef.current);
        } else {
          trailLineRef.current = L.polyline(trailPointsRef.current, {
            color: "#3b82f6",
            weight: 4,
            opacity: 0.55,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(map);
        }
      }

      // Pan map to follow courier (smooth)
      map.panTo(latlng, { animate: true, duration: 0.5 });
    });
  }, [position]);

  // Update delivery markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    import("leaflet").then((L) => {
      const map = mapInstanceRef.current!;

      // Clear old delivery markers and route lines
      deliveryMarkersRef.current.forEach((m) => m.remove());
      routeLinesRef.current.forEach((l) => l.remove());
      deliveryMarkersRef.current = [];
      routeLinesRef.current = [];

      const active = deliveries.filter((d) => ["assigned", "picked_up"].includes(d.status));

      active.forEach((delivery) => {
        const isTarget = delivery.id === targetDeliveryId;
        const isPickedUp = delivery.status === "picked_up";
        const targetLat = isPickedUp ? delivery.deliveryLat : delivery.pickupLat;
        const targetLng = isPickedUp ? delivery.deliveryLng : delivery.pickupLng;

        // Next target marker (pulsing if current target)
        const color = isPickedUp ? "#f97316" : "#8b5cf6";
        const emoji = isPickedUp ? "🏠" : "📦";
        const pulseClass = isTarget ? "animate-ping" : "";

        const svg = `
          <div style="position:relative;width:44px;height:54px">
            ${isTarget ? `<div style="position:absolute;top:2px;left:2px;width:40px;height:40px;border-radius:50%;background:${color};opacity:0.3;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite"></div>` : ""}
            <svg width="44" height="54" viewBox="0 0 44 54" xmlns="http://www.w3.org/2000/svg">
              <circle cx="22" cy="20" r="18" fill="${color}" stroke="white" stroke-width="3"/>
              <text x="22" y="26" font-size="14" text-anchor="middle" fill="white">${emoji}</text>
              <polygon points="22,50 14,32 30,32" fill="${color}"/>
            </svg>
          </div>`;

        const icon = L.divIcon({
          html: svg, iconSize: [44, 54], iconAnchor: [22, 54], popupAnchor: [0, -54], className: "",
        });

        const popup = `
          <div style="font-family:sans-serif;min-width:140px;padding:4px">
            <div style="font-weight:600;color:${color}">${isPickedUp ? "🏠 Livraison" : "📦 Collecte"}</div>
            <div style="font-size:12px;margin-top:2px">${isPickedUp ? delivery.deliveryAddress : delivery.pickupAddress}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:2px">Client: ${delivery.customerName}</div>
          </div>`;

        const m = L.marker([targetLat, targetLng], { icon })
          .addTo(map)
          .bindPopup(popup);
        deliveryMarkersRef.current.push(m);

        // Draw route line from courier to target
        if (position) {
          const routeLine = L.polyline(
            [[position.lat, position.lng], [targetLat, targetLng]],
            {
              color: isTarget ? color : "#6b7280",
              weight: isTarget ? 3 : 2,
              opacity: isTarget ? 0.7 : 0.3,
              dashArray: "8, 6",
            }
          ).addTo(map);
          routeLinesRef.current.push(routeLine);
        }
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveries, targetDeliveryId, position?.lat, position?.lng]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden">
      <div ref={mapRef} className="w-full h-full" />
      {/* Map overlay: compass indicator */}
      <div className="absolute top-2 left-2 bg-gray-900/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-lg">
        📍 Position live
      </div>
    </div>
  );
}
