"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Phone, Search, MapPin, ChevronRight, Clock, Bike, X, Star, Flame, Zap } from "lucide-react";
import type { Merchant } from "@/lib/types";

const MANAGER_PHONE = process.env.NEXT_PUBLIC_MANAGER_PHONE || "+21629461250";

// ── Category config ────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: "all",         label: "Tout",        emoji: "🏪" },
  { key: "restaurant",  label: "Restaurants", emoji: "🍽️" },
  { key: "patisserie",  label: "Pâtisserie",  emoji: "🧁" },
  { key: "boucherie",   label: "Boucherie",   emoji: "🥩" },
  { key: "volaillerie", label: "Volaillerie", emoji: "🐔" },
  { key: "fromagerie",  label: "Fromagerie",  emoji: "🧀" },
  { key: "supermarche", label: "Supermarché", emoji: "🛒" },
  { key: "pharmacie",   label: "Pharmacie",   emoji: "💊" },
  { key: "eau",         label: "Pack d'eau",  emoji: "💧" },
  { key: "course",      label: "Course",      emoji: "📦" },
];

// ── Per-category gradient colors (CSS) ───────────────────────────────────
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

// ── Derived metadata (consistent across renders) ─────────────────────────
function merchantRating(id: string): string {
  const n = (id.charCodeAt(0) * 13 + id.charCodeAt(1) * 7) % 12;
  return (3.8 + n * 0.1).toFixed(1);
}
function deliveryMinutes(id: string): string {
  const n = (id.charCodeAt(2) * 11 + id.charCodeAt(3) * 5) % 20;
  const lo = 15 + n;
  return `${lo}–${lo + 10} min`;
}
function isPopular(id: string): boolean { return id.charCodeAt(0) % 3 === 0; }
function isNew(id: string): boolean     { return id.charCodeAt(1) % 5 === 0; }

