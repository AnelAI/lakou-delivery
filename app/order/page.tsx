"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Phone, MapPin, Package, Send, Navigation,
  CheckCircle, Clock, ChevronRight, Bike, ChevronLeft,
} from "lucide-react";

const MANAGER_PHONE = process.env.NEXT_PUBLIC_MANAGER_PHONE || "+21629461250";

// ── Catégories ──────────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: "restaurant",   label: "Restaurant",   emoji: "🍽️", color: "bg-orange-50  border-orange-200 text-orange-700" },
  { key: "patisserie",   label: "Pâtisserie",   emoji: "🧁", color: "bg-pink-50    border-pink-200   text-pink-700"   },
  { key: "boucherie",    label: "Boucherie",    emoji: "🥩", color: "bg-red-50     border-red-200    text-red-700"    },
  { key: "volaillerie",  label: "Volaillerie",  emoji: "🐔", color: "bg-yellow-50  border-yellow-200 text-yellow-700" },
  { key: "fromagerie",   label: "Fromagerie",   emoji: "🧀", color: "bg-amber-50   border-amber-200  text-amber-700"  },
  { key: "supermarche",  label: "Supermarché",  emoji: "🛒", color: "bg-green-50   border-green-200  text-green-700"  },
  { key: "pharmacie",    label: "Pharmacie",    emoji: "💊", color: "bg-blue-50    border-blue-200   text-blue-700"   },
  { key: "eau",          label: "Pack d'eau",   emoji: "💧", color: "bg-cyan-50    border-cyan-200   text-cyan-700"   },
  { key: "course",       label: "Course",       emoji: "📦", color: "bg-purple-50  border-purple-200 text-purple-700" },
];

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

type Step = "category" | "form" | "success";

interface Form {
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  pickupLat: string;
  pickupLng: string;
  deliveryAddress: string;
  deliveryLat: string;
  deliveryLng: string;
  notes: string;
}

const EMPTY_FORM: Form = {
  customerName: "", customerPhone: "",
  pickupAddress: "", pickupLat: "", pickupLng: "",
  deliveryAddress: "", deliveryLat: "", deliveryLng: "",
  notes: "",
};

