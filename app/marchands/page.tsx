"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, Download, Store, MapPin,
  Phone, Globe, ToggleLeft, ToggleRight, Trash2,
  CheckCircle, AlertCircle, Loader,
} from "lucide-react";
import type { Merchant } from "@/lib/types";

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

type SeedResult = { total: number; created: number; updated: number };

export default function MarchandsPage() {
  const [merchants, setMerchants]     = useState<Merchant[]>([]);
  const [loading, setLoading]         = useState(true);
  const [seeding, setSeeding]         = useState(false);
  const [seedResult, setSeedResult]   = useState<SeedResult | null>(null);
  const [seedError, setSeedError]     = useState("");
  const [filterCat, setFilterCat]     = useState("all");

  const fetchMerchants = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/merchants?active=all");
    // Note: our GET doesn't filter by active on admin — fetch all
    const res2 = await fetch("/api/merchants");
    if (res2.ok) setMerchants(await res2.json());
    setLoading(false);
    void res;
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
    setMerchants((prev) => prev.map((m) => m.id === merchant.id ? { ...m, active: !m.active } : m));
  };

  const deleteMerchant = async (merchant: Merchant) => {
    if (!confirm(`Supprimer "${merchant.name}" ?`)) return;
    await fetch(`/api/merchants/${merchant.id}`, { method: "DELETE" });
    setMerchants((prev) => prev.filter((m) => m.id !== merchant.id));
  };

  // Stats by category
  const stats = Object.entries(CATEGORIES).map(([key, { label, emoji }]) => ({
    key, label, emoji,
    count: merchants.filter((m) => m.category === key).length,
  })).sort((a, b) => b.count - a.count);

  const filtered = filterCat === "all"
    ? merchants
    : merchants.filter((m) => m.category === filterCat);

  return (
    <div className="min-h-screen bg-gray-50">
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
            <p className="text-xs text-gray-500">{merchants.length} marchand{merchants.length !== 1 ? "s" : ""} enregistrés</p>
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
            onClick={seedFromOsm}
            disabled={seeding}
            className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60"
          >
            {seeding
              ? <><Loader size={15} className="animate-spin" /> Import en cours...</>
              : <><Download size={15} /> Alimenter OSM</>}
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Seed feedback */}
        {seedResult && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-start gap-3">
            <CheckCircle size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
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
            <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-700">Erreur d&apos;import</p>
              <p className="text-sm text-red-600">{seedError}</p>
            </div>
          </div>
        )}

        {/* Stats by category */}
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

        {/* OSM empty state */}
        {!loading && merchants.length === 0 && (
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-gray-100">
            <div className="text-6xl mb-4">🗺️</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Base de données vide</h2>
            <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
              Cliquez sur <strong>Alimenter OSM</strong> pour importer automatiquement
              tous les commerces de la région de Bizerte depuis OpenStreetMap.
            </p>
            <button
              onClick={seedFromOsm}
              disabled={seeding}
              className="inline-flex items-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60"
            >
              {seeding ? <><Loader size={18} className="animate-spin" /> Import en cours...</> : <><Download size={18} /> Alimenter depuis OpenStreetMap</>}
            </button>
            <p className="text-xs text-gray-400 mt-3">Données libres © OpenStreetMap contributors</p>
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
                {filterCat === "all" ? "Tous les marchands" : `${CATEGORIES[filterCat]?.emoji} ${CATEGORIES[filterCat]?.label}`}
                <span className="ml-2 text-orange-500">{filtered.length}</span>
              </span>
            </div>
            {filtered.map((merchant, i) => {
              const cat = CATEGORIES[merchant.category];
              return (
                <div
                  key={merchant.id}
                  className={`flex items-center gap-3 px-4 py-3 ${i < filtered.length - 1 ? "border-b border-gray-50" : ""} ${!merchant.active ? "opacity-50" : ""}`}
                >
                  <span className="text-2xl flex-shrink-0">{cat?.emoji ?? "🏪"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-800 text-sm truncate">{merchant.name}</p>
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full flex-shrink-0">{cat?.label}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                      {merchant.address && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin size={10} />{merchant.address}
                        </span>
                      )}
                      {merchant.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={10} />{merchant.phone}
                        </span>
                      )}
                      {merchant.website && (
                        <span className="flex items-center gap-1">
                          <Globe size={10} />site
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
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
