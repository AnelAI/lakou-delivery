"use client";

import { useCallback, useRef, useState } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { X, Package, MapPin, CheckCircle } from "lucide-react";

const BIZERTE_CENTER = { lat: 37.2744, lng: 9.8739 };
const LIBRARIES: ("places")[] = [];

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
  const [adminNote, setAdminNote] = useState("");
  const [saving, setSaving] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);

  const isPickup = locationType === "pickup";
  const center = initialCenter ?? BIZERTE_CENTER;

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    libraries: LIBRARIES,
  });

  const onMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    setPin({ lat: e.latLng.lat(), lng: e.latLng.lng() });
  }, []);

  const handleConfirm = async () => {
    if (!pin) return;
    setSaving(true);
    try {
      const action = isPickup ? "confirm-pickup" : "confirm-location";
      const body: Record<string, unknown> = { action, lat: pin.lat, lng: pin.lng };
      if (isPickup && adminNote.trim()) body.address = adminNote.trim();
      const res = await fetch(`/api/deliveries/${deliveryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) onConfirm(deliveryId, pin.lat, pin.lng);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3">
      <div
        className="bg-white rounded-xl shadow-xl w-full flex flex-col border border-gray-200"
        style={{ maxWidth: 500, maxHeight: "92vh" }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
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
            {description && (
              <p className="mt-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 italic">
                📍 {description}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Instruction */}
        <p className="px-5 py-2 text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
          Cliquez sur la carte pour placer l&apos;épingle
          {pin && <span className="ml-1.5 text-green-600 font-medium">· position sélectionnée</span>}
        </p>

        {/* Map */}
        <div style={{ height: 340, flexShrink: 0 }}>
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: "100%" }}
              center={center}
              zoom={16}
              onClick={onMapClick}
              onLoad={(map) => { mapRef.current = map; }}
              onUnmount={() => { mapRef.current = null; }}
              options={{
                disableDefaultUI: false,
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
              }}
            >
              {pin && <Marker position={pin} />}
            </GoogleMap>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Coordinates */}
        {pin && (
          <p className="px-5 py-1.5 text-[11px] text-gray-400 font-mono border-t border-gray-100 bg-gray-50">
            {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}
          </p>
        )}

        {/* Admin note for pickup */}
        {isPickup && (
          <div className="px-5 py-3 border-t border-gray-100">
            <label className="text-xs font-medium text-gray-600 block mb-1.5">
              Note de collecte (optionnel)
            </label>
            <input
              type="text"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Ex : Pizzeria Hassan, rue de la République..."
              className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:bg-white transition-colors"
            />
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-gray-100 flex gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={!pin || saving}
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
