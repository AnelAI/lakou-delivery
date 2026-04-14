"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Phone, MapPin, Navigation, ChevronLeft, CheckCircle,
  ChevronRight, Globe, Star, Clock, Send, X, Flame,
} from "lucide-react";
import type { Merchant } from "@/lib/types";

const MANAGER_PHONE = process.env.NEXT_PUBLIC_MANAGER_PHONE || "+21629461250";

const CAT_META: Record<string, { label: string; emoji: string }> = {
  restaurant:  { label: "Restaurant",  emoji: "🍽️" },
  patisserie:  { label: "Pâtisserie",  emoji: "🧁" },
  boucherie:   { label: "Boucherie",   emoji: "🥩" },
  volaillerie: { label: "Volaillerie", emoji: "🐔" },
  fromagerie:  { label: "Fromagerie",  emoji: "🧀" },
  supermarche: { label: "Supermarché", emoji: "🛒" },
  pharmacie:   { label: "Pharmacie",   emoji: "💊" },
  eau:         { label: "Pack d'eau",  emoji: "💧" },
  course:      { label: "Course",      emoji: "📦" },
};

const GRADIENTS: Record<string, [string, string]> = {
  restaurant:  ["#FF6B35", "#F7B731"],
  patisserie:  ["#FC5C7D", "#6A3093"],
  boucherie:   ["#C0392B", "#E74C3C"],
  volaillerie: ["#F39C12", "#F1C40F"],
  fromagerie:  ["#E67E22", "#F39C12"],
  supermarche: ["#27AE60", "#2ECC71"],
  pharmacie:   ["#2980B9", "#3498DB"],
  eau:         ["#00B4DB", "#0083B0"],
  course:      ["#8E44AD", "#9B59B6"],
};

function merchantRating(id: string): string {
  const n = (id.charCodeAt(0) * 13 + id.charCodeAt(1) * 7) % 12;
  return (3.8 + n * 0.1).toFixed(1);
}
function deliveryRange(id: string): string {
  const n = (id.charCodeAt(2) * 11 + id.charCodeAt(3) * 5) % 20;
  const lo = 15 + n;
  return `${lo}–${lo + 10} min`;
}

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

type Step = "detail" | "order" | "success";

