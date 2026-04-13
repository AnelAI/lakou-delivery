"use client";

import { useState, useEffect } from "react";
import type { Alert } from "@/lib/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertTriangle,
  Clock,
  MapPin,
  CheckCircle,
  ArrowLeft,
  Filter,
} from "lucide-react";
import Link from "next/link";

const alertTypeLabels: Record<string, string> = {
  unauthorized_pause: "Pause non autorisée",
  route_deviation: "Déviation d'itinéraire",
  speed_violation: "Infraction de vitesse",
  offline: "Hors connexion",
};

const alertTypeIcons: Record<string, React.ReactNode> = {
  unauthorized_pause: <Clock size={16} />,
  route_deviation: <MapPin size={16} />,
  speed_violation: <AlertTriangle size={16} />,
  offline: <AlertTriangle size={16} />,
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "resolved">("active");
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    setLoading(true);
    const params = filter === "all" ? "" : `?resolved=${filter === "resolved"}`;
    const res = await fetch(`/api/alerts${params}`);
    if (res.ok) setAlerts(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    fetchAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const resolveAlert = async (id: string) => {
    await fetch(`/api/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved: true }),
    });
    fetchAlerts();
  };

  const resolveAll = async () => {
    const activeAlerts = alerts.filter((a) => !a.resolved);
    await Promise.all(
      activeAlerts.map((a) =>
        fetch(`/api/alerts/${a.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resolved: true }),
        })
      )
    );
    fetchAlerts();
  };

  const activeCount = alerts.filter((a) => !a.resolved).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <AlertTriangle size={20} className="text-red-500" />
                Centre d&apos;alertes
              </h1>
              <p className="text-sm text-gray-500">
                {activeCount > 0
                  ? `${activeCount} alerte(s) active(s)`
                  : "Aucune alerte active"}
              </p>
            </div>
          </div>
          {activeCount > 0 && (
            <button
              onClick={resolveAll}
              className="flex items-center gap-2 text-sm bg-green-100 text-green-700 px-4 py-2 rounded-lg hover:bg-green-200"
            >
              <CheckCircle size={14} />
              Tout résoudre
            </button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-6">
          <Filter size={16} className="text-gray-500" />
          {(["active", "all", "resolved"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
                filter === f
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {f === "active" ? "Actives" : f === "all" ? "Toutes" : "Résolues"}
            </button>
          ))}
        </div>

        {/* Alert list */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Chargement...</div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
            <CheckCircle size={40} className="text-green-400 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Aucune alerte</p>
            <p className="text-sm text-gray-400 mt-1">
              Tous vos coursiers sont bien tracés
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`bg-white rounded-xl border p-4 flex items-start gap-4 ${
                  alert.severity === "critical" && !alert.resolved
                    ? "border-red-200 bg-red-50"
                    : alert.resolved
                    ? "border-gray-100 opacity-60"
                    : "border-yellow-100 bg-yellow-50"
                }`}
              >
                <div
                  className={`p-2 rounded-lg flex-shrink-0 ${
                    alert.severity === "critical"
                      ? "bg-red-100 text-red-600"
                      : "bg-yellow-100 text-yellow-600"
                  }`}
                >
                  {alertTypeIcons[alert.type] ?? <AlertTriangle size={16} />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-800">
                      {alert.courier?.name ?? "Coursier inconnu"}
                    </span>
                    <StatusBadge type="severity" value={alert.severity} />
                    {alert.resolved && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        Résolu
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-medium text-gray-700">
                      {alertTypeLabels[alert.type] ?? alert.type}
                    </span>{" "}
                    — {alert.message}
                  </p>
                  <div className="text-xs text-gray-400 mt-1.5 space-x-3">
                    <span>
                      {formatDistanceToNow(new Date(alert.createdAt), {
                        addSuffix: true,
                        locale: fr,
                      })}
                    </span>
                    <span>
                      {format(new Date(alert.createdAt), "dd/MM/yyyy HH:mm")}
                    </span>
                    {alert.resolvedAt && (
                      <span className="text-green-600">
                        Résolu le {format(new Date(alert.resolvedAt), "dd/MM HH:mm")}
                      </span>
                    )}
                  </div>
                </div>

                {!alert.resolved && (
                  <button
                    onClick={() => resolveAlert(alert.id)}
                    className="flex-shrink-0 text-xs bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-1"
                  >
                    <CheckCircle size={12} />
                    Résoudre
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
