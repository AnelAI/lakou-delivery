"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Phone, MapPin, Package, Send, Navigation,
  ChevronLeft, CheckCircle, ChevronRight, Globe, AlertCircle,
} from "lucide-react";
import type { Merchant } from "@/lib/types";

const MANAGER_PHONE = process.env.NEXT_PUBLIC_MANAGER_PHONE || "+21629461250";

const CATEGORIES: Record<string, { label: string; emoji: string; grad: string }> = {
  restaurant:  { label: "Restaurant",  emoji: "🍽️", grad: "from-orange-400 to-amber-400" },
  patisserie:  { label: "Pâtisserie",  emoji: "🧁", grad: "from-pink-400   to-rose-400"  },
  boucherie:   { label: "Boucherie",   emoji: "🥩", grad: "from-red-400    to-rose-500"  },
  volaillerie: { label: "Volaillerie", emoji: "🐔", grad: "from-yellow-400 to-orange-400"},
  fromagerie:  { label: "Fromagerie",  emoji: "🧀", grad: "from-amber-400  to-yellow-400"},
  supermarche: { label: "Supermarché", emoji: "🛒", grad: "from-green-400  to-emerald-400"},
  pharmacie:   { label: "Pharmacie",   emoji: "💊", grad: "from-blue-400   to-cyan-400"  },
  eau:         { label: "Pack d'eau",  emoji: "💧", grad: "from-cyan-400   to-sky-400"   },
  course:      { label: "Course",      emoji: "📦", grad: "from-purple-400 to-violet-400"},
};

const BIZERTE_LOCATIONS = [
  { name: "Centre-ville Bizerte",  lat: 37.2744, lng: 9.8739 },
  { name: "Port de Bizerte",       lat: 37.2756, lng: 9.8686 },
  { name: "Zarzouna",              lat: 37.2511, lng: 9.8481 },
  { name: "Corniche Bizerte",      lat: 37.2780, lng: 9.8620 },
  { name: "Remel",                 lat: 37.2920, lng: 9.8530 },
  { name: "El Azib",               lat: 37.2100, lng: 9.8450 },
  { name: "Menzel Bourguiba",      lat: 37.1532, lng: 9.7987 },
  { name: "Mateur",                lat: 37.0430, lng: 9.6647 },
  { name: "Ras Jebel",             lat: 37.2167, lng: 10.1167 },
  { name: "El Alia",               lat: 37.1667, lng: 9.9833 },
  { name: "Utique",                lat: 37.0536, lng: 10.0531 },
  { name: "Sejnane",               lat: 37.0583, lng: 9.2333 },
  { name: "Joumine",               lat: 37.0333, lng: 9.5333 },
  { name: "Ghezala",               lat: 37.1500, lng: 9.6167 },
];

type Step = "info" | "form" | "success";

