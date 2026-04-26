"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef, use, useCallback } from "react";
import type { Courier, Delivery } from "@/lib/types";
import { useGpsTracking } from "@/lib/useGpsTracking";
import { haversineDistance } from "@/lib/geo";
import { getPusherClient, courierChannel, ADMIN_CHANNEL, EVENTS } from "@/lib/pusher-client";
import { Navigation, Package, CheckCircle, Clock, MapPin, Phone, AlertTriangle, Download, ChevronDown, ChevronUp } from "lucide-react";

const CourierLiveMap = dynamic(
  () => import("@/components/courier/CourierLiveMap").then((m) => m.CourierLiveMap),
  { ssr: false }
);

// ── Design tokens (light mode) ─────────────────────────────────────────────
const C = {
  bg:       "#F5F6FA",
  bg2:      "#FFFFFF",
  bg3:      "#F0F2F5",
  bg4:      "#E4E6EB",
  border:   "#D1D5DB",
  ink:      "#111827",
  ink60:    "#4B5563",
  ink40:    "#6B7280",
  ink20:    "#9CA3AF",
  ink10:    "#F3F4F6",
  flash:    "#DC2626",
  flashBg:  "#FEF2F2",
  flashBorder: "#FECACA",
  lime:     "#16A34A",
  limeBg:   "#F0FDF4",
  limeBorder:"#BBF7D0",
  amber:    "#D97706",
  amberBg:  "#FFFBEB",
  amberBorder:"#FDE68A",
  blue:     "#2563EB",
  blueBg:   "#EFF6FF",
  blueBorder:"#BFDBFE",
  purple:   "#7C3AED",
  purpleBg: "#F5F3FF",
  purpleBorder:"#DDD6FE",
};

