"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { GoogleMap, useJsApiLoader, OverlayView, Polyline } from "@react-google-maps/api";
import type { Courier, Delivery, LocationUpdate } from "@/lib/types";
import { getPusherClient, ADMIN_CHANNEL, EVENTS } from "@/lib/pusher-client";
import { getOsrmRoute, getOsrmTrip } from "@/lib/osrm";

interface Props {
  couriers: Courier[];
  deliveries: Delivery[];
  selectedCourierId?: string | null;
  onCourierClick?: (courier: Courier) => void;
  courierColors: Map<string, string>;
  visibleIds: Set<string>;
}

const DEFAULT_CENTER = { lat: 37.2744, lng: 9.8739 };
const LIBRARIES: ("geometry" | "places")[] = [];

type LatLng = { lat: number; lng: number };

function toLatLng([lat, lng]: [number, number]): LatLng {
  return { lat, lng };
}

const STATUS_DOT: Record<string, string> = {
  available: "#22c55e",
  busy: "#3b82f6",
  paused: "#eab308",
  offline: "#6b7280",
};

interface CourierRoute {
  path: LatLng[];
  orderedDeliveries: Delivery[];
  distance: number;
  duration: number;
}

export function DeliveryMap({
  couriers,
  deliveries,
  selectedCourierId,
  onCourierClick,
  courierColors,
  visibleIds,
}: Props) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    libraries: LIBRARIES,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const routeCacheRef = useRef<Map<string, LatLng[]>>(new Map());

  const [courierRoutes, setCourierRoutes] = useState<Map<string, CourierRoute>>(new Map());
  const [trails, setTrails] = useState<Map<string, LatLng[]>>(new Map());
  const [openPopupId, setOpenPopupId] = useState<string | null>(null);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const isVisible = useCallback(
    (courierId: string | null | undefined) =>
      visibleIds.size === 0 || (!!courierId && visibleIds.has(courierId)),
    [visibleIds]
  );

  const courierColor = useCallback(
    (courierId: string, status?: string) =>
      courierColors.get(courierId) ?? STATUS_DOT[status ?? "offline"] ?? "#6b7280",
    [courierColors]
  );

  // Compute optimized routes when data changes
  useEffect(() => {
    const active = deliveries.filter((d) =>
      ["assigned", "picked_up", "pending"].includes(d.status)
    );

    const courierPos = new Map(
      couriers
        .filter((c) => c.currentLat && c.currentLng)
        .map((c) => [c.id, [c.currentLat!, c.currentLng!] as [number, number]])
    );

    const courierGroups = new Map<string, typeof active>();
    for (const d of active) {
      if (!d.courierId) continue;
      if (!courierGroups.has(d.courierId)) courierGroups.set(d.courierId, []);
      courierGroups.get(d.courierId)!.push(d);
    }

    const computeRoutes = async () => {
      const newRoutes = new Map<string, CourierRoute>();

      await Promise.all(
        Array.from(courierGroups.entries()).map(async ([courierId, cDelivs]) => {
          const pos = courierPos.get(courierId);
          if (!pos) return;

          const toPickup = cDelivs.filter((d) => d.status === "assigned");
          const toDeliver = cDelivs.filter((d) => d.status === "picked_up");
          if (toPickup.length === 0 && toDeliver.length === 0) return;

          const destKey = (d: (typeof active)[0]) => `${d.deliveryLat},${d.deliveryLng}`;
          const uniqueDests = [...new Map(cDelivs.map((d) => [destKey(d), d])).values()];

          let path: LatLng[] = [];
          let orderedDeliveries: typeof active = [];
          let distance = 0;
          let duration = 0;

          if (toPickup.length >= 2) {
            const pickupPoints = toPickup.map((d) => [d.pickupLat, d.pickupLng] as [number, number]);
            const finalDest: [number, number] = [uniqueDests[0].deliveryLat, uniqueDests[0].deliveryLng];
            const cacheKey = `trip-${courierId}-${toPickup.map((d) => d.id).sort().join("-")}-${Math.round(pos[0] * 1000)}`;

            if (routeCacheRef.current.has(cacheKey)) {
              path = routeCacheRef.current.get(cacheKey)!;
              orderedDeliveries = toPickup;
            } else {
              const trip = await getOsrmTrip(pos, pickupPoints, finalDest);
              if (trip) {
                path = trip.geometry.map(toLatLng);
                distance = trip.distance;
                duration = trip.duration;
                orderedDeliveries = [...trip.stopOrder.map((i) => toPickup[i]), ...toDeliver];
                if (path.length > 1) routeCacheRef.current.set(cacheKey, path);
              } else {
                orderedDeliveries = [...toPickup, ...toDeliver];
              }
            }
          } else {
            const waypoints: [number, number][] = [pos];
            if (toPickup[0]) waypoints.push([toPickup[0].pickupLat, toPickup[0].pickupLng]);
            for (const dd of uniqueDests) waypoints.push([dd.deliveryLat, dd.deliveryLng]);

            const cacheKey = `route-${courierId}-${cDelivs.map((d) => d.id).sort().join("-")}-${Math.round(pos[0] * 1000)}`;
            if (routeCacheRef.current.has(cacheKey)) {
              path = routeCacheRef.current.get(cacheKey)!;
            } else {
              const coords = await getOsrmRoute(waypoints);
              path = coords ? coords.map(toLatLng) : waypoints.map(([lat, lng]) => ({ lat, lng }));
              if (path.length > 1) routeCacheRef.current.set(cacheKey, path);
            }
            orderedDeliveries = [...toPickup, ...toDeliver];
          }

          newRoutes.set(courierId, { path, orderedDeliveries, distance, duration });
        })
      );

      setCourierRoutes(newRoutes);
    };

    computeRoutes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveries, couriers]);

  // Center on selected courier
  useEffect(() => {
    if (!selectedCourierId || !mapRef.current) return;
    const c = couriers.find((c) => c.id === selectedCourierId);
    if (c?.currentLat && c?.currentLng) {
      mapRef.current.panTo({ lat: c.currentLat, lng: c.currentLng });
      mapRef.current.setZoom(15);
      setOpenPopupId(selectedCourierId);
    }
  }, [selectedCourierId, couriers]);

  // Real-time location updates via Pusher
  useEffect(() => {
    if (!isLoaded) return;
    const client = getPusherClient();
    const channel = client.subscribe(ADMIN_CHANNEL);

    channel.bind(EVENTS.COURIER_LOCATION_UPDATE, (data: LocationUpdate) => {
      setTrails((prev) => {
        const trail = [...(prev.get(data.courierId) ?? []), { lat: data.lat, lng: data.lng }];
        if (trail.length > 150) trail.shift();
        return new Map(prev).set(data.courierId, trail);
      });
    });

    return () => {
      channel.unbind(EVENTS.COURIER_LOCATION_UPDATE);
      client.unsubscribe(ADMIN_CHANNEL);
    };
  }, [isLoaded]);

  const active = deliveries.filter((d) => ["assigned", "picked_up", "pending"].includes(d.status));
  const pending = active.filter((d) => !d.courierId);

  if (!isLoaded) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
        <div className="text-gray-500 flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>Chargement Google Maps…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={DEFAULT_CENTER}
        zoom={13}
        onLoad={onMapLoad}
        options={{
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        }}
      >
        {/* ── Courier GPS trails ── */}
        {Array.from(trails.entries()).map(([courierId, trail]) => {
          if (trail.length < 2 || !isVisible(courierId)) return null;
          const color = courierColor(courierId);
          return (
            <Polyline
              key={`trail-${courierId}`}
              path={trail}
              options={{ strokeColor: color, strokeWeight: 3, strokeOpacity: isVisible(courierId) ? 0.5 : 0.05 }}
            />
          );
        })}

        {/* ── Optimized routes per courier ── */}
        {Array.from(courierRoutes.entries()).map(([courierId, route]) => {
          if (route.path.length < 2) return null;
          const color = courierColors.get(courierId) ?? "#22c55e";
          const opacity = isVisible(courierId) ? 0.88 : 0.05;
          return (
            <Polyline
              key={`route-${courierId}`}
              path={route.path}
              options={{ strokeColor: color, strokeWeight: 5, strokeOpacity: opacity }}
            />
          );
        })}

        {/* ── Pending delivery dashed lines ── */}
        {pending.map((d) => (
          <Polyline
            key={`pending-${d.id}`}
            path={[
              { lat: d.pickupLat, lng: d.pickupLng },
              { lat: d.deliveryLat, lng: d.deliveryLng },
            ]}
            options={{
              strokeColor: "#9ca3af",
              strokeWeight: 2,
              strokeOpacity: 0,
              icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 0.5, scale: 3, strokeColor: "#9ca3af" }, offset: "0", repeat: "12px" }],
            }}
          />
        ))}

        {/* ── Courier markers ── */}
        {couriers.map((courier) => {
          if (!courier.currentLat || !courier.currentLng) return null;
          const color = courierColor(courier.id, courier.status);
          const opacity = isVisible(courier.id) ? 1 : 0.15;
          const hasAlert = courier.alerts && courier.alerts.length > 0;
          const isOpen = openPopupId === courier.id;

          return (
            <OverlayView
              key={courier.id}
              position={{ lat: courier.currentLat, lng: courier.currentLng }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <div style={{ transform: "translate(-20px, -50px)", opacity, cursor: "pointer" }}
                onClick={() => {
                  setOpenPopupId(isOpen ? null : courier.id);
                  onCourierClick?.(courier);
                }}
              >
                <svg width="40" height="50" viewBox="0 0 40 50">
                  <circle cx="20" cy="18" r="16" fill={color} stroke="white" strokeWidth="3" />
                  {hasAlert && <circle cx="32" cy="6" r="6" fill="#ef4444" />}
                  <text x="20" y="23" fontSize="14" textAnchor="middle" fill="white">🏍️</text>
                  <polygon points="20,46 13,30 27,30" fill={color} />
                </svg>
                {isOpen && (
                  <div style={{
                    position: "absolute", bottom: 54, left: "50%", transform: "translateX(-50%)",
                    background: "white", borderRadius: 8, padding: "8px 12px", minWidth: 160,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)", whiteSpace: "nowrap", zIndex: 10,
                  }}>
                    <div style={{ fontWeight: 700, color: "#1f2937" }}>{courier.name}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{courier.phone}</div>
                    {courier.speed > 0 && (
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                        {Math.round(courier.speed)} km/h
                      </div>
                    )}
                    {courier.deliveries?.length ? (
                      <div style={{ fontSize: 12, color: "#2563eb", marginTop: 2 }}>
                        {courier.deliveries.length} course(s)
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </OverlayView>
          );
        })}

        {/* ── Numbered pickup markers per courier route ── */}
        {Array.from(courierRoutes.entries()).map(([courierId, route]) => {
          const color = courierColors.get(courierId) ?? "#22c55e";
          const opacity = isVisible(courierId) ? 1 : 0.1;
          return route.orderedDeliveries
            .filter((d) => d.status === "assigned")
            .map((d, idx) => (
              <OverlayView
                key={`pickup-${d.id}`}
                position={{ lat: d.pickupLat, lng: d.pickupLng }}
                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              >
                <div style={{ transform: "translate(-15px, -38px)", opacity }}>
                  <svg width="30" height="38" viewBox="0 0 30 38">
                    <circle cx="15" cy="13" r="11" fill={color} stroke="white" strokeWidth="2" />
                    <text x="15" y="18" fontSize="11" fontWeight="bold" textAnchor="middle" fill="white">{idx + 1}</text>
                    <polygon points="15,36 9,21 21,21" fill={color} />
                  </svg>
                </div>
              </OverlayView>
            ));
        })}

        {/* ── Delivery destination markers ── */}
        {Array.from(courierRoutes.entries()).map(([courierId, route]) => {
          const opacity = isVisible(courierId) ? 1 : 0.1;
          const seen = new Set<string>();
          return route.orderedDeliveries.map((d) => {
            const key = `${d.deliveryLat},${d.deliveryLng}`;
            if (seen.has(key)) return null;
            seen.add(key);
            return (
              <OverlayView
                key={`dest-${d.id}`}
                position={{ lat: d.deliveryLat, lng: d.deliveryLng }}
                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              >
                <div style={{ transform: "translate(-16px, -40px)", opacity }}>
                  <svg width="32" height="40" viewBox="0 0 32 40">
                    <circle cx="16" cy="14" r="12" fill="#f97316" stroke="white" strokeWidth="2" />
                    <text x="16" y="19" fontSize="12" textAnchor="middle" fill="white">🏠</text>
                    <polygon points="16,38 10,22 22,22" fill="#f97316" />
                  </svg>
                </div>
              </OverlayView>
            );
          });
        })}

        {/* ── Pending delivery markers (no courier assigned) ── */}
        {pending.map((d) => (
          <OverlayView
            key={`pend-pickup-${d.id}`}
            position={{ lat: d.pickupLat, lng: d.pickupLng }}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
          >
            <div style={{ transform: "translate(-16px, -40px)" }}>
              <svg width="32" height="40" viewBox="0 0 32 40">
                <circle cx="16" cy="14" r="12" fill="#8b5cf6" stroke="white" strokeWidth="2" />
                <text x="16" y="19" fontSize="12" textAnchor="middle" fill="white">📦</text>
                <polygon points="16,38 10,22 22,22" fill="#8b5cf6" />
              </svg>
            </div>
          </OverlayView>
        ))}
      </GoogleMap>

      {/* ── Legend ── */}
      {couriers.some((c) => c.status !== "offline") && (
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
