"use client";

import { useState, useRef, useCallback } from "react";
import { getPusherClient, courierChannel, EVENTS } from "./pusher-client";
import { haversineDistance } from "./geo";

export interface GpsPosition {
  lat: number;
  lng: number;
  speed: number;
  accuracy: number;
  heading: number;
  altitude: number | null;
  timestamp: number;
}

export type TrackingState = "idle" | "starting" | "active" | "error";

interface Options {
  courierId: string;
  onPosition?: (pos: GpsPosition) => void;
  onError?: (msg: string) => void;
}

function getSendIntervalMs(speedKmh: number): number {
  if (speedKmh > 20) return 5_000;
  if (speedKmh > 3)  return 10_000;
  return 30_000;
}

const MIN_DISTANCE_TO_SEND_KM = 0.01;

export function useGpsTracking({ courierId, onPosition, onError }: Options) {
  const [state, setState] = useState<TrackingState>("idle");
  const [position, setPosition] = useState<GpsPosition | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const lastSentRef = useRef<GpsPosition | null>(null);
  const lastSendTimeRef = useRef<number>(0);

  // ── Send position to server via HTTP → Pusher broadcast ───────────────────
  const sendToServer = useCallback(async (pos: GpsPosition) => {
    const payload = { courierId, lat: pos.lat, lng: pos.lng, speed: pos.speed, heading: pos.heading };

    try {
      await fetch("/api/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    } catch {
      // Network error — position will be sent on next tick
    }

    lastSentRef.current = pos;
    lastSendTimeRef.current = Date.now();
  }, [courierId]);

  // ── Acquire WakeLock ───────────────────────────────────────────────────────
  const acquireWakeLock = useCallback(async () => {
    if (!("wakeLock" in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen");
      wakeLockRef.current.addEventListener("release", () => {
        if (document.visibilityState === "visible") acquireWakeLock();
      });
    } catch {
      // Non-fatal
    }
  }, []);

  // ── Handle incoming GPS position ───────────────────────────────────────────
  const handlePosition = useCallback((raw: GeolocationPosition) => {
    setState("active");

    const pos: GpsPosition = {
      lat: raw.coords.latitude,
      lng: raw.coords.longitude,
      speed: raw.coords.speed != null ? raw.coords.speed * 3.6 : 0,
      accuracy: raw.coords.accuracy ?? 999,
      heading: raw.coords.heading ?? 0,
      altitude: raw.coords.altitude,
      timestamp: raw.timestamp,
    };

    setPosition(pos);
    onPosition?.(pos);

    const now = Date.now();
    const intervalMs = getSendIntervalMs(pos.speed);
    const timeSinceLast = now - lastSendTimeRef.current;
    const lastSent = lastSentRef.current;
    const distMoved = lastSent
      ? haversineDistance(lastSent.lat, lastSent.lng, pos.lat, pos.lng)
      : Infinity;

    if (!lastSent || timeSinceLast >= intervalMs || distMoved >= MIN_DISTANCE_TO_SEND_KM) {
      sendToServer(pos);
    }
  }, [onPosition, sendToServer]);

  // ── Handle GPS error ───────────────────────────────────────────────────────
  const handleError = useCallback((err: GeolocationPositionError) => {
    const messages: Record<number, string> = {
      1: "Permission GPS refusée. Veuillez autoriser la localisation dans les paramètres.",
      2: "Signal GPS indisponible. Déplacez-vous vers un espace ouvert.",
      3: "Délai GPS dépassé. Réessayez.",
    };
    const msg = messages[err.code] ?? `Erreur GPS (${err.code})`;
    setErrorMsg(msg);
    setState("error");
    onError?.(msg);
  }, [onError]);

  // ── Start tracking ─────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    if (!navigator.geolocation) {
      const msg = "La géolocalisation n'est pas supportée par ce navigateur.";
      setErrorMsg(msg);
      setState("error");
      onError?.(msg);
      return;
    }

    setState("starting");
    setErrorMsg("");

    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }

    await acquireWakeLock();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/courier/" }).catch(() => {});
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 3_000 }
    );

    await fetch(`/api/couriers/${courierId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "available" }),
    });

    // Subscribe to courier-specific Pusher channel for new assignment push
    const client = getPusherClient();
    const channel = client.subscribe(courierChannel(courierId));
    channel.bind(EVENTS.DELIVERY_ASSIGNED, (data: { message: string }) => {
      if ("vibrate" in navigator) navigator.vibrate([400, 200, 400]);
      if (Notification.permission === "granted") {
        new Notification("🏍️ Nouvelle course — Lakou Delivery", {
          body: data.message,
          icon: "/icons/icon-192.png",
          tag: "new-assignment",
          requireInteraction: true,
        });
      }
    });
  }, [courierId, acquireWakeLock, handlePosition, handleError, onError]);

  // ── Stop tracking ──────────────────────────────────────────────────────────
  const stop = useCallback(async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;

    // Unsubscribe from Pusher courier channel
    const client = getPusherClient();
    client.unsubscribe(courierChannel(courierId));

    setState("idle");

    await fetch(`/api/couriers/${courierId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "offline" }),
    });
  }, [courierId]);

  return { state, position, errorMsg, start, stop };
}
