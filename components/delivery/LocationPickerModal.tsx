"use client";

import { useState, useCallback } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { X, Package, MapPin, CheckCircle } from "lucide-react";

const BIZERTE_CENTER = { lat: 37.2744, lng: 9.8739 };
const LIBRARIES: ("geometry" | "places")[] = [];

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
  const [pin, setPin]       = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const center = initialCenter ?? BIZERTE_CENTER;
  const isPickup = locationType === "pickup";

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    libraries: LIBRARIES,
  });

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) setPin({ lat: e.latLng.lat(), lng: e.latLng.lng() });
  }, []);

  const handleConfirm = async () => {
    if (!pin) return;
    setSaving(true);
    try {
      const action = isPickup ? "confirm-pickup" : "confirm-location";
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

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full flex flex-col"
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

            {clientNote && (
              <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800">
                <span className="font-semibold">Commande :</span> {clientNote}
              </div>
            )}
            {description && (
              <div className="mt-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 italic">
                📍 {description}
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Instruction */}
        <div className={`px-4 py-2 text-xs font-medium flex-shrink-0 border-b ${
          isPickup ? "bg-purple-50 text-purple-700 border-purple-100" : "bg-orange-50 text-orange-700 border-orange-100"
        }`}>
          👆 Cliquez sur la carte pour placer l&apos;épingle
          {pin && <span className="ml-2 font-bold text-green-700">— position sélectionnée ✓</span>}
        </div>

        {/* Map — explicit height so Google Maps renders correctly */}
        <div style={{ height: 380, flexShrink: 0 }}>
          {loadError && (
            <div className="w-full h-full flex items-center justify-center text-sm text-red-500 bg-red-50">
              Erreur de chargement de la carte
            </div>
          )}
          {!isLoaded && !loadError && (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {isLoaded && (
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: "380px" }}
              center={center}
              zoom={16}
              onClick={handleMapClick}
              options={{
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
                zoomControlOptions: { position: 9 },
              }}
            >
              {pin && (
                <Marker
                  position={pin}
                  icon={isPickup
                    ? { url: "https://maps.google.com/mapfiles/ms/icons/purple-dot.png" }
                    : { url: "https://maps.google.com/mapfiles/ms/icons/orange-dot.png" }
                  }
                />
              )}
            </GoogleMap>
          )}
        </div>

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
