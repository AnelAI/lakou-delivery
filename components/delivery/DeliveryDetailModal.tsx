"use client";

import { useState } from "react";
import type { Courier, Delivery } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  X, MapPin, Package, Phone, Clock, Truck, FileText,
  AlertTriangle, User, CheckCircle, XCircle,
} from "lucide-react";
import { LocationPickerModal } from "./LocationPickerModal";

interface Props {
  delivery: Delivery;
  couriers: Courier[];
  onClose: () => void;
  onAssign: (deliveryId: string, courierId: string) => void;
  onStatusChange: (deliveryId: string, action: string) => void;
  onConfirmLocation?: (deliveryId: string, lat: number, lng: number) => void;
  onConfirmPickup?: (deliveryId: string, lat: number, lng: number) => void;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending:   { label: "En attente", color: "text-yellow-600 bg-yellow-50" },
  assigned:  { label: "Assignée",   color: "text-blue-600 bg-blue-50"    },
  picked_up: { label: "En route",   color: "text-purple-600 bg-purple-50" },
  delivered: { label: "Livrée",     color: "text-green-600 bg-green-50"   },
  cancelled: { label: "Annulée",    color: "text-gray-500 bg-gray-100"    },
};

export function DeliveryDetailModal({
  delivery, couriers, onClose, onAssign, onStatusChange, onConfirmLocation, onConfirmPickup,
}: Props) {
  const [assigning, setAssigning]         = useState(false);
  const [pickingLocation, setPickingLocation] = useState<"pickup" | "delivery" | null>(null);

  const available = couriers.filter((c) => ["available", "busy"].includes(c.status));
  const status    = STATUS_META[delivery.status] ?? STATUS_META.pending;
  const isLibre   = !delivery.merchantId;

  const doAssign = (courierId: string) => {
    onAssign(delivery.id, courierId);
    onClose();
  };

  const doAction = (action: string) => {
    onStatusChange(delivery.id, action);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
        <div
          className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          style={{ maxHeight: "92vh" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between gap-3 flex-shrink-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status.color}`}>
                  {status.label}
                </span>
                {delivery.locationConfirmed === false && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-amber-700 bg-amber-50">
                    📍 Livraison à localiser
                  </span>
                )}
                {isLibre && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-purple-700 bg-purple-50">
                    💬 Commande libre
                  </span>
                )}
              </div>
              <h2 className="font-bold text-gray-900 text-lg leading-tight">{delivery.customerName}</h2>
              <p className="text-xs text-gray-400 font-mono mt-0.5">{delivery.orderNumber}</p>
              {/* Note client visible dès l'ouverture */}
              {delivery.notes && (
                <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-800 flex items-start gap-1.5">
                  <FileText size={12} className="flex-shrink-0 mt-0.5 text-yellow-600" />
                  <span>{delivery.notes}</span>
                </div>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

            {/* Customer contact */}
            <div className="space-y-2">
              {delivery.customerPhone && (
                <a href={`tel:${delivery.customerPhone}`}
                  className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 hover:bg-gray-100 transition-colors">
                  <Phone size={16} className="text-blue-500 flex-shrink-0" />
                  <span className="text-sm font-semibold text-blue-600">{delivery.customerPhone}</span>
                </a>
              )}
              <div className="flex items-center gap-3 text-xs text-gray-400 px-1">
                <Clock size={12} />
                {formatDistanceToNow(new Date(delivery.createdAt), { addSuffix: true, locale: fr })}
                {delivery.distance && <span>· {delivery.distance} km</span>}
                {delivery.estimatedTime && <span>· ~{delivery.estimatedTime} min</span>}
              </div>
            </div>

            {/* Pickup */}
            <div className="rounded-2xl border border-purple-100 overflow-hidden">
              <div className="bg-purple-50 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-700">
                  <Package size={13} />
                  COLLECTE
                </div>
                {isLibre && onConfirmPickup && (
                  <button
                    onClick={() => setPickingLocation("pickup")}
                    className="text-xs bg-purple-600 text-white px-2.5 py-1 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
                  >
                    Localiser sur maps
                  </button>
                )}
              </div>
              <div className="px-4 py-3 space-y-1.5">
                <p className="text-sm text-gray-800 font-medium">{delivery.pickupAddress}</p>
                {delivery.merchant && (
                  <p className="text-xs text-gray-500">{delivery.merchant.name}</p>
                )}
                {delivery.pickupLat !== 0 && delivery.pickupLng !== 0 && (
                  <a
                    href={`https://maps.google.com/?q=${delivery.pickupLat},${delivery.pickupLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-purple-600 bg-purple-50 border border-purple-200 rounded-lg px-3 py-1.5 hover:bg-purple-100 transition-colors font-mono"
                  >
                    <MapPin size={11} className="text-purple-500 flex-shrink-0" />
                    {delivery.pickupLat.toFixed(6)}, {delivery.pickupLng.toFixed(6)}
                    <span className="text-purple-400 ml-1">↗</span>
                  </a>
                )}
                {isLibre && (
                  <p className="text-xs text-purple-600 italic">
                    ⚠️ Vérifiez le lieu de collecte dans les notes avant d&apos;assigner
                  </p>
                )}
              </div>
            </div>

            {/* Delivery */}
            <div className="rounded-2xl border border-orange-100 overflow-hidden">
              <div className="bg-orange-50 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-orange-700">
                  <MapPin size={13} />
                  LIVRAISON
                </div>
                {delivery.locationConfirmed === false && onConfirmLocation && (
                  <button
                    onClick={() => setPickingLocation("delivery")}
                    className="text-xs bg-orange-500 text-white px-2.5 py-1 rounded-lg font-semibold hover:bg-orange-600 transition-colors"
                  >
                    Localiser sur maps
                  </button>
                )}
              </div>
              <div className="px-4 py-3 space-y-2">
                {/* Address text */}
                <p className="text-sm text-gray-800 font-medium">{delivery.deliveryAddress}</p>

                {/* GPS coordinates — clickable link to maps */}
                {delivery.locationConfirmed && delivery.deliveryLat !== 0 && delivery.deliveryLng !== 0 && (
                  <a
                    href={`https://maps.google.com/?q=${delivery.deliveryLat},${delivery.deliveryLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-100 transition-colors font-mono"
                  >
                    <MapPin size={11} className="text-blue-500 flex-shrink-0" />
                    {delivery.deliveryLat.toFixed(6)}, {delivery.deliveryLng.toFixed(6)}
                    <span className="text-blue-400 ml-1">↗</span>
                  </a>
                )}

                {delivery.deliveryDescription && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 italic flex items-start gap-2">
                    <AlertTriangle size={12} className="flex-shrink-0 mt-0.5 text-amber-500" />
                    {delivery.deliveryDescription}
                  </div>
                )}
              </div>
            </div>

            {/* Courier */}
            {delivery.courier && (
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <Truck size={15} className="text-gray-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 font-medium">Coursier assigné</p>
                  <p className="text-sm font-semibold text-gray-800">{delivery.courier.name}</p>
                </div>
              </div>
            )}

            {/* Assign section */}
            {delivery.status === "pending" && (
              <div className="space-y-2">
                {!assigning ? (
                  <button
                    onClick={() => setAssigning(true)}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl py-3.5 text-sm transition-colors"
                  >
                    <User size={16} />
                    Assigner un coursier
                  </button>
                ) : (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-bold text-blue-700">Choisir un coursier :</p>
                    {available.length === 0 && (
                      <p className="text-xs text-gray-500 py-1">Aucun coursier disponible</p>
                    )}
                    {available.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => doAssign(c.id)}
                        className="w-full flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-blue-200 hover:bg-blue-50 transition-colors"
                      >
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                          c.status === "available" ? "bg-green-500" : "bg-blue-500"
                        }`}>
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                          <p className="text-xs text-gray-500">
                            {c.status === "available" ? "✓ Disponible" : `En course (${c.deliveries?.length ?? 0})`}
                          </p>
                        </div>
                      </button>
                    ))}
                    <button onClick={() => setAssigning(false)} className="w-full text-xs text-gray-400 py-1 hover:text-gray-600">
                      Annuler
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Status actions */}
            {delivery.status === "assigned" && (
              <button
                onClick={() => doAction("pickup")}
                className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl py-3.5 text-sm transition-colors"
              >
                <Package size={16} /> Marquer collectée
              </button>
            )}
            {delivery.status === "picked_up" && (
              <button
                onClick={() => doAction("deliver")}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl py-3.5 text-sm transition-colors"
              >
                <CheckCircle size={16} /> Marquer livrée
              </button>
            )}
            {["pending", "assigned"].includes(delivery.status) && (
              <button
                onClick={() => doAction("cancel")}
                className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 rounded-xl py-3 text-sm font-semibold hover:bg-red-50 transition-colors"
              >
                <XCircle size={15} /> Annuler cette course
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Location picker overlay */}
      {pickingLocation && (
        <LocationPickerModal
          deliveryId={delivery.id}
          locationType={pickingLocation}
          description={pickingLocation === "delivery" ? delivery.deliveryDescription : null}
          clientNote={delivery.notes ?? undefined}
          customerName={delivery.customerName}
          initialCenter={
            delivery.deliveryLat && delivery.deliveryLng
              ? { lat: delivery.deliveryLat, lng: delivery.deliveryLng }
              : undefined
          }
          onConfirm={(id, lat, lng) => {
            if (pickingLocation === "pickup" && onConfirmPickup) onConfirmPickup(id, lat, lng);
            if (pickingLocation === "delivery" && onConfirmLocation) onConfirmLocation(id, lat, lng);
            setPickingLocation(null);
          }}
          onClose={() => setPickingLocation(null)}
        />
      )}
    </>
  );
}
