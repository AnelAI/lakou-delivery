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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Bike size={20} className="text-blue-600" />
                Gestion des coursiers
              </h1>
              <p className="text-sm text-gray-500">{couriers.length} coursier(s) enregistré(s)</p>
            </div>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
          >
            + Ajouter un coursier
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Chargement...</div>
        ) : couriers.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <Bike size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Aucun coursier enregistré</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm"
            >
              Ajouter le premier coursier
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {couriers.map((courier) => (
              <div
                key={courier.id}
                className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
              >
                {/* Avatar & name */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg ${
                        courier.status === "available"
                          ? "bg-green-500"
                          : courier.status === "busy"
                          ? "bg-blue-500"
                          : courier.status === "paused"
                          ? "bg-yellow-500"
                          : "bg-gray-400"
                      }`}
                    >
                      {courier.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">{courier.name}</h3>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Phone size={12} />
                        {courier.phone}
                      </div>
                    </div>
                  </div>
                  <StatusBadge type="courier" value={courier.status} />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-2 mb-4 text-center">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <div className="text-lg font-bold text-blue-600">
                      {courier.deliveries?.length ?? 0}
                    </div>
                    <div className="text-xs text-gray-500">En cours</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <div className="text-lg font-bold text-green-600">
                      {courier.deliveredCount ?? 0}
                    </div>
                    <div className="text-xs text-gray-500">Livrées</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <div className="text-lg font-bold text-red-500">
                      {courier.alerts?.length ?? 0}
                    </div>
                    <div className="text-xs text-gray-500">Alertes</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <div className="text-lg font-bold text-gray-600">
                      {Math.round(courier.speed ?? 0)}
                    </div>
                    <div className="text-xs text-gray-500">km/h</div>
                  </div>
                </div>

                {/* Location & last seen */}
                <div className="space-y-1 mb-4 text-xs text-gray-500">
                  {courier.currentLat && courier.currentLng ? (
                    <div className="flex items-center gap-1">
                      <MapPin size={10} className="text-green-500" />
                      <span>
                        {courier.currentLat.toFixed(4)}, {courier.currentLng.toFixed(4)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-gray-400">
                      <MapPin size={10} />
                      <span>Position inconnue</span>
                    </div>
                  )}
                  {courier.lastSeen && (
                    <div>
                      Vu{" "}
                      {formatDistanceToNow(new Date(courier.lastSeen), {
                        addSuffix: true,
                        locale: fr,
                      })}
                    </div>
                  )}
                </div>

                {/* Active alerts */}
                {courier.alerts && courier.alerts.length > 0 && (
                  <div className="bg-red-50 rounded-lg p-2 mb-3">
                    <div className="flex items-center gap-1 text-red-600 text-xs font-medium mb-1">
                      <AlertTriangle size={12} />
                      {courier.alerts.length} alerte(s) active(s)
                    </div>
                    {courier.alerts.slice(0, 2).map((a) => (
                      <p key={a.id} className="text-xs text-red-500">
                        • {a.message}
                      </p>
                    ))}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  <select
                    value={courier.status}
                    onChange={(e) => updateStatus(courier.id, e.target.value)}
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="offline">Hors ligne</option>
                    <option value="available">Disponible</option>
                    <option value="busy">En livraison</option>
                    <option value="paused">En pause</option>
                  </select>
                  <button
                    onClick={() => deleteCourier(courier.id, courier.name)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Action links */}
                <div className="mt-2 flex gap-2">
                  <Link
                    href={`/courier/${courier.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1 text-xs text-blue-600 hover:text-blue-800 py-1.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <Power size={12} />
                    Lien tracking
                  </Link>
                  <button
                    onClick={() => shareWhatsApp(courier.id, courier.name)}
                    className="flex-1 flex items-center justify-center gap-1 text-xs text-green-700 hover:text-green-900 py-1.5 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    <Share2 size={12} />
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
