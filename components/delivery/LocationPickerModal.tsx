"use client";

import { useEffect, useRef, useState } from "react";
import { X, Package, MapPin, CheckCircle } from "lucide-react";

const DEFAULT_CENTER: [number, number] = [37.2744, 9.8739];

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
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef   = useRef<unknown>(null);
  const markerRef        = useRef<unknown>(null);
  const [pin, setPin]    = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const center: [number, number] = initialCenter
    ? [initialCenter.lat, initialCenter.lng]
    : DEFAULT_CENTER;

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Inject Leaflet CSS once
    const cssId = "leaflet-css";
    if (!document.getElementById(cssId)) {
      const link = document.createElement("link");
      link.id   = cssId;
      link.rel  = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet") as typeof import("leaflet");

    // Fix default marker icons (broken by webpack)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });

    const map = L.map(mapContainerRef.current).setView(center, 16);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      if (markerRef.current) {
        (markerRef.current as L.Marker).setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng]).addTo(map);
      }
      setPin({ lat, lng });
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConfirm = async () => {
    if (!pin) return;
    setSaving(true);
    try {
      const action = locationType === "pickup" ? "confirm-pickup" : "confirm-location";
      const res = await fetch(`/api/deliveries/${deliveryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, lat: pin.lat, lng: pin.lng }),
      });
      if (res.ok) onConfirm(deliveryId, pin.lat, pin.lng);
    } finally {
      setSaving(false);
    }
  };

  const isPickup = locationType === "pickup";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden"
        style={{ maxWidth: 520, maxHeight: "92vh" }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-gray-900 flex items-center gap-2 text-base">
              {isPickup
                ? <><Package size={17} className="text-purple-500 flex-shrink-0" /> Localiser le point de collecte</>
                : <><MapPin size={17} className="text-orange-500 flex-shrink-0" /> Localiser la livraison</>}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{customerName}</p>

            {/* Client note */}
            {clientNote && (
              <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800">
                <span className="font-semibold">Commande :</span> {clientNote}
              </div>
            )}

            {/* Location description */}
            {description && (
              <div className="mt-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 italic">
                📍 {description}
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0 mt-0.5">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Instruction */}
        <div className={`px-4 py-2 text-xs font-medium flex-shrink-0 ${
          isPickup
            ? "bg-purple-50 text-purple-700 border-b border-purple-100"
            : "bg-orange-50 text-orange-700 border-b border-orange-100"
        }`}>
          👆 Cliquez sur la carte pour placer l&apos;épingle
          {pin && <span className="ml-2 font-bold">— épingle placée ✓</span>}
        </div>

        {/* Map */}
        <div ref={mapContainerRef} className="flex-1" style={{ height: 380, minHeight: 280 }} />

        {/* Coordinates preview */}
        {pin && (
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 font-mono flex-shrink-0">
            {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={!pin || saving}
            className={`flex-1 py-3 disabled:opacity-40 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
              isPickup ? "bg-purple-600 hover:bg-purple-700" : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {saving
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><CheckCircle size={16} /> Confirmer la position</>}
          </button>
        </div>
      </div>
    </div>
  );
}