export default function MerchantPage({ params }: { params: Promise<{ merchantId: string }> }) {
  const { merchantId } = use(params);
  const router = useRouter();

  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [step, setStep]         = useState<Step>("detail");
  const [orderNumber, setOrderNumber] = useState("");

  // Form
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
      .then((r) => r.ok ? r.json() : null)
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
    if (!deliveryLat) { setError("Sélectionnez une adresse"); return; }
    setSubmitting(true); setError("");
    try {
      const res = await fetch("/api/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName, customerPhone,
          pickupAddress: merchant!.address || merchant!.name,
          pickupLat: merchant!.lat, pickupLng: merchant!.lng,
          deliveryAddress, deliveryLat: parseFloat(deliveryLat), deliveryLng: parseFloat(deliveryLng),
          notes, category: merchant!.category, merchantId: merchant!.id, priority: 0,
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Erreur"); return; }
      const delivery = await res.json();
      setOrderNumber(delivery.orderNumber);
      setStep("success");
    } catch { setError("Erreur réseau"); }
    finally { setSubmitting(false); }
  };

  if (!merchant) {
    return (
      <div className="min-h-screen bg-[#F6F6F6] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const cat     = CAT_META[merchant.category] ?? { label: "Marchand", emoji: "🏪" };
  const [c1, c2] = GRADIENTS[merchant.category] ?? ["#636e72", "#b2bec3"];
  const rating  = merchantRating(merchant.id);
  const time    = deliveryRange(merchant.id);

  // ── Success ──────────────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <div className="min-h-screen bg-[#F6F6F6] flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={44} className="text-green-500" />
          </div>
          <div className="text-5xl mb-3">{cat.emoji}</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Commande envoyée !</h2>
          <p className="text-gray-500 text-sm mb-6">
            depuis <span className="font-semibold">{merchant.name}</span>
          </p>
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
          <a href={`tel:${MANAGER_PHONE}`}
            className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-600 py-3.5 rounded-2xl text-sm font-semibold hover:bg-gray-50 transition-colors">
            <Phone size={15} /> Contacter Motaz
          </a>
        </div>
      </div>
    );
  }

  // ── Main page ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F6F6F6]">

      {/* ── Full-width hero ─────────────────────────────────────────────── */}
      <div
        className="relative w-full"
        style={{
          height: 260,
          background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`,
        }}
      >
        {/* pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle at 20% 80%, white 1.5px, transparent 1.5px), radial-gradient(circle at 80% 20%, white 1.5px, transparent 1.5px)",
            backgroundSize: "50px 50px",
          }}
        />

        {/* Back button */}
        <Link
          href="/order"
          className="absolute top-12 left-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors z-10"
        >
          <ChevronLeft size={20} className="text-gray-800" />
        </Link>

        {/* Emoji centered */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[90px] drop-shadow-2xl">{cat.emoji}</span>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#F6F6F6] to-transparent" />
      </div>

      {/* ── Info sheet ──────────────────────────────────────────────────── */}
      <div className="max-w-lg mx-auto px-4 -mt-4 pb-10 space-y-4">

        {/* Title card */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 leading-tight mb-1">
                {merchant.name}
              </h1>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-xs font-bold px-3 py-1 rounded-full text-white"
                  style={{ background: `linear-gradient(90deg, ${c1}, ${c2})` }}
                >
                  {cat.emoji} {cat.label}
                </span>
                {(merchant.id.charCodeAt(0) % 3 === 0) && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-orange-500 bg-orange-50 px-2.5 py-1 rounded-full">
                    <Flame size={10} /> Populaire
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-amber-500 font-bold text-lg mb-0.5">
                <Star size={16} fill="currentColor" />
                {rating}
              </div>
              <p className="text-xs text-gray-400">Note</p>
            </div>
            <div className="text-center border-x border-gray-100">
              <div className="font-bold text-gray-900 text-lg mb-0.5">{time.split("–")[0]}<span className="text-sm">min</span></div>
              <p className="text-xs text-gray-400">Livraison</p>
            </div>
            <div className="text-center">
              <div className="font-bold text-gray-900 text-lg mb-0.5">0 DT</div>
              <p className="text-xs text-gray-400">Frais</p>
            </div>
          </div>
        </div>

        {/* Info card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          {merchant.address && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <MapPin size={15} className="text-orange-500" />
              </div>
              <p className="text-sm text-gray-700">{merchant.address}</p>
            </div>
          )}
          {merchant.phone && (
            <a href={`tel:${merchant.phone}`} className="flex items-center gap-3 group">
              <div className="w-8 h-8 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Phone size={15} className="text-green-500" />
              </div>
              <p className="text-sm text-gray-700 group-hover:text-green-600 transition-colors">{merchant.phone}</p>
            </a>
          )}
          {merchant.website && (
            <a href={merchant.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 group">
              <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Globe size={15} className="text-blue-500" />
              </div>
              <p className="text-sm text-gray-700 group-hover:text-blue-600 truncate transition-colors">{merchant.website}</p>
            </a>
          )}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Clock size={15} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-700">Livraison estimée : <span className="font-semibold text-gray-900">{time}</span></p>
          </div>
        </div>

        {/* ── CTA / Order form ──────────────────────────────────────────── */}
        {step === "detail" && (
          <button
            onClick={() => setStep("order")}
            className="w-full bg-gray-900 text-white py-5 rounded-2xl font-bold text-lg hover:bg-gray-800 active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl"
          >
            <span className="text-2xl">{cat.emoji}</span>
            Commander ici
            <ChevronRight size={20} />
          </button>
        )}

        {step === "order" && (
          <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
            {/* Form header */}
            <div
              className="px-5 py-4 flex items-center justify-between"
              style={{ background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)` }}
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{cat.emoji}</span>
                <div>
                  <p className="text-white font-bold text-base leading-tight">{merchant.name}</p>
                  <p className="text-white/80 text-xs">{time} · Livraison gratuite</p>
                </div>
              </div>
              <button
                onClick={() => setStep("detail")}
                className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <X size={16} className="text-white" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-5">

              {/* Customer */}
              <div className="space-y-3">
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

              {/* Delivery address */}
              <div className="space-y-3">
                <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wide">Adresse de livraison</h3>
                <button
                  type="button" onClick={useGPS} disabled={gpsLoading}
                  className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 text-sm font-semibold transition-all
                    ${deliveryAddress === "Ma position GPS"
                      ? "border-green-400 bg-green-50 text-green-700"
                      : "border-dashed border-gray-300 bg-gray-50 text-gray-600 hover:border-orange-400 hover:text-orange-600"}`}
                >
                  <Navigation size={15} className={gpsLoading ? "animate-spin" : ""} />
                  {gpsLoading ? "Localisation..."
                    : deliveryAddress === "Ma position GPS" ? `Position GPS (±${gpsAccuracy}m)`
                    : "Utiliser ma position GPS"}
                </button>
                <div className="relative">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <span className="text-gray-400 text-xs">ou</span>
                  </div>
                  <select
                    className="w-full bg-gray-100 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:bg-white transition-colors appearance-none"
                    value={deliveryAddress !== "Ma position GPS" ? deliveryAddress : ""}
                    onChange={(e) => {
                      const loc = BIZERTE_LOCATIONS.find((l) => l.name === e.target.value);
                      if (loc) { setDeliveryAddress(loc.name); setDeliveryLat(String(loc.lat)); setDeliveryLng(String(loc.lng)); setGpsAccuracy(null); }
                    }}
                  >
                    <option value="">Choisir un quartier...</option>
                    {BIZERTE_LOCATIONS.map((loc) => <option key={loc.name} value={loc.name}>{loc.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wide">Instructions</h3>
                <textarea
                  value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Fragilité, code portail, étage..."
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
                disabled={submitting || !deliveryLat}
                className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold text-base hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg"
              >
                {submitting
                  ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Envoi...</>
                  : <><Send size={18} /> Confirmer la commande</>}
              </button>
            </form>
          </div>
        )}

        {/* Call manager */}
        <a
          href={`tel:${MANAGER_PHONE}`}
          className="flex items-center justify-center gap-2 w-full bg-white border border-gray-200 text-gray-700 py-4 rounded-2xl font-semibold hover:bg-gray-50 transition-colors shadow-sm"
        >
          <Phone size={16} />
          Appeler Motaz directement
        </a>
      </div>
    </div>
  );
}
