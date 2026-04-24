"use client";

import { useState } from "react";
import type { Courier, Delivery } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  X, MapPin, Package, Phone, Clock, Truck, FileText,
  AlertTriangle, User, CheckCircle, XCircle, DollarSign, Pencil,
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

const PRIORITY_META: Record<number, { label: string; color: string }> = {
  0: { label: "Normale",  color: "text-gray-500 bg-gray-100" },
  1: { label: "Haute",    color: "text-orange-600 bg-orange-50" },
  2: { label: "Urgente",  color: "text-red-600 bg-red-50" },
};

export function DeliveryDetailModal({
  delivery, couriers, onClose, onAssign, onStatusChange, onConfirmLocation, onConfirmPickup,
}: Props) {
  const [assigning, setAssigning]             = useState(false);
  const [pickingLocation, setPickingLocation] = useState<"pickup" | "delivery" | null>(null);
  const [partnerInput, setPartnerInput]       = useState(
    delivery.pickupAddress !== "Better Call Motaz" ? delivery.pickupAddress : ""
  );
  const [savedPickupAddress, setSavedPickupAddress] = useState(delivery.pickupAddress);
  const [confirmedPickupCoords, setConfirmedPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [savingPartner, setSavingPartner] = useState(false);

  // Price editing
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput]     = useState(delivery.price?.toString() ?? "");
  const [savingPrice, setSavingPrice]   = useState(false);
  const [currentPrice, setCurrentPrice] = useState<number | null>(delivery.price ?? null);

  const available = couriers.filter((c) => ["available", "busy"].includes(c.status));
  const status    = STATUS_META[delivery.status] ?? STATUS_META.pending;
  const priority  = PRIORITY_META[delivery.priority] ?? PRIORITY_META[0];
  const isLibre   = !delivery.merchantId;

  const savePartnerName = async () => {
    setSavingPartner(true);
    const newAddress = partnerInput.trim() || "Better Call Motaz";
    try {
      await fetch(`/api/deliveries/${delivery.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickupAddress: newAddress }),
      });
      setSavedPickupAddress(newAddress);
      if (partnerInput.trim() && onConfirmPickup) onConfirmPickup(delivery.id, delivery.pickupLat, delivery.pickupLng);
    } finally {
      setSavingPartner(false);
    }
  };

  const savePrice = async () => {
    setSavingPrice(true);
    try {
      const res = await fetch(`/api/deliveries/${delivery.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-price", price: priceInput ? parseFloat(priceInput) : null }),
      });
      if (res.ok) {
        setCurrentPrice(priceInput ? parseFloat(priceInput) : null);
        setEditingPrice(false);
      }
    } finally {
      setSavingPrice(false);
    }
  };

  const doAssign = (courierId: string) => { onAssign(delivery.id, courierId); onClose(); };
  const doAction = (action: string)    => { onStatusChange(delivery.id, action); onClose(); };

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
                {delivery.priority > 0 && (
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${priority.color}`}>
                    ⚡ {priority.label}
                  </span>
                )}
                {delivery.locationConfirmed === false && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-amber-700 bg-amber-50">
                    📍 À localiser
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

            {/* Contact + meta */}
            <div className="space-y-2">
              {delivery.customerPhone && (
                <a
                  href={`tel:${delivery.customerPhone}`}
                  className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 hover:bg-gray-100 transition-colors"
                >
                  <Phone size={16} className="text-blue-500 flex-shrink-0" />
                  <span className="text-sm font-semibold text-blue-600">{delivery.customerPhone}</span>
                </a>
              )}
              <div className="flex items-center gap-3 text-xs text-gray-400 px-1 flex-wrap">
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {formatDistanceToNow(new Date(delivery.createdAt), { addSuffix: true, locale: fr })}
                </span>
                {delivery.distance && <span>· {delivery.distance} km</span>}
                {delivery.estimatedTime && <span>· ~{delivery.estimatedTime} min</span>}
              </div>
            </div>

            {/* Prix de livraison */}
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between border-b border-gray-200">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                  <DollarSign size={13} />
                  PRIX DE LIVRAISON
                </div>
                {!editingPrice && (
                  <button
                    onClick={() => { setEditingPrice(true); setPriceInput(currentPrice?.toString() ?? ""); }}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                  >
                    <Pencil size={11} /> Modifier
                  </button>
                )}
              </div>
              <div className="px-4 py-3">
                {editingPrice ? (
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <DollarSign size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={priceInput}
                        onChange={(e) => setPriceInput(e.target.value)}
                        placeholder="0.00"
                        autoFocus
                        className="w-full text-sm bg-white border border-gray-200 rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </div>
                    <span className="text-sm text-gray-500 font-medium">DT</span>
                    <button
                      onClick={savePrice}
                      disabled={savingPrice}
                      className="px-3 py-2 bg-gray-900 text-white text-xs font-semibold rounded-lg disabled:opacity-40 hover:bg-gray-800 transition-colors"
                    >
                      {savingPrice ? "..." : "OK"}
                    </button>
                    <button
                      onClick={() => setEditingPrice(false)}
                      className="px-3 py-2 border border-gray-200 text-gray-500 text-xs rounded-lg hover:bg-gray-50"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-gray-800">
                    {currentPrice != null
                      ? <span className="text-green-700">{currentPrice.toFixed(2)} DT</span>
                      : <span className="text-gray-400 italic">Non défini</span>}
                  </p>
                )}
              </div>
            </div>

            {/* Pickup */}
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between border-b border-gray-200">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                  <Package size={13} />
                  POINT DE COLLECTE
                </div>
              </div>

              {isLibre ? (
                <div className="px-4 py-3 space-y-2">
                  <label className="text-xs font-medium text-gray-600">Préciser le nom du partenaire</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={partnerInput}
                      onChange={(e) => setPartnerInput(e.target.value)}
                      placeholder="Ex : Pizzeria Hassan..."
                      className="flex-1 text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-400 transition-colors"
                    />
                    <button
                      onClick={savePartnerName}
                      disabled={savingPartner}
                      className="px-3 py-2 bg-gray-900 text-white text-xs font-semibold rounded-lg disabled:opacity-40 hover:bg-gray-800 transition-colors flex-shrink-0"
                    >
                      {savingPartner ? "..." : "Valider"}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400">ou</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                  <button
                    onClick={() => setPickingLocation("pickup")}
                    className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-600 text-xs font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <MapPin size={13} />
                    Localiser sur la carte
                  </button>
                  {confirmedPickupCoords && (
                    <a
                      href={`https://maps.google.com/?q=${confirmedPickupCoords.lat},${confirmedPickupCoords.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 hover:bg-green-100 transition-colors font-mono"
                    >
                      <MapPin size={11} className="text-green-500 flex-shrink-0" />
                      {confirmedPickupCoords.lat.toFixed(6)}, {confirmedPickupCoords.lng.toFixed(6)}
                      <span className="text-green-400 ml-1">↗</span>
                    </a>
                  )}
                </div>
              ) : (
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
                      className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-100 transition-colors font-mono"
                    >
                      <MapPin size={11} className="text-gray-400 flex-shrink-0" />
                      {delivery.pickupLat.toFixed(6)}, {delivery.pickupLng.toFixed(6)}
                      <span className="text-gray-400 ml-1">↗</span>
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Delivery location */}
            <div className="rounded-2xl border border-orange-100 overflow-hidden">
              <div className="bg-orange-50 px-4 py-2.5 flex items-center justify-between border-b border-orange-100">
                <div className="flex items-center gap-2 text-xs font-bold text-orange-700">
                  <MapPin size={13} />
                  ADRESSE DE LIVRAISON
                </div>
                {onConfirmLocation && (
                  <button
                    onClick={() => setPickingLocation("delivery")}
                    className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                      delivery.locationConfirmed === false
                        ? "bg-orange-500 text-white hover:bg-orange-600"
                        : "border border-orange-300 text-orange-600 hover:bg-orange-100"
                    }`}
                  >
                    {delivery.locationConfirmed === false ? "Localiser sur la carte" : "Modifier position"}
                  </button>
                )}
              </div>
              <div className="px-4 py-3 space-y-2">
                <p className="text-sm text-gray-800 font-medium">{delivery.deliveryAddress}</p>

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

            {/* Assigned courier */}
            {delivery.courier && (
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <Truck size={15} className="text-gray-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 font-medium">Coursier assigné</p>
                  <p className="text-sm font-semibold text-gray-800">{delivery.courier.name}</p>
                  {delivery.courier.phone && (
                    <a href={`tel:${delivery.courier.phone}`} className="text-xs text-blue-500 hover:underline">
                      {delivery.courier.phone}
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Assign section */}
            {delivery.status === "pending" && (
              <div className="space-y-2">
                {isLibre && savedPickupAddress === "Better Call Motaz" && !confirmedPickupCoords && (
                  <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs text-gray-500">
                    <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    Renseignez le partenaire de collecte avant d&apos;assigner un coursier.
                  </div>
                )}
                {!assigning ? (
                  <button
                    onClick={() => setAssigning(true)}
                    disabled={isLibre && savedPickupAddress === "Better Call Motaz" && !confirmedPickupCoords}
                    className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl py-3.5 text-sm transition-colors"
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
            if (pickingLocation === "pickup") {
              setConfirmedPickupCoords({ lat, lng });
              if (onConfirmPickup) onConfirmPickup(id, lat, lng);
            }
            if (pickingLocation === "delivery" && onConfirmLocation) onConfirmLocation(id, lat, lng);
            setPickingLocation(null);
          }}
          onClose={() => setPickingLocation(null)}
        />
      )}
    </>
  );
}
