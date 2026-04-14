"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  Phone, MapPin, Clock, CheckCircle, Package, Bike,
  ChevronLeft, AlertCircle,
} from "lucide-react";
import type { Delivery } from "@/lib/types";
import { getPusherClient, orderChannel, EVENTS } from "@/lib/pusher-client";

const MANAGER_PHONE = process.env.NEXT_PUBLIC_MANAGER_PHONE || "+21629461250";

interface ExtendedDelivery extends Delivery {
  courier?: {
    id: string;
    name: string;
    phone: string;
  } | null;
}

const STATUS_STEPS = [
  { key: "pending",   label: "Reçue",            icon: "📋", description: "Votre commande est enregistrée" },
  { key: "assigned",  label: "Coursier assigné",  icon: "🏍️", description: "Un coursier est en route pour le colis" },
  { key: "picked_up", label: "En route",           icon: "📦", description: "Le colis est en route vers vous" },
  { key: "delivered", label: "Livré",              icon: "✅", description: "Commande livrée avec succès !" },
];

function getStepIndex(status: string): number {
  return STATUS_STEPS.findIndex((s) => s.key === status);
}

function ElapsedTimer({ since }: { since: string }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const update = () => {
      const diff = Math.floor((Date.now() - new Date(since).getTime()) / 1000);
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setElapsed(m > 0 ? `${m}min ${s}s` : `${s}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [since]);

  return <span className="font-mono text-orange-600">{elapsed}</span>;
}

export default function TrackPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = use(params);
  const [delivery, setDelivery] = useState<ExtendedDelivery | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  // ── Initial fetch ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/track/${orderNumber}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((data: ExtendedDelivery | null) => {
        if (data) setDelivery(data);
      })
      .finally(() => setLoading(false));
  }, [orderNumber]);

  // ── Pusher real-time status updates ───────────────────────────────────────
  useEffect(() => {
    const client = getPusherClient();
    const ch = client.subscribe(orderChannel(orderNumber));

    ch.bind(EVENTS.DELIVERY_STATUS_UPDATE, (updated: ExtendedDelivery) => {
      setDelivery(updated);
    });

    return () => {
      ch.unbind_all();
      client.unsubscribe(orderChannel(orderNumber));
    };
  }, [orderNumber]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Chargement du suivi...</p>
        </div>
      </div>
    );
  }

  if (notFound || !delivery) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 text-center max-w-sm w-full">
          <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
          <h2 className="font-bold text-gray-800 text-lg mb-2">Commande introuvable</h2>
          <p className="text-gray-500 text-sm mb-6">
            Le numéro <span className="font-mono text-orange-600">{orderNumber}</span> n&apos;existe pas.
          </p>
          <Link
            href="/order"
            className="inline-flex items-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-orange-600 transition-colors"
          >
            <ChevronLeft size={16} />
            Passer une commande
          </Link>
        </div>
      </div>
    );
  }

  const currentStep = getStepIndex(delivery.status);
  const isDelivered = delivery.status === "delivered";
  const isCancelled = delivery.status === "cancelled";

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex flex-col">

      {/* Header */}
      <div className={`px-4 pt-10 pb-6 text-white ${
        isDelivered  ? "bg-gradient-to-r from-green-500 to-emerald-500" :
        isCancelled  ? "bg-gradient-to-r from-gray-400 to-gray-500" :
                       "bg-gradient-to-r from-orange-500 to-amber-500"
      }`}>
        <div className="max-w-sm mx-auto">
          <Link href="/order" className="inline-flex items-center gap-1 text-white/80 text-sm mb-4 hover:text-white">
            <ChevronLeft size={16} />
            Commander
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white/80 text-xs font-medium mb-0.5">Numéro de commande</p>
              <p className="font-bold text-lg font-mono leading-tight">{delivery.orderNumber}</p>
            </div>
            <div className="text-right">
              {delivery.createdAt && !isDelivered && !isCancelled && (
                <div className="flex items-center gap-1 text-white/80 text-xs">
                  <Clock size={12} />
                  <ElapsedTimer since={delivery.createdAt} />
                </div>
              )}
              {isDelivered && delivery.deliveredAt && (
                <p className="text-xs text-white/80">
                  Livré à {new Date(delivery.deliveredAt).toLocaleTimeString("fr-TN", { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-sm mx-auto w-full px-4 py-5 space-y-4">

        {/* Status timeline */}
        {!isCancelled && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="space-y-3">
              {STATUS_STEPS.map((step, i) => {
                const isDone    = i < currentStep;
                const isCurrent = i === currentStep;
                return (
                  <div key={step.key} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0 transition-all
                        ${isDone    ? "bg-green-100"
                        : isCurrent ? "bg-orange-100 ring-2 ring-orange-400"
                        :             "bg-gray-100 opacity-40"}`}
                      >
                        {isDone ? <CheckCircle size={18} className="text-green-500" /> : step.icon}
                      </div>
                      {i < STATUS_STEPS.length - 1 && (
                        <div className={`w-0.5 h-5 mt-1 ${isDone ? "bg-green-300" : "bg-gray-100"}`} />
                      )}
                    </div>
                    <div className="pt-1.5">
                      <p className={`text-sm font-semibold leading-tight ${
                        isDone ? "text-green-600" : isCurrent ? "text-orange-600" : "text-gray-400"
                      }`}>
                        {step.label}
                      </p>
                      {isCurrent && (
                        <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isCancelled && (
          <div className="bg-red-50 rounded-2xl p-4 border border-red-100 text-center">
            <p className="text-red-600 font-semibold">Commande annulée</p>
            <p className="text-red-400 text-sm mt-1">Contactez Motaz pour plus d&apos;informations</p>
          </div>
        )}

        {/* Estimated time when assigned */}
        {delivery.estimatedTime && (delivery.status === "assigned" || delivery.status === "picked_up") && (
          <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-orange-100 flex items-center gap-3">
            <Clock size={20} className="text-orange-500 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Temps de livraison estimé</p>
              <p className="font-bold text-orange-600 text-lg leading-tight">{delivery.estimatedTime} min</p>
            </div>
          </div>
        )}

        {/* Courier card */}
        {delivery.courier && (delivery.status === "assigned" || delivery.status === "picked_up") && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-blue-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white flex-shrink-0">
                <Bike size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800">{delivery.courier.name}</p>
                <p className="text-xs text-gray-500">Votre coursier</p>
              </div>
              <a
                href={`tel:${delivery.courier.phone}`}
                className="flex items-center gap-1.5 bg-green-500 text-white px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-green-600 active:scale-95 transition-all"
              >
                <Phone size={15} />
                Appeler
              </a>
            </div>
          </div>
        )}

        {/* Delivery details */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Détails de la commande</h3>
          <div className="flex items-start gap-3 text-sm">
            <Package size={16} className="text-purple-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Collecte</p>
              <p className="text-gray-700 font-medium">{delivery.pickupAddress}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 text-sm">
            <MapPin size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Livraison</p>
              <p className="text-gray-700 font-medium">{delivery.deliveryAddress}</p>
            </div>
          </div>
          {delivery.notes && (
            <div className="bg-gray-50 rounded-xl px-3 py-2 text-xs text-gray-600 italic">
              &quot;{delivery.notes}&quot;
            </div>
          )}
          {delivery.distance && (
            <p className="text-xs text-gray-400">Distance : {delivery.distance} km</p>
          )}
        </div>

        {/* Call manager */}
        <a
          href={`tel:${MANAGER_PHONE}`}
          className="flex items-center justify-center gap-2 w-full bg-white border border-orange-200 text-orange-600 py-3.5 rounded-2xl font-semibold shadow-sm hover:bg-orange-50 active:scale-95 transition-all"
        >
          <Phone size={18} />
          Contacter Motaz
        </a>

        <p className="text-center text-xs text-gray-400 pb-6">
          Better Call Motaz • Bizerte, Tunisie
        </p>
      </div>
    </div>
  );
}
