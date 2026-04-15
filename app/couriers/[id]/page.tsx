"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ArrowLeft, TrendingUp, Clock, Package, DollarSign,
  Calendar, CheckCircle, AlertTriangle, ChevronDown, ChevronUp,
  Phone, Bike,
} from "lucide-react";

interface DeliveryRow {
  id: string;
  orderNumber: string;
  customerName: string;
  pickupAddress: string;
  deliveryAddress: string;
  priority: number;
  assignedAt: string | null;
  deliveredAt: string | null;
  notes: string | null;
  category: string | null;
  merchant: { name: string } | null;
}

interface Stats {
  today:      { count: number; revenue: number };
  week:       { count: number; revenue: number };
  month:      { count: number; revenue: number };
  allTime:    { count: number; revenue: number };
  avgMinutes: number | null;
  active:     number;
  alertCount: number;
  history:    DeliveryRow[];
}

interface CourierInfo {
  id: string;
  name: string;
  phone: string;
  status: string;
  deliveredCount: number;
  deliveredToday: number;
  createdAt: string;
}

const PRIORITY_LABEL: Record<number, string> = { 0: "Normale", 1: "Haute", 2: "Urgente" };
const PRIORITY_COLOR: Record<number, string> = {
  0: "bg-gray-100 text-gray-600",
  1: "bg-orange-100 text-orange-700",
  2: "bg-red-100 text-red-700",
};
const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: "🍽️", patisserie: "🧁", boucherie: "🥩", volaillerie: "🐔",
  fromagerie: "🧀", supermarche: "🛒", pharmacie: "💊", eau: "💧", course: "📦",
};

function KpiCard({
  label, value, sub, color, icon,
}: {
  label: string; value: string | number; sub?: string;
  color: string; icon: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl p-4 ${color}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold opacity-70 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
        </div>
        <div className="opacity-80">{icon}</div>
      </div>
    </div>
  );
}

