"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Bizerte et environs
const BIZERTE_LOCATIONS = [
  { name: "Centre-ville Bizerte", lat: 37.2744, lng: 9.8739 },
  { name: "Port de Bizerte",      lat: 37.2756, lng: 9.8686 },
  { name: "Zarzouna",             lat: 37.2511, lng: 9.8481 },
  { name: "Corniche Bizerte",     lat: 37.2780, lng: 9.8620 },
  { name: "Remel",                lat: 37.2920, lng: 9.8530 },
  { name: "El Azib",              lat: 37.2100, lng: 9.8450 },
  { name: "Menzel Bourguiba",     lat: 37.1532, lng: 9.7987 },
  { name: "Mateur",               lat: 37.0430, lng: 9.6647 },
  { name: "Ras Jebel",            lat: 37.2167, lng: 10.1167 },
  { name: "El Alia",              lat: 37.1667, lng: 9.9833 },
  { name: "Utique",               lat: 37.0536, lng: 10.0531 },
  { name: "Sejnane",              lat: 37.0583, lng: 9.2333 },
  { name: "Joumine",              lat: 37.0333, lng: 9.5333 },
  { name: "Ghezala",              lat: 37.1500, lng: 9.6167 },
];

export function AddDeliveryForm({ isOpen, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    pickupAddress: "",
    pickupLat: "",
    pickupLng: "",
    deliveryAddress: "",
    deliveryLat: "",
    deliveryLng: "",
    notes: "",
    priority: "0",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const setPickup = (loc: { name: string; lat: number; lng: number }) => {
    setForm((f) => ({
      ...f,
      pickupAddress: loc.name,
      pickupLat: loc.lat.toString(),
      pickupLng: loc.lng.toString(),
    }));
  };

  const setDelivery = (loc: { name: string; lat: number; lng: number }) => {
    setForm((f) => ({
      ...f,
      deliveryAddress: loc.name,
      deliveryLat: loc.lat.toString(),
      deliveryLng: loc.lng.toString(),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.pickupLat || !form.pickupLng || !form.deliveryLat || !form.deliveryLng) {
      setError("Veuillez sélectionner les adresses dans les listes");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          pickupLat: parseFloat(form.pickupLat),
          pickupLng: parseFloat(form.pickupLng),
          deliveryLat: parseFloat(form.deliveryLat),
          deliveryLng: parseFloat(form.deliveryLng),
          priority: parseInt(form.priority),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erreur lors de la création");
        return;
      }
      setForm({
        customerName: "", customerPhone: "", pickupAddress: "",
        pickupLat: "", pickupLng: "", deliveryAddress: "",
        deliveryLat: "", deliveryLng: "", notes: "", priority: "0",
      });
      onSuccess();
      onClose();
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nouvelle course de livraison">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Customer info */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Nom client *</label>
            <input
              type="text"
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              placeholder="Mohammed Trabelsi"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Téléphone client</label>
            <input
              type="tel"
              value={form.customerPhone}
              onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
              placeholder="+216 XX XXX XXX"
              className={inputClass}
            />
          </div>
        </div>

        {/* Pickup */}
        <div className="bg-purple-50 rounded-xl p-3">
          <label className="block text-sm font-semibold text-purple-700 mb-2">
            📦 Point de collecte *
          </label>
          <select
            className={inputClass}
            value={form.pickupAddress}
            onChange={(e) => {
              const loc = BIZERTE_LOCATIONS.find((l) => l.name === e.target.value);
              if (loc) setPickup(loc);
            }}
            required
          >
            <option value="">Sélectionner un quartier...</option>
            {BIZERTE_LOCATIONS.map((loc) => (
              <option key={loc.name} value={loc.name}>{loc.name}</option>
            ))}
          </select>
          {form.pickupAddress && (
            <p className="text-xs text-purple-600 mt-1">
              Coordonnées: {parseFloat(form.pickupLat).toFixed(4)}, {parseFloat(form.pickupLng).toFixed(4)}
            </p>
          )}
        </div>

        {/* Delivery */}
        <div className="bg-orange-50 rounded-xl p-3">
          <label className="block text-sm font-semibold text-orange-700 mb-2">
            🏠 Adresse de livraison *
          </label>
          <select
            className={inputClass}
            value={form.deliveryAddress}
            onChange={(e) => {
              const loc = BIZERTE_LOCATIONS.find((l) => l.name === e.target.value);
              if (loc) setDelivery(loc);
            }}
            required
          >
            <option value="">Sélectionner un quartier...</option>
            {BIZERTE_LOCATIONS.map((loc) => (
              <option key={loc.name} value={loc.name}>{loc.name}</option>
            ))}
          </select>
          {form.deliveryAddress && (
            <p className="text-xs text-orange-600 mt-1">
              Coordonnées: {parseFloat(form.deliveryLat).toFixed(4)}, {parseFloat(form.deliveryLng).toFixed(4)}
            </p>
          )}
        </div>

        {/* Priority & notes */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Priorité</label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className={inputClass}
            >
              <option value="0">Normale</option>
              <option value="1">Haute</option>
              <option value="2">Urgente</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Notes</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Instructions spéciales..."
              className={inputClass}
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-orange-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-600 disabled:opacity-50"
          >
            {loading ? "Création..." : "Créer la course"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
