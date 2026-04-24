"use client";

import { useEffect, useRef, useState } from "react";
import { X, MapPin, CheckCircle } from "lucide-react";

const BIZERTE_CENTER = { lat: 37.2744, lng: 9.8739 };

interface Props {
  title: string;
  subtitle?: string;
  initialCenter?: { lat: number; lng: number };
  onConfirm: (lat: number, lng: number) => void;
  onClose: () => void;
}

export function MapPickerModal({ title, subtitle, initialCenter, onConfirm, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const markerRef    = useRef<google.maps.Marker | null>(null);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);

  const center = initialCenter ?? BIZERTE_CENTER;

  useEffect(() => {
    let cancelled = false;

    function initMap() {
      if (cancelled || !containerRef.current) return;
      if (!window.google?.maps) {
        // Google Maps not ready yet — retry after a short delay
        setTimeout(initMap, 200);
        return;
      }

      const map = new window.google.maps.Map(containerRef.current, {
        center,
        zoom: 16,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      });

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
    }

    initMap();

    return () => {
      cancelled = true;
      markerRef.current?.setMap(null);
      markerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 p-3">
      <div
        className="bg-white rounded-xl shadow-xl w-full flex flex-col border border-gray-200"
        style={{ maxWidth: 500, maxHeight: "92vh" }}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
              <MapPin size={15} className="text-gray-600 flex-shrink-0" />
              {title}
            </h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        <p className="px-5 py-2 text-xs text-gray-500 border-b border-gray-100 bg-gray-50 flex-shrink-0">
          Cliquez sur la carte pour placer l&apos;épingle
          {pin && <span className="ml-1.5 text-green-600 font-medium">· position sélectionnée</span>}
        </p>

        <div ref={containerRef} className="flex-1 min-h-0" style={{ minHeight: 260 }} />

        {pin && (
          <p className="px-5 py-1.5 text-[11px] text-gray-400 font-mono bg-gray-50 border-t border-gray-100">
            {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}
          </p>
        )}

        <div className="px-5 py-3.5 border-t border-gray-100 flex gap-2.5 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={() => pin && onConfirm(pin.lat, pin.lng)}
            disabled={!pin}
            className="flex-1 py-2.5 bg-gray-900 disabled:opacity-40 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 hover:bg-gray-800"
          >
            <CheckCircle size={15} /> Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}