export default function CourierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [courier, setCourier]   = useState<CourierInfo | null>(null);
  const [stats, setStats]       = useState<Stats | null>(null);
  const [loading, setLoading]   = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [period, setPeriod]     = useState<"today" | "week" | "month" | "all">("week");

  useEffect(() => {
    Promise.all([
      fetch(`/api/couriers`).then((r) => r.json()),
      fetch(`/api/couriers/${id}/stats`).then((r) => r.json()),
    ]).then(([couriers, s]) => {
      const c = couriers.find((x: CourierInfo) => x.id === id);
      setCourier(c ?? null);
      setStats(s);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!courier || !stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
        <p className="text-gray-500">Coursier introuvable</p>
        <Link href="/couriers" className="text-blue-600 underline text-sm">Retour</Link>
      </div>
    );
  }

  const statusColor =
    courier.status === "available" ? "bg-green-500" :
    courier.status === "busy"      ? "bg-blue-500"  :
    courier.status === "paused"    ? "bg-yellow-500": "bg-gray-400";

  // History filtered by period
  const filteredHistory = stats.history.filter((d) => {
    if (!d.deliveredAt) return false;
    const t = new Date(d.deliveredAt).getTime();
    const now = Date.now();
    if (period === "today") return t >= new Date().setHours(0,0,0,0);
    if (period === "week") {
      const w = new Date(); w.setDate(w.getDate() - ((w.getDay() + 6) % 7)); w.setHours(0,0,0,0);
      return t >= w.getTime();
    }
    if (period === "month") {
      const m = new Date(); m.setDate(1); m.setHours(0,0,0,0);
      return t >= m.getTime();
    }
    return true; // all
  });

  const currentBucket = period === "today" ? stats.today
    : period === "week" ? stats.week
    : period === "month" ? stats.month
    : stats.allTime;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/couriers" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft size={18} className="text-gray-600" />
          </Link>
          <div className="flex items-center gap-3 flex-1">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg ${statusColor}`}>
              {courier.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="font-bold text-gray-800 flex items-center gap-2">
                <Bike size={16} className="text-blue-600" />
                {courier.name}
              </h1>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Phone size={10} /> {courier.phone}
                <span className="mx-1">·</span>
                Depuis {format(new Date(courier.createdAt), "MMMM yyyy", { locale: fr })}
              </p>
            </div>
          </div>
          {stats.alertCount > 0 && (
            <span className="flex items-center gap-1 text-xs bg-red-100 text-red-600 px-2.5 py-1 rounded-full font-semibold">
              <AlertTriangle size={12} /> {stats.alertCount} alerte{stats.alertCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* ── KPI Cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard
            label="Livré aujourd'hui"
            value={stats.today.count}
            sub={`${stats.today.revenue} DT`}
            color="bg-blue-50 text-blue-700"
            icon={<Package size={22} />}
          />
          <KpiCard
            label="Cette semaine"
            value={stats.week.count}
            sub={`${stats.week.revenue} DT`}
            color="bg-purple-50 text-purple-700"
            icon={<Calendar size={22} />}
          />
          <KpiCard
            label="Ce mois"
            value={stats.month.count}
            sub={`${stats.month.revenue} DT`}
            color="bg-orange-50 text-orange-700"
            icon={<TrendingUp size={22} />}
          />
          <KpiCard
            label="Total général"
            value={stats.allTime.count}
            sub={`${stats.allTime.revenue} DT`}
            color="bg-green-50 text-green-700"
            icon={<CheckCircle size={22} />}
          />
        </div>

        {/* ── Performance row ────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
              <Clock size={14} />
              <span className="text-xs">Tps moyen / course</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">
              {stats.avgMinutes !== null ? `${stats.avgMinutes} min` : "—"}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
              <Package size={14} />
              <span className="text-xs">En cours</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{stats.active}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
              <DollarSign size={14} />
              <span className="text-xs">CA ce mois</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.month.revenue} DT</p>
          </div>
        </div>

        {/* ── Revenue chart (simple bar) ──────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-orange-500" /> Budget généré
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Aujourd'hui", ...stats.today },
              { label: "Semaine",     ...stats.week },
              { label: "Mois",        ...stats.month },
              { label: "Total",       ...stats.allTime },
            ].map((b) => {
              const maxRevenue = Math.max(stats.allTime.revenue, 1);
              const pct = Math.round((b.revenue / maxRevenue) * 100);
              return (
                <div key={b.label} className="text-center">
                  <div className="h-24 flex items-end justify-center mb-1">
                    <div
                      className="w-8 bg-orange-400 rounded-t-md transition-all"
                      style={{ height: `${Math.max(pct, 4)}%` }}
                    />
                  </div>
                  <p className="text-xs font-bold text-gray-700">{b.revenue} DT</p>
                  <p className="text-xs text-gray-400">{b.label}</p>
                  <p className="text-xs text-gray-500">{b.count} livr.</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── History ────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <Package size={15} className="text-purple-500" />
              Historique des courses
              <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">
                {filteredHistory.length}
              </span>
            </span>
            {historyOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </button>

          {historyOpen && (
            <>
              {/* Period filter */}
              <div className="flex gap-1 px-4 pb-3 border-b border-gray-100">
                {(["today", "week", "month", "all"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                      period === p
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {p === "today" ? "Aujourd'hui" : p === "week" ? "Semaine" : p === "month" ? "Mois" : "Tout"}
                  </button>
                ))}
                <span className="ml-auto text-xs text-gray-500 self-center">
                  {currentBucket.count} courses · {currentBucket.revenue} DT
                </span>
              </div>

              {filteredHistory.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-400 text-sm">
                  Aucune livraison sur cette période
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {filteredHistory.map((d) => {
                    const durationMin =
                      d.assignedAt && d.deliveredAt
                        ? Math.round((new Date(d.deliveredAt).getTime() - new Date(d.assignedAt).getTime()) / 60000)
                        : null;
                    return (
                      <div key={d.id} className="px-4 py-3 flex items-start gap-3">
                        <span className="text-lg flex-shrink-0 mt-0.5">
                          {CATEGORY_EMOJI[d.category ?? ""] ?? "📦"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-gray-800 truncate">
                              {d.customerName}
                            </span>
                            {d.merchant && (
                              <span className="text-xs text-gray-500">@ {d.merchant.name}</span>
                            )}
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${PRIORITY_COLOR[d.priority]}`}>
                              {PRIORITY_LABEL[d.priority]}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {d.pickupAddress} → {d.deliveryAddress}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                            {d.deliveredAt && (
                              <span>{format(new Date(d.deliveredAt), "dd/MM HH:mm")}</span>
                            )}
                            {durationMin !== null && (
                              <span className="flex items-center gap-0.5">
                                <Clock size={10} /> {durationMin} min
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-green-600">
                            {5 + d.priority * 2} DT
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">#{d.orderNumber.slice(-6)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
