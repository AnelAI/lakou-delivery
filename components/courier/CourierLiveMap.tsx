"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { GoogleMap, useJsApiLoader, OverlayView, Polyline, Circle } from "@react-google-maps/api";
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

const DEFAULT_CENTER = { lat: 37.2744, lng: 9.8739 };
const LIBRARIES: ("geometry" | "places")[] = [];

type LatLng = { lat: number; lng: number };

function toLatLng([lat, lng]: [number, number]): LatLng {
  return { lat, lng };
}

export function CourierLiveMap({ position, deliveries, targetDeliveryId }: Props) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    libraries: LIBRARIES,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const trailPointsRef = useRef<LatLng[]>([]);
  const routeCacheRef = useRef<Map<string, LatLng[]>>(new Map());

  const [trail, setTrail] = useState<LatLng[]>([]);
  const [activeRoute, setActiveRoute] = useState<LatLng[] | null>(null);
  const [secondaryLines, setSecondaryLines] = useState<{ start: LatLng; end: LatLng }[]>([]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Update trail + pan map on position change
  useEffect(() => {
    if (!position) return;
    const latlng = { lat: position.lat, lng: position.lng };
    trailPointsRef.current.push(latlng);
    if (trailPointsRef.current.length > 200) trailPointsRef.current.shift();
    setTrail([...trailPointsRef.current]);
    mapRef.current?.panTo(latlng);
  }, [position]);

  // Update routes when deliveries change
  useEffect(() => {
    const active = deliveries.filter((d) => ["assigned", "picked_up"].includes(d.status));
    const currentTarget =
      (targetDeliveryId ? active.find((d) => d.id === targetDeliveryId) : null) ??
      active[0] ??
      null;

    const updateRoutes = async () => {
      if (currentTarget && position) {
        const isPickedUp = currentTarget.status === "picked_up";
        const targetLat = isPickedUp ? currentTarget.deliveryLat : currentTarget.pickupLat;
        const targetLng = isPickedUp ? currentTarget.deliveryLng : currentTarget.pickupLng;

        const cacheKey = `${currentTarget.id}-${currentTarget.status}`;
        let route = routeCacheRef.current.get(cacheKey);
        if (!route) {
          const osrmRoute = await getOsrmRoute([
            [position.lat, position.lng],
            [targetLat, targetLng],
          ]);
          if (osrmRoute) {
            route = osrmRoute.map(toLatLng);
            routeCacheRef.current.set(cacheKey, route);
          }
        }
        setActiveRoute(route ?? null);
      } else {
        setActiveRoute(null);
      }

      if (position) {
        const secondaries = active
          .filter((d) => d.id !== currentTarget?.id)
          .map((d) => {
            const isPickedUp = d.status === "picked_up";
            return {
              start: { lat: position.lat, lng: position.lng },
              end: {
                lat: isPickedUp ? d.deliveryLat : d.pickupLat,
                lng: isPickedUp ? d.deliveryLng : d.pickupLng,
              },
            };
          });
        setSecondaryLines(secondaries);
      }
    };

    updateRoutes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveries, targetDeliveryId]);

  const active = deliveries.filter((d) => ["assigned", "picked_up"].includes(d.status));
  const currentTarget =
    (targetDeliveryId ? active.find((d) => d.id === targetDeliveryId) : null) ??
    active[0] ??
    null;

  if (!isLoaded) {
    return (
      <div className="relative w-full h-full rounded-2xl overflow-hidden flex items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center gap-2 text-gray-500">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>Chargement Google Maps…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden">
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={position ? { lat: position.lat, lng: position.lng } : DEFAULT_CENTER}
        zoom={16}
        onLoad={onMapLoad}
        options={{
          zoomControl: true,
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        }}
      >
        {/* GPS accuracy circle */}
        {position && (position.accuracy ?? 0) < 200 && position.accuracy && (
          <Circle
            center={{ lat: position.lat, lng: position.lng }}
            radius={position.accuracy}
            options={{
              strokeColor: "#2563eb",
              strokeOpacity: 0.4,
              strokeWeight: 1,
              fillColor: "#3b82f6",
              fillOpacity: 0.08,
              clickable: false,
            }}
          />
        )}

        {/* GPS trail */}
        {trail.length >= 2 && (
          <Polyline
            path={trail}
            options={{ strokeColor: "#2563eb", strokeWeight: 4, strokeOpacity: 0.5 }}
          />
        )}

        {/* Courier position marker */}
        {position && (
          <OverlayView
            position={{ lat: position.lat, lng: position.lng }}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
          >
            <div style={{ transform: "translate(-20px, -20px)", width: 40, height: 40, position: "relative" }}>
              {position.heading != null && (
                <svg width="40" height="40" viewBox="0 0 40 40" style={{ position: "absolute", top: 0, left: 0 }}>
                  <polygon
                    points="20,2 26,24 20,20 14,24"
                    fill="#2563eb"
                    opacity="0.85"
                    transform={`rotate(${position.heading}, 20, 20)`}
                  />
                </svg>
              )}
              <svg width="40" height="40" viewBox="0 0 40 40" style={{ position: "absolute", top: 0, left: 0 }}>
                <circle cx="20" cy="20" r="10" fill="#2563eb" stroke="white" strokeWidth="3" />
              </svg>
            </div>
          </OverlayView>
        )}

        {/* Active route */}
        {activeRoute && activeRoute.length >= 2 && (() => {
          const isPickedUp = currentTarget?.status === "picked_up";
          const color = isPickedUp ? "#f97316" : "#7c3aed";
          return (
            <Polyline
              path={activeRoute}
              options={{ strokeColor: color, strokeWeight: 5, strokeOpacity: 0.75 }}
            />
          );
        })()}

        {/* Secondary dashed lines */}
        {secondaryLines.map((line, i) => (
          <Polyline
            key={i}
            path={[line.start, line.end]}
            options={{
              strokeColor: "#9ca3af",
              strokeWeight: 2,
              strokeOpacity: 0,
              icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3, strokeColor: "#9ca3af" }, offset: "0", repeat: "14px" }],
            }}
          />
        ))}

        {/* Delivery waypoint markers */}
        {active.map((delivery) => {
          const isPickedUp = delivery.status === "picked_up";
          const isTarget = delivery.id === currentTarget?.id;
          const lat = isPickedUp ? delivery.deliveryLat : delivery.pickupLat;
          const lng = isPickedUp ? delivery.deliveryLng : delivery.pickupLng;
          const color = isPickedUp ? "#f97316" : "#7c3aed";
          const emoji = isPickedUp ? "🏠" : "📦";

          return (
            <OverlayView
              key={delivery.id}
              position={{ lat, lng }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <div style={{ transform: "translate(-22px, -54px)", position: "relative", width: 44, height: 54 }}>
                {isTarget && (
                  <div style={{
                    position: "absolute", top: 2, left: 2,
                    width: 40, height: 40, borderRadius: "50%",
                    background: color, opacity: 0.25,
                  }} />
                )}
                <svg width="44" height="54" viewBox="0 0 44 54">
                  <circle cx="22" cy="20" r="18" fill={color} stroke="white" strokeWidth="3" />
                  <text x="22" y="26" fontSize="14" textAnchor="middle" fill="white">{emoji}</text>
                  <polygon points="22,50 14,32 30,32" fill={color} />
                </svg>
              </div>
            </OverlayView>
          );
        })}
      </GoogleMap>

      <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm text-gray-700 text-xs px-2 py-1 rounded-lg shadow-sm border border-gray-200">
        📍 Position live
      </div>
    </div>
  );
}
