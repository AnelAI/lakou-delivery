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
  showRoute?: boolean;
}

const DEFAULT_CENTER = { lat: 37.2744, lng: 9.8739 };
const LIBRARIES: ("geometry" | "places")[] = [];

type LatLng = { lat: number; lng: number };

function toLatLng([lat, lng]: [number, number]): LatLng {
  return { lat, lng };
}

export function CourierLiveMap({ position, deliveries, targetDeliveryId, showRoute = false }: Props) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    libraries: LIBRARIES,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const trailPointsRef = useRef<LatLng[]>([]);
  const routeCacheRef = useRef<Map<string, LatLng[]>>(new Map());
  const showRouteRef = useRef(showRoute);

  const [trail, setTrail] = useState<LatLng[]>([]);
  const [activeRoute, setActiveRoute] = useState<LatLng[] | null>(null);
  const [secondaryLines, setSecondaryLines] = useState<{ start: LatLng; end: LatLng }[]>([]);

  useEffect(() => { showRouteRef.current = showRoute; }, [showRoute]);

  const active = deliveries.filter((d) => ["assigned", "picked_up"].includes(d.status));
  const currentTarget =
    (targetDeliveryId ? active.find((d) => d.id === targetDeliveryId) : null) ??
    active[0] ??
    null;

  // Target center: pickup if assigned, delivery address if picked_up
  const targetCenter = currentTarget
    ? {
        lat: currentTarget.status === "picked_up" ? currentTarget.deliveryLat : currentTarget.pickupLat,
        lng: currentTarget.status === "picked_up" ? currentTarget.deliveryLng : currentTarget.pickupLng,
      }
    : null;

  const targetCenterRef = useRef(targetCenter);
  useEffect(() => { targetCenterRef.current = targetCenter; }, [targetCenter]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    // Initial zoom: target point if showRoute=false, else courier position
    if (!showRouteRef.current && targetCenterRef.current) {
      map.panTo(targetCenterRef.current);
      map.setZoom(16);
    } else if (showRouteRef.current && position) {
      map.panTo({ lat: position.lat, lng: position.lng });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When showRoute toggles: pan to the right focus
  useEffect(() => {
    if (!mapRef.current) return;
    if (!showRoute) {
      if (targetCenterRef.current) {
        mapRef.current.panTo(targetCenterRef.current);
        mapRef.current.setZoom(16);
      }
    } else if (position) {
      mapRef.current.panTo({ lat: position.lat, lng: position.lng });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRoute]);

  // When target changes (pickup → delivery), re-zoom if showRoute=false
  useEffect(() => {
    if (showRouteRef.current || !mapRef.current) return;
    const tc = targetCenterRef.current;
    if (tc) {
      mapRef.current.panTo(tc);
      mapRef.current.setZoom(16);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTarget?.id, currentTarget?.status]);

  // Trail update + map follow on position change
  useEffect(() => {
    if (!position) return;
    const latlng = { lat: position.lat, lng: position.lng };
    trailPointsRef.current.push(latlng);
    if (trailPointsRef.current.length > 200) trailPointsRef.current.shift();
    setTrail([...trailPointsRef.current]);
    // Only follow courier when route is shown
    if (showRouteRef.current) {
      mapRef.current?.panTo(latlng);
    }
  }, [position]);

  // Fetch OSRM routes — always compute and display
  useEffect(() => {
    const updateRoutes = async () => {
      if (currentTarget) {
        const isPickedUp = currentTarget.status === "picked_up";
        const targetLat = isPickedUp ? currentTarget.deliveryLat : currentTarget.pickupLat;
        const targetLng = isPickedUp ? currentTarget.deliveryLng : currentTarget.pickupLng;

        // With GPS: courier → target. Without GPS: pickup → delivery (static overview)
        const fromLat = position ? position.lat : currentTarget.pickupLat;
        const fromLng = position ? position.lng : currentTarget.pickupLng;
        const cacheKey = position
          ? `${currentTarget.id}-${currentTarget.status}-live`
          : `${currentTarget.id}-static`;

        let route = routeCacheRef.current.get(cacheKey);
        if (!route) {
          const osrmRoute = await getOsrmRoute([
            [fromLat, fromLng],
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
  }, [deliveries, targetDeliveryId, position?.lat, position?.lng]);

  const initialCenter =
    !showRoute && targetCenter
      ? targetCenter
      : position
      ? { lat: position.lat, lng: position.lng }
      : DEFAULT_CENTER;

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
        center={initialCenter}
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

        {/* GPS trail — only when route is visible */}
        {showRoute && trail.length >= 2 && (
          <Polyline
            path={trail}
            options={{ strokeColor: "#2563eb", strokeWeight: 4, strokeOpacity: 0.5 }}
          />
        )}

        {/* Courier position marker — always shown */}
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

        {/* Active route — always shown */}
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

        {/* Secondary dashed lines — only when showRoute */}
        {showRoute && secondaryLines.map((line, i) => (
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

        {/* Delivery waypoint markers — always shown */}
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

      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-lg border border-white/10">
        {showRoute
          ? "🗺️ Trajet en cours"
          : currentTarget
          ? currentTarget.status === "picked_up"
            ? "🏠 Destination client"
            : "📦 Point de collecte"
          : "📍 Position live"}
      </div>
    </div>
  );
}
