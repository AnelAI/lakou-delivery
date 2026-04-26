"use client";

import { useEffect, useRef, useState } from "react";
import { X, Package, MapPin, CheckCircle, Store, FileText, Map } from "lucide-react";
import type { Merchant } from "@/lib/types";

const BIZERTE_CENTER = { lat: 37.2744, lng: 9.8739 };

type Mode = "merchant" | "description" | "map";

interface Props {
  deliveryId: string;
  locationType: "pickup" | "delivery";
  description?: string | null;
  clientNote?: string | null;
  customerName: string;
  initialCenter?: { lat: number; lng: number };
  onConfirm: (deliveryId: string, lat: number, lng: number) => void;
  onClose: () => void;
}

export function LocationPickerModal({
  deliveryId, locationType, description, clientNote, customerName,
  initialCenter, onConfirm, onClose,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const markerRef    = useRef<google.maps.Marker | null>(null);

  const [mode, setMode]   = useState<Mode>("map");
  const [pin, setPin]     = useState<{ lat: number; lng: number } | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [merchants, setMerchants]           = useState<Merchant[]>([]);
  const [merchantSearch, setMerchantSearch] = useState("");
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [loadingMerchants, setLoadingMerchants] = useState(false);

  const [descText, setDescText] = useState(description ?? "");

  const isPickup = locationType === "pickup";
  const center   = initialCenter ?? BIZERTE_CENTER;

  useEffect(() => {
    if (mode !== "merchant") return;
    setLoadingMerchants(true);
    const qs = merchantSearch ? `?search=${encodeURIComponent(merchantSearch)}` : "";
    fetch(`/api/merchants${qs}`)
      .then((r) => r.json())
      .then((data) => setMerchants(Array.isArray(data) ? data : []))
      .catch(() => setMerchants([]))
      .finally(() => setLoadingMerchants(false));
  }, [mode, merchantSearch]);

  useEffect(() => {
    if (mode !== "map" || !containerRef.current || !window.google) return;

    const map = new window.google.maps.Map(containerRef.current, {
      center: pin ?? center,
      zoom: 16,
      zoomControl: true,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
    });

    if (pin) {
      markerRef.current = new window.google.maps.Marker({ position: pin, map });
    }

    map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setPin({ lat, lng });
      if (markerRef.current) {
        markerRef.current.setPosition({ lat, lng });
      } else {
        markerRef.current = new window.google.maps.Marker({ position: { lat, lng }, map });
      }
    });

    return () => {
      markerRef.current?.setMap(null);
      markerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handleConfirm = async () => {
    setSaving(true);
    try {
      if (mode === "merchant" && selectedMerchant) {
        const action = isPickup ? "confirm-pickup" : "confirm-location";
        const body: Record<string, unknown> = { action, lat: selectedMerchant.lat, lng: selectedMerchant.lng };
        if (isPickup) body.address = selectedMerchant.name;
        const res = await fetch(`/api/deliveries/${deliveryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) onConfirm(deliveryId, selectedMerchant.lat, selectedMerchant.lng);

      } else if (mode === "description") {
        const body = isPickup
          ? { pickupAddress: descText.trim() || "Better Call Motaz" }
          : { deliveryDescription: descText.trim() || null, locationConfirmed: true };
        const res = await fetch(`/api/deliveries/${deliveryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) onClose();

      } else if (mode === "map" && pin) {
        const action = isPickup ? "confirm-pickup" : "confirm-location";
        const body: Record<string, unknown> = { action, lat: pin.lat, lng: pin.lng };
        if (isPickup && adminNote.trim()) body.address = adminNote.trim();
        const res = await fetch(`/api/deliveries/${deliveryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) onConfirm(deliveryId, pin.lat, pin.lng);
      }
    } finally {
      setSaving(false);
    }
  };

  const canConfirm =
    (mode === "merchant" && !!selectedMerchant) ||
    (mode === "description" && descText.trim().length > 0) ||
    (mode === "map" && !!pin);

  const TABS: { key: Mode; Icon: typeof Store; label: string }[] = [
    { key: "merchant",    Icon: Store,    label: "Marchand"    },
    { key: "description", Icon: FileText, label: "Description" },
    { key: "map",         Icon: Map,      label: "Carte"       },
  ];

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 p-3">
      <div
        className="bg-white rounded-xl shadow-xl w-full flex flex-col border border-gray-200"
        style={{ maxWidth: 500, maxHeight: "92vh" }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
              {isPickup
                ? <><Package size={15} className="text-gray-600 flex-shrink-0" /> Point de collecte</>
                : <><MapPin size={15} className="text-gray-600 flex-shrink-0" /> Position de livraison</>}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">{customerName}</p>
            {clientNote && (
              <p className="mt-2 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <span className="font-medium">Commande :</span> {clientNote}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 flex-shrink-0">
          {TABS.map(({ key, Icon, label }) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors border-b-2 ${
                mode === key
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">

          {/* ── Marchand ── */}
          {mode === "merchant" && (
            <div className="flex flex-col h-full" style={{ minHeight: 300 }}>
              <div className="px-4 pt-3 pb-2 flex-shrink-0">
                <input
                  type="text"
                  value={merchantSearch}
                  onChange={(e) => setMerchantSearch(e.target.value)}
                  placeholder="Rechercher un marchand…"
                  autoFocus
                  className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:bg-white transition-colors"
                />
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-1.5">
                {loadingMerchants ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
                  </div>
                ) : merchants.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">Aucun marchand trouvé</p>
                ) : (
                  merchants.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMerchant(m)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${
                        selectedMerchant?.id === m.id
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "border-gray-200 hover:bg-gray-50 text-gray-800"
                      }`}
                    >
                      <div className="text-sm font-semibold">{m.name}</div>
                      {m.address && (
                        <div className={`text-xs mt-0.5 ${selectedMerchant?.id === m.id ? "text-gray-300" : "text-gray-400"}`}>
                          {m.address}
                        </div>
                      )}
                      <div className={`text-[11px] font-mono mt-0.5 ${selectedMerchant?.id === m.id ? "text-gray-400" : "text-gray-300"}`}>
                        {m.lat.toFixed(5)}, {m.lng.toFixed(5)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── Description ── */}
          {mode === "description" && (
            <div className="px-5 py-4 flex flex-col gap-3" style={{ minHeight: 200 }}>
              <p className="text-xs text-gray-500">
                {isPickup
                  ? "Précisez le nom du point de collecte (partenaire, adresse…)"
                  : "Décrivez la localisation (immeuble, étage, code porte, point de repère…)"}
              </p>
              <textarea
                value={descText}
                onChange={(e) => setDescText(e.target.value)}
                placeholder={
                  isPickup
                    ? "Ex : Pizzeria Hassan, rue de la République…"
                    : "Ex : Résidence les Jasmins, Bât B, 2ème étage, apt 12…"
                }
                rows={5}
                autoFocus
                className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:bg-white transition-colors resize-none"
              />
              {!isPickup && (
                <p className="text-[11px] text-gray-400">
                  La position sera marquée comme confirmée sans coordonnées GPS.
                </p>
              )}
            </div>
          )}

          {/* ── Carte ── */}
          {mode === "map" && (
            <>
              <p className="px-5 py-2 text-xs text-gray-500 border-b border-gray-100 bg-gray-50 flex-shrink-0">
                Cliquez sur la carte pour placer l&apos;épingle
                {pin && <span className="ml-1.5 text-green-600 font-medium">· position sélectionnée</span>}
              </p>
              <div ref={containerRef} className="flex-1 min-h-0" style={{ minHeight: 220 }} />
              <div className="flex-shrink-0 border-t border-gray-100">
                {pin && (
                  <p className="px-5 py-1.5 text-[11px] text-gray-400 font-mono bg-gray-50">
                    {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}
                  </p>
                )}
                {isPickup && (
                  <div className="px-5 py-3 border-t border-gray-100">
                    <label className="text-xs font-medium text-gray-600 block mb-1.5">
                      Note de collecte (optionnel)
                    </label>
                    <input
                      type="text"
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      placeholder="Ex : Pizzeria Hassan, rue de la République…"
                      className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:bg-white transition-colors"
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-gray-100 flex gap-2.5 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || saving}
            className="flex-1 py-2.5 bg-gray-900 disabled:opacity-40 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 hover:bg-gray-800"
          >
            {saving
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><CheckCircle size={15} /> Confirmer</>}
          </button>
        </div>
      </div>
    </div>
  );
}
