"use client";

import { useState, useEffect, useRef } from "react";
import {
  X, Package, Phone, User, CheckCircle, Zap, DollarSign,
  Navigation, Truck, Search, Link2, Crosshair, AlignLeft, ExternalLink,
  XCircle, Trash2,
} from "lucide-react";
import type { Courier, Delivery } from "@/lib/types";
import { PlacesInput } from "@/components/ui/PlacesInput";

// ── Constants ────────────────────────────────────────────────────────────────
const STOP_COLOR  = "#6366F1";
const DEST_COLOR  = "#EF4444";
const BIZERTE_CENTER = { lat: 37.2744, lng: 9.8739 };

type MapMethod = "search" | "link" | "click" | "description";

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

interface Props {
  delivery: Delivery;
  couriers: Courier[];
  onClose: () => void;
  onStatusChange: (deliveryId: string, action: string) => void;
  onSaved: () => void;
}

const PRIORITY_OPTIONS = [
  { v: "0", label: "Normale", color: "#6B7280" },
  { v: "1", label: "Haute",   color: "#F97316" },
  { v: "2", label: "Urgente", color: "#EF4444" },
];

export function EditDeliveryForm({
  delivery, couriers, onClose, onStatusChange, onSaved,
}: Props) {
  // ── State ────────────────────────────────────────────────────────────────
  const [customerName,  setCustomerName]  = useState(delivery.customerName);
  const [customerPhone, setCustomerPhone] = useState(delivery.customerPhone ?? "");

  const [pickupMapMethod, setPickupMapMethod] = useState<MapMethod>("search");
  const [pickupLinkInput, setPickupLinkInput] = useState("");
  const [pickupAddress, setPickupAddress] = useState(delivery.pickupAddress);
  const [pickupLat,     setPickupLat]     = useState(delivery.pickupLat !== 0 ? delivery.pickupLat.toString() : "");
  const [pickupLng,     setPickupLng]     = useState(delivery.pickupLng !== 0 ? delivery.pickupLng.toString() : "");
  const [pickupPinned,  setPickupPinned]  = useState(delivery.pickupLat !== 0 && delivery.pickupLng !== 0);

  const initMethod = (): MapMethod =>
    delivery.locationConfirmed === false && !delivery.deliveryLat ? "description" : "search";

  const [deliveryMapMethod, setDeliveryMapMethod] = useState<MapMethod>(initMethod);
  const [deliveryLinkInput, setDeliveryLinkInput] = useState("");
  const [deliveryAddress,   setDeliveryAddress]   = useState(delivery.deliveryAddress);
  const [deliveryLat,       setDeliveryLat]       = useState(
    delivery.deliveryLat ? delivery.deliveryLat.toString() : ""
  );
  const [deliveryLng,       setDeliveryLng]       = useState(
    delivery.deliveryLng ? delivery.deliveryLng.toString() : ""
  );
  const [deliveryPinned, setDeliveryPinned] = useState(
    !!(delivery.deliveryLat && delivery.deliveryLng && delivery.locationConfirmed !== false)
  );

  const [notes,        setNotes]        = useState(delivery.notes ?? "");
  const [instructions, setInstructions] = useState(delivery.deliveryDescription ?? "");
  const [price,        setPrice]        = useState(delivery.price?.toString() ?? "");
  const [priority,     setPriority]     = useState((delivery.priority ?? 0).toString());
  const [assignId,     setAssignId]     = useState(delivery.courierId ?? "");

  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const mapClickTargetRef = useRef<"pickup" | "delivery" | null>(null);
  const [mapClickTarget, setMapClickTargetBase] = useState<"pickup" | "delivery" | null>(null);
  const setMapClickTarget = (t: "pickup" | "delivery" | null) => {
    mapClickTargetRef.current = t; setMapClickTargetBase(t);
  };

  // ── Map refs ────────────────────────────────────────────────────────────
  const mapPanelRef  = useRef<HTMLDivElement>(null);
  const gMapRef      = useRef<google.maps.Map | null>(null);
  const pickupMarker = useRef<google.maps.Marker | null>(null);
  const delivMarker  = useRef<google.maps.Marker | null>(null);

  const available = couriers.filter(c => ["available", "busy"].includes(c.status));
  const isActive  = ["pending", "assigned", "picked_up"].includes(delivery.status);

  const hasDelivery = deliveryMapMethod === "description"
    ? !!deliveryAddress.trim()
    : !!(deliveryLat && deliveryLng);

  // ── Map init ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapPanelRef.current) return;
    let cancelled = false;
    const tryInit = () => {
      if (cancelled || !mapPanelRef.current) return;
      if (!window.google?.maps) { setTimeout(tryInit, 200); return; }
      if (gMapRef.current) return;

      const center = delivery.deliveryLat && delivery.deliveryLng
        ? { lat: delivery.deliveryLat, lng: delivery.deliveryLng }
        : BIZERTE_CENTER;

      const map = new window.google.maps.Map(mapPanelRef.current, {
        center, zoom: 14,
        mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
        mapTypeId: "satellite",
        styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
      });
      gMapRef.current = map;

      if (delivery.pickupLat && delivery.pickupLng) {
        pickupMarker.current = new window.google.maps.Marker({
          map, position: { lat: delivery.pickupLat, lng: delivery.pickupLng },
          title: "Collecte",
          label: { text: "C", color: "#fff", fontWeight: "bold", fontSize: "12px" },
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 14, fillColor: STOP_COLOR, fillOpacity: 1,
            strokeColor: "#fff", strokeWeight: 2,
          },
        });
      }

      if (delivery.deliveryLat && delivery.deliveryLng) {
        delivMarker.current = new window.google.maps.Marker({
          map, position: { lat: delivery.deliveryLat, lng: delivery.deliveryLng },
          title: "Livraison",
          icon: {
            path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
            scale: 7, fillColor: DEST_COLOR, fillOpacity: 1,
            strokeColor: "#fff", strokeWeight: 2,
          },
        });
      }

      map.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (!e.latLng || !mapClickTargetRef.current) return;
        const lat = e.latLng.lat(), lng = e.latLng.lng();
        if (mapClickTargetRef.current === "delivery") {
          setDeliveryLat(lat.toString()); setDeliveryLng(lng.toString()); setDeliveryPinned(true);
          if (!delivMarker.current) {
            delivMarker.current = new window.google.maps.Marker({ map,
              icon: { path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW, scale: 7, fillColor: DEST_COLOR, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
            });
          }
          delivMarker.current.setPosition(e.latLng);
        } else {
          setPickupLat(lat.toString()); setPickupLng(lng.toString()); setPickupPinned(true);
          if (!pickupMarker.current) {
            pickupMarker.current = new window.google.maps.Marker({ map,
              label: { text: "C", color: "#fff", fontWeight: "bold", fontSize: "12px" },
              icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 14, fillColor: STOP_COLOR, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
            });
          }
          pickupMarker.current.setPosition(e.latLng);
        }
      });
    };
    tryInit();
    return () => { cancelled = true; };
  }, []);

  // Sync delivery marker
  useEffect(() => {
    if (!gMapRef.current || !deliveryLat || !deliveryLng) return;
    const pos = { lat: parseFloat(deliveryLat), lng: parseFloat(deliveryLng) };
    if (!delivMarker.current) {
      delivMarker.current = new window.google.maps.Marker({ map: gMapRef.current, position: pos,
        icon: { path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW, scale: 7, fillColor: DEST_COLOR, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
      });
    } else { delivMarker.current.setPosition(pos); }
    gMapRef.current.panTo(pos);
  }, [deliveryLat, deliveryLng]);

  // Sync pickup marker
  useEffect(() => {
    if (!gMapRef.current || !pickupLat || !pickupLng) return;
    const pos = { lat: parseFloat(pickupLat), lng: parseFloat(pickupLng) };
    if (!pickupMarker.current) {
      pickupMarker.current = new window.google.maps.Marker({ map: gMapRef.current, position: pos,
        label: { text: "C", color: "#fff", fontWeight: "bold", fontSize: "12px" },
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 14, fillColor: STOP_COLOR, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
      });
    } else { pickupMarker.current.setPosition(pos); }
  }, [pickupLat, pickupLng]);

  // ── Sub-components ────────────────────────────────────────────────────────
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

  const LinkInput = ({ value, onChange, onParsed }: {
    value: string; onChange: (v: string) => void; onParsed: (lat: number, lng: number) => void;
  }) => {
    const parsed = value ? parseGMapsLink(value) : null;
    return (
      <div className="space-y-1.5">
        <div className="relative">
          <Link2 size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9CA3AF" }} />
          <input
            type="url" value={value}
            onChange={e => { onChange(e.target.value); const c = parseGMapsLink(e.target.value); if (c) onParsed(c.lat, c.lng); }}
            placeholder="Coller un lien Google Maps…"
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
            style={{ border: `1px solid ${parsed ? "#6EE7B7" : "#E5E7EB"}`, background: parsed ? "#F0FDF4" : "#FAFAFA" }}
          />
        </div>
        {value && !parsed && <p className="text-xs pl-1" style={{ color: "#F97316" }}>Lien non reconnu — essayez de copier depuis Google Maps → Partager → Copier le lien</p>}
        {parsed && <div className="flex items-center gap-1.5 text-xs px-2" style={{ color: "#059669" }}><ExternalLink size={10} /> {parsed.lat.toFixed(5)}, {parsed.lng.toFixed(5)}</div>}
      </div>
    );
  };

  const MethodSelector = ({ method, setMethod, activeColor, clickTarget }: {
    method: MapMethod; setMethod: (m: MapMethod) => void;
    activeColor: string; clickTarget: "pickup" | "delivery";
  }) => (
    <div className="flex rounded-xl p-0.5 gap-0.5" style={{ background: "#F4F4F4" }}>
      {([
        { key: "search",      icon: <Search size={11} />,    label: "Chercher" },
        { key: "link",        icon: <Link2 size={11} />,     label: "Lien" },
        { key: "click",       icon: <Crosshair size={11} />, label: "Carte" },
        { key: "description", icon: <AlignLeft size={11} />, label: "Texte" },
      ] as { key: MapMethod; icon: React.ReactNode; label: string }[]).map(m => (
        <button key={m.key} type="button"
          onClick={() => {
            setMethod(m.key);
            setMapClickTarget(m.key === "click" ? clickTarget : null);
          }}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold rounded-lg transition-all"
          style={method === m.key
            ? { background: mapClickTarget === clickTarget && m.key === "click" ? "#EF4444" : activeColor, color: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }
            : { color: "#8A8A8A" }}
        >
          {m.icon} {m.label}
        </button>
      ))}
    </div>
  );

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setError("");
    if (!customerName.trim()) { setError("Le nom du client est requis"); return; }
    if (deliveryMapMethod === "description") {
      if (!deliveryAddress.trim()) { setError("Décrivez l'emplacement de livraison"); return; }
    } else {
      if (!deliveryLat || !deliveryLng) { setError("Localisez le client sur la carte"); return; }
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/deliveries/${delivery.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName:        customerName.trim(),
          customerPhone:       customerPhone.trim() || null,
          pickupAddress:       pickupAddress.trim(),
          pickupLat:           parseFloat(pickupLat) || delivery.pickupLat,
          pickupLng:           parseFloat(pickupLng) || delivery.pickupLng,
          deliveryAddress:     deliveryAddress.trim(),
          deliveryLat:         deliveryMapMethod === "description" ? 0 : parseFloat(deliveryLat),
          deliveryLng:         deliveryMapMethod === "description" ? 0 : parseFloat(deliveryLng),
          locationConfirmed:   deliveryMapMethod !== "description",
          notes:               notes.trim() || null,
          deliveryDescription: instructions.trim() || null,
          price:               price ? parseFloat(price) : null,
          priority:            parseInt(priority),
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Erreur lors de la sauvegarde");
        return;
      }

      if (assignId && assignId !== delivery.courierId) {
        await fetch(`/api/deliveries/${delivery.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "assign", courierId: assignId }),
        });
      }

      onSaved();
      onClose();
    } catch {
      setError("Erreur réseau");
    } finally {
      setSaving(false);
    }
  };

  const doAction = (action: string) => { onStatusChange(delivery.id, action); onClose(); };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await fetch(`/api/deliveries/${delivery.id}`, { method: "DELETE" });
      onSaved();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[2000] flex flex-col" style={{ background: "rgba(10,10,10,0.85)", backdropFilter: "blur(4px)" }}>
      <div className="flex flex-col h-full">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="shrink-0 flex items-center gap-3 px-4 py-3" style={{ background: "#FFFFFF", borderBottom: "1px solid #EEEEEE" }}>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 shrink-0">
            <X size={16} style={{ color: "#5A5A5A" }} />
          </button>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${DEST_COLOR}15` }}>
              <Navigation size={14} style={{ color: DEST_COLOR }} />
            </div>
            <span className="font-bold text-sm" style={{ fontFamily: "Archivo, sans-serif", color: "#0A0A0A" }}>
              Modifier la course
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-lg" style={{ background: "#F4F4F4", color: "#8A8A8A" }}>
              #{delivery.orderNumber}
            </span>
          </div>

          <div className="flex-1" />

          {/* Priority + Price + Courier — header controls */}
          <div className="hidden md:flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: "#F4F4F4", border: "1px solid #EEEEEE" }}>
              {PRIORITY_OPTIONS.map(p => (
                <button key={p.v} type="button" onClick={() => setPriority(p.v)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all"
                  style={priority === p.v
                    ? { background: "#FFFFFF", color: p.color, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }
                    : { color: "#8A8A8A" }}
                >
                  {p.v === "2" && <Zap size={10} />} {p.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <DollarSign size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "#8A8A8A" }} />
              <input type="number" min="0" step="0.5" value={price} onChange={e => setPrice(e.target.value)}
                placeholder="Prix DT"
                className="pl-7 pr-3 py-1.5 text-sm rounded-lg focus:outline-none"
                style={{ background: "#F4F4F4", border: "1px solid #EEEEEE", width: 110 }} />
            </div>
            <div className="relative">
              <Truck size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "#8A8A8A" }} />
              <select value={assignId} onChange={e => setAssignId(e.target.value)}
                className="pl-7 pr-3 py-1.5 text-sm rounded-lg focus:outline-none appearance-none"
                style={{ background: "#F4F4F4", border: "1px solid #EEEEEE", width: 160 }}>
                <option value="">Coursier (optionnel)</option>
                {available.map(c => (
                  <option key={c.id} value={c.id}>{c.name} {c.status === "available" ? "✓" : "·"}</option>
                ))}
              </select>
            </div>
          </div>

          <button type="button" onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all disabled:opacity-50 shrink-0"
            style={{ background: DEST_COLOR, color: "#FFFFFF", fontFamily: "Archivo, sans-serif" }}>
            {saving
              ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              : <CheckCircle size={14} />}
            {saving ? "Sauvegarde…" : "Enregistrer"}
          </button>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div className="flex-1 flex overflow-hidden">

          {/* ── Left panel ───────────────────────────────────────────── */}
          <div className="w-full md:w-110 shrink-0 overflow-y-auto" style={{ background: "#F7F7F7", borderRight: "1px solid #EEEEEE" }}>
            <div className="p-4 space-y-3">

              {/* Client */}
              <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: "1px solid #EEEEEE" }}>
                <div className="flex items-center gap-2 mb-3">
                  <User size={12} style={{ color: "#8A8A8A" }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#8A8A8A" }}>Client</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: "#5A5A5A" }}>Nom *</label>
                    <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)}
                      placeholder="Mohammed Trabelsi" required
                      className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2"
                      style={{ border: "1px solid #E5E7EB", background: "#FAFAFA" }} />
                  </div>
                  <div>
                    <label className="flex items-center gap-1 text-xs font-semibold mb-1" style={{ color: "#5A5A5A" }}>
                      <Phone size={9} /> Téléphone
                    </label>
                    <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
                      placeholder="+216 XX XXX XXX"
                      className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2"
                      style={{ border: "1px solid #E5E7EB", background: "#FAFAFA" }} />
                  </div>
                </div>
              </div>

              {/* Collecte */}
              <div className="flex gap-3">
                <div className="shrink-0 flex flex-col items-center pt-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold z-10 relative shadow-md"
                    style={{ background: pickupPinned || pickupMapMethod === "description" ? STOP_COLOR : "#C4C4C4", border: "3px solid white" }}>
                    C
                  </div>
                </div>
                <div className="flex-1 bg-white rounded-2xl shadow-sm overflow-hidden"
                  style={{ border: `1px solid ${pickupPinned || pickupMapMethod === "description" ? "#E0E0FF" : "#EEEEEE"}` }}>
                  <div className="flex items-center gap-2 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold" style={{ color: STOP_COLOR }}>📦 Point de collecte</span>
                      <p className="text-sm font-medium truncate mt-0.5" style={{ color: (pickupPinned || pickupMapMethod === "description") ? "#111827" : "#9CA3AF" }}>
                        {pickupMapMethod === "description" ? (pickupAddress || "Description de l'emplacement…") : pickupPinned ? pickupAddress : "Localiser le point de collecte…"}
                      </p>
                    </div>
                  </div>
                  <div className="px-4 pb-4 space-y-2.5" style={{ borderTop: "1px solid #F5F5F5" }}>
                    <div className="mt-3">
                      <MethodSelector method={pickupMapMethod} setMethod={setPickupMapMethod} activeColor={STOP_COLOR} clickTarget="pickup" />
                    </div>
                    {pickupMapMethod === "search" && (
                      <PlacesInput value={pickupAddress} confirmed={pickupPinned}
                        placeholder="Rechercher le point de collecte…"
                        borderColor="#E0E0FF" bgColor="#F5F3FF"
                        onTextChange={t => { setPickupAddress(t); setPickupPinned(false); }}
                        onPlaceSelect={(addr, lat, lng) => { setPickupAddress(addr); setPickupLat(lat.toString()); setPickupLng(lng.toString()); setPickupPinned(true); }}
                        onClear={() => { setPickupAddress(""); setPickupLat(""); setPickupLng(""); setPickupPinned(false); }}
                      />
                    )}
                    {pickupMapMethod === "link" && (
                      <LinkInput value={pickupLinkInput} onChange={setPickupLinkInput}
                        onParsed={(lat, lng) => { setPickupLat(lat.toString()); setPickupLng(lng.toString()); setPickupPinned(true); }}
                      />
                    )}
                    {pickupMapMethod === "click" && (
                      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                        style={{ background: mapClickTarget === "pickup" ? "#F5F3FF" : "#F9FAFB", border: `1px solid ${mapClickTarget === "pickup" ? "#C4B5FD" : "#E5E7EB"}` }}>
                        <Crosshair size={14} style={{ color: mapClickTarget === "pickup" ? STOP_COLOR : "#9CA3AF", flexShrink: 0 }}
                          className={mapClickTarget === "pickup" ? "animate-pulse" : ""} />
                        <span className="text-sm flex-1" style={{ color: mapClickTarget === "pickup" ? "#111827" : "#9CA3AF" }}>
                          {mapClickTarget === "pickup" ? "Cliquez sur la carte à droite →" : "Cliquez « Carte » puis cliquez sur la carte"}
                        </span>
                      </div>
                    )}
                    {pickupMapMethod === "description" && (
                      <textarea value={pickupAddress} onChange={e => setPickupAddress(e.target.value)}
                        placeholder="Ex : Pizzeria Hassan, rue de la République, Bizerte…"
                        rows={4} className="w-full px-3 py-2 text-sm rounded-xl focus:outline-none resize-none"
                        style={{ border: "1px solid #E0E0FF", background: "#F5F3FF" }}
                      />
                    )}
                    {pickupPinned && pickupMapMethod !== "description" && (
                      <GpsBadge lat={pickupLat} lng={pickupLng} address={pickupAddress || undefined} />
                    )}
                    {pickupMapMethod !== "description" && (
                      <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: "#5A5A5A" }}>
                          Libellé <span style={{ color: "#9CA3AF" }}>(optionnel)</span>
                        </label>
                        <input type="text" value={pickupAddress} onChange={e => setPickupAddress(e.target.value)}
                          placeholder="Ex : Pizzeria Hassan, rue de la République…"
                          className="w-full px-3 py-2 text-sm rounded-xl focus:outline-none"
                          style={{ border: "1px solid #E5E7EB", background: "#FAFAFA" }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Destination */}
              <div className="flex gap-3">
                <div className="shrink-0 flex flex-col items-center pt-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center z-10 relative shadow-md"
                    style={{ background: hasDelivery ? DEST_COLOR : "#C4C4C4", border: "3px solid white" }}>
                    <CheckCircle size={14} color="white" />
                  </div>
                </div>

                <div className="flex-1 bg-white rounded-2xl shadow-sm overflow-hidden"
                  style={{ border: `1px solid ${hasDelivery ? "#FFE4E4" : "#EEEEEE"}` }}>
                  <div className="flex items-center gap-2 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold" style={{ color: DEST_COLOR }}>🏁 Destination finale</span>
                      <p className="text-sm font-medium truncate mt-0.5"
                        style={{ color: hasDelivery ? "#111827" : "#9CA3AF" }}>
                        {hasDelivery
                          ? (deliveryAddress || `${parseFloat(deliveryLat).toFixed(4)}, ${parseFloat(deliveryLng).toFixed(4)}`)
                          : "Localiser le client…"}
                      </p>
                    </div>
                  </div>

                  <div className="px-4 pb-4 space-y-2.5" style={{ borderTop: "1px solid #F5F5F5" }}>
                    <div className="mt-3">
                      <MethodSelector method={deliveryMapMethod} setMethod={setDeliveryMapMethod} activeColor={DEST_COLOR} clickTarget="delivery" />
                    </div>

                    {deliveryMapMethod === "search" && (
                      <PlacesInput
                        value={deliveryAddress}
                        confirmed={deliveryPinned}
                        placeholder="Rechercher l'adresse du client…"
                        borderColor="#FECACA"
                        bgColor="#FFF5F5"
                        onTextChange={text => { setDeliveryAddress(text); setDeliveryPinned(false); }}
                        onPlaceSelect={(address, lat, lng) => {
                          setDeliveryAddress(address);
                          setDeliveryLat(lat.toString());
                          setDeliveryLng(lng.toString());
                          setDeliveryPinned(true);
                        }}
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
                      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                        style={{ background: mapClickTarget === "delivery" ? "#FEF2F2" : "#F9FAFB", border: `1px solid ${mapClickTarget === "delivery" ? "#FECACA" : "#E5E7EB"}` }}>
                        <Crosshair size={14} style={{ color: mapClickTarget === "delivery" ? DEST_COLOR : "#9CA3AF", flexShrink: 0 }}
                          className={mapClickTarget === "delivery" ? "animate-pulse" : ""} />
                        <span className="text-sm flex-1" style={{ color: mapClickTarget === "delivery" ? "#111827" : "#9CA3AF" }}>
                          {mapClickTarget === "delivery" ? "Cliquez sur la carte à droite →" : "Cliquez « Carte » puis cliquez sur la carte"}
                        </span>
                      </div>
                    )}

                    {deliveryMapMethod === "description" && (
                      <textarea
                        value={deliveryAddress}
                        onChange={e => setDeliveryAddress(e.target.value)}
                        placeholder="Ex : Près de la pharmacie centrale, en face du café Bel Aziz, 2ème rue à gauche…"
                        rows={4}
                        className="w-full px-3 py-2 text-sm rounded-xl focus:outline-none resize-none"
                        style={{ border: "1px solid #FECACA", background: "#FFF5F5" }}
                      />
                    )}

                    {hasDelivery && deliveryMapMethod !== "description" && (
                      <GpsBadge lat={deliveryLat} lng={deliveryLng} address={deliveryAddress || undefined} />
                    )}

                    {/* Delivery label */}
                    {deliveryMapMethod !== "description" && (
                      <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: "#5A5A5A" }}>
                          Libellé <span style={{ color: "#9CA3AF" }}>(optionnel)</span>
                        </label>
                        <input type="text" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)}
                          placeholder="Ex: Villa avec portail rouge, Zarzouna…"
                          className="w-full px-3 py-2 text-sm rounded-xl focus:outline-none"
                          style={{ border: "1px solid #FECACA", background: "#FFF5F5" }} />
                      </div>
                    )}

                    {/* Instructions */}
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: "#5A5A5A" }}>
                        Instructions coursier <span style={{ color: "#9CA3AF" }}>(optionnel)</span>
                      </label>
                      <textarea value={instructions} onChange={e => setInstructions(e.target.value)}
                        placeholder="Ex: 3ème étage, sonner 2 fois…"
                        rows={3}
                        className="w-full px-3 py-2 text-sm rounded-xl focus:outline-none resize-none"
                        style={{ border: "1px solid #FECACA", background: "#FFF5F5" }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Commande */}
              <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: "1px solid #EEEEEE" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Package size={12} style={{ color: "#8A8A8A" }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#8A8A8A" }}>Commande</span>
                </div>
                <div>
                  <label className="flex items-center gap-1 text-xs font-semibold mb-1" style={{ color: "#5A5A5A" }}>
                    <Package size={10} /> Détail commande
                  </label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Ex: 2 pizzas Margherita + 1 boisson…"
                    rows={3}
                    className="w-full px-3 py-2 text-sm rounded-xl focus:outline-none resize-none"
                    style={{ border: "1px solid #E5E7EB", background: "#FAFAFA" }} />
                </div>
              </div>

              {/* Mobile: price + priority + courier */}
              <div className="md:hidden bg-white rounded-2xl p-4 shadow-sm space-y-3" style={{ border: "1px solid #EEEEEE" }}>
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign size={12} style={{ color: "#8A8A8A" }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#8A8A8A" }}>Prix & Coursier</span>
                </div>
                <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: "#F4F4F4" }}>
                  {PRIORITY_OPTIONS.map(p => (
                    <button key={p.v} type="button" onClick={() => setPriority(p.v)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold rounded-md transition-all"
                      style={priority === p.v
                        ? { background: "#FFFFFF", color: p.color, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }
                        : { color: "#8A8A8A" }}>
                      {p.v === "2" && <Zap size={10} />} {p.label}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <DollarSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9CA3AF" }} />
                  <input type="number" min="0" step="0.5" value={price} onChange={e => setPrice(e.target.value)}
                    placeholder="Prix de livraison (DT)"
                    className="w-full pl-9 pr-12 py-2.5 text-sm rounded-xl focus:outline-none"
                    style={{ border: "1px solid #E5E7EB", background: "#FAFAFA" }} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: "#9CA3AF" }}>DT</span>
                </div>
                <div className="relative">
                  <Truck size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9CA3AF" }} />
                  <select value={assignId} onChange={e => setAssignId(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl focus:outline-none appearance-none"
                    style={{ border: "1px solid #E5E7EB", background: "#FAFAFA" }}>
                    <option value="">Coursier (optionnel)</option>
                    {available.map(c => (
                      <option key={c.id} value={c.id}>{c.name} {c.status === "available" ? "✓" : "·"}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                  style={{ background: "#FEF2F2", color: DEST_COLOR, border: "1px solid #FECACA" }}>
                  <X size={14} className="shrink-0" /> {error}
                </div>
              )}

              {/* Mobile save */}
              <button type="button" onClick={handleSave} disabled={saving}
                className="md:hidden w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm disabled:opacity-50"
                style={{ background: DEST_COLOR, color: "#fff" }}>
                {saving
                  ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  : <CheckCircle size={16} />}
                {saving ? "Sauvegarde…" : "Enregistrer les modifications"}
              </button>

              {/* ── Status actions ───────────────────────────────────── */}
              {isActive && (
                <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2" style={{ border: "1px solid #EEEEEE" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#8A8A8A" }}>Actions</span>
                  </div>

                  {delivery.status === "assigned" && (
                    <button type="button" onClick={() => doAction("pickup")}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
                      style={{ background: "#7C3AED", color: "#fff" }}>
                      <Package size={15} /> Marquer collectée
                    </button>
                  )}
                  {delivery.status === "picked_up" && (
                    <button type="button" onClick={() => doAction("deliver")}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
                      style={{ background: "#16A34A", color: "#fff" }}>
                      <CheckCircle size={15} /> Marquer livrée
                    </button>
                  )}
                  {delivery.status === "assigned" && (
                    <button type="button" onClick={() => doAction("unassign")}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm"
                      style={{ border: "1px solid #E5E7EB", color: "#5A5A5A", background: "#FAFAFA" }}>
                      <Truck size={14} /> Désassigner (remettre en attente)
                    </button>
                  )}
                  <button type="button" onClick={() => doAction("cancel")}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm"
                    style={{ border: "1px solid #FECACA", color: "#DC2626", background: "#FEF2F2" }}>
                    <XCircle size={14} /> Annuler cette course
                  </button>
                </div>
              )}

              {/* Delete */}
              <div className="pb-4">
                {!confirmDelete ? (
                  <button type="button" onClick={() => setConfirmDelete(true)}
                    className="w-full flex items-center justify-center gap-2 text-xs py-2.5 rounded-xl transition-colors"
                    style={{ color: "#9CA3AF" }}>
                    <Trash2 size={13} /> Supprimer définitivement
                  </button>
                ) : (
                  <div className="rounded-xl p-3 space-y-2" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
                    <p className="text-xs font-semibold text-center" style={{ color: "#DC2626" }}>Confirmer la suppression ?</p>
                    <p className="text-xs text-center" style={{ color: "#EF4444" }}>Cette action est irréversible.</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setConfirmDelete(false)}
                        className="flex-1 py-2 text-xs font-semibold rounded-lg"
                        style={{ border: "1px solid #E5E7EB", color: "#5A5A5A" }}>
                        Annuler
                      </button>
                      <button type="button" onClick={doDelete} disabled={deleting}
                        className="flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-40"
                        style={{ background: "#DC2626", color: "#fff" }}>
                        <Trash2 size={12} /> {deleting ? "…" : "Supprimer"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* ── Right panel: Map ───────────────────────────────────── */}
          <div className="hidden md:flex flex-1 flex-col relative">
            <div ref={mapPanelRef} className="flex-1 w-full h-full" />

            <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
              <div className="px-3 py-2 rounded-xl text-xs font-semibold shadow-lg"
                style={{ background: "rgba(255,255,255,0.95)", color: "#111827", border: "1px solid #EEEEEE" }}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: STOP_COLOR }} />
                  <span>Collecte</span>
                </div>
                {hasDelivery && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-3 h-3 rounded-full" style={{ background: DEST_COLOR }} />
                    <span>Destination confirmée</span>
                  </div>
                )}
              </div>
            </div>

            {mapClickTarget && (
              <div className="absolute inset-0 pointer-events-none flex items-start justify-center pt-16">
                <div className="px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3"
                  style={{ background: "rgba(0,0,0,0.82)", color: "#FFFFFF" }}>
                  <Crosshair size={18} className="animate-pulse" style={{ color: "#FCD34D" }} />
                  <div>
                    <p className="font-bold text-sm">Mode placement actif — {mapClickTarget === "pickup" ? "Collecte" : "Destination"}</p>
                    <p className="text-xs opacity-70">Cliquez sur la carte pour placer le point</p>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
