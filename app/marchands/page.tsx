"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, Download, Store, MapPin,
  Phone, Globe, ToggleLeft, ToggleRight, Trash2,
  CheckCircle, AlertCircle, Loader, Plus, Pencil,
  Package, X, Save, ChevronRight, Map, Link2, SlidersHorizontal,
} from "lucide-react";
import { useJsApiLoader } from "@react-google-maps/api";
import { MapPickerModal } from "@/components/ui/MapPickerModal";
import type { Merchant, Delivery } from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: Record<string, { label: string; emoji: string }> = {
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

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:   { label: "En attente",   color: "bg-yellow-100 text-yellow-700" },
  assigned:  { label: "Assignée",     color: "bg-blue-100 text-blue-700" },
  picked_up: { label: "Récupérée",    color: "bg-orange-100 text-orange-700" },
  delivered: { label: "Livrée",       color: "bg-green-100 text-green-700" },
  cancelled: { label: "Annulée",      color: "bg-red-100 text-red-700" },
};

// Stable reference — must be outside component to avoid useJsApiLoader warning
const GMAPS_LIBRARIES: [] = [];

type SeedResult = { total: number; created: number; updated: number };

type MarchandFormData = {
  name: string;
  category: string;
  address: string;
  phone: string;
  website: string;
  lat: string;
  lng: string;
};

const EMPTY_FORM: MarchandFormData = {
  name: "", category: "restaurant", address: "",
  phone: "", website: "", lat: "", lng: "",
};

// Extracts lat/lng from common Google Maps URL formats.
// Supports: /maps/@lat,lng  |  ?q=lat,lng  |  ?ll=lat,lng
// Does NOT support shortened URLs (goo.gl / maps.app.goo.gl) — those require server-side resolution.
function parseGoogleMapsUrl(url: string): { lat: number; lng: number } | null {
  const atMatch = url.match(/@(-?\d+\.?\d+),(-?\d+\.?\d+)/);
  if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };

  const qMatch = url.match(/[?&]q=(-?\d+\.?\d+),(-?\d+\.?\d+)/);
  if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };

  const llMatch = url.match(/[?&]ll=(-?\d+\.?\d+),(-?\d+\.?\d+)/);
  if (llMatch) return { lat: parseFloat(llMatch[1]), lng: parseFloat(llMatch[2]) };

  return null;
}

// ─── Form Modal ───────────────────────────────────────────────────────────────

type LocMode = "map" | "url" | "manual";

const LOC_TABS: { key: LocMode; Icon: typeof Map; label: string }[] = [
  { key: "map",    Icon: Map,              label: "Carte"        },
  { key: "url",    Icon: Link2,            label: "URL Maps"     },
  { key: "manual", Icon: SlidersHorizontal, label: "Coordonnées" },
];