export default function OrderPage() {
  const router = useRouter();
  const [step, setStep]               = useState<Step>("category");
  const [category, setCategory]       = useState<string>("");
  const [orderNumber, setOrderNumber] = useState("");
  const [form, setForm]               = useState<Form>(EMPTY_FORM);
  const [loading, setLoading]         = useState(false);
  const [gpsLoading, setGpsLoading]   = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [error, setError]             = useState("");
  const [trackInput, setTrackInput]   = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const selectedCat = CATEGORIES.find((c) => c.key === category);

  const setPickup = (loc: { name: string; lat: number; lng: number }) =>
    setForm((f) => ({ ...f, pickupAddress: loc.name, pickupLat: String(loc.lat), pickupLng: String(loc.lng) }));

  const setDelivery = (loc: { name: string; lat: number; lng: number }) =>
    setForm((f) => ({ ...f, deliveryAddress: loc.name, deliveryLat: String(loc.lat), deliveryLng: String(loc.lng) }));

  const useGPS = () => {
    if (!navigator.geolocation) { setError("GPS non disponible"); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          deliveryAddress: "Ma position GPS",
          deliveryLat: String(pos.coords.latitude),
          deliveryLng: String(pos.coords.longitude),
        }));
        setGpsAccuracy(Math.round(pos.coords.accuracy));
        setGpsLoading(false);
      },
      (err) => { setError(`GPS : ${err.message}`); setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.pickupLat || !form.deliveryLat) { setError("Veuillez sélectionner les adresses"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          category,
          pickupLat:   parseFloat(form.pickupLat),
          pickupLng:   parseFloat(form.pickupLng),
          deliveryLat: parseFloat(form.deliveryLat),
          deliveryLng: parseFloat(form.deliveryLng),
          priority: 0,
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Erreur"); return; }
      const delivery = await res.json();
      setOrderNumber(delivery.orderNumber);
      setStep("success");
    } catch { setError("Erreur réseau"); }
    finally { setLoading(false); }
  };

  const inputClass = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

  // ────────────────────────────────────────────────────────────────────────────
  // STEP: SUCCESS
  // ────────────────────────────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={40} className="text-green-500" />
          </div>
          {selectedCat && (
            <div className="text-4xl mb-2">{selectedCat.emoji}</div>
          )}
          <h2 className="text-xl font-bold text-gray-800 mb-1">Commande envoyée !</h2>
          <p className="text-gray-500 text-sm mb-6">
            Votre commande <span className="font-semibold text-orange-600">{selectedCat?.label}</span> est enregistrée.
          </p>
          <div className="bg-orange-50 rounded-2xl p-4 mb-6">
            <p className="text-xs text-orange-600 font-medium mb-1">Numéro de commande</p>
            <p className="text-lg font-bold text-orange-700 font-mono">{orderNumber}</p>
          </div>
          <button
            onClick={() => router.push(`/track/${orderNumber}`)}
            className="w-full bg-orange-500 text-white py-3 rounded-xl font-semibold hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 mb-3"
          >
            <MapPin size={18} />
            Suivre ma commande
            <ChevronRight size={16} />
          </button>
          <a
            href={`tel:${MANAGER_PHONE}`}
            className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-600 py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors"
          >
            <Phone size={16} />
            Appeler Motaz
          </a>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // STEP: CATEGORY SELECTION
  // ────────────────────────────────────────────────────────────────────────────
  if (step === "category") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 pt-12 pb-8 text-white">
          <div className="max-w-sm mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <Bike size={26} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold leading-tight">Better Call Motaz</h1>
                <p className="text-orange-100 text-xs">Livraison rapide à Bizerte</p>
              </div>
            </div>
            <a
              href={`tel:${MANAGER_PHONE}`}
              className="flex items-center justify-center gap-3 w-full bg-white text-orange-600 py-4 rounded-2xl font-bold text-base shadow-lg hover:bg-orange-50 active:scale-95 transition-all"
            >
              <Phone size={20} className="animate-pulse" />
              Appeler Motaz directement
            </a>
            <p className="text-center text-orange-100 text-xs mt-2">{MANAGER_PHONE}</p>
          </div>
        </div>

        {/* Categories */}
        <div className="max-w-sm mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-400 font-semibold tracking-wide">QUE VOULEZ-VOUS COMMANDER ?</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => { setCategory(cat.key); setStep("form"); }}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all active:scale-95 hover:shadow-md ${cat.color}`}
              >
                <span className="text-3xl leading-none">{cat.emoji}</span>
                <span className="text-xs font-semibold text-center leading-tight">{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Track existing */}
          <div className="mt-8 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
              <Clock size={15} className="text-blue-500" />
              Suivre une commande existante
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={trackInput}
                onChange={(e) => setTrackInput(e.target.value.toUpperCase())}
                placeholder="ORD-..."
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
              />
              <button
                onClick={() => trackInput && router.push(`/track/${trackInput}`)}
                disabled={!trackInput}
                className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6 pb-8">
            Better Call Motaz • Bizerte, Tunisie
          </p>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // STEP: FORM
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
      {/* Header with selected category */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 pt-10 pb-6 text-white">
        <div className="max-w-sm mx-auto">
          <button
            onClick={() => { setStep("category"); setForm(EMPTY_FORM); setGpsAccuracy(null); setError(""); }}
            className="inline-flex items-center gap-1 text-white/80 text-sm mb-3 hover:text-white"
          >
            <ChevronLeft size={16} />
            Catégories
          </button>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-3xl backdrop-blur-sm">
              {selectedCat?.emoji}
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">{selectedCat?.label}</h1>
              <p className="text-orange-100 text-xs">Remplissez les détails de votre commande</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 py-5">
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">

          {/* 1 — Customer info */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <span className="w-5 h-5 bg-orange-100 text-orange-600 rounded-full text-xs flex items-center justify-center font-bold">1</span>
              Vos informations
            </h3>
            <div>
              <label className={labelClass}>Nom complet *</label>
              <input
                type="text"
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                placeholder="Mohamed Ben Ali"
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Téléphone *</label>
              <input
                type="tel"
                value={form.customerPhone}
                onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                placeholder="+216 XX XXX XXX"
                required
                className={inputClass}
              />
            </div>
          </div>

          {/* 2 — Pickup */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-purple-100 space-y-3">
            <h3 className="text-sm font-semibold text-purple-700 flex items-center gap-2">
              <span className="w-5 h-5 bg-purple-100 text-purple-600 rounded-full text-xs flex items-center justify-center font-bold">2</span>
              <Package size={13} />
              Où récupérer ?
            </h3>
            <select
              className={inputClass}
              value={form.pickupAddress}
              onChange={(e) => {
                const loc = BIZERTE_LOCATIONS.find((l) => l.name === e.target.value);
                if (loc) setPickup(loc);
              }}
              required
            >
              <option value="">Sélectionner un quartier...</option>
              {BIZERTE_LOCATIONS.map((loc) => (
                <option key={loc.name} value={loc.name}>{loc.name}</option>
              ))}
            </select>
            {form.pickupAddress && (
              <p className="text-xs text-purple-600 flex items-center gap-1">
                <MapPin size={10} /> {form.pickupAddress} — enregistré
              </p>
            )}
          </div>

          {/* 3 — Delivery */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100 space-y-3">
            <h3 className="text-sm font-semibold text-orange-700 flex items-center gap-2">
              <span className="w-5 h-5 bg-orange-100 text-orange-600 rounded-full text-xs flex items-center justify-center font-bold">3</span>
              <MapPin size={13} />
              Où livrer ?
            </h3>
            <button
              type="button"
              onClick={useGPS}
              disabled={gpsLoading}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed text-sm font-medium transition-all
                ${form.deliveryAddress === "Ma position GPS"
                  ? "border-green-400 bg-green-50 text-green-700"
                  : "border-orange-300 bg-orange-50 text-orange-600 hover:border-orange-400"}`}
            >
              <Navigation size={15} className={gpsLoading ? "animate-spin" : ""} />
              {gpsLoading
                ? "Localisation..."
                : form.deliveryAddress === "Ma position GPS"
                ? `GPS activé (±${gpsAccuracy}m)`
                : "Utiliser ma position GPS"}
            </button>

            <div className="flex items-center gap-2 text-xs text-gray-400">
              <div className="h-px flex-1 bg-gray-100" />ou choisir un quartier<div className="h-px flex-1 bg-gray-100" />
            </div>

            <select
              className={inputClass}
              value={form.deliveryAddress !== "Ma position GPS" ? form.deliveryAddress : ""}
              onChange={(e) => {
                const loc = BIZERTE_LOCATIONS.find((l) => l.name === e.target.value);
                if (loc) { setDelivery(loc); setGpsAccuracy(null); }
              }}
            >
              <option value="">Sélectionner un quartier...</option>
              {BIZERTE_LOCATIONS.map((loc) => (
                <option key={loc.name} value={loc.name}>{loc.name}</option>
              ))}
            </select>
          </div>

          {/* 4 — Notes */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
              <span className="w-5 h-5 bg-gray-100 text-gray-500 rounded-full text-xs flex items-center justify-center font-bold">4</span>
              Instructions (optionnel)
            </h3>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Fragile, sonner à l'entrée, code portail 1234..."
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading || !form.pickupLat || !form.deliveryLat}
            className="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold text-base shadow-lg hover:bg-orange-600 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />Envoi...</>
            ) : (
              <><Send size={18} />Commander — {selectedCat?.emoji} {selectedCat?.label}</>
            )}
          </button>
        </form>

        <a
          href={`tel:${MANAGER_PHONE}`}
          className="mt-4 flex items-center justify-center gap-2 w-full border border-orange-200 text-orange-600 py-3 rounded-2xl text-sm font-medium hover:bg-orange-50 transition-colors"
        >
          <Phone size={15} />
          Appeler Motaz directement
        </a>

        <p className="text-center text-xs text-gray-400 mt-5 pb-8">
          Better Call Motaz • Bizerte, Tunisie
        </p>
      </div>
    </div>
  );
}