// ── Card components ───────────────────────────────────────────────────────
function HeroGradient({
  category, emoji, height = 160,
}: {
  category: string; emoji: string; height?: number;
}) {
  const [c1, c2] = GRADIENTS[category] ?? ["#636e72", "#b2bec3"];
  return (
    <div
      className="w-full flex items-center justify-center relative overflow-hidden"
      style={{
        height,
        background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`,
      }}
    >
      {/* subtle pattern overlay */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: "radial-gradient(circle at 20% 80%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <span className="text-6xl drop-shadow-lg relative z-10">{emoji}</span>
    </div>
  );
}

function MerchantCardMain({ merchant }: { merchant: Merchant }) {
  const cat     = CATEGORIES.find((c) => c.key === merchant.category);
  const rating  = merchantRating(merchant.id);
  const time    = deliveryMinutes(merchant.id);
  const popular = isPopular(merchant.id);
  const newStore = isNew(merchant.id);

  return (
    <Link href={`/order/${merchant.id}`} className="block group">
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 active:scale-[0.98]">
        {/* Image area */}
        <div className="relative">
          <HeroGradient category={merchant.category} emoji={cat?.emoji ?? "🏪"} height={160} />
          {/* Badges */}
          <div className="absolute top-3 left-3 flex gap-1.5">
            {popular && (
              <span className="flex items-center gap-1 bg-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-md">
                <Flame size={10} /> Populaire
              </span>
            )}
            {newStore && !popular && (
              <span className="flex items-center gap-1 bg-emerald-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-md">
                <Zap size={10} /> Nouveau
              </span>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="px-4 py-3">
          <h3 className="font-bold text-gray-900 text-base leading-tight line-clamp-1 mb-1 group-hover:text-orange-600 transition-colors">
            {merchant.name}
          </h3>

          {/* Meta row */}
          <div className="flex items-center gap-3 text-sm text-gray-500 mb-2">
            <span>{cat?.emoji} {cat?.label}</span>
            <span className="flex items-center gap-0.5 text-amber-500 font-semibold">
              <Star size={12} fill="currentColor" />
              {rating}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {time}
            </span>
          </div>

          {/* Address */}
          {merchant.address && (
            <p className="text-xs text-gray-400 flex items-center gap-1 line-clamp-1">
              <MapPin size={10} />
              {merchant.address}
            </p>
          )}

          {/* Delivery label */}
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-100">
            <span className="text-xs text-gray-400">Livraison gratuite</span>
            <span className="text-orange-500 font-semibold text-sm flex items-center gap-1">
              Commander <ChevronRight size={14} />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function MerchantCardFeatured({ merchant }: { merchant: Merchant }) {
  const cat     = CATEGORIES.find((c) => c.key === merchant.category);
  const rating  = merchantRating(merchant.id);
  const time    = deliveryMinutes(merchant.id);

  return (
    <Link href={`/order/${merchant.id}`} className="flex-shrink-0 w-40 block group">
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all active:scale-95">
        <HeroGradient category={merchant.category} emoji={cat?.emoji ?? "🏪"} height={100} />
        <div className="p-2.5">
          <p className="font-bold text-gray-900 text-xs line-clamp-2 leading-tight mb-1">
            {merchant.name}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Star size={10} className="text-amber-400 fill-amber-400" />
            <span className="text-amber-500 font-semibold">{rating}</span>
            <span>·</span>
            <Clock size={10} />
            <span>{time.split("–")[0]}min</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm animate-pulse">
      <div className="h-40 bg-gray-200" />
      <div className="p-4 space-y-2.5">
        <div className="h-4 bg-gray-200 rounded-lg w-3/4" />
        <div className="h-3 bg-gray-100 rounded-lg w-1/2" />
        <div className="h-3 bg-gray-100 rounded-lg w-2/3" />
        <div className="h-px bg-gray-100" />
        <div className="h-3 bg-gray-100 rounded-lg w-1/3" />
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function MarketplacePage() {
  const router = useRouter();
  const [merchants, setMerchants]           = useState<Merchant[]>([]);
  const [loading, setLoading]               = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch]                 = useState("");
  const [trackInput, setTrackInput]         = useState("");
  const [scrolled, setScrolled]             = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Header shadow on scroll
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const fetchMerchants = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeCategory !== "all") params.set("category", activeCategory);
      if (search) params.set("search", search);
      const res = await fetch(`/api/merchants?${params}`);
      if (res.ok) setMerchants(await res.json());
    } finally { setLoading(false); }
  }, [activeCategory, search]);

  useEffect(() => {
    const t = setTimeout(fetchMerchants, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchMerchants, search]);

  // Derived sections
  const featured = merchants.filter((m) => isPopular(m.id)).slice(0, 8);
  const showFeatured = !search && activeCategory === "all" && featured.length > 0;

  return (
    <div className="min-h-screen bg-[#F6F6F6]">

      {/* ── Sticky header ─────────────────────────────────────────────── */}
      <header className={`sticky top-0 z-50 bg-white transition-shadow duration-200 ${scrolled ? "shadow-md" : "shadow-none"}`}>
        <div className="px-4 pt-10 pb-2 max-w-lg mx-auto">
          {/* Top row */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-0.5">
                <MapPin size={11} className="text-orange-500" />
                <span>Livraison à</span>
              </div>
              <button className="flex items-center gap-1 font-bold text-gray-900">
                <Bike size={16} className="text-orange-500" />
                Better Call Motaz
                <ChevronRight size={14} className="text-gray-400" />
              </button>
            </div>
            <a
              href={`tel:${MANAGER_PHONE}`}
              className="flex items-center gap-1.5 bg-gray-900 text-white px-3.5 py-2 rounded-xl text-xs font-bold hover:bg-gray-800 active:scale-95 transition-all shadow-sm"
            >
              <Phone size={13} />
              Appeler
            </a>
          </div>

          {/* Search bar */}
          <div className="relative mb-3">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Restaurant, pharmacie, épicerie..."
              className="w-full bg-gray-100 rounded-xl pl-10 pr-9 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:bg-white transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 bg-gray-400 text-white rounded-full flex items-center justify-center hover:bg-gray-500"
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Category chips */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide max-w-lg mx-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeCategory === cat.key
                  ? "bg-gray-900 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <main className="max-w-lg mx-auto px-4 py-4 space-y-6">

        {/* Empty DB */}
        {!loading && merchants.length === 0 && (
          <div className="bg-white rounded-3xl p-10 text-center shadow-sm">
            <div className="text-6xl mb-4">🗺️</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Marketplace vide</h2>
            <p className="text-gray-500 text-sm mb-6 max-w-xs mx-auto">
              Importez les commerces de Bizerte depuis OpenStreetMap pour remplir la marketplace.
            </p>
            <Link
              href="/marchands"
              className="inline-flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-800 transition-colors"
            >
              Alimenter depuis OSM →
            </Link>
          </div>
        )}

        {/* Featured horizontal scroll */}
        {showFeatured && !loading && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                <Flame size={18} className="text-orange-500" />
                Populaires près de vous
              </h2>
            </div>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
              {featured.map((m) => <MerchantCardFeatured key={m.id} merchant={m} />)}
            </div>
          </section>
        )}

        {/* Main listing */}
        {(search || activeCategory !== "all" || !showFeatured || loading || merchants.length > 0) && (
          <section>
            {!loading && merchants.length > 0 && (
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-gray-900 text-lg">
                  {search
                    ? `Résultats pour "${search}"`
                    : activeCategory !== "all"
                    ? CATEGORIES.find((c) => c.key === activeCategory)?.label
                    : "Tous les marchands"}
                  <span className="text-gray-400 font-normal text-sm ml-2">({merchants.length})</span>
                </h2>
              </div>
            )}

            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : merchants.length === 0 && search ? (
              <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                <div className="text-4xl mb-3">🔍</div>
                <p className="font-semibold text-gray-700 mb-1">Aucun résultat</p>
                <p className="text-sm text-gray-400">pour &quot;{search}&quot;</p>
                <button onClick={() => setSearch("")} className="mt-4 text-orange-500 text-sm font-medium">
                  Effacer la recherche
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {merchants.map((m) => <MerchantCardMain key={m.id} merchant={m} />)}
              </div>
            )}
          </section>
        )}

        {/* Track order */}
        <section className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Clock size={16} className="text-blue-500" />
            Suivre une commande
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={trackInput}
              onChange={(e) => setTrackInput(e.target.value.toUpperCase())}
              placeholder="ORD-..."
              className="flex-1 bg-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
            />
            <button
              onClick={() => trackInput && router.push(`/track/${trackInput}`)}
              disabled={!trackInput}
              className="bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </section>

        <p className="text-center text-xs text-gray-400 pb-6">
          Better Call Motaz · Bizerte · Données © OpenStreetMap contributors
        </p>
      </main>
    </div>
  );
}