const ARRIVAL_RADIUS_KM = 0.15;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function CourierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [courier, setCourier] = useState<Courier | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [showRoute, setShowRoute] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [nearTarget, setNearTarget] = useState<{ delivery: Delivery; type: "pickup" | "delivery" } | null>(null);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const arrivedRef = useRef<Set<string>>(new Set());

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchDeliveries = useCallback(async () => {
    const res = await fetch(`/api/deliveries?courierId=${id}`);
    if (res.ok) setDeliveries(await res.json());
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const init = async () => {
      try {
        const courierRes = await fetch(`/api/couriers/${id}`, { signal: controller.signal });
        if (courierRes.ok) {
          const data = await courierRes.json();
          setCourier(data);
          if (Array.isArray(data.deliveries) && data.deliveries.length > 0) {
            setDeliveries((prev) => (prev.length > 0 ? prev : data.deliveries));
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") console.error("[CourierPage] courier fetch error:", err);
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
      fetchDeliveries().catch(console.error);
    };
    init();
    localStorage.setItem("lakou_courier_id", id);

    const client = getPusherClient();
    const adminCh = client.subscribe(ADMIN_CHANNEL);
    adminCh.bind(EVENTS.DELIVERIES_UPDATED, fetchDeliveries);
    adminCh.bind(EVENTS.DELIVERIES_NEW, fetchDeliveries);
    const courierCh = client.subscribe(courierChannel(id));
    courierCh.bind(EVENTS.DELIVERY_ASSIGNED, fetchDeliveries);

    return () => {
      controller.abort();
      adminCh.unbind(EVENTS.DELIVERIES_UPDATED, fetchDeliveries);
      adminCh.unbind(EVENTS.DELIVERIES_NEW, fetchDeliveries);
      client.unsubscribe(ADMIN_CHANNEL);
      client.unsubscribe(courierChannel(id));
    };
  }, [id, fetchDeliveries]);

  // ── PWA install ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) setIsInstalled(true);
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e as BeforeInstallPromptEvent); };
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

  // ── GPS ────────────────────────────────────────────────────────────────────
  const { state: trackingState, position, errorMsg, start, stop } = useGpsTracking({
    courierId: id,
    onPosition: (pos) => {
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
          if ("vibrate" in navigator) navigator.vibrate([300, 100, 300, 100, 300]);
          if (Notification.permission === "granted") {
            new Notification("📍 Arrivée détectée — Lakou Delivery", {
              body: `Vous êtes arrivé à ${isPickedUp ? "la destination" : "la collecte"} de ${delivery.customerName}`,
              icon: "/icons/icon-192.png",
              tag: arrivedKey,
            });
          }
        } else if (dist > ARRIVAL_RADIUS_KM * 2) {
          arrivedRef.current.delete(arrivedKey);
        }
      }
    },
  });

  const isTracking = trackingState === "active" || trackingState === "starting";

  // ── Actions ────────────────────────────────────────────────────────────────
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

  const acknowledgeDelivery = async (deliveryId: string) => {
    setAcknowledgedIds((prev) => new Set([...prev, deliveryId]));
    await fetch(`/api/deliveries/${deliveryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "acknowledge" }),
    });
    if ("vibrate" in navigator) navigator.vibrate(100);
  };

  const activeDeliveries = deliveries.filter((d) => ["assigned", "picked_up"].includes(d.status));
  const currentTarget = activeDeliveries[0] ?? null;

  interface CourierGroup {
    key: string; customerName: string; customerPhone: string; deliveries: Delivery[];
  }
  const groupedDeliveries: CourierGroup[] = (() => {
    const map = new Map<string, CourierGroup>();
    for (const d of activeDeliveries) {
      const key = d.customerPhone?.trim() || d.customerName.trim().toLowerCase();
      if (!map.has(key)) map.set(key, { key, customerName: d.customerName, customerPhone: d.customerPhone, deliveries: [] });
      map.get(key)!.deliveries.push(d);
    }
    return [...map.values()];
  })();

  const getDistanceToTarget = (delivery: Delivery) => {
    if (!position) return null;
    const isPickedUp = delivery.status === "picked_up";
    const dist = haversineDistance(position.lat, position.lng,
      isPickedUp ? delivery.deliveryLat : delivery.pickupLat,
      isPickedUp ? delivery.deliveryLng : delivery.pickupLng,
    );
    const etaMin = position.speed > 1
      ? Math.ceil((dist / position.speed) * 60)
      : Math.ceil((dist / 30) * 60);
    return { dist: dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`, etaMin };
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ height: "100dvh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", border: `4px solid ${C.flash}`, borderTopColor: "transparent" }} className="animate-spin" />
          <p style={{ color: C.ink40, fontSize: 15, fontFamily: "Archivo, sans-serif" }}>Chargement…</p>
        </div>
      </div>
    );
  }

  if (!courier) {
    return (
      <div style={{ height: "100dvh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: "0 24px" }}>
          <AlertTriangle size={44} color={C.flash} style={{ margin: "0 auto 12px" }} />
          <p style={{ color: C.ink, fontWeight: 700, fontFamily: "Archivo, sans-serif", fontSize: 20 }}>Coursier introuvable</p>
          <p style={{ color: C.ink40, fontSize: 14, marginTop: 6 }}>Vérifiez le lien fourni par votre admin.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "100dvh", maxHeight: "100dvh", background: C.bg, display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif", overflow: "hidden" }}>

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <header style={{ background: C.bg2, borderBottom: `1px solid ${C.border}`, padding: "10px 16px", flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: `2px solid ${C.border}` }}>
              <img src="/logo.jpg" alt="Lakoud" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div>
              <div style={{ fontFamily: "Archivo, sans-serif", fontWeight: 800, fontSize: 16, color: C.ink, lineHeight: 1 }}>{courier.name}</div>
              <div style={{ fontSize: 11, color: C.ink40, marginTop: 2 }}>Coursier · Lakoud Express</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {position && (
              <div style={{ fontSize: 11, fontWeight: 600, color: position.accuracy < 20 ? C.lime : C.amber }}>
                ±{Math.round(position.accuracy)}m
              </div>
            )}
            <div style={{
              display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 999,
              background: trackingState === "active" ? C.limeBg : trackingState === "starting" ? C.blueBg : C.bg3,
              color: trackingState === "active" ? C.lime : trackingState === "starting" ? C.blue : C.ink40,
              border: `1px solid ${trackingState === "active" ? C.limeBorder : trackingState === "starting" ? C.blueBorder : C.border}`,
              fontSize: 11, fontWeight: 700,
            }}>
              <div style={{
                width: 7, height: 7, borderRadius: "50%",
                background: trackingState === "active" ? C.lime : trackingState === "starting" ? C.blue : C.ink20,
                ...(trackingState === "active" ? { boxShadow: `0 0 0 3px rgba(22,163,74,0.25)` } : {}),
              }}/>
              {trackingState === "active" ? "En ligne" : trackingState === "starting" ? "GPS…" : "Hors ligne"}
            </div>
          </div>
        </div>
      </header>

      {/* ── Arrival banner ────────────────────────────────────────────────────── */}
      {nearTarget && (
        <div style={{ background: C.flash, padding: "14px 16px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#fff" }}>
            <div style={{ fontSize: 26 }}>{nearTarget.type === "pickup" ? "📦" : "📍"}</div>
            <div>
              <div style={{ fontFamily: "Archivo, sans-serif", fontWeight: 800, fontSize: 15 }}>
                {nearTarget.type === "pickup" ? "Point de collecte atteint !" : "Destination atteinte !"}
              </div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{nearTarget.delivery.customerName}</div>
            </div>
          </div>
          <button
            onClick={() => updateDelivery(nearTarget.delivery.id, nearTarget.type === "pickup" ? "pickup" : "deliver")}
            style={{ background: "#fff", color: C.flash, border: "none", padding: "10px 16px", borderRadius: 999, fontFamily: "Archivo, sans-serif", fontWeight: 800, fontSize: 13, flexShrink: 0, cursor: "pointer" }}
          >
            {nearTarget.type === "pickup" ? "✓ Collecte OK" : "✓ Livraison OK"}
          </button>
        </div>
      )}

      {/* ── Map ───────────────────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, borderBottom: `1px solid ${C.border}` }}>
        <button
          onClick={() => setMapExpanded(!mapExpanded)}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: C.bg2, color: C.ink60, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Navigation size={14} color={C.blue} />
            Carte en temps réel
          </span>
          {mapExpanded ? <ChevronUp size={16} color={C.ink40} /> : <ChevronDown size={16} color={C.ink40} />}
        </button>

        {mapExpanded && (
          <div style={{ height: 240, background: "#E8EDF2", position: "relative" }}>
            <CourierLiveMap
              position={position ? { lat: position.lat, lng: position.lng, accuracy: position.accuracy, heading: position.heading } : null}
              deliveries={activeDeliveries}
              targetDeliveryId={currentTarget?.id ?? null}
              showRoute={showRoute}
            />
            {activeDeliveries.length > 0 && (
              <button
                onClick={() => setShowRoute((v) => !v)}
                style={{
                  position: "absolute", bottom: 10, right: 10, zIndex: 10,
                  padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                  display: "flex", alignItems: "center", gap: 4, cursor: "pointer",
                  background: showRoute ? C.flash : C.bg2,
                  color: showRoute ? "#fff" : C.ink,
                  border: showRoute ? "none" : `1px solid ${C.border}`,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                }}
              >
                <Navigation size={11} />
                {showRoute ? "Masquer trajet" : "Voir trajet"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Speed bar ─────────────────────────────────────────────────────────── */}
      {isTracking && position && (() => {
        const info = currentTarget ? getDistanceToTarget(currentTarget) : null;
        return (
          <div style={{ margin: "12px 14px 0", background: C.bg2, borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ textAlign: "center", flexShrink: 0, minWidth: 52 }}>
              <div style={{ fontFamily: "Archivo, sans-serif", fontWeight: 900, fontSize: 38, color: C.ink, lineHeight: 1 }}>{Math.round(position.speed)}</div>
              <div style={{ fontSize: 10, color: C.ink40, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>km/h</div>
            </div>
            {info && currentTarget && (
              <div style={{ flex: 1, background: C.bg3, borderRadius: 12, padding: "10px 12px", border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 11, color: C.ink40, fontWeight: 700, marginBottom: 4 }}>
                  {currentTarget.status === "picked_up" ? "🏠 Livraison suivante" : "📦 Collecte suivante"}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, color: C.flash, fontWeight: 800, fontSize: 15 }}>
                    <MapPin size={13} color={C.flash} />
                    {info.dist}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, color: C.ink40, fontSize: 12 }}>
                    <Clock size={11} />
                    ~{info.etaMin} min
                  </div>
                </div>
                <div style={{ fontSize: 12, color: C.ink60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {currentTarget.status === "picked_up" ? currentTarget.deliveryAddress : currentTarget.pickupAddress}
                </div>
              </div>
            )}
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: position.accuracy < 20 ? C.lime : C.amber }}>
                ±{Math.round(position.accuracy)}m
              </div>
              <div style={{ fontSize: 10, color: C.ink40, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>GPS</div>
            </div>
          </div>
        );
      })()}

      {/* ── Tracking CTA ─────────────────────────────────────────────────────── */}
      <div style={{ padding: "12px 14px 0", flexShrink: 0 }}>
        <button
          onClick={isTracking ? stop : start}
          disabled={trackingState === "starting"}
          style={{
            width: "100%", padding: "18px", borderRadius: 16,
            fontFamily: "Archivo, sans-serif", fontWeight: 800, fontSize: 17,
            cursor: trackingState === "starting" ? "wait" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s",
            ...(trackingState === "active"
              ? { background: C.flashBg, color: C.flash, border: `2px solid ${C.flash}` }
              : trackingState === "starting"
              ? { background: C.blueBg, color: C.blue, border: `2px solid ${C.blueBorder}` }
              : { background: C.flash, color: "#fff", border: "none", boxShadow: "0 6px 20px rgba(220,38,38,0.3)" }
            ),
          }}
        >
          {trackingState === "active" && "⏹  Arrêter le tracking"}
          {trackingState === "starting" && "🛰  Acquisition GPS…"}
          {trackingState === "idle" && "▶  Démarrer le tracking"}
          {trackingState === "error" && "↺  Réessayer"}
        </button>

        {errorMsg && (
          <div style={{ marginTop: 8, background: C.flashBg, border: `1px solid ${C.flashBorder}`, color: C.flash, borderRadius: 12, padding: "12px 14px", fontSize: 13, display: "flex", alignItems: "flex-start", gap: 8 }}>
            <AlertTriangle size={16} color={C.flash} style={{ flexShrink: 0, marginTop: 1 }} />
            {errorMsg}
          </div>
        )}
      </div>

      {/* ── Deliveries ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
        {activeDeliveries.length === 0 ? (
          <>
            <div style={{ margin: "20px 14px", background: C.bg2, borderRadius: 20, padding: "32px 20px", textAlign: "center", border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>🏍️</div>
              <div style={{ fontFamily: "Archivo, sans-serif", fontWeight: 800, fontSize: 22, color: C.ink, marginBottom: 8 }}>Prêt à livrer !</div>
              <div style={{ fontSize: 14, color: C.ink40, lineHeight: 1.6, maxWidth: 240, margin: "0 auto" }}>
                Aucune course assignée pour l&apos;instant. L&apos;admin vous enverra une notification dès qu&apos;une course est disponible.
              </div>
              {isTracking && (
                <div style={{ marginTop: 20, padding: "10px 18px", background: C.limeBg, border: `1px solid ${C.limeBorder}`, borderRadius: 12, display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: C.lime, fontWeight: 700 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.lime, boxShadow: `0 0 0 4px rgba(22,163,74,0.2)` }}/>
                  Tracking GPS actif
                </div>
              )}
            </div>

            <div style={{ margin: "0 14px 12px", background: C.bg2, borderRadius: 16, padding: "16px", display: "flex", justifyContent: "space-around", border: `1px solid ${C.border}` }}>
              {[
                { v: courier.deliveredToday ?? 0, l: "Livrées auj.", c: C.lime },
                { v: courier.deliveredCount ?? 0, l: "Total",       c: C.ink },
                { v: "4.9★",                      l: "Note",        c: C.amber },
              ].map((s) => (
                <div key={s.l} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "Archivo, sans-serif", fontWeight: 800, fontSize: 24, color: s.c, lineHeight: 1 }}>{s.v}</div>
                  <div style={{ fontSize: 11, color: C.ink40, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4, fontWeight: 600 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {groupedDeliveries.map((group, groupIndex) => {
              const isMulti = group.deliveries.length > 1;
              const isExpanded = expandedGroups.has(group.key);
              const globalIndexOffset = groupedDeliveries.slice(0, groupIndex).reduce((acc, g) => acc + g.deliveries.length, 0);

              const renderDeliveryCard = (delivery: Delivery, index: number) => {
                const isPickedUp = delivery.status === "picked_up";
                const distInfo = getDistanceToTarget(delivery);
                const isFirst = globalIndexOffset + index === 0;

                return (
                  <div
                    key={delivery.id}
                    style={{
                      margin: "12px 14px 0",
                      borderRadius: 20, overflow: "hidden",
                      border: `2px solid ${isFirst ? C.flash : C.border}`,
                      background: C.bg2,
                      boxShadow: isFirst ? "0 4px 16px rgba(220,38,38,0.1)" : "0 1px 4px rgba(0,0,0,0.06)",
                    }}
                  >
                    {/* Card header */}
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 14px",
                      background: isFirst ? "#FFF5F5" : C.bg3,
                      borderBottom: `1px solid ${isFirst ? C.flashBorder : C.border}`,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {isFirst && (
                          <span style={{ fontSize: 10, background: C.flash, color: "#fff", padding: "3px 9px", borderRadius: 999, fontWeight: 800, fontFamily: "Archivo, sans-serif" }}>
                            SUIVANTE
                          </span>
                        )}
                        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: C.ink60, fontWeight: 600 }}>
                          {delivery.orderNumber}
                        </span>
                      </div>
                      <span style={{
                        fontSize: 12, padding: "4px 11px", borderRadius: 999, fontWeight: 700,
                        background: isPickedUp ? C.amberBg : C.blueBg,
                        color: isPickedUp ? C.amber : C.blue,
                        border: `1px solid ${isPickedUp ? C.amberBorder : C.blueBorder}`,
                      }}>
                        {isPickedUp ? "🏃 En route" : "📦 À récupérer"}
                      </span>
                    </div>

                    <div style={{ padding: "14px" }}>
                      {/* Client info */}
                      {!isMulti && (
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, padding: "10px 12px", background: C.bg3, borderRadius: 12, border: `1px solid ${C.border}` }}>
                          <div style={{ width: 42, height: 42, borderRadius: 12, background: C.ink, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "Archivo, sans-serif", fontWeight: 800, fontSize: 18, flexShrink: 0 }}>
                            {delivery.customerName.charAt(0)}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 16, color: C.ink }}>{delivery.customerName}</div>
                            {delivery.customerPhone && (
                              <a
                                href={`tel:${delivery.customerPhone}`}
                                style={{ fontSize: 14, color: C.blue, display: "flex", alignItems: "center", gap: 5, marginTop: 3, textDecoration: "none", fontWeight: 600 }}
                              >
                                <Phone size={13} color={C.blue} />
                                {delivery.customerPhone}
                              </a>
                            )}
                          </div>
                          {delivery.price != null && (
                            <div style={{ textAlign: "right", background: C.limeBg, border: `1px solid ${C.limeBorder}`, borderRadius: 10, padding: "6px 10px" }}>
                              <div style={{ fontFamily: "Archivo, sans-serif", fontWeight: 800, fontSize: 17, color: C.lime, lineHeight: 1 }}>{delivery.price.toFixed(3)}</div>
                              <div style={{ fontSize: 10, color: C.lime, fontWeight: 600, marginTop: 1 }}>DT</div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Pickup address */}
                      {!isPickedUp && (
                        <div style={{ background: C.purpleBg, borderRadius: 14, padding: "12px 14px", marginBottom: 10, border: `1px solid ${C.purpleBorder}` }}>
                          <div style={{ fontSize: 11, color: C.purple, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800, marginBottom: 6 }}>📦 COLLECTE</div>
                          {delivery.merchant && (
                            <div style={{ fontSize: 13, color: C.purple, fontWeight: 700, marginBottom: 4 }}>
                              🏪 {delivery.merchant.name}
                            </div>
                          )}
                          <div style={{ fontSize: 15, color: C.ink, fontWeight: 600, lineHeight: 1.4, marginBottom: 8 }}>
                            {delivery.pickupAddress}
                          </div>
                          {delivery.pickupLat !== 0 && delivery.pickupLng !== 0 && (
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${delivery.pickupLat},${delivery.pickupLng}&travelmode=driving`}
                              target="_blank" rel="noopener noreferrer"
                              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", borderRadius: 10, background: C.purple, color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 700, fontFamily: "Archivo, sans-serif" }}
                            >
                              <Navigation size={15} color="#fff" />
                              Naviguer — Collecte
                            </a>
                          )}
                        </div>
                      )}

                      {/* Delivery address */}
                      <div style={{ background: C.amberBg, borderRadius: 14, padding: "12px 14px", marginBottom: 10, border: `1px solid ${C.amberBorder}` }}>
                        <div style={{ fontSize: 11, color: C.amber, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800, marginBottom: 6 }}>🏠 LIVRAISON</div>
                        <div style={{ fontSize: 15, color: C.ink, fontWeight: 600, lineHeight: 1.4, marginBottom: delivery.deliveryDescription ? 6 : 8 }}>
                          {delivery.deliveryAddress}
                        </div>
                        {delivery.deliveryDescription && (
                          <div style={{ fontSize: 13, color: C.amber, fontWeight: 500, lineHeight: 1.4, marginBottom: 8, padding: "8px 10px", background: "rgba(255,255,255,0.6)", borderRadius: 8 }}>
                            📍 {delivery.deliveryDescription}
                          </div>
                        )}
                        {delivery.locationConfirmed && delivery.deliveryLat !== 0 && delivery.deliveryLng !== 0 && isPickedUp && (
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${delivery.deliveryLat},${delivery.deliveryLng}&travelmode=driving`}
                            target="_blank" rel="noopener noreferrer"
                            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "12px", borderRadius: 10, background: C.amber, color: "#fff", textDecoration: "none", fontSize: 15, fontWeight: 800, fontFamily: "Archivo, sans-serif" }}
                          >
                            <Navigation size={17} color="#fff" />
                            Naviguer vers le client
                          </a>
                        )}
                        {!delivery.locationConfirmed && (
                          <div style={{ fontSize: 12, color: C.amber, fontWeight: 600, padding: "6px 10px", background: "rgba(255,255,255,0.5)", borderRadius: 8 }}>
                            ⚠️ Localisation à confirmer sur place
                          </div>
                        )}
                      </div>

                      {/* Distance/ETA */}
                      {distInfo && (
                        <div style={{ display: "flex", alignItems: "center", gap: 12, background: C.bg3, borderRadius: 12, padding: "11px 14px", marginBottom: 10, border: `1px solid ${C.border}` }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, color: C.flash, fontWeight: 800, fontSize: 16 }}>
                            <Navigation size={14} color={C.flash} />
                            {distInfo.dist}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, color: C.ink60, fontSize: 14 }}>
                            <Clock size={13} />
                            ~{distInfo.etaMin} min
                          </div>
                          {delivery.distance && (
                            <div style={{ marginLeft: "auto", fontSize: 12, color: C.ink40, fontWeight: 500 }}>
                              {delivery.distance} km total
                            </div>
                          )}
                        </div>
                      )}

                      {/* Notes */}
                      {delivery.notes && (
                        <div style={{ background: "#FFFBEB", border: `1px solid ${C.amberBorder}`, borderRadius: 10, padding: "10px 12px", marginBottom: 10, fontSize: 13, color: C.amber, fontWeight: 500, lineHeight: 1.5 }}>
                          📝 {delivery.notes}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 2 }}>
                        {!isPickedUp && (
                          <>
                            {!acknowledgedIds.has(delivery.id) ? (
                              <button
                                onClick={() => acknowledgeDelivery(delivery.id)}
                                style={{ width: "100%", padding: "16px", borderRadius: 14, background: C.blueBg, color: C.blue, border: `2px solid ${C.blueBorder}`, fontFamily: "Archivo, sans-serif", fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" }}
                              >
                                <CheckCircle size={18} color={C.blue} />
                                J&apos;ai pris en compte
                              </button>
                            ) : (
                              <>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: C.limeBg, border: `1px solid ${C.limeBorder}`, color: C.lime, padding: "10px", borderRadius: 12, fontSize: 13, fontWeight: 700 }}>
                                  <CheckCircle size={15} color={C.lime} /> Admin notifié ✓
                                </div>
                                <button
                                  onClick={() => updateDelivery(delivery.id, "pickup")}
                                  style={{ width: "100%", padding: "18px", borderRadius: 14, background: C.flash, color: "#fff", border: "none", fontFamily: "Archivo, sans-serif", fontWeight: 800, fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, cursor: "pointer", boxShadow: "0 4px 16px rgba(220,38,38,0.25)" }}
                                >
                                  <Package size={20} color="#fff" />
                                  Colis récupéré ✓
                                </button>
                              </>
                            )}
                          </>
                        )}
                        {isPickedUp && (
                          <>
                            {delivery.locationConfirmed && delivery.deliveryLat !== 0 && delivery.deliveryLng !== 0 && (
                              <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${delivery.deliveryLat},${delivery.deliveryLng}&travelmode=driving`}
                                target="_blank" rel="noopener noreferrer"
                                style={{ width: "100%", padding: "16px", borderRadius: 14, background: C.blueBg, color: C.blue, border: `2px solid ${C.blueBorder}`, fontFamily: "Archivo, sans-serif", fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none" }}
                              >
                                <Navigation size={18} color={C.blue} />
                                Naviguer vers le client
                              </a>
                            )}
                            <button
                              onClick={() => updateDelivery(delivery.id, "deliver")}
                              style={{ width: "100%", padding: "20px", borderRadius: 14, background: C.lime, color: "#fff", border: "none", fontFamily: "Archivo, sans-serif", fontWeight: 900, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, cursor: "pointer", boxShadow: "0 4px 16px rgba(22,163,74,0.3)" }}
                            >
                              <CheckCircle size={22} color="#fff" />
                              Course livrée ! ✓
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              };

              if (!isMulti) return renderDeliveryCard(group.deliveries[0], globalIndexOffset);

              return (
                <div key={group.key} style={{ margin: "12px 14px 0", borderRadius: 20, overflow: "hidden", border: `2px solid ${C.purpleBorder}`, background: C.bg2, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  {/* Group header */}
                  <button
                    onClick={() => setExpandedGroups((prev) => { const next = new Set(prev); if (next.has(group.key)) next.delete(group.key); else next.add(group.key); return next; })}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px", background: C.purpleBg, borderBottom: `1px solid ${C.purpleBorder}`, cursor: "pointer", textAlign: "left", border: "none" }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: C.purple, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "Archivo, sans-serif", fontWeight: 800, fontSize: 18, flexShrink: 0 }}>
                      {group.customerName.charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: C.ink, fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{group.customerName}</div>
                      {group.customerPhone && (
                        <a href={`tel:${group.customerPhone}`} onClick={(e) => e.stopPropagation()} style={{ fontSize: 13, color: C.blue, display: "flex", alignItems: "center", gap: 4, textDecoration: "none", fontWeight: 600, marginTop: 2 }}>
                          <Phone size={12} color={C.blue} />{group.customerPhone}
                        </a>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 12, background: C.purple, color: "#fff", padding: "4px 10px", borderRadius: 999, fontWeight: 700 }}>{group.deliveries.length} courses</span>
                      {isExpanded ? <ChevronUp size={18} color={C.ink40} /> : <ChevronDown size={18} color={C.ink40} />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div style={{ padding: "12px 0" }}>
                      {group.deliveries.map((d, i) => renderDeliveryCard(d, globalIndexOffset + i))}
                    </div>
                  )}
                  {!isExpanded && (
                    <div style={{ padding: "10px 14px", display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {group.deliveries.map((d) => (
                        <span key={d.id} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, fontFamily: "JetBrains Mono, monospace", fontWeight: 600, background: d.status === "picked_up" ? C.amberBg : C.blueBg, color: d.status === "picked_up" ? C.amber : C.blue, border: `1px solid ${d.status === "picked_up" ? C.amberBorder : C.blueBorder}` }}>
                          {d.orderNumber}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Completed today */}
            {deliveries.filter((d) => d.status === "delivered").length > 0 && (
              <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
                <span style={{ fontSize: 13, color: C.lime, background: C.limeBg, border: `1px solid ${C.limeBorder}`, padding: "7px 16px", borderRadius: 999, fontWeight: 700 }}>
                  ✓ {deliveries.filter((d) => d.status === "delivered").length} course(s) livrée(s) aujourd&apos;hui
                </span>
              </div>
            )}

            {/* Stats */}
            <div style={{ margin: "12px 14px 8px", background: C.bg2, borderRadius: 16, padding: "16px", display: "flex", justifyContent: "space-around", border: `1px solid ${C.border}` }}>
              {[
                { v: courier.deliveredToday ?? 0, l: "Livrées auj.", c: C.lime },
                { v: courier.deliveredCount ?? 0, l: "Total",       c: C.ink },
                { v: "4.9★",                      l: "Note",        c: C.amber },
              ].map((s) => (
                <div key={s.l} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "Archivo, sans-serif", fontWeight: 800, fontSize: 24, color: s.c, lineHeight: 1 }}>{s.v}</div>
                  <div style={{ fontSize: 11, color: C.ink40, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4, fontWeight: 600 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ height: 16 }} />
      </div>

      {/* ── PWA install banner ────────────────────────────────────────────────── */}
      {installPrompt && !isInstalled && (
        <div style={{ margin: "0 14px 14px", background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <Download size={18} color={C.blue} />
          <span style={{ flex: 1, fontSize: 13, color: C.ink60, fontWeight: 500 }}>Installer l&apos;app sur cet appareil</span>
          <button onClick={handleInstall} style={{ background: C.blue, color: "#fff", border: "none", padding: "8px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            Installer
          </button>
        </div>
      )}
    </div>
  );
}
