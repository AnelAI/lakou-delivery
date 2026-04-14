"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Phone, Search, MapPin, ChevronRight, Clock,
  Bike, RefreshCw, Store, X,
} from "lucide-react";
import type { Merchant } from "@/lib/types";

const MANAGER_PHONE = process.env.NEXT_PUBLIC_MANAGER_PHONE || "+21629461250";

const CATEGORIES = [
  { key: "all",         label: "Tout",        emoji: "🏪" },
  { key: "restaurant",  label: "Restaurant",  emoji: "🍽️" },
  { key: "patisserie",  label: "Pâtisserie",  emoji: "🧁" },
  { key: "boucherie",   label: "Boucherie",   emoji: "🥩" },
  { key: "volaillerie", label: "Volaillerie", emoji: "🐔" },
  { key: "fromagerie",  label: "Fromagerie",  emoji: "🧀" },
  { key: "supermarche", label: "Supermarché", emoji: "🛒" },
  { key: "pharmacie",   label: "Pharmacie",   emoji: "💊" },
  { key: "eau",         label: "Pack d'eau",  emoji: "💧" },
  { key: "course",      label: "Course",      emoji: "📦" },
];

const CAT_COLORS: Record<string, string> = {
  restaurant:  "bg-orange-100 text-orange-700",
  patisserie:  "bg-pink-100   text-pink-700",
  boucherie:   "bg-red-100    text-red-700",
  volaillerie: "bg-yellow-100 text-yellow-700",
  fromagerie:  "bg-amber-100  text-amber-700",
  supermarche: "bg-green-100  text-green-700",
  pharmacie:   "bg-blue-100   text-blue-700",
  eau:         "bg-cyan-100   text-cyan-700",
  course:      "bg-purple-100 text-purple-700",
};

const CAT_BG: Record<string, string> = {
  restaurant:  "from-orange-400 to-amber-400",
  patisserie:  "from-pink-400   to-rose-400",
  boucherie:   "from-red-400    to-rose-500",
  volaillerie: "from-yellow-400 to-orange-400",
  fromagerie:  "from-amber-400  to-yellow-400",
  supermarche: "from-green-400  to-emerald-400",
  pharmacie:   "from-blue-400   to-cyan-400",
  eau:         "from-cyan-400   to-sky-400",
  course:      "from-purple-400 to-violet-400",
};

