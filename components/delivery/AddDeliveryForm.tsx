"use client";

import { useState, useEffect, useRef } from "react";
import { MapPickerModal } from "@/components/ui/MapPickerModal";
import {
  Plus, Trash2, Search, MapPin, X, Package, Truck,
  ChevronDown, ChevronUp, User, Phone, Flag,
  Store, CheckCircle, Zap, DollarSign, Navigation,
  Link2, Crosshair, ExternalLink, AlignLeft,
} from "lucide-react";
import type { Merchant, Courier } from "@/lib/types";
import { PlacesInput } from "@/components/ui/PlacesInput";

// ── Types & constants ─────────────────────────────────────────────────────
interface Props { isOpen: boolean; onClose: () => void; onSuccess: () => void; }

const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: "🍽️", patisserie: "🧁", boucherie: "🥩",
  volaillerie: "🐔", fromagerie: "🧀", supermarche: "🛒",
  pharmacie: "💊", eau: "💧", course: "📦",
};
const BIZERTE_CENTER = { lat: 37.2744, lng: 9.8739 };
const STOP_COLOR = "#6366F1";
const DEST_COLOR = "#EF4444";

type StopMode  = "merchant" | "map";
type MapMethod = "search" | "link" | "click" | "description";

interface PickupStop {
  _key: string;
  mode: StopMode;
  mapMethod: MapMethod;
  linkInput: string;       // raw URL typed in link field
  query: string;           // merchant search query
  merchantId: string | null;
  merchantName: string;
  address: string;         // optional label / display address
  lat: string;
  lng: string;
  pinned: boolean;         // true when GPS confirmed
  orderNotes: string;
  showDropdown: boolean;
}

function newStop(): PickupStop {
  return {
    _key: Math.random().toString(36).slice(2),
    mode: "map", mapMethod: "search", linkInput: "",
    query: "", merchantId: null, merchantName: "",
    address: "", lat: "", lng: "", pinned: false,
    orderNotes: "", showDropdown: false,
  };
}

// ── Google Maps link parser ────────────────────────────────────────────────
function parseGMapsLink(url: string): { lat: number; lng: number } | null {
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /\/place\/[^/@]*\/@(-?\d+\.\d+),(-?\d+\.\d+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) {
      const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
    }
  }
  return null;
}

type MapClickTarget = { kind: "delivery" } | { kind: "pickup"; key: string };

