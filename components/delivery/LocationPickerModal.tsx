"use client";

import { useState, useCallback } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { X, MapPin, CheckCircle, Package } from "lucide-react";

const DEFAULT_CENTER = { lat: 37.2744, lng: 9.8739 };
const LIBRARIES: ("geometry" | "places")[] = [];

interface Props {
  deliveryId: string;
  locationType: "pickup" | "delivery";
  description?: string | null;
  customerName: string;
  onConfirm: (deliveryId: string, lat: number, lng: number) => void;
  onClose: () => void;
}

export function LocationPickerModal({ deliveryId, locationType, description, customerName, onConfirm, onClose }: Props) {
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const { isLoaded } = useJsApiLoader({
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }}>

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3 flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              {isPickup
                ? <><Package size={18} className="text-purple-500" /> Localiser le point de collecte</>
                : <><MapPin size={18} className="text-orange-500" /> Localiser la livraison</>}
            </h2>
            <p className="text-sm text-gray-600 mt-0.5 font-medium">{customerName}</p>
            {description && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-2 italic">
                &ldquo;{description}&rdquo;
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Instruction */}
        <div className={`px-5 py-2.5 border-b text-xs flex-shrink-0 ${
          isPickup
            ? "bg-purple-50 border-purple-100 text-purple-700"
            : "bg-blue-50 border-blue-100 text-blue-700"
        }`}>
          Cliquez sur la carte pour placer l&apos;épingle au point de {isPickup ? "collecte" : "livraison"}.
        </div>

        {/* Map */}
        <div className="flex-1 min-h-0" style={{ height: 360 }}>
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: "100%" }}
              center={DEFAULT_CENTER}
              zoom={13}
              onClick={handleMapClick}
              options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
            >
              {pin && (
                <Marker
                  position={pin}
                  icon={isPickup
                    ? { url: "http://maps.google.com/mapfiles/ms/icons/purple-dot.png" }
                    : { url: "http://maps.google.com/mapfiles/ms/icons/orange-dot.png" }
                  }
                />
              )}
            </GoogleMap>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={!pin || saving}
            className={`flex-1 py-3 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
              isPickup ? "bg-purple-600 hover:bg-purple-700" : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {saving
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><CheckCircle size={16} /> Confirmer</>}
          </button>
        </div>
      </div>
    </div>
  );
}
