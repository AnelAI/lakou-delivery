"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Phone, MapPin, Navigation, ChevronLeft, CheckCircle,
  ChevronRight, Send, X, Pencil,
} from "lucide-react";

const MANAGER_PHONE = process.env.NEXT_PUBLIC_MANAGER_PHONE || "+21629461250";

// Bizerte centre used as default pickup coords for free orders
const BIZERTE_CENTER = { lat: 37.2744, lng: 9.8739 };


type LocationMode = "gps" | "description";

export default function FreeOrderPage() {
  const router = useRouter();

  const [orderNumber, setOrderNumber]           = useState("");
  const [done, setDone]                         = useState(false);
  const [customerName, setCustomerName]         = useState("");
  const [customerPhone, setCustomerPhone]       = useState("");
  const [orderDescription, setOrderDescription] = useState("");
  const [locationMode, setLocationMode]         = useState<LocationMode>("gps");
  const [deliveryAddress, setDeliveryAddress]   = useState("");
  const [deliveryLat, setDeliveryLat]           = useState("");
  const [deliveryLng, setDeliveryLng]           = useState("");
  const [deliveryDescription, setDeliveryDescription] = useState("");
  const [notes, setNotes]                       = useState("");
  const [gpsLoading, setGpsLoading]             = useState(false);
  const [gpsAccuracy, setGpsAccuracy]           = useState<number | null>(null);
  const [submitting, setSubmitting]             = useState(false);
  const [error, setError]                       = useState("");

  const useGPS = () => {
    if (!navigator.geolocation) { setError("GPS non disponible sur cet appareil"); return; }
    setGpsLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDeliveryAddress("Ma position GPS");
        setDeliveryLat(String(pos.coords.latitude));
        setDeliveryLng(String(pos.coords.longitude));
        setGpsAccuracy(Math.round(pos.coords.accuracy));
        setGpsLoading(false);
      },
      (err) => { setError(`GPS : ${err.message}`); setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const canSubmit = () => {
    if (!customerName || !customerPhone || orderDescription.trim().length < 5) return false;
    if (locationMode === "gps") return !!deliveryLat;
if (locationMode === "description") return deliveryDescription.trim().length >= 10;
    return false;
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!canSubmit()) { setError("Veuillez remplir tous les champs"); return; }
    setSubmitting(true);
    setError("");

    const isDescLocation = locationMode === "description";
    const lat = isDescLocation ? BIZERTE_CENTER.lat : parseFloat(deliveryLat);
    const lng = isDescLocation ? BIZERTE_CENTER.lng : parseFloat(deliveryLng);
    const address = isDescLocation
      ? `📍 À confirmer — ${deliveryDescription.slice(0, 60)}`
      : deliveryAddress;

    try {
      const res = await fetch("/api/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone,
          pickupAddress: "Better Call Motaz",
          pickupLat: BIZERTE_CENTER.lat,
          pickupLng: BIZERTE_CENTER.lng,
          deliveryAddress: address,
          deliveryLat: lat,
          deliveryLng: lng,
          deliveryDescription: isDescLocation ? deliveryDescription.trim() : null,
          locationConfirmed: !isDescLocation,
          notes: [orderDescription.trim(), notes.trim()].filter(Boolean).join("\n---\n"),
          category: null,
          merchantId: null,
          priority: 0,
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Erreur"); return; }
      const delivery = await res.json();
      setOrderNumber(delivery.orderNumber);
      setDone(true);
    } catch { setError("Erreur réseau"); }
    finally { setSubmitting(false); }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-[#F6F6F6] flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={44} className="text-green-500" />
          </div>
          <div className="text-5xl mb-3">💬</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Commande envoyée !</h2>
          <p className="text-gray-500 text-sm mb-6">Motaz vous contactera pour confirmer.</p>
          <div className="bg-gray-50 rounded-2xl p-4 mb-6">
            <p className="text-xs text-gray-500 mb-1">Numéro de commande</p>
            <p className="text-xl font-bold text-gray-900 font-mono">{orderNumber}</p>
          </div>
          <button
            onClick={() => router.push(`/track/${orderNumber}`)}
            className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold text-base hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 mb-3 active:scale-95"
          >
            <MapPin size={18} /> Suivre ma commande <ChevronRight size={16} />
          </button>
          <a
            href={`tel:${MANAGER_PHONE}`}
            className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-600 py-3.5 rounded-2xl text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            <Phone size={15} /> Contacter Motaz
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F6F6]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 pt-10 pb-4">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Link href="/order" className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors flex-shrink-0">
            <ChevronLeft size={20} className="text-gray-700" />
          </Link>
          <div>
            <h1 className="font-bold text-gray-900 text-lg leading-tight">Commande libre 💬</h1>
            <p className="text-xs text-gray-500">Décrivez ce que vous voulez, Motaz s&apos;en occupe</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 pb-10">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Coordonnées */}
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wide">Vos coordonnées</h3>
            <input
              type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nom complet *" required
              className="w-full bg-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:bg-white transition-colors"
            />
            <input
              type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Téléphone *" required
              className="w-full bg-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:bg-white transition-colors"
            />
          </div>

          {/* Description commande */}
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wide">Votre commande</h3>
            <textarea
              value={orderDescription}
              onChange={(e) => setOrderDescription(e.target.value)}
              placeholder="Ex : 2 pizzas margherita de chez Hassan, une bouteille d'eau et des cigarettes Marlboro..."
              rows={4}
              required
              className="w-full bg-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:bg-white transition-colors resize-none"
            />
            {orderDescription.trim().length > 0 && orderDescription.trim().length < 5 && (
              <p className="text-xs text-red-500">Soyez plus précis</p>
            )}
          </div>

          {/* Position */}
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wide">Votre position de livraison</h3>

            <div className="grid grid-cols-2 gap-2">
              {([
                { id: "gps",         icon: <Navigation size={14} />, label: "GPS" },
                { id: "description", icon: <Pencil size={14} />,     label: "Note" },
              ] as const).map(({ id, icon, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setLocationMode(id);
                    setDeliveryAddress(""); setDeliveryLat(""); setDeliveryLng("");
                    setDeliveryDescription(""); setGpsAccuracy(null); setError("");
                  }}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-semibold border-2 transition-all ${
                    locationMode === id
                      ? "border-orange-400 bg-orange-50 text-orange-700"
                      : "border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>

            {locationMode === "gps" && (
              <button
                type="button" onClick={useGPS} disabled={gpsLoading}
                className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 text-sm font-semibold transition-all
                  ${deliveryLat
                    ? "border-green-400 bg-green-50 text-green-700"
                    : "border-dashed border-gray-300 bg-gray-50 text-gray-600 hover:border-orange-400 hover:text-orange-600"}`}
              >
                <Navigation size={15} className={gpsLoading ? "animate-spin" : ""} />
                {gpsLoading ? "Localisation..."
                  : deliveryLat ? `✓ Position GPS (±${gpsAccuracy}m)`
                  : "Partager ma position GPS"}
              </button>
            )}

            {locationMode === "description" && (
              <div className="space-y-2">
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700 flex items-start gap-2">
                  <span className="flex-shrink-0 mt-0.5">ℹ️</span>
                  <span>Décrivez votre emplacement avec des repères connus. Motaz vous confirmera la livraison.</span>
                </div>
                <textarea
                  value={deliveryDescription}
                  onChange={(e) => setDeliveryDescription(e.target.value)}
                  placeholder="Ex : Près de la pharmacie centrale, en face du café Bel Aziz, 2ème rue à gauche..."
                  rows={3}
                  className="w-full bg-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:bg-white transition-colors resize-none"
                />
                {deliveryDescription.length > 0 && deliveryDescription.length < 10 && (
                  <p className="text-xs text-red-500">Soyez plus précis (min. 10 caractères)</p>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wide">Instructions supplémentaires</h3>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Fragilité, heure préférée, code portail..."
              rows={2}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:bg-white transition-colors resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100 flex items-center gap-2">
              <X size={14} className="flex-shrink-0" /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !canSubmit()}
            className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold text-base hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg"
          >
            {submitting
              ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Envoi...</>
              : <><Send size={18} /> Envoyer la commande</>}
          </button>

          <a
            href={`tel:${MANAGER_PHONE}`}
            className="flex items-center justify-center gap-2 w-full bg-white border border-gray-200 text-gray-700 py-4 rounded-2xl font-semibold hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Phone size={16} />
            Appeler Motaz directement
          </a>
        </form>
      </div>
    </div>
  );
}