export function AddDeliveryForm({ isOpen, onClose, onSuccess }: Props) {
  // ── State ─────────────────────────────────────────────────────────────
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [stops, setStops] = useState<PickupStop[]>([newStop()]);
  const [deliveryMapMethod, setDeliveryMapMethod] = useState<MapMethod>("search");
  const [deliveryLinkInput, setDeliveryLinkInput] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryLat, setDeliveryLat] = useState("");
  const [deliveryLng, setDeliveryLng] = useState("");
  const [deliveryPinned, setDeliveryPinned] = useState(false);
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [priority, setPriority] = useState("0");
  const [price, setPrice] = useState("");
  const [assignCourierId, setAssignCourierId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  // MapPickerModal (full-screen) — only as fallback
  const [mapTarget, setMapTarget] = useState<{ kind: "delivery" } | { kind: "pickup"; key: string } | null>(null);
  // Right-panel map click target
  const [mapClickTarget, setMapClickTarget] = useState<MapClickTarget | null>(null);
  // Collapse state
  const [collapsedStops, setCollapsedStops] = useState<Set<string>>(new Set());
  const [deliveryCollapsed, setDeliveryCollapsed] = useState(false);

  // ── Map refs ───────────────────────────────────────────────────────────
  const mapPanelRef = useRef<HTMLDivElement>(null);
  const gMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/merchants").then(r => r.ok ? r.json() : [])
      .then((d: Merchant[]) => setMerchants(d.filter(m => m.active))).catch(() => {});
    fetch("/api/couriers").then(r => r.ok ? r.json() : [])
      .then((d: Courier[]) => setCouriers(d.filter(c => ["available", "busy"].includes(c.status)))).catch(() => {});
  }, [isOpen]);

  // ── Reset on close ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setCustomerName(""); setCustomerPhone(""); setStops([newStop()]);
      setDeliveryMapMethod("search"); setDeliveryLinkInput("");
      setDeliveryAddress(""); setDeliveryLat(""); setDeliveryLng("");
      setDeliveryPinned(false); setDeliveryInstructions("");
      setPriority("0"); setPrice(""); setAssignCourierId("");
      setError(""); setMapTarget(null); setMapClickTarget(null);
      setCollapsedStops(new Set()); setDeliveryCollapsed(false);
      gMapRef.current = null;
    }
  }, [isOpen]);

  // ── Right-panel Google Maps init ───────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !mapPanelRef.current) return;
    let cancelled = false;
    const tryInit = () => {
      if (cancelled || !mapPanelRef.current) return;
      if (!window.google?.maps) { setTimeout(tryInit, 200); return; }
      if (gMapRef.current) return;
      gMapRef.current = new window.google.maps.Map(mapPanelRef.current, {
        center: BIZERTE_CENTER, zoom: 13,
        disableDefaultUI: true, zoomControl: true,
        gestureHandling: "cooperative",
        styles: [
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
        ],
      });
    };
    setTimeout(tryInit, 150);
    return () => { cancelled = true; };
  }, [isOpen]);

  // ── Right-map click-to-select interaction ──────────────────────────────
  useEffect(() => {
    const map = gMapRef.current;
    if (!map || !window.google?.maps) return;
    if (!mapClickTarget) {
      map.setOptions({ draggableCursor: undefined });
      return;
    }
    map.setOptions({ draggableCursor: "crosshair" });
    const G = window.google;
    const listener = G.maps.event.addListener(map, "click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat(), lng = e.latLng.lng();
      if (mapClickTarget.kind === "delivery") {
        setDeliveryLat(lat.toString()); setDeliveryLng(lng.toString()); setDeliveryPinned(true);
      } else {
        updateStop(mapClickTarget.key, { lat: lat.toString(), lng: lng.toString(), pinned: true });
      }
      setMapClickTarget(null);
    });
    return () => {
      G.maps.event.removeListener(listener);
      if (gMapRef.current) gMapRef.current.setOptions({ draggableCursor: undefined });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapClickTarget]);

  // ── Update markers on map ──────────────────────────────────────────────
  useEffect(() => {
    const map = gMapRef.current;
    if (!map || !window.google?.maps) return;
    const G = window.google;
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null; }
    const coords: { lat: number; lng: number }[] = [];

    stops.forEach((stop, idx) => {
      if (!stop.lat || !stop.lng) return;
      const lat = parseFloat(stop.lat), lng = parseFloat(stop.lng);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><path d="M14 0C6.3 0 0 6.3 0 14C0 22 14 36 14 36C14 36 28 22 28 14C28 6.3 21.7 0 14 0Z" fill="${STOP_COLOR}"/><circle cx="14" cy="14" r="9" fill="white"/><text x="14" y="19" text-anchor="middle" font-size="11" font-weight="bold" font-family="system-ui" fill="${STOP_COLOR}">${idx + 1}</text></svg>`;
      const marker = new G.maps.Marker({
        position: { lat, lng }, map, zIndex: idx + 1,
        icon: { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, scaledSize: new G.maps.Size(28, 36), anchor: new G.maps.Point(14, 36) },
      });
      markersRef.current.push(marker);
      coords.push({ lat, lng });
    });

    if (deliveryLat && deliveryLng) {
      const lat = parseFloat(deliveryLat), lng = parseFloat(deliveryLng);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><path d="M14 0C6.3 0 0 6.3 0 14C0 22 14 36 14 36C14 36 28 22 28 14C28 6.3 21.7 0 14 0Z" fill="${DEST_COLOR}"/><circle cx="14" cy="14" r="9" fill="white"/><text x="14" y="19" text-anchor="middle" font-size="14" font-family="system-ui" fill="${DEST_COLOR}">🏁</text></svg>`;
      const marker = new G.maps.Marker({
        position: { lat, lng }, map, zIndex: 100,
        icon: { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, scaledSize: new G.maps.Size(28, 36), anchor: new G.maps.Point(14, 36) },
      });
      markersRef.current.push(marker);
      coords.push({ lat, lng });
    }

    if (coords.length > 1) {
      polylineRef.current = new G.maps.Polyline({
        path: coords, geodesic: true,
        strokeColor: STOP_COLOR, strokeOpacity: 0.5, strokeWeight: 3, map,
      });
    }
    if (coords.length > 0) {
      const bounds = new G.maps.LatLngBounds();
      coords.forEach(p => bounds.extend(p));
      map.fitBounds(bounds, { padding: 60 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops.map(s => `${s.lat},${s.lng}`).join("|"), deliveryLat, deliveryLng]);

  // ── Stop helpers ───────────────────────────────────────────────────────
  const updateStop = (key: string, patch: Partial<PickupStop>) =>
    setStops(prev => prev.map(s => s._key === key ? { ...s, ...patch } : s));

  const removeStop = (key: string) => setStops(prev => prev.filter(s => s._key !== key));

  const addStop = () => setStops(prev => [...prev, newStop()]);

  const filteredMerchants = (query: string) => {
    const q = query.toLowerCase().trim();
    if (!q) return merchants.slice(0, 8);
    return merchants.filter(m => m.name.toLowerCase().includes(q) || (m.address ?? "").toLowerCase().includes(q)).slice(0, 8);
  };

  const selectMerchant = (key: string, m: Merchant) =>
    updateStop(key, { merchantId: m.id, merchantName: m.name, query: m.name, address: m.address ?? m.name, lat: m.lat.toString(), lng: m.lng.toString(), pinned: true, showDropdown: false });

  // ── Map confirm (MapPickerModal fallback) ──────────────────────────────
  const handleMapConfirm = (lat: number, lng: number) => {
    if (!mapTarget) return;
    if (mapTarget.kind === "delivery") {
      setDeliveryLat(lat.toString()); setDeliveryLng(lng.toString()); setDeliveryPinned(true);
      if (!deliveryAddress) setDeliveryAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } else {
      const stop = stops.find(s => s._key === mapTarget.key);
      updateStop(mapTarget.key, { lat: lat.toString(), lng: lng.toString(), pinned: true, address: stop?.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
    }
    setMapTarget(null);
  };

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    for (const stop of stops) {
      if (stop.mode === "merchant") {
        if (!stop.lat || !stop.lng) { setError("Localisez chaque marchand (GPS requis)"); return; }
      } else if (stop.mapMethod === "description") {
        if (!stop.address.trim()) { setError("Décrivez l'emplacement de chaque arrêt"); return; }
      } else {
        if (!stop.lat || !stop.lng) { setError("Localisez chaque arrêt sur la carte"); return; }
      }
    }
    if (deliveryMapMethod === "description") {
      if (!deliveryAddress.trim()) { setError("Décrivez l'emplacement de livraison"); return; }
    } else {
      if (!deliveryLat || !deliveryLng) { setError("Localisez le client sur la carte"); return; }
    }

    setLoading(true);
    try {
      const results = await Promise.all(stops.map(stop =>
        fetch("/api/deliveries", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerName, customerPhone,
            pickupAddress: stop.address || stop.merchantName || `${parseFloat(stop.lat).toFixed(5)}, ${parseFloat(stop.lng).toFixed(5)}`,
            pickupLat: stop.mapMethod === "description" ? BIZERTE_CENTER.lat : parseFloat(stop.lat),
            pickupLng: stop.mapMethod === "description" ? BIZERTE_CENTER.lng : parseFloat(stop.lng),
            deliveryAddress: deliveryMapMethod === "description"
              ? deliveryAddress
              : (deliveryAddress || `${parseFloat(deliveryLat).toFixed(5)}, ${parseFloat(deliveryLng).toFixed(5)}`),
            deliveryLat: deliveryMapMethod === "description" ? 0 : parseFloat(deliveryLat),
            deliveryLng: deliveryMapMethod === "description" ? 0 : parseFloat(deliveryLng),
            notes: stop.orderNotes || null,
            deliveryDescription: deliveryInstructions || null,
            merchantId: stop.merchantId || null,
            category: stop.merchantId ? merchants.find(m => m.id === stop.merchantId)?.category ?? null : null,
            priority: parseInt(priority),
            price: price ? parseFloat(price) : null,
            locationConfirmed: deliveryMapMethod !== "description",
          }),
        })
      ));

      const failed = results.find(r => !r.ok);
      if (failed) { const d = await failed.json(); setError(d.error || "Erreur lors de la création"); return; }

      if (assignCourierId) {
        const created = await Promise.all(results.map(r => r.clone().json()));
        await Promise.all(created.map(d =>
          fetch(`/api/deliveries/${d.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "assign", courierId: assignCourierId }) })
        ));
      }
      onSuccess(); onClose();
    } catch { setError("Erreur réseau"); } finally { setLoading(false); }
  };

  const configuredStops = stops.filter(s => s.mapMethod === "description" ? s.address.trim() : (s.lat && s.lng)).length;
  const hasDelivery = deliveryMapMethod === "description" ? !!deliveryAddress.trim() : !!(deliveryLat && deliveryLng);
  const selectedCourier = couriers.find(c => c.id === assignCourierId);

  if (!isOpen) return null;

  // ── Map method selector component ──────────────────────────────────────
  const MapMethodSelector = ({
    method, onMethod, isTarget,
    onActivateClick, onDeactivateClick,
  }: {
    method: MapMethod;
    onMethod: (m: MapMethod) => void;
    isTarget: boolean;
    onActivateClick: () => void;
    onDeactivateClick: () => void;
  }) => (
    <div className="flex rounded-xl p-0.5 gap-0.5" style={{ background: "#F4F4F4" }}>
      {([
        { key: "search",      icon: <Search size={11} />,    label: "Chercher" },
        { key: "link",        icon: <Link2 size={11} />,      label: "Lien" },
        { key: "click",       icon: <Crosshair size={11} />,  label: "Carte" },
        { key: "description", icon: <AlignLeft size={11} />,  label: "Texte" },
      ] as { key: MapMethod; icon: React.ReactNode; label: string }[]).map(m => (
        <button
          key={m.key} type="button"
          onClick={() => {
            onMethod(m.key);
            if (m.key === "click") onActivateClick();
            else onDeactivateClick();
          }}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold rounded-lg transition-all"
          style={method === m.key
            ? { background: isTarget && m.key === "click" ? "#EF4444" : STOP_COLOR, color: "#FFFFFF", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }
            : { color: "#8A8A8A" }
          }
        >
          {m.icon} {m.label}
        </button>
      ))}
    </div>
  );

  // ── GPS badge ──────────────────────────────────────────────────────────
  const GpsBadge = ({ lat, lng, address }: { lat: string; lng: string; address?: string }) => (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "#F0FDF4", border: "1px solid #D1FAE5" }}>
      <CheckCircle size={13} style={{ color: "#10B981", flexShrink: 0 }} />
      <div className="min-w-0 flex-1">
        {address && <p className="text-xs font-medium truncate" style={{ color: "#111827" }}>{address}</p>}
        <p className="text-xs font-mono" style={{ color: "#6B7280" }}>
          {parseFloat(lat).toFixed(5)}, {parseFloat(lng).toFixed(5)}
        </p>
      </div>
      <span className="text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "#D1FAE5", color: "#059669" }}>GPS ✓</span>
    </div>
  );

  // ── Click instruction banner ───────────────────────────────────────────
  const ClickInstruction = ({ active, onCancel }: { active: boolean; onCancel: () => void }) => (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: active ? "#FEF2F2" : "#F9FAFB", border: `1px solid ${active ? "#FECACA" : "#E5E7EB"}` }}>
      <Crosshair size={14} style={{ color: active ? DEST_COLOR : "#9CA3AF", flexShrink: 0 }} className={active ? "animate-pulse" : ""} />
      <span className="text-sm flex-1" style={{ color: active ? "#111827" : "#9CA3AF" }}>
        {active ? "Cliquez sur la carte à droite pour placer le point →" : "Cliquez « Carte → » puis cliquez sur la carte"}
      </span>
      {active && (
        <button type="button" onClick={onCancel} className="p-0.5 rounded hover:bg-red-100">
          <X size={11} style={{ color: "#EF4444" }} />
        </button>
      )}
    </div>
  );

  // ── Link input with auto-parse ─────────────────────────────────────────
  const LinkInput = ({
    value, onChange, onParsed,
  }: { value: string; onChange: (v: string) => void; onParsed: (lat: number, lng: number) => void }) => {
    const parsed = value ? parseGMapsLink(value) : null;
    return (
      <div className="space-y-1.5">
        <div className="relative">
          <Link2 size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9CA3AF" }} />
          <input
            type="url" value={value} onChange={e => { onChange(e.target.value); const c = parseGMapsLink(e.target.value); if (c) onParsed(c.lat, c.lng); }}
            placeholder="Coller un lien Google Maps…"
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
            style={{ border: `1px solid ${parsed ? "#6EE7B7" : "#E5E7EB"}`, background: parsed ? "#F0FDF4" : "#FAFAFA" }}
          />
        </div>
        {value && !parsed && (
          <p className="text-xs pl-1" style={{ color: "#F97316" }}>Lien non reconnu — essayez de copier depuis Google Maps → Partager → Copier le lien</p>
        )}
        {parsed && (
          <div className="flex items-center gap-1.5 text-xs px-2" style={{ color: "#059669" }}>
            <ExternalLink size={10} /> Coordonnées extraites : {parsed.lat.toFixed(5)}, {parsed.lng.toFixed(5)}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-2000 flex flex-col" style={{ background: "rgba(10,10,10,0.85)", backdropFilter: "blur(4px)" }}>
        <form onSubmit={handleSubmit} className="flex flex-col h-full">

          {/* ── STICKY HEADER ─────────────────────────────────────────── */}
          <div className="shrink-0 flex items-center gap-3 px-4 py-3" style={{ background: "#FFFFFF", borderBottom: "1px solid #EEEEEE" }}>
            <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 shrink-0">
              <X size={16} style={{ color: "#5A5A5A" }} />
            </button>
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${STOP_COLOR}15` }}>
                <Navigation size={14} style={{ color: STOP_COLOR }} />
              </div>
              <span className="font-bold text-sm" style={{ fontFamily: "Archivo, sans-serif", color: "#0A0A0A" }}>Nouvelle course</span>
            </div>
            <div className="flex-1" />
            <div className="hidden md:flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: "#F4F4F4", border: "1px solid #EEEEEE" }}>
                {[{ v: "0", label: "Normale", color: "#6B7280" }, { v: "1", label: "Haute", color: "#F97316" }, { v: "2", label: "Urgente", color: "#EF4444" }].map(p => (
                  <button key={p.v} type="button" onClick={() => setPriority(p.v)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all"
                    style={priority === p.v ? { background: "#FFFFFF", color: p.color, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" } : { color: "#8A8A8A" }}
                  >
                    {p.v === "2" && <Zap size={10} />} {p.label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <DollarSign size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "#8A8A8A" }} />
                <input type="number" min="0" step="0.5" value={price} onChange={e => setPrice(e.target.value)} placeholder="Prix DT"
                  className="pl-7 pr-3 py-1.5 text-sm rounded-lg focus:outline-none" style={{ background: "#F4F4F4", border: "1px solid #EEEEEE", width: 110 }} />
              </div>
              <div className="relative">
                <Truck size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "#8A8A8A" }} />
                <select value={assignCourierId} onChange={e => setAssignCourierId(e.target.value)}
                  className="pl-7 pr-3 py-1.5 text-sm rounded-lg focus:outline-none appearance-none" style={{ background: "#F4F4F4", border: "1px solid #EEEEEE", width: 160 }}>
                  <option value="">Coursier (optionnel)</option>
                  {couriers.map(c => <option key={c.id} value={c.id}>{c.name} {c.status === "available" ? "✓" : "·"}</option>)}
                </select>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all disabled:opacity-50 shrink-0"
              style={{ background: STOP_COLOR, color: "#FFFFFF", fontFamily: "Archivo, sans-serif" }}>
              {loading ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <CheckCircle size={14} />}
              {loading ? "Création…" : stops.length > 1 ? `Créer ${stops.length} courses` : "Créer la course"}
            </button>
          </div>

          {/* ── BODY ─────────────────────────────────────────────────── */}
          <div className="flex-1 flex overflow-hidden">

            {/* ── LEFT PANEL ──────────────────────────────────────────── */}
            <div className="w-full md:w-110 shrink-0 overflow-y-auto" style={{ background: "#F7F7F7", borderRight: "1px solid #EEEEEE" }}>
              <div className="p-4 space-y-3">

                {/* Customer */}
                <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: "1px solid #EEEEEE" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <User size={12} style={{ color: "#8A8A8A" }} />
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#8A8A8A" }}>Client</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: "#5A5A5A" }}>Nom *</label>
                      <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Mohammed Trabelsi" required
                        className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2" style={{ border: "1px solid #E5E7EB", background: "#FAFAFA" }} />
                    </div>
                    <div>
                      <label className="flex items-center gap-1 text-xs font-semibold mb-1" style={{ color: "#5A5A5A" }}><Phone size={9} /> Téléphone</label>
                      <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="+216 XX XXX XXX"
                        className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2" style={{ border: "1px solid #E5E7EB", background: "#FAFAFA" }} />
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="relative">
                  <div className="absolute left-[15px] top-8 bottom-8 w-0.5" style={{ background: "linear-gradient(to bottom, #6366F1, #EF4444)" }} />
                  <div className="space-y-2">

                    {/* Stop cards */}
                    {stops.map((stop, idx) => {
                      const isGps = !!(stop.lat && stop.lng);
                      const isCollapsed = collapsedStops.has(stop._key);
                      const isClickTarget = mapClickTarget?.kind === "pickup" && (mapClickTarget as { kind: "pickup"; key: string }).key === stop._key;

                      return (
                        <div key={stop._key} className="flex gap-3">
                          <div className="shrink-0 flex flex-col items-center pt-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold z-10 relative shadow-md"
                              style={{ background: isGps ? STOP_COLOR : "#C4C4C4", border: "3px solid white" }}>
                              {isGps ? <CheckCircle size={14} /> : idx + 1}
                            </div>
                          </div>

                          <div className="flex-1 bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: `1px solid ${isGps ? "#E0E0FF" : "#EEEEEE"}` }}>
                            {/* Card header */}
                            <div className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none"
                              onClick={() => setCollapsedStops(prev => { const n = new Set(prev); if (n.has(stop._key)) n.delete(stop._key); else n.add(stop._key); return n; })}>
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-bold" style={{ color: STOP_COLOR }}>
                                  {stop.mode === "merchant" ? "🏪" : "📍"} Arrêt {idx + 1}
                                </span>
                                <p className="text-sm font-medium truncate mt-0.5" style={{ color: isGps ? "#111827" : "#9CA3AF" }}>
                                  {isGps ? (stop.merchantName || stop.address || `${parseFloat(stop.lat).toFixed(4)}, ${parseFloat(stop.lng).toFixed(4)}`) : "Localiser cet arrêt…"}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {stops.length > 1 && (
                                  <button type="button" onClick={e => { e.stopPropagation(); removeStop(stop._key); }} className="p-1.5 rounded-lg hover:bg-red-50">
                                    <Trash2 size={12} style={{ color: "#EF4444" }} />
                                  </button>
                                )}
                                {isCollapsed ? <ChevronDown size={14} style={{ color: "#9CA3AF" }} /> : <ChevronUp size={14} style={{ color: "#9CA3AF" }} />}
                              </div>
                            </div>

                            {/* Card body */}
                            {!isCollapsed && (
                              <div className="px-4 pb-4 space-y-3" style={{ borderTop: "1px solid #F5F5F5" }}>
                                {/* Mode tabs: Merchant vs Map */}
                                <div className="flex rounded-xl p-0.5 gap-0.5 mt-3" style={{ background: "#F4F4F4" }}>
                                  {([{ key: "merchant", icon: <Store size={11} />, label: "Marchand" }, { key: "map", icon: <MapPin size={11} />, label: "Localiser" }] as { key: StopMode; icon: React.ReactNode; label: string }[]).map(m => (
                                    <button key={m.key} type="button"
                                      onClick={() => updateStop(stop._key, { mode: m.key, query: "", merchantId: null, merchantName: "", address: "", lat: "", lng: "", pinned: false, showDropdown: false, linkInput: "" })}
                                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all"
                                      style={stop.mode === m.key ? { background: "#FFFFFF", color: STOP_COLOR, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" } : { color: "#8A8A8A" }}>
                                      {m.icon} {m.label}
                                    </button>
                                  ))}
                                </div>

                                {/* Merchant mode */}
                                {stop.mode === "merchant" && (
                                  <div className="relative">
                                    <div className="relative">
                                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9CA3AF" }} />
                                      <input type="text" value={stop.query}
                                        onChange={e => updateStop(stop._key, { query: e.target.value, merchantId: null, address: "", lat: "", lng: "", pinned: false, showDropdown: true })}
                                        onFocus={() => updateStop(stop._key, { showDropdown: true })}
                                        placeholder="Rechercher un marchand…"
                                        className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-2"
                                        style={{ border: "1px solid #E5E7EB", background: "#FAFAFA" }} />
                                    </div>
                                    {stop.showDropdown && filteredMerchants(stop.query).length > 0 && (
                                      <div className="absolute z-50 mt-1 w-full bg-white rounded-xl shadow-xl overflow-hidden max-h-44 overflow-y-auto" style={{ border: "1px solid #E5E7EB" }}>
                                        {filteredMerchants(stop.query).map(m => (
                                          <button key={m.id} type="button" onMouseDown={() => selectMerchant(stop._key, m)}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-indigo-50 transition-colors">
                                            <span className="text-base">{CATEGORY_EMOJI[m.category] ?? "🏪"}</span>
                                            <div className="min-w-0">
                                              <p className="text-sm font-medium truncate" style={{ color: "#111827" }}>{m.name}</p>
                                              {m.address && <p className="text-xs truncate" style={{ color: "#9CA3AF" }}>{m.address}</p>}
                                            </div>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                    {stop.merchantId && (
                                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium mt-1" style={{ background: "#EEF2FF", color: STOP_COLOR, border: "1px solid #E0E0FF" }}>
                                        <span>{CATEGORY_EMOJI[merchants.find(m => m.id === stop.merchantId)?.category ?? ""] ?? "🏪"}</span>
                                        <span>{stop.merchantName}</span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Map mode */}
                                {stop.mode === "map" && (
                                  <div className="space-y-2.5">
                                    <MapMethodSelector
                                      method={stop.mapMethod}
                                      onMethod={m => updateStop(stop._key, { mapMethod: m })}
                                      isTarget={isClickTarget}
                                      onActivateClick={() => setMapClickTarget({ kind: "pickup", key: stop._key })}
                                      onDeactivateClick={() => { if (isClickTarget) setMapClickTarget(null); }}
                                    />

                                    {stop.mapMethod === "search" && (
                                      <PlacesInput
                                        value={stop.address}
                                        confirmed={stop.pinned}
                                        placeholder="Rechercher une adresse à Bizerte…"
                                        onTextChange={text => updateStop(stop._key, { address: text, pinned: false })}
                                        onPlaceSelect={(address, lat, lng) => updateStop(stop._key, { address, lat: lat.toString(), lng: lng.toString(), pinned: true })}
                                        onClear={() => updateStop(stop._key, { address: "", lat: "", lng: "", pinned: false })}
                                      />
                                    )}

                                    {stop.mapMethod === "link" && (
                                      <LinkInput
                                        value={stop.linkInput}
                                        onChange={v => updateStop(stop._key, { linkInput: v })}
                                        onParsed={(lat, lng) => updateStop(stop._key, { lat: lat.toString(), lng: lng.toString(), pinned: true })}
                                      />
                                    )}

                                    {stop.mapMethod === "click" && (
                                      <ClickInstruction
                                        active={isClickTarget}
                                        onCancel={() => setMapClickTarget(null)}
                                      />
                                    )}

                                    {stop.mapMethod === "description" && (
                                      <textarea
                                        value={stop.address}
                                        onChange={e => updateStop(stop._key, { address: e.target.value })}
                                        placeholder="Ex : Près de la pharmacie centrale, 2ème rue à gauche…"
                                        rows={4}
                                        className="w-full px-3 py-2 text-sm rounded-xl focus:outline-none resize-none"
                                        style={{ border: "1px solid #E5E7EB", background: "#FAFAFA" }}
                                      />
                                    )}

                                    {/* GPS confirmed */}
                                    {stop.lat && stop.lng && stop.mapMethod !== "description" && (
                                      <GpsBadge lat={stop.lat} lng={stop.lng} address={stop.address || undefined} />
                                    )}
                                  </div>
                                )}

                                {/* Optional label (for map mode) */}
                                {stop.mode === "map" && stop.mapMethod !== "description" && (
                                  <div>
                                    <label className="block text-xs font-semibold mb-1" style={{ color: "#5A5A5A" }}>Libellé du lieu <span style={{ color: "#9CA3AF" }}>(optionnel)</span></label>
                                    <input type="text" value={stop.address} onChange={e => updateStop(stop._key, { address: e.target.value })}
                                      placeholder="Ex: Café de la Paix, Zarzouna…"
                                      className="w-full px-3 py-2 text-sm rounded-xl focus:outline-none"
                                      style={{ border: "1px solid #E5E7EB", background: "#FAFAFA" }} />
                                  </div>
                                )}

                                {/* Order notes */}
                                <div>
                                  <label className="flex items-center gap-1 text-xs font-semibold mb-1" style={{ color: "#5A5A5A" }}>
                                    <Package size={10} /> Détail commande
                                  </label>
                                  <textarea value={stop.orderNotes} onChange={e => updateStop(stop._key, { orderNotes: e.target.value })}
                                    placeholder="Ex: 2 pizzas Margherita + 1 boisson…"
                                    rows={3}
                                    className="w-full px-3 py-2 text-sm rounded-xl focus:outline-none resize-none"
                                    style={{ border: "1px solid #E5E7EB", background: "#FAFAFA" }} />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Add stop */}
                    <div className="flex gap-3">
                      <div className="shrink-0 w-8 flex justify-center pt-1">
                        <div className="w-0.5 h-6" style={{ background: "rgba(99,102,241,0.2)" }} />
                      </div>
                      <button type="button" onClick={addStop}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition-all"
                        style={{ border: `1.5px dashed ${STOP_COLOR}40`, color: STOP_COLOR, background: `${STOP_COLOR}05` }}>
                        <Plus size={14} /> Ajouter un arrêt
                      </button>
                    </div>

                    {/* ── Destination client ───────────────────────────── */}
                    <div className="flex gap-3">
                      <div className="shrink-0 flex flex-col items-center pt-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center z-10 relative shadow-md"
                          style={{ background: hasDelivery ? DEST_COLOR : "#C4C4C4", border: "3px solid white" }}>
                          {hasDelivery ? <CheckCircle size={14} color="white" /> : <Flag size={14} color="white" />}
                        </div>
                      </div>

                      <div className="flex-1 bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: `1px solid ${hasDelivery ? "#FFE4E4" : "#EEEEEE"}` }}>
                        <div className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none" onClick={() => setDeliveryCollapsed(p => !p)}>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-bold" style={{ color: DEST_COLOR }}>🏁 Destination finale</span>
                            <p className="text-sm font-medium truncate mt-0.5" style={{ color: hasDelivery ? "#111827" : "#9CA3AF" }}>
                              {hasDelivery ? (deliveryAddress || `${parseFloat(deliveryLat).toFixed(4)}, ${parseFloat(deliveryLng).toFixed(4)}`) : "Localiser le client…"}
                            </p>
                          </div>
                          {deliveryCollapsed ? <ChevronDown size={14} style={{ color: "#9CA3AF" }} /> : <ChevronUp size={14} style={{ color: "#9CA3AF" }} />}
                        </div>

                        {!deliveryCollapsed && (
                          <div className="px-4 pb-4 space-y-2.5" style={{ borderTop: "1px solid #F5F5F5" }}>
                            <div className="mt-3">
                              <MapMethodSelector
                                method={deliveryMapMethod}
                                onMethod={m => { setDeliveryMapMethod(m); if (m !== "click") setMapClickTarget(prev => prev?.kind === "delivery" ? null : prev); }}
                                isTarget={mapClickTarget?.kind === "delivery"}
                                onActivateClick={() => setMapClickTarget({ kind: "delivery" })}
                                onDeactivateClick={() => { if (mapClickTarget?.kind === "delivery") setMapClickTarget(null); }}
                              />
                            </div>

                            {deliveryMapMethod === "search" && (
                              <PlacesInput
                                value={deliveryAddress}
                                confirmed={deliveryPinned}
                                placeholder="Rechercher l'adresse du client…"
                                borderColor="#FECACA"
                                bgColor="#FFF5F5"
                                onTextChange={text => { setDeliveryAddress(text); setDeliveryPinned(false); }}
                                onPlaceSelect={(address, lat, lng) => { setDeliveryAddress(address); setDeliveryLat(lat.toString()); setDeliveryLng(lng.toString()); setDeliveryPinned(true); }}
                                onClear={() => { setDeliveryAddress(""); setDeliveryLat(""); setDeliveryLng(""); setDeliveryPinned(false); }}
                              />
                            )}

                            {deliveryMapMethod === "link" && (
                              <LinkInput
                                value={deliveryLinkInput}
                                onChange={setDeliveryLinkInput}
                                onParsed={(lat, lng) => { setDeliveryLat(lat.toString()); setDeliveryLng(lng.toString()); setDeliveryPinned(true); }}
                              />
                            )}

                            {deliveryMapMethod === "click" && (
                              <ClickInstruction
                                active={mapClickTarget?.kind === "delivery"}
                                onCancel={() => setMapClickTarget(null)}
                              />
                            )}

                            {deliveryMapMethod === "description" && (
                              <textarea
                                value={deliveryAddress}
                                onChange={e => setDeliveryAddress(e.target.value)}
                                placeholder="Ex : Près de la pharmacie centrale, en face du café Bel Aziz, 2ème rue à gauche après la mosquée…"
                                rows={4}
                                className="w-full px-3 py-2 text-sm rounded-xl focus:outline-none resize-none"
                                style={{ border: "1px solid #FECACA", background: "#FFF5F5" }}
                              />
                            )}

                            {hasDelivery && deliveryMapMethod !== "description" && (
                              <GpsBadge lat={deliveryLat} lng={deliveryLng} address={deliveryAddress || undefined} />
                            )}

                            <div>
                              <label className="block text-xs font-semibold mb-1" style={{ color: "#5A5A5A" }}>Libellé <span style={{ color: "#9CA3AF" }}>(optionnel)</span></label>
                              <input type="text" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)}
                                placeholder="Ex: Villa avec portail rouge, Zarzouna…"
                                className="w-full px-3 py-2 text-sm rounded-xl focus:outline-none"
                                style={{ border: "1px solid #FECACA", background: "#FFF5F5" }} />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold mb-1" style={{ color: "#5A5A5A" }}>Instructions coursier <span style={{ color: "#9CA3AF" }}>(optionnel)</span></label>
                              <textarea value={deliveryInstructions} onChange={e => setDeliveryInstructions(e.target.value)}
                                placeholder="Ex: 3ème étage, sonner 2 fois…"
                                rows={3}
                                className="w-full px-3 py-2 text-sm rounded-xl focus:outline-none resize-none"
                                style={{ border: "1px solid #FECACA", background: "#FFF5F5" }} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: "1px solid #EEEEEE" }}>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-xl font-black" style={{ fontFamily: "Archivo, sans-serif", color: STOP_COLOR }}>{stops.length}</div>
                      <div className="text-xs" style={{ color: "#8A8A8A" }}>Arrêt{stops.length > 1 ? "s" : ""}</div>
                    </div>
                    <div>
                      <div className="text-xl font-black" style={{ fontFamily: "Archivo, sans-serif", color: price ? "#10B981" : "#C4C4C4" }}>
                        {price ? `${parseFloat(price).toFixed(1)}` : "—"}
                      </div>
                      <div className="text-xs" style={{ color: "#8A8A8A" }}>DT</div>
                    </div>
                    <div>
                      <div className="text-sm font-bold truncate" style={{ color: selectedCourier ? "#111827" : "#C4C4C4" }}>
                        {selectedCourier ? selectedCourier.name.split(" ")[0] : "—"}
                      </div>
                      <div className="text-xs" style={{ color: "#8A8A8A" }}>Coursier</div>
                    </div>
                  </div>
                  {stops.length > 1 && (
                    <div className="mt-3 px-3 py-2 rounded-xl text-xs text-center font-medium" style={{ background: "#EEF2FF", color: STOP_COLOR }}>
                      {stops.length} arrêts → {stops.length} livraisons pour ce client
                    </div>
                  )}
                </div>

                {error && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{ background: "#FEF2F2", color: DEST_COLOR, border: "1px solid #FECACA" }}>
                    <X size={14} className="shrink-0" /> {error}
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT PANEL: MAP ─────────────────────────────────────── */}
            <div className="hidden md:flex flex-1 flex-col relative">
              <div ref={mapPanelRef} className="flex-1 w-full h-full" />

              {/* Map overlay info */}
              <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
                <div className="px-3 py-2 rounded-xl text-xs font-semibold shadow-lg" style={{ background: "rgba(255,255,255,0.95)", color: "#111827", border: "1px solid #EEEEEE" }}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: STOP_COLOR }} />
                    <span>{configuredStops}/{stops.length} arrêt{stops.length > 1 ? "s" : ""} localisé{configuredStops > 1 ? "s" : ""}</span>
                  </div>
                  {hasDelivery && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-3 h-3 rounded-full" style={{ background: DEST_COLOR }} />
                      <span>Destination confirmée</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Click mode overlay */}
              {mapClickTarget && (
                <div className="absolute inset-0 pointer-events-none flex items-start justify-center pt-16">
                  <div className="px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3" style={{ background: "rgba(0,0,0,0.82)", color: "#FFFFFF" }}>
                    <Crosshair size={18} className="animate-pulse" style={{ color: "#FCD34D" }} />
                    <div>
                      <p className="font-bold text-sm" style={{ fontFamily: "Archivo, sans-serif" }}>Mode sélection actif</p>
                      <p className="text-xs opacity-70">Cliquez sur la carte pour placer le point</p>
                    </div>
                    <button
                      type="button"
                      className="pointer-events-auto ml-2 p-1.5 rounded-lg hover:bg-white/10"
                      onClick={() => setMapClickTarget(null)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Empty placeholder */}
              {configuredStops === 0 && !hasDelivery && !mapClickTarget && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="px-6 py-5 rounded-2xl text-center shadow-xl" style={{ background: "rgba(255,255,255,0.95)", maxWidth: 260 }}>
                    <MapPin size={32} style={{ color: STOP_COLOR, margin: "0 auto 8px" }} />
                    <p className="font-bold text-sm" style={{ color: "#111827", fontFamily: "Archivo, sans-serif" }}>Carte de la livraison</p>
                    <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>Localisez vos arrêts — ils apparaîtront ici avec la route.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>
      </div>

      {mapTarget && (
        <MapPickerModal
          title={mapTarget.kind === "delivery" ? "Position de livraison" : "Point de collecte"}
          subtitle={mapTarget.kind === "delivery" ? "Cliquez sur la carte pour situer le client" : "Cliquez sur la carte pour situer l'arrêt"}
          initialCenter={mapTarget.kind === "delivery"
            ? (deliveryLat && deliveryLng ? { lat: parseFloat(deliveryLat), lng: parseFloat(deliveryLng) } : BIZERTE_CENTER)
            : (() => { const s = stops.find(st => st._key === (mapTarget as { kind: "pickup"; key: string }).key); return s?.lat && s?.lng ? { lat: parseFloat(s.lat), lng: parseFloat(s.lng) } : BIZERTE_CENTER; })()
          }
          onConfirm={handleMapConfirm}
          onClose={() => setMapTarget(null)}
        />
      )}
    </>
  );
}