export default function MerchantPage({ params }: { params: Promise<{ merchantId: string }> }) {
  const { merchantId } = use(params);
  const router = useRouter();

  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [step, setStep]         = useState<Step>("info");
  const [orderNumber, setOrderNumber] = useState("");

  // Form state
  const [customerName,    setCustomerName]    = useState("");
  const [customerPhone,   setCustomerPhone]   = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryLat,     setDeliveryLat]     = useState("");
  const [deliveryLng,     setDeliveryLng]     = useState("");
  const [notes,           setNotes]           = useState("");
  const [gpsLoading,      setGpsLoading]      = useState(false);
  const [gpsAccuracy,     setGpsAccuracy]     = useState<number | null>(null);
  const [submitting,      setSubmitting]      = useState(false);
  const [error,           setError]           = useState("");

  useEffect(() => {
    fetch(`/api/merchants/${merchantId}`)
      .then((r) => { if (r.status === 404) { setNotFound(true); return null; } return r.json(); })
      .then((d: Merchant | null) => { if (d) setMerchant(d); });
  }, [merchantId]);

  const useGPS = () => {
    if (!navigator.geolocation) { setError("GPS non disponible"); return; }
    setGpsLoading(true);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryLat) { setError("Sélectionnez une adresse de livraison"); return; }
    setSubmitting(true); setError("");
    try {
      const res = await fetch("/api/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone,
          pickupAddress: merchant!.address || merchant!.name,
          pickupLat:     merchant!.lat,
          pickupLng:     merchant!.lng,
          deliveryAddress,
          deliveryLat:   parseFloat(deliveryLat),
          deliveryLng:   parseFloat(deliveryLng),
          notes,
          category:   merchant!.category,
          merchantId: merchant!.id,
          priority:   0,
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Erreur"); return; }
      const delivery = await res.json();
      setOrderNumber(delivery.orderNumber);
      setStep("success");
    } catch { setError("Erreur réseau"); }
    finally { setSubmitting(false); }
  };

  const cat  = merchant ? CATEGORIES[merchant.category] : null;
  const grad = cat?.grad ?? "from-gray-400 to-gray-500";

  const inputClass = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white";

  // ── Loading ──────────────────────────────────────────────────────────────
  if (!merchant && !notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 text-center max-w-sm w-full shadow-xl">
          <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
          <h2 className="font-bold text-gray-800 mb-4">Marchand introuvable</h2>
          <Link href="/order" className="inline-flex items-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-orange-600">
            <ChevronLeft size={16} /> Retour
          </Link>
        </div>
      </div>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={40} className="text-green-500" />
          </div>
          <div className="text-4xl mb-2">{cat?.emoji}</div>
          <h2 className="text-xl font-bold text-gray-800 mb-1">Commande envoyée !</h2>
          <p className="text-gray-500 text-sm mb-2">depuis <span className="font-semibold text-orange-600">{merchant!.name}</span></p>
          <div className="bg-orange-50 rounded-2xl p-4 mb-6">
            <p className="text-xs text-orange-600 font-medium mb-1">Numéro de commande</p>
            <p className="text-lg font-bold text-orange-700 font-mono">{orderNumber}</p>
          </div>
          <button
            onClick={() => router.push(`/track/${orderNumber}`)}
            className="w-full bg-orange-500 text-white py-3 rounded-xl font-semibold hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 mb-3"
          >
            <MapPin size={18} /> Suivre ma commande <ChevronRight size={16} />
          </button>
          <a href={`tel:${MANAGER_PHONE}`} className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-600 py-3 rounded-xl text-sm hover:bg-gray-50">
            <Phone size={16} /> Appeler Motaz
          </a>
        </div>
      </div>
    );
  }

  // ── Merchant info ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* Hero header */}
      <div className={`bg-gradient-to-br ${grad} relative`}>
        <div className="px-4 pt-10 pb-6 max-w-sm mx-auto">
          <Link href="/order" className="inline-flex items-center gap-1 text-white/80 text-sm mb-4 hover:text-white">
            <ChevronLeft size={16} /> Retour
          </Link>
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center text-5xl backdrop-blur-sm flex-shrink-0 shadow-lg">
              {cat?.emoji ?? "🏪"}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <span className="inline-block bg-white/25 text-white text-xs font-semibold px-2.5 py-1 rounded-full mb-2 backdrop-blur-sm">
                {cat?.label}
              </span>
              <h1 className="text-white font-bold text-xl leading-tight line-clamp-2">
                {merchant!.name}
              </h1>
            </div>
          </div>
        </div>
        {/* Wave shape */}
        <div className="h-6 bg-gray-50 rounded-t-3xl" />
      </div>

      <div className="max-w-sm mx-auto px-4 -mt-2 pb-8 space-y-4">

        {/* Info card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
          {merchant!.address && (
            <div className="flex items-start gap-3 text-sm">
              <MapPin size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700">{merchant!.address}</span>
            </div>
          )}
          {merchant!.phone && (
            <a href={`tel:${merchant!.phone}`} className="flex items-center gap-3 text-sm hover:text-orange-600 transition-colors">
              <Phone size={16} className="text-green-500 flex-shrink-0" />
              <span className="text-gray-700">{merchant!.phone}</span>
            </a>
          )}
          {merchant!.website && (
            <a href={merchant!.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm hover:text-blue-600 transition-colors">
              <Globe size={16} className="text-blue-500 flex-shrink-0" />
              <span className="text-gray-700 truncate">{merchant!.website}</span>
            </a>
          )}
        </div>

        {/* Static OSM map tile */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
          <img
            src={`https://staticmap.openstreetmap.de/staticmap.php?center=${merchant!.lat},${merchant!.lng}&zoom=16&size=600x200&markers=${merchant!.lat},${merchant!.lng},red-marker`}
            alt={`Localisation de ${merchant!.name}`}
            className="w-full h-36 object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <div className="px-4 py-2.5 text-xs text-gray-500 flex items-center gap-1">
            <MapPin size={11} className="text-orange-500" />
            {merchant!.lat.toFixed(4)}, {merchant!.lng.toFixed(4)} — données © OpenStreetMap
          </div>
        </div>

        {/* CTA or Form */}
        {step === "info" && (
          <button
            onClick={() => setStep("form")}
            className={`w-full bg-gradient-to-r ${grad} text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-3`}
          >
            <Package size={20} />
            Commander depuis {cat?.emoji} {merchant!.name}
          </button>
        )}

        {step === "form" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-8 h-8 bg-gradient-to-br ${grad} rounded-xl flex items-center justify-center text-lg`}>
                {cat?.emoji}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">{merchant!.name}</p>
                <p className="text-xs text-gray-400">Collecte à cette adresse</p>
              </div>
            </div>

            {/* Customer info */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom complet *</label>
                <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Mohamed Ben Ali" required className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Téléphone *</label>
                <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+216 XX XXX XXX" required className={inputClass} />
              </div>
            </div>

            {/* Delivery address */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100 space-y-3">
              <h3 className="text-sm font-semibold text-orange-700 flex items-center gap-2">
                <MapPin size={14} /> Adresse de livraison *
              </h3>
              <button type="button" onClick={useGPS} disabled={gpsLoading}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed text-sm font-medium transition-all
                  ${deliveryAddress === "Ma position GPS" ? "border-green-400 bg-green-50 text-green-700" : "border-orange-300 bg-orange-50 text-orange-600 hover:border-orange-400"}`}>
                <Navigation size={15} className={gpsLoading ? "animate-spin" : ""} />
                {gpsLoading ? "Localisation..." : deliveryAddress === "Ma position GPS" ? `GPS activé (±${gpsAccuracy}m)` : "Utiliser ma position GPS"}
              </button>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="h-px flex-1 bg-gray-100" />ou choisir un quartier<div className="h-px flex-1 bg-gray-100" />
              </div>
              <select className={inputClass}
                value={deliveryAddress !== "Ma position GPS" ? deliveryAddress : ""}
                onChange={(e) => {
                  const loc = BIZERTE_LOCATIONS.find((l) => l.name === e.target.value);
                  if (loc) { setDeliveryAddress(loc.name); setDeliveryLat(String(loc.lat)); setDeliveryLng(String(loc.lng)); setGpsAccuracy(null); }
                }}>
                <option value="">Sélectionner un quartier...</option>
                {BIZERTE_LOCATIONS.map((loc) => (
                  <option key={loc.name} value={loc.name}>{loc.name}</option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-2">Instructions (optionnel)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Fragile, sonner à l'entrée..." rows={3} className={`${inputClass} resize-none`} />
            </div>

            {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">{error}</div>}

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep("info")}
                className="flex items-center gap-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                <ChevronLeft size={16} /> Retour
              </button>
              <button type="submit" disabled={submitting || !deliveryLat}
                className={`flex-1 bg-gradient-to-r ${grad} text-white py-3 rounded-xl font-bold shadow-md hover:opacity-95 active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2`}>
                {submitting
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Envoi...</>
                  : <><Send size={16} /> Confirmer la commande</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
