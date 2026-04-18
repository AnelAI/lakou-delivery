"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef, use, useCallback } from "react";
import type { Courier, Delivery } from "@/lib/types";
import { useGpsTracking } from "@/lib/useGpsTracking";
import { haversineDistance } from "@/lib/geo";
import { getPusherClient, courierChannel, ADMIN_CHANNEL, EVENTS } from "@/lib/pusher-client";
import {
  Wifi, WifiOff, Navigation, Package, CheckCircle,
  Clock, MapPin, Phone, AlertTriangle, Download,
  ChevronDown, ChevronUp, Signal,
} from "lucide-react";

const CourierLiveMap = dynamic(
  () => import("@/components/courier/CourierLiveMap").then((m) => m.CourierLiveMap),
  { ssr: false }
);

// ── Arrival detection threshold ───────────────────────────────────────────
const ARRIVAL_RADIUS_KM = 0.15; // 150 metres

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function CourierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [courier, setCourier] = useState<Courier | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapExpanded, setMapExpanded] = useState(true);
  const [showRoute, setShowRoute] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [nearTarget, setNearTarget] = useState<{ delivery: Delivery; type: "pickup" | "delivery" } | null>(null);
  const arrivedRef = useRef<Set<string>>(new Set());

  // ── Fetch data ─────────────────────────────────────────────────────────────
  const fetchDeliveries = useCallback(async () => {
    const res = await fetch(`/api/deliveries?courierId=${id}`);
    if (res.ok) setDeliveries(await res.json());
  }, [id]);

  useEffect(() => {
    const init = async () => {
      const [courierRes] = await Promise.all([
        fetch(`/api/couriers/${id}`),
        fetchDeliveries(),
      ]);
      if (courierRes.ok) setCourier(await courierRes.json());
      setLoading(false);
    };
    init();

    // Persist courier ID for quick re-access
    localStorage.setItem("lakou_courier_id", id);

    // Listen for delivery updates via Pusher
    const client = getPusherClient();
    const adminCh = client.subscribe(ADMIN_CHANNEL);
    adminCh.bind(EVENTS.DELIVERIES_UPDATED, fetchDeliveries);
    adminCh.bind(EVENTS.DELIVERIES_NEW, fetchDeliveries);

    const courierCh = client.subscribe(courierChannel(id));
    courierCh.bind(EVENTS.DELIVERY_ASSIGNED, fetchDeliveries);

    return () => {
      adminCh.unbind(EVENTS.DELIVERIES_UPDATED, fetchDeliveries);
      adminCh.unbind(EVENTS.DELIVERIES_NEW, fetchDeliveries);
      client.unsubscribe(ADMIN_CHANNEL);
      client.unsubscribe(courierChannel(id));
    };
  }, [id, fetchDeliveries]);

  // ── PWA Install prompt ─────────────────────────────────────────────────────
  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setInstallPrompt(null);
  };

  // ── GPS tracking hook ──────────────────────────────────────────────────────
  const { state: trackingState, position, errorMsg, start, stop } = useGpsTracking({
    courierId: id,
    onPosition: (pos) => {
      // Arrival detection
      const active = deliveries.filter((d) => ["assigned", "picked_up"].includes(d.status));
      for (const delivery of active) {
        const isPickedUp = delivery.status === "picked_up";
        const targetLat = isPickedUp ? delivery.deliveryLat : delivery.pickupLat;
        const targetLng = isPickedUp ? delivery.deliveryLng : delivery.pickupLng;
        const dist = haversineDistance(pos.lat, pos.lng, targetLat, targetLng);
        const arrivedKey = `${delivery.id}-${isPickedUp ? "delivery" : "pickup"}`;

        if (dist <= ARRIVAL_RADIUS_KM && !arrivedRef.current.has(arrivedKey)) {
          arrivedRef.current.add(arrivedKey);
          setNearTarget({ delivery, type: isPickedUp ? "delivery" : "pickup" });
          // Vibrate phone
          if ("vibrate" in navigator) navigator.vibrate([300, 100, 300, 100, 300]);
          // Show notification
          if (Notification.permission === "granted") {
            new Notification("📍 Arrivée détectée — Lakou Delivery", {
              body: `Vous êtes arrivé à ${isPickedUp ? "la destination" : "la collecte"} de ${delivery.customerName}`,
              icon: "/icons/icon-192.png",
              tag: arrivedKey,
            });
          }
        } else if (dist > ARRIVAL_RADIUS_KM * 2) {
          // Reset once they move away
          arrivedRef.current.delete(arrivedKey);
        }
      }
    },
  });

  const isTracking = trackingState === "active" || trackingState === "starting";

  // ── Update delivery status ─────────────────────────────────────────────────
  const updateDelivery = async (deliveryId: string, action: string) => {
    setNearTarget(null);
    await fetch(`/api/deliveries/${deliveryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await fetchDeliveries();
    if ("vibrate" in navigator) navigator.vibrate(200);
  };

  const activeDeliveries = deliveries.filter((d) => ["assigned", "picked_up"].includes(d.status));
  const currentTarget = activeDeliveries[0] ?? null;

  // ── Distance and ETA to next target ───────────────────────────────────────
  const getDistanceToTarget = (delivery: Delivery) => {
    if (!position) return null;
    const isPickedUp = delivery.status === "picked_up";
    const dist = haversineDistance(
      position.lat, position.lng,
      isPickedUp ? delivery.deliveryLat : delivery.pickupLat,
      isPickedUp ? delivery.deliveryLng : delivery.pickupLng,
    );
    const etaMin = position.speed > 1
      ? Math.ceil((dist / position.speed) * 60)
      : Math.ceil((dist / 30) * 60);
    return { dist: dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`, etaMin };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!courier) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center px-6">
          <AlertTriangle size={40} className="text-red-400 mx-auto mb-3" />
          <p className="text-white font-semibold">Coursier introuvable</p>
          <p className="text-gray-400 text-sm mt-1">Vérifiez le lien fourni par votre admin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
              trackingState === "active" ? "bg-blue-600" : "bg-gray-600"
            }`}>
              {courier.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="font-bold text-white text-base leading-tight">{courier.name}</h1>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Phone size={10} />
                {courier.phone}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* GPS accuracy indicator */}
            {position && (
              <div className="flex items-center gap-1 text-xs">
                <Signal size={12} className={
                  position.accuracy < 15 ? "text-green-400" :
                  position.accuracy < 50 ? "text-yellow-400" : "text-red-400"
                } />
                <span className="text-gray-400">{Math.round(position.accuracy)}m</span>
              </div>
            )}

            {/* Online/offline badge */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
              trackingState === "active"
                ? "bg-green-900/60 text-green-400"
                : trackingState === "starting"
                ? "bg-blue-900/60 text-blue-400"
                : "bg-gray-700 text-gray-400"
            }`}>
              {trackingState === "active"
                ? <><Wifi size={12} className="animate-pulse" /> En ligne</>
                : trackingState === "starting"
                ? <><div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> GPS...</>
                : <><WifiOff size={12} /> Hors ligne</>
              }
            </div>
          </div>
        </div>
      </header>

      {/* ── Arrival alert banner ─────────────────────────────────────────────── */}
      {nearTarget && (
        <div className="bg-blue-600 px-4 py-3 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2 text-white">
            <MapPin size={18} className="animate-bounce" />
            <div>
              <div className="font-bold text-sm">
                {nearTarget.type === "pickup" ? "📦 Point de collecte" : "🏠 Destination"} atteint !
              </div>
              <div className="text-blue-100 text-xs">{nearTarget.delivery.customerName}</div>
            </div>
          </div>
          <button
            onClick={() => updateDelivery(
              nearTarget.delivery.id,
              nearTarget.type === "pickup" ? "pickup" : "deliver"
            )}
            className="bg-white text-blue-700 font-bold text-xs px-3 py-2 rounded-xl flex-shrink-0 active:bg-blue-50"
          >
            {nearTarget.type === "pickup" ? "Confirmer collecte" : "Confirmer livraison"}
          </button>
        </div>
      )}

      {/* ── Map section ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0">
        <button
          onClick={() => setMapExpanded(!mapExpanded)}
          className="w-full flex items-center justify-between px-4 py-2 bg-gray-800/50 text-xs text-gray-400 border-b border-gray-700/50"
        >
          <span className="flex items-center gap-1.5">
            <Navigation size={12} />
            Carte en temps réel
          </span>
          {mapExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {mapExpanded && (
          <div className="h-56 bg-gray-800 relative">
            <CourierLiveMap
              position={position ? {
                lat: position.lat,
                lng: position.lng,
                accuracy: position.accuracy,
                heading: position.heading,
              } : null}
              deliveries={activeDeliveries}
              targetDeliveryId={currentTarget?.id ?? null}
              showRoute={showRoute}
            />
            {activeDeliveries.length > 0 && (
              <button
                onClick={() => setShowRoute((v) => !v)}
                className={`absolute bottom-2 right-2 z-10 text-xs px-3 py-1.5 rounded-xl border flex items-center gap-1.5 active:scale-95 transition-all ${
                  showRoute
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "bg-gray-900/80 backdrop-blur-sm border-gray-600/50 text-gray-200"
                }`}
              >
                <Navigation size={11} />
                {showRoute ? "Masquer trajet" : "Voir trajet"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Speed dashboard ───────────────────────────────────────────────────── */}
      {isTracking && position && (
        <div className="flex-shrink-0 mx-4 mt-4 bg-gray-800 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-white tabular-nums">
              {Math.round(position.speed)}
            </div>
            <div className="text-xs text-gray-500">km/h</div>
          </div>
          {currentTarget && (() => {
            const info = getDistanceToTarget(currentTarget);
            return info ? (
              <div className="flex-1 bg-gray-700/50 rounded-xl p-3">
                <div className="text-xs text-gray-400 mb-1">
                  {currentTarget.status === "picked_up" ? "🏠 Livraison" : "📦 Collecte"} suivante
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-blue-400 font-bold">
                    <MapPin size={14} />
                    {info.dist}
                  </div>
                  <div className="flex items-center gap-1 text-gray-400 text-sm">
                    <Clock size={12} />
                    ~{info.etaMin} min
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-0.5 truncate">
                  {currentTarget.status === "picked_up"
                    ? currentTarget.deliveryAddress
                    : currentTarget.pickupAddress}
                </div>
              </div>
            ) : null;
          })()}
          <div className="text-center">
            <div className={`text-sm font-bold ${
              position.accuracy < 15 ? "text-green-400" :
              position.accuracy < 50 ? "text-yellow-400" : "text-red-400"
            }`}>
              ±{Math.round(position.accuracy)}m
            </div>
            <div className="text-xs text-gray-500">GPS</div>
          </div>
        </div>
      )}

      {/* ── Main tracking button ─────────────────────────────────────────────── */}
      <div className="px-4 mt-4 flex-shrink-0">
        <button
          onClick={isTracking ? stop : start}
          disabled={trackingState === "starting"}
          className={`w-full py-5 rounded-2xl text-xl font-bold transition-all active:scale-95 ${
            trackingState === "active"
              ? "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/40"
              : trackingState === "starting"
              ? "bg-blue-900 text-blue-300 cursor-wait"
              : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/40"
          }`}
        >
          {trackingState === "active" && "⏹  Arrêter le tracking"}
          {trackingState === "starting" && "🛰  Acquisition GPS..."}
          {trackingState === "idle" && "▶  Démarrer le tracking"}
          {trackingState === "error" && "↺  Réessayer"}
        </button>

        {errorMsg && (
          <div className="mt-2 bg-red-900/30 border border-red-700/50 text-red-400 rounded-xl p-3 text-sm flex items-start gap-2">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            {errorMsg}
          </div>
        )}
      </div>

      {/* ── Deliveries list ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-gray-400 flex items-center gap-2">
            <Package size={12} />
            MES COURSES ({activeDeliveries.length})
          </h2>
          {activeDeliveries.length > 0 && (
            <span className="text-xs text-blue-400">
              {activeDeliveries.length} active{activeDeliveries.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {activeDeliveries.length === 0 ? (
          <div className="bg-gray-800 rounded-2xl p-8 text-center">
            <Package size={36} className="text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">Aucune course assignée</p>
            <p className="text-gray-600 text-sm mt-1">
              L&apos;admin vous assignera des courses quand elles arrivent
            </p>
          </div>
        ) : (
          activeDeliveries.map((delivery, index) => {
            const isPickedUp = delivery.status === "picked_up";
            const distInfo = getDistanceToTarget(delivery);

            return (
              <div
                key={delivery.id}
                className={`rounded-2xl overflow-hidden border ${
                  index === 0
                    ? "border-blue-600/50 bg-gray-800"
                    : "border-gray-700/50 bg-gray-800/60"
                }`}
              >
                {/* Card header */}
                <div className="flex items-center justify-between px-4 py-2 bg-gray-700/30 border-b border-gray-700/30">
                  <div className="flex items-center gap-2">
                    {index === 0 && (
                      <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                        Prochaine
                      </span>
                    )}
                    <span className="text-xs text-gray-500 font-mono">{delivery.orderNumber}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    isPickedUp
                      ? "bg-orange-900/50 text-orange-400"
                      : "bg-blue-900/50 text-blue-400"
                  }`}>
                    {isPickedUp ? "En route" : "À récupérer"}
                  </span>
                </div>

                <div className="p-4 space-y-3">
                  {/* Client */}
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {delivery.customerName.charAt(0)}
                    </div>
                    <div>
                      <div className="font-semibold text-white">{delivery.customerName}</div>
                      {delivery.customerPhone && (
                        <a
                          href={`tel:${delivery.customerPhone}`}
                          className="text-xs text-blue-400 flex items-center gap-1"
                        >
                          <Phone size={10} />
                          {delivery.customerPhone}
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Addresses */}
                  <div className="space-y-2">
                    {!isPickedUp && (
                      <div className="flex items-start gap-2 bg-purple-900/20 rounded-xl p-3">
                        <MapPin size={14} className="text-purple-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-xs text-purple-400 font-medium">Collecte</div>
                          <div className="text-sm text-gray-200">{delivery.pickupAddress}</div>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-2 bg-orange-900/20 rounded-xl p-3">
                      <MapPin size={14} className="text-orange-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-xs text-orange-400 font-medium">Livraison</div>
                        <div className="text-sm text-gray-200">{delivery.deliveryAddress}</div>
                      </div>
                    </div>
                  </div>

                  {/* Distance / ETA */}
                  {distInfo && (
                    <div className="flex items-center gap-3 text-sm bg-gray-700/30 rounded-xl px-3 py-2">
                      <div className="flex items-center gap-1 text-blue-400 font-semibold">
                        <Navigation size={12} />
                        {distInfo.dist}
                      </div>
                      <div className="flex items-center gap-1 text-gray-400">
                        <Clock size={11} />
                        ~{distInfo.etaMin} min
                      </div>
                      {delivery.distance && (
                        <div className="text-gray-500 text-xs ml-auto">
                          Total: {delivery.distance} km
                        </div>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  {delivery.notes && (
                    <div className="text-xs text-yellow-400 italic bg-yellow-900/20 rounded-lg px-3 py-2">
                      📝 {delivery.notes}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="pt-1 space-y-2">
                    {!isPickedUp && (
                      <button
                        onClick={() => updateDelivery(delivery.id, "pickup")}
                        className="w-full bg-purple-700 hover:bg-purple-600 active:bg-purple-800 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                      >
                        <Package size={18} />
                        Colis récupéré
                      </button>
                    )}
                    {isPickedUp && (
                      <>
                        {delivery.locationConfirmed && (
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${delivery.deliveryLat},${delivery.deliveryLng}&travelmode=driving`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-800 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                          >
                            <Navigation size={17} />
                            Naviguer vers le client
                          </a>
                        )}
                        <button
                          onClick={() => updateDelivery(delivery.id, "deliver")}
                          className="w-full bg-green-700 hover:bg-green-600 active:bg-green-800 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                        >
                          <CheckCircle size={18} />
                          Course livrée !
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Completed today */}
        {deliveries.filter((d) => d.status === "delivered").length > 0 && (
          <div className="text-center py-3">
            <span className="text-xs text-gray-600 bg-gray-800 px-3 py-1.5 rounded-full">
              ✓ {deliveries.filter((d) => d.status === "delivered").length} course(s) livrée(s) aujourd&apos;hui
            </span>
          </div>
        )}
      </div>

      {/* ── Bottom bar: install PWA ───────────────────────────────────────────── */}
      {installPrompt && !isInstalled && (
        <div className="flex-shrink-0 mx-4 mb-4">
          <button
            onClick={handleInstall}
            className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl text-sm font-medium border border-gray-600 transition-colors"
          >
            <Download size={16} className="text-blue-400" />
            Installer l&apos;application sur cet appareil
          </button>
        </div>
      )}
    </div>
  );
}