function MerchantCard({ merchant }: { merchant: Merchant }) {
  const cat  = CATEGORIES.find((c) => c.key === merchant.category);
  const grad = CAT_BG[merchant.category] ?? "from-gray-400 to-gray-500";
  const badge = CAT_COLORS[merchant.category] ?? "bg-gray-100 text-gray-700";

  return (
    <Link href={`/order/${merchant.id}`} className="block group">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 active:scale-95">
        {/* Card header gradient */}
        <div className={`bg-gradient-to-br ${grad} h-20 flex items-center justify-center relative`}>
          <span className="text-5xl drop-shadow-sm">{cat?.emoji ?? "🏪"}</span>
          <div className="absolute inset-0 bg-black/5" />
        </div>

        {/* Card body */}
        <div className="p-3">
          <h3 className="font-bold text-gray-800 text-sm leading-tight line-clamp-1 mb-1">
            {merchant.name}
          </h3>

          {merchant.address && (
            <div className="flex items-start gap-1 text-xs text-gray-500 mb-2">
              <MapPin size={10} className="mt-0.5 flex-shrink-0 text-gray-400" />
              <span className="line-clamp-1">{merchant.address}</span>
            </div>
          )}

          <div className="flex items-center justify-between mt-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge}`}>
              {cat?.label ?? merchant.category}
            </span>
            <span className="text-orange-500 group-hover:translate-x-0.5 transition-transform">
              <ChevronRight size={16} />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-pulse">
      <div className="h-20 bg-gray-200" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-gray-200 rounded w-3/4" />
        <div className="h-2 bg-gray-100 rounded w-1/2" />
        <div className="h-5 bg-gray-100 rounded w-1/3" />
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  const router = useRouter();
  const [merchants, setMerchants]       = useState<Merchant[]>([]);
  const [loading, setLoading]           = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch]             = useState("");
  const [trackInput, setTrackInput]     = useState("");

  const fetchMerchants = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeCategory !== "all") params.set("category", activeCategory);
      if (search) params.set("search", search);
      const res = await fetch(`/api/merchants?${params}`);
      if (res.ok) setMerchants(await res.json());
    } finally {
      setLoading(false);
    }
  }, [activeCategory, search]);

  useEffect(() => {
    const timeout = setTimeout(fetchMerchants, search ? 300 : 0);
    return () => clearTimeout(timeout);
  }, [fetchMerchants, search]);

  const activeCat = CATEGORIES.find((c) => c.key === activeCategory);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-gradient-to-b from-orange-500 to-orange-400 shadow-lg">
        <div className="px-4 pt-10 pb-3 max-w-lg mx-auto">
          {/* Brand row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                <Bike size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-white font-bold text-base leading-none">Better Call Motaz</h1>
                <div className="flex items-center gap-1 text-orange-100 text-xs mt-0.5">
                  <MapPin size={9} />
                  Bizerte, Tunisie
                </div>
              </div>
            </div>
            <a
              href={`tel:${MANAGER_PHONE}`}
              className="flex items-center gap-1.5 bg-white text-orange-600 px-3 py-2 rounded-xl text-xs font-bold shadow-sm hover:bg-orange-50 active:scale-95 transition-all"
            >
              <Phone size={14} className="animate-pulse" />
              Appeler
            </a>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un restaurant, pharmacie..."
              className="w-full bg-white rounded-xl pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 shadow-sm"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Category chips */}
        <div className="flex gap-2 px-4 pb-3 max-w-lg mx-auto overflow-x-auto scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeCategory === cat.key
                  ? "bg-white text-orange-600 shadow-sm"
                  : "bg-white/20 text-white hover:bg-white/30"
              }`}
            >
              <span>{cat.emoji}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="max-w-lg mx-auto px-4 py-4">

        {/* Count & label */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-gray-700">
            {loading ? "Chargement..." : (
              <>
                <span className="text-orange-500">{merchants.length}</span>
                {" "}marchand{merchants.length !== 1 ? "s" : ""}
                {activeCategory !== "all" && <> · {activeCat?.emoji} {activeCat?.label}</>}
              </>
            )}
          </p>
          {!loading && merchants.length === 0 && !search && (
            <button
              onClick={fetchMerchants}
              className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-600"
            >
              <RefreshCw size={12} />
              Actualiser
            </button>
          )}
        </div>

        {/* Empty state */}
        {!loading && merchants.length === 0 && (
          <div className="text-center py-16">
            <Store size={48} className="text-gray-200 mx-auto mb-3" />
            {search ? (
              <>
                <p className="text-gray-500 font-medium">Aucun résultat pour &quot;{search}&quot;</p>
                <button onClick={() => setSearch("")} className="mt-2 text-orange-500 text-sm">Effacer la recherche</button>
              </>
            ) : (
              <>
                <p className="text-gray-500 font-medium mb-1">Aucun marchand disponible</p>
                <p className="text-gray-400 text-sm mb-4">La base n&apos;a pas encore été alimentée depuis OpenStreetMap.</p>
                <Link href="/marchands" className="inline-flex items-center gap-2 bg-orange-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors">
                  Alimenter depuis OSM →
                </Link>
              </>
            )}
          </div>
        )}

        {/* Merchant grid */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : merchants.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {merchants.map((m) => <MerchantCard key={m.id} merchant={m} />)}
          </div>
        ) : null}

        {/* Track order */}
        <div className="mt-8 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
            <Clock size={15} className="text-blue-500" />
            Suivre une commande
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
              className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6 pb-8">
          Better Call Motaz • Bizerte, Tunisie • Données © OpenStreetMap
        </p>
      </div>
    </div>
  );
}
