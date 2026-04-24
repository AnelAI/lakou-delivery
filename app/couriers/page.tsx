"use client";

import { useState, useEffect } from "react";
import type { Courier } from "@/lib/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AddCourierForm } from "@/components/courier/AddCourierForm";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ArrowLeft,
  Phone,
  AlertTriangle,
  MapPin,
  Bike,
  Trash2,
  Power,
  CheckCircle,
  Share2,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

export default function CouriersPage() {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const fetchCouriers = async () => {
    setLoading(true);
    const res = await fetch("/api/couriers");
    if (res.ok) setCouriers(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    fetchCouriers();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/couriers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchCouriers();
  };

  const deleteCourier = async (id: string, name: string) => {
    if (!confirm(`Supprimer le coursier "${name}" ? Cette action est irréversible.`)) return;
    await fetch(`/api/couriers/${id}`, { method: "DELETE" });
    fetchCouriers();
  };

  const shareWhatsApp = (courierId: string, courierName: string) => {
    const url = `${window.location.origin}/courier/${courierId}`;
    const text = `🏍️ Lakou Delivery — Bonjour ${courierName} !\nVoici votre lien de suivi GPS :\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="min-h-screen" style={{ background: "#FAFAF8", fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div className="bg-white px-6 py-4" style={{ borderBottom: "1px solid #E8E8E8" }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-lg transition-colors"
              style={{ color: "#5A5A5A", border: "1px solid #E8E8E8" }}
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 className="text-xl flex items-center gap-2" style={{ fontFamily: "Archivo, sans-serif", fontWeight: 800, letterSpacing: "-0.02em", color: "#0A0A0A" }}>
                <Bike size={20} color="#FF3B2F" />
                Gestion des coursiers
              </h1>
              <p className="text-sm" style={{ color: "#5A5A5A" }}>{couriers.length} coursier(s) enregistré(s)</p>
            </div>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="text-sm px-4 py-2 rounded-full transition-colors"
            style={{ background: "#0A0A0A", color: "#FFFFFF", fontFamily: "Archivo, sans-serif", fontWeight: 700, border: "none", cursor: "pointer" }}
          >
            + Ajouter un coursier
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {loading ? (
          <div className="text-center py-12" style={{ color: "#8A8A8A" }}>Chargement…</div>
        ) : couriers.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl" style={{ border: "1px solid #E8E8E8" }}>
            <Bike size={40} color="#C8C8C8" className="mx-auto mb-3" />
            <p className="font-medium" style={{ color: "#5A5A5A" }}>Aucun coursier enregistré</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-4 text-sm px-4 py-2 rounded-full"
              style={{ background: "#FF3B2F", color: "#FFFFFF", fontFamily: "Archivo, sans-serif", fontWeight: 700, border: "none", cursor: "pointer" }}
            >
              Ajouter le premier coursier
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {couriers.map((courier) => (
              <div
                key={courier.id}
                className="bg-white rounded-2xl p-5 transition-shadow hover:shadow-md"
                style={{ border: "1px solid #E8E8E8" }}
              >
                {/* Avatar & name */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg relative"
                      style={{
                        background:
                          courier.status === "available" ? "#22c55e" :
                          courier.status === "busy"      ? "#FF3B2F" :
                          courier.status === "paused"    ? "#FFB800" :
                                                           "#C8C8C8",
                        fontFamily: "Archivo, sans-serif",
                        fontWeight: 900,
                      }}
                    >
                      {courier.name.charAt(0).toUpperCase()}
                      <span
                        className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                        style={{
                          background:
                            courier.status === "available" ? "#B8FF3E" :
                            courier.status === "busy"      ? "#FF3B2F" :
                            courier.status === "paused"    ? "#FFB800" : "#C8C8C8"
                        }}
                      />
                    </div>
                    <div>
                      <h3 style={{ fontFamily: "Archivo, sans-serif", fontWeight: 800, fontSize: 16, color: "#0A0A0A" }}>{courier.name}</h3>
                      <div className="flex items-center gap-1 text-sm" style={{ color: "#5A5A5A", fontSize: 12, marginTop: 2 }}>
                        <Phone size={10} />
                        {courier.phone}
                      </div>
                    </div>
                  </div>
                  <StatusBadge type="courier" value={courier.status} />
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-4 gap-2 mb-4 text-center">
                  {[
                    { v: courier.deliveries?.length ?? 0, l: "En cours", bg: "#F4F4F4", c: "#0A0A0A" },
                    { v: courier.deliveredToday ?? 0, l: "Auj.", bg: "rgba(255,59,47,0.08)", c: "#FF3B2F" },
                    { v: courier.deliveredCount ?? 0, l: "Total", bg: "rgba(184,255,62,0.15)", c: "#3a7d00" },
                    { v: courier.alerts?.length ?? 0, l: "Alertes", bg: (courier.alerts?.length ?? 0) > 0 ? "rgba(255,59,47,0.08)" : "#F4F4F4", c: (courier.alerts?.length ?? 0) > 0 ? "#FF3B2F" : "#8A8A8A" },
                  ].map((s, i) => (
                    <div key={i} className="rounded-lg p-2" style={{ background: s.bg }}>
                      <div style={{ fontFamily: "Archivo, sans-serif", fontWeight: 800, fontSize: 18, color: s.c, lineHeight: 1 }}>{s.v}</div>
                      <div style={{ fontSize: 9, color: "#5A5A5A", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>{s.l}</div>
                    </div>
                  ))}
                </div>

                {/* GPS */}
                <div className="flex items-center gap-1 mb-4 text-xs" style={{ color: courier.currentLat ? "#3a7d00" : "#8A8A8A" }}>
                  <MapPin size={10} />
                  {courier.currentLat && courier.currentLng
                    ? `GPS actif · ${courier.currentLat.toFixed(4)}, ${courier.currentLng.toFixed(4)}`
                    : "Position inconnue"}
                  {courier.lastSeen && (
                    <span className="ml-auto" style={{ color: "#8A8A8A" }}>
                      {formatDistanceToNow(new Date(courier.lastSeen), { addSuffix: true, locale: fr })}
                    </span>
                  )}
                </div>

                {/* Active alerts */}
                {courier.alerts && courier.alerts.length > 0 && (
                  <div className="rounded-lg p-2 mb-3" style={{ background: "rgba(255,59,47,0.08)" }}>
                    <div className="flex items-center gap-1 text-xs font-medium mb-1" style={{ color: "#FF3B2F" }}>
                      <AlertTriangle size={11} />
                      {courier.alerts.length} alerte(s) active(s) — Dépassement délai
                    </div>
                  </div>
                )}

                {/* Status select + delete */}
                <div className="flex gap-2 mb-2">
                  <select
                    value={courier.status}
                    onChange={(e) => updateStatus(courier.id, e.target.value)}
                    className="flex-1 text-xs rounded-lg px-2 py-1.5 focus:outline-none"
                    style={{ border: "1px solid #E8E8E8", background: "#F4F4F4", color: "#0A0A0A" }}
                  >
                    <option value="offline">Hors ligne</option>
                    <option value="available">Disponible</option>
                    <option value="busy">En livraison</option>
                    <option value="paused">En pause</option>
                  </select>
                  <button
                    onClick={() => deleteCourier(courier.id, courier.name)}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ background: "rgba(255,59,47,0.08)", color: "#FF3B2F", border: "none", cursor: "pointer" }}
                    title="Supprimer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Action links */}
                <div className="grid grid-cols-3 gap-2">
                  <Link
                    href={`/couriers/${courier.id}`}
                    className="flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg font-semibold transition-colors"
                    style={{ background: "rgba(139,92,246,0.08)", color: "#6d28d9" }}
                  >
                    <CheckCircle size={11} />
                    Détail
                  </Link>
                  <Link
                    href={`/courier/${courier.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg transition-colors"
                    style={{ background: "rgba(59,130,246,0.08)", color: "#1d4ed8" }}
                  >
                    <Power size={11} />
                    Tracking
                  </Link>
                  <button
                    onClick={() => shareWhatsApp(courier.id, courier.name)}
                    className="flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg transition-colors"
                    style={{ background: "rgba(34,197,94,0.1)", color: "#166534", border: "none", cursor: "pointer" }}
                  >
                    <Share2 size={11} />
                    WhatsApp
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddCourierForm
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={fetchCouriers}
      />
    </div>
  );
}