function MarchandFormModal({
  mode,
  initial,
  onClose,
  onSaved,
}: {
  mode: "add" | "edit";
  initial?: Merchant;
  onClose: () => void;
  onSaved: (m: Merchant) => void;
}) {
  const { isLoaded: mapsLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    libraries: GMAPS_LIBRARIES,
  });

  const [form, setForm] = useState<MarchandFormData>(
    initial
      ? {
          name: initial.name,
          category: initial.category,
          address: initial.address ?? "",
          phone: initial.phone ?? "",
          website: initial.website ?? "",
          lat: String(initial.lat),
          lng: String(initial.lng),
        }
      : EMPTY_FORM
  );

  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");
  const [locMode, setLocMode]         = useState<LocMode>("map");
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [gmapsUrl, setGmapsUrl]       = useState("");
  const [urlError, setUrlError]       = useState("");
  const [urlSuccess, setUrlSuccess]   = useState(false);

  const set = (key: keyof MarchandFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const hasCoords = form.lat !== "" && form.lng !== "";
  const coordsCenter = hasCoords
    ? { lat: parseFloat(form.lat), lng: parseFloat(form.lng) }
    : undefined;

  const [urlResolving, setUrlResolving] = useState(false);

  const handleParseUrl = async () => {
    setUrlError("");
    setUrlSuccess(false);
    const trimmed = gmapsUrl.trim();
    if (!trimmed) { setUrlError("Entrez une URL Google Maps."); return; }

    // Try client-side parse first (works for full URLs with @lat,lng or ?q=lat,lng)
    const direct = parseGoogleMapsUrl(trimmed);
    if (direct) {
      setForm((prev) => ({ ...prev, lat: String(direct.lat), lng: String(direct.lng) }));
      setUrlSuccess(true);
      return;
    }

    // Shortened URL or no coords found client-side → resolve server-side
    setUrlResolving(true);
    try {
      const res = await fetch("/api/resolve-maps-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUrlError(data.error ?? "Impossible d'extraire les coordonnées.");
        return;
      }
      setForm((prev) => ({ ...prev, lat: String(data.lat), lng: String(data.lng) }));
      setUrlSuccess(true);
    } catch {
      setUrlError("Erreur réseau. Vérifiez votre connexion.");
    } finally {
      setUrlResolving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) { setError("Le nom est requis."); return; }
    if (!form.lat || !form.lng) { setError("La localisation est requise (carte, URL ou coordonnées)."); return; }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        website: form.website.trim() || null,
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
      };

      const res = await fetch(
        mode === "add" ? "/api/merchants" : `/api/merchants/${initial!.id}`,
        {
          method: mode === "add" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erreur serveur");
        return;
      }

      onSaved(await res.json());
      onClose();
    } catch {
      setError("Erreur réseau");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">

          {/* Header */}
          <div className="sticky top-0 bg-white rounded-t-3xl px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-800 text-lg flex items-center gap-2">
              <Store size={18} className="text-orange-500" />
              {mode === "add" ? "Ajouter un marchand" : "Modifier le marchand"}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
              <X size={18} className="text-gray-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

            {/* Nom */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nom *</label>
              <input
                type="text"
                value={form.name}
                onChange={set("name")}
                placeholder="Ex: Boulangerie Centrale"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>

            {/* Catégorie */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Catégorie *</label>
              <select
                value={form.category}
                onChange={set("category")}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              >
                {Object.entries(CATEGORIES).map(([key, { label, emoji }]) => (
                  <option key={key} value={key}>{emoji} {label}</option>
                ))}
              </select>
            </div>

            {/* Adresse / Description */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Adresse / Description
                <span className="ml-1 font-normal text-gray-400">(optionnel)</span>
              </label>
              <input
                type="text"
                value={form.address}
                onChange={set("address")}
                placeholder="Ex: Rue de la République, face à la poste…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>

            {/* Téléphone */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Téléphone
                <span className="ml-1 font-normal text-gray-400">(optionnel)</span>
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={set("phone")}
                placeholder="Ex: +216 71 234 567"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>

            {/* Site web */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Site web
                <span className="ml-1 font-normal text-gray-400">(optionnel)</span>
              </label>
              <input
                type="url"
                value={form.website}
                onChange={set("website")}
                placeholder="https://..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>

            {/* ── Localisation ── */}
            <div className="border border-gray-100 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                  <MapPin size={13} className="text-orange-500" />
                  Localisation
                  <span className="font-normal text-gray-400">(optionnel)</span>
                </span>
                {hasCoords && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                      {parseFloat(form.lat).toFixed(5)}, {parseFloat(form.lng).toFixed(5)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, lat: "", lng: "" }))}
                      className="text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>

              {/* Mode tabs */}
              <div className="flex border-b border-gray-100">
                {LOC_TABS.map(({ key, Icon, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setLocMode(key)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors border-b-2 ${
                      locMode === key
                        ? "border-orange-400 text-orange-600 bg-orange-50"
                        : "border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <Icon size={13} /> {label}
                  </button>
                ))}
              </div>

              <div className="p-4">
                {/* Mode Carte */}
                {locMode === "map" && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">
                      Cliquez sur la carte pour placer l&apos;épingle à l&apos;emplacement exact du marchand.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowMapPicker(true)}
                      disabled={!mapsLoaded}
                      className="w-full flex items-center justify-center gap-2 bg-gray-800 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                      {mapsLoaded
                        ? <><Map size={15} />{hasCoords ? "Modifier sur la carte" : "Ouvrir la carte"}</>
                        : <><Loader size={15} className="animate-spin" />Chargement Google Maps…</>}
                    </button>
                  </div>
                )}

                {/* Mode URL */}
                {locMode === "url" && (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-2">
                        Collez n&apos;importe quel lien Google Maps : lien court <strong>maps.app.goo.gl</strong>,
                        lien de partage, ou URL complète.
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={gmapsUrl}
                          onChange={(e) => { setGmapsUrl(e.target.value); setUrlError(""); setUrlSuccess(false); }}
                          placeholder="https://maps.app.goo.gl/… ou lien complet"
                          className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent min-w-0"
                        />
                        <button
                          type="button"
                          onClick={handleParseUrl}
                          disabled={urlResolving}
                          className="shrink-0 bg-orange-500 text-white px-3 py-2.5 rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center gap-1.5"
                        >
                          {urlResolving
                            ? <><Loader size={13} className="animate-spin" />Résolution…</>
                            : "Extraire"}
                        </button>
                      </div>
                    </div>
                    {urlError && (
                      <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                        <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-red-600">{urlError}</p>
                      </div>
                    )}
                    {urlSuccess && hasCoords && (
                      <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2.5">
                        <CheckCircle size={14} className="text-green-500 shrink-0" />
                        <p className="text-xs text-green-700 font-mono">
                          {parseFloat(form.lat).toFixed(6)}, {parseFloat(form.lng).toFixed(6)}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Mode Manuel */}
                {locMode === "manual" && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">Saisissez les coordonnées GPS manuellement.</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Latitude</label>
                        <input
                          type="number"
                          step="any"
                          value={form.lat}
                          onChange={set("lat")}
                          placeholder="37.2746"
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Longitude</label>
                        <input
                          type="number"
                          step="any"
                          value={form.lng}
                          onChange={set("lng")}
                          placeholder="9.8739"
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 flex items-center gap-2">
                <AlertCircle size={15} className="text-red-500 shrink-0" />
                <span className="text-sm text-red-600">{error}</span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-orange-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? <Loader size={15} className="animate-spin" /> : <Save size={15} />}
                {mode === "add" ? "Ajouter" : "Enregistrer"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Map picker — rendered above the form modal (z-[3000]) */}
      {showMapPicker && (
        <MapPickerModal
          title="Emplacement du marchand"
          subtitle={form.name.trim() ? form.name.trim() : "Cliquez sur la carte pour placer l'épingle"}
          initialCenter={coordsCenter}
          onConfirm={(lat, lng) => {
            setForm((prev) => ({ ...prev, lat: String(lat), lng: String(lng) }));
            setShowMapPicker(false);
          }}
          onClose={() => setShowMapPicker(false)}
        />
      )}
    </>
  );
}

// ─── Commandes Panel ───────────────────────────────────────────────────────────

type MarchandDelivery = Pick<Delivery,
  "id" | "orderNumber" | "customerName" | "customerPhone" |
  "deliveryAddress" | "status" | "priority" | "price" | "createdAt"
> & { courier?: { id: string; name: string; phone: string } | null };

function CommandesPanel({
  merchant,
  onClose,
}: {
  merchant: Merchant;
  onClose: () => void;
}) {
  const [deliveries, setDeliveries] = useState<MarchandDelivery[]>([]);
  const [loading, setLoading]       = useState(true);
  const [unlinking, setUnlinking]   = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/merchants/${merchant.id}/deliveries`);
        if (res.ok) setDeliveries(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, [merchant.id]);

  const unlink = async (deliveryId: string) => {
    setUnlinking(deliveryId);
    await fetch(`/api/deliveries/${deliveryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchantId: null }),
    });
    setDeliveries((prev) => prev.filter((d) => d.id !== deliveryId));
    setUnlinking(null);
  };

  const cat = CATEGORIES[merchant.category];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
              <span>{cat?.emoji ?? "🏪"}</span>
              <span className="truncate">{merchant.name}</span>
            </h2>
            <p className="text-xs text-gray-500">Commandes liées</p>
          </div>
          <span className="text-xs font-semibold bg-orange-100 text-orange-600 px-2 py-1 rounded-full shrink-0">
            {loading ? "…" : deliveries.length}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-gray-100 rounded-2xl h-20 animate-pulse" />
              ))}
            </div>
          ) : deliveries.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-3">📭</div>
              <p className="font-semibold text-gray-700">Aucune commande</p>
              <p className="text-sm text-gray-400 mt-1">Ce marchand n&apos;a pas encore de commandes liées.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {deliveries.map((d) => {
                const st = STATUS_LABELS[d.status] ?? { label: d.status, color: "bg-gray-100 text-gray-600" };
                return (
                  <div key={d.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-800 text-sm">#{d.orderNumber}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${st.color}`}>{st.label}</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5 truncate">{d.customerName}</p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate flex items-center gap-1">
                          <MapPin size={10} />{d.deliveryAddress}
                        </p>
                        {d.courier && (
                          <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                            <ChevronRight size={10} />Coursier: {d.courier.name}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {d.price != null && (
                          <span className="text-sm font-bold text-gray-800">{d.price} DT</span>
                        )}
                        <span className="text-xs text-gray-400">
                          {new Date(d.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                        </span>
                        {(d.status === "pending" || d.status === "assigned") && (
                          <button
                            onClick={() => unlink(d.id)}
                            disabled={unlinking === d.id}
                            className="text-xs text-red-400 hover:text-red-600 flex items-center gap-0.5 mt-1 disabled:opacity-50"
                          >
                            {unlinking === d.id ? <Loader size={10} className="animate-spin" /> : <X size={10} />}
                            Délier
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function MarchandsPage() {
  const [merchants, setMerchants]       = useState<Merchant[]>([]);
  const [loading, setLoading]           = useState(true);
  const [seeding, setSeeding]           = useState(false);
  const [seedResult, setSeedResult]     = useState<SeedResult | null>(null);
  const [seedError, setSeedError]       = useState("");
  const [filterCat, setFilterCat]       = useState("all");

  // Modals
  const [showAdd, setShowAdd]           = useState(false);
  const [editTarget, setEditTarget]     = useState<Merchant | null>(null);
  const [cmdTarget, setCmdTarget]       = useState<Merchant | null>(null);

  const fetchMerchants = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/merchants?admin=true");
    if (res.ok) setMerchants(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchMerchants(); }, [fetchMerchants]);

  const seedFromOsm = async () => {
    if (!confirm("Lancer l'import depuis OpenStreetMap (Bizerte, rayon 20km) ? Cela peut prendre 30-40 secondes.")) return;
    setSeeding(true); setSeedResult(null); setSeedError("");
    try {
      const res = await fetch("/api/admin/seed-osm", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setSeedError(data.error || "Erreur serveur"); }
      else { setSeedResult(data); await fetchMerchants(); }
    } catch { setSeedError("Erreur réseau"); }
    finally { setSeeding(false); }
  };

  const toggleActive = async (merchant: Merchant) => {
    await fetch(`/api/merchants/${merchant.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !merchant.active }),
    });
    setMerchants((prev) =>
      prev.map((m) => m.id === merchant.id ? { ...m, active: !m.active } : m)
    );
  };

  const deleteMerchant = async (merchant: Merchant) => {
    if (!confirm(`Supprimer "${merchant.name}" ? Cette action est irréversible.`)) return;
    await fetch(`/api/merchants/${merchant.id}`, { method: "DELETE" });
    setMerchants((prev) => prev.filter((m) => m.id !== merchant.id));
  };

  const handleSaved = (saved: Merchant) => {
    setMerchants((prev) => {
      const exists = prev.find((m) => m.id === saved.id);
      return exists
        ? prev.map((m) => m.id === saved.id ? saved : m)
        : [saved, ...prev];
    });
  };

  const stats = Object.entries(CATEGORIES).map(([key, { label, emoji }]) => ({
    key, label, emoji,
    count: merchants.filter((m) => m.category === key).length,
  })).sort((a, b) => b.count - a.count);

  const filtered = filterCat === "all"
    ? merchants
    : merchants.filter((m) => m.category === filterCat);

  const activeCount   = merchants.filter((m) => m.active).length;
  const inactiveCount = merchants.filter((m) => !m.active).length;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Modals */}
      {showAdd && (
        <MarchandFormModal
          mode="add"
          onClose={() => setShowAdd(false)}
          onSaved={handleSaved}
        />
      )}
      {editTarget && (
        <MarchandFormModal
          mode="edit"
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}
      {cmdTarget && (
        <CommandesPanel
          merchant={cmdTarget}
          onClose={() => setCmdTarget(null)}
        />
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft size={18} className="text-gray-600" />
          </Link>
          <div>
            <h1 className="font-bold text-gray-800 flex items-center gap-2">
              <Store size={18} className="text-orange-500" />
              Marchands
            </h1>
            <p className="text-xs text-gray-500">
              {merchants.length} enregistrés · {activeCount} actifs · {inactiveCount} inactifs
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchMerchants}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Actualiser"
          >
            <RefreshCw size={15} className="text-gray-500" />
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-gray-800 text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-gray-700 transition-colors"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Ajouter</span>
          </button>
          <button
            onClick={seedFromOsm}
            disabled={seeding}
            className="flex items-center gap-2 bg-orange-500 text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60"
          >
            {seeding
              ? <><Loader size={15} className="animate-spin" /><span className="hidden sm:inline">Import...</span></>
              : <><Download size={15} /><span className="hidden sm:inline">OSM</span></>}
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Seed feedback */}
        {seedResult && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-start gap-3">
            <CheckCircle size={20} className="text-green-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-700">Import réussi depuis OpenStreetMap !</p>
              <p className="text-sm text-green-600 mt-0.5">
                {seedResult.total} marchands traités · {seedResult.created} ajoutés · {seedResult.updated} mis à jour
              </p>
            </div>
          </div>
        )}

        {seedError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-700">Erreur d&apos;import</p>
              <p className="text-sm text-red-600">{seedError}</p>
            </div>
          </div>
        )}

        {/* Stats par catégorie */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {stats.filter((s) => s.count > 0).map((s) => (
            <button
              key={s.key}
              onClick={() => setFilterCat(filterCat === s.key ? "all" : s.key)}
              className={`flex flex-col items-center gap-1 p-3 rounded-2xl border-2 transition-all text-center ${
                filterCat === s.key ? "border-orange-400 bg-orange-50" : "border-gray-100 bg-white hover:border-gray-200"
              }`}
            >
              <span className="text-2xl">{s.emoji}</span>
              <span className="text-xs font-semibold text-gray-700">{s.count}</span>
              <span className="text-xs text-gray-500 leading-tight">{s.label}</span>
            </button>
          ))}
        </div>

        {/* Empty state */}
        {!loading && merchants.length === 0 && (
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-gray-100">
            <div className="text-6xl mb-4">🗺️</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Base de données vide</h2>
            <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
              Ajoutez un marchand manuellement ou importez depuis OpenStreetMap.
            </p>
            <div className="flex justify-center gap-3 flex-wrap">
              <button
                onClick={() => setShowAdd(true)}
                className="inline-flex items-center gap-2 bg-gray-800 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-gray-700 transition-colors"
              >
                <Plus size={16} /> Ajouter un marchand
              </button>
              <button
                onClick={seedFromOsm}
                disabled={seeding}
                className="inline-flex items-center gap-2 bg-orange-500 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60"
              >
                {seeding ? <><Loader size={16} className="animate-spin" /> Import...</> : <><Download size={16} /> Alimenter OSM</>}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-4">Données OSM libres © OpenStreetMap contributors</p>
          </div>
        )}

        {/* Merchant list */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-16 animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : filtered.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">
                {filterCat === "all"
                  ? "Tous les marchands"
                  : `${CATEGORIES[filterCat]?.emoji} ${CATEGORIES[filterCat]?.label}`}
                <span className="ml-2 text-orange-500">{filtered.length}</span>
              </span>
            </div>

            {filtered.map((merchant, i) => {
              const cat = CATEGORIES[merchant.category];
              return (
                <div
                  key={merchant.id}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    i < filtered.length - 1 ? "border-b border-gray-50" : ""
                  } ${!merchant.active ? "opacity-50" : ""}`}
                >
                  <span className="text-2xl shrink-0">{cat?.emoji ?? "🏪"}</span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800 text-sm truncate">{merchant.name}</p>
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full shrink-0">
                        {cat?.label}
                      </span>
                      {!merchant.active && (
                        <span className="text-xs bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full shrink-0">
                          Inactif
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
                      {merchant.address && (
                        <span className="flex items-center gap-1 truncate max-w-45">
                          <MapPin size={10} />{merchant.address}
                        </span>
                      )}
                      {merchant.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={10} />{merchant.phone}
                        </span>
                      )}
                      {merchant.website && (
                        <a
                          href={merchant.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-500 hover:underline"
                        >
                          <Globe size={10} />site
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setCmdTarget(merchant)}
                      className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Voir les commandes"
                    >
                      <Package size={15} className="text-blue-400" />
                    </button>
                    <button
                      onClick={() => setEditTarget(merchant)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Modifier"
                    >
                      <Pencil size={14} className="text-gray-400" />
                    </button>
                    <button
                      onClick={() => toggleActive(merchant)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                      title={merchant.active ? "Désactiver" : "Activer"}
                    >
                      {merchant.active
                        ? <ToggleRight size={20} className="text-green-500" />
                        : <ToggleLeft size={20} className="text-gray-400" />}
                    </button>
                    <button
                      onClick={() => deleteMerchant(merchant)}
                      className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={15} className="text-red-400" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
