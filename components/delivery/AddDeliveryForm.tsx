"use client";

import { useState, useEffect, useRef } from "react";
import { Modal } from "@/components/ui/Modal";
import { Plus, Trash2, Search, MapPin, X, Package } from "lucide-react";
import type { Merchant } from "@/lib/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: "🍽️", patisserie: "🧁", boucherie: "🥩",
  volaillerie: "🐔", fromagerie: "🧀", supermarche: "🛒",
  pharmacie: "💊", eau: "💧", course: "📦",
};

const BIZERTE_ZONES = [
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
];

interface PickupStop {
  _key: string;
  mode: "merchant" | "text";
  // merchant mode
  query: string;
  merchantId: string | null;
  merchantName: string;
  // resolved address / coords
  address: string;
  lat: string;
  lng: string;
  // order description
  orderNotes: string;
  showDropdown: boolean;
}

function newStop(): PickupStop {
  return {
    _key: Math.random().toString(36).slice(2),
    mode: "merchant",
    query: "",
    merchantId: null,
    merchantName: "",
    address: "",
    lat: "",
    lng: "",
    orderNotes: "",
    showDropdown: false,
  };
}

export function AddDeliveryForm({ isOpen, onClose, onSuccess }: Props) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [stops, setStops] = useState<PickupStop[]>([newStop()]);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryLat, setDeliveryLat] = useState("");
  const [deliveryLng, setDeliveryLng] = useState("");
  const [deliveryZoneSearch, setDeliveryZoneSearch] = useState("");
  const [showDeliveryDropdown, setShowDeliveryDropdown] = useState(false);
  const [priority, setPriority] = useState("0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [merchants, setMerchants] = useState<Merchant[]>([]);

  const deliveryRef = useRef<HTMLDivElement>(null);

  // Fetch merchants once when modal opens
  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/merchants")
      .then((r) => r.ok ? r.json() : [])
      .then((data: Merchant[]) => setMerchants(data.filter((m) => m.active)))
      .catch(() => {});
  }, [isOpen]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setCustomerName(""); setCustomerPhone("");
      setStops([newStop()]);
      setDeliveryAddress(""); setDeliveryLat(""); setDeliveryLng("");
      setDeliveryZoneSearch(""); setShowDeliveryDropdown(false);
      setPriority("0"); setError("");
    }
  }, [isOpen]);

  // ── Stops helpers ──────────────────────────────────────────────────────────
  const updateStop = (key: string, patch: Partial<PickupStop>) =>
    setStops((prev) => prev.map((s) => s._key === key ? { ...s, ...patch } : s));

  const removeStop = (key: string) =>
    setStops((prev) => prev.filter((s) => s._key !== key));

  const addStop = () => setStops((prev) => [...prev, newStop()]);

  const filteredMerchants = (query: string) => {
    const q = query.toLowerCase().trim();
    if (!q) return merchants.slice(0, 8);
    return merchants.filter(
      (m) => m.name.toLowerCase().includes(q) || (m.address ?? "").toLowerCase().includes(q)
    ).slice(0, 8);
  };

  const selectMerchant = (key: string, merchant: Merchant) => {
    updateStop(key, {
      merchantId: merchant.id,
      merchantName: merchant.name,
      query: merchant.name,
      address: merchant.address ?? merchant.name,
      lat: merchant.lat.toString(),
      lng: merchant.lng.toString(),
      showDropdown: false,
    });
  };

  // ── Delivery zone search ───────────────────────────────────────────────────
  const filteredZones = deliveryZoneSearch.trim()
    ? BIZERTE_ZONES.filter((z) => z.name.toLowerCase().includes(deliveryZoneSearch.toLowerCase()))
    : BIZERTE_ZONES;

  const selectZone = (zone: { name: string; lat: number; lng: number }) => {
    setDeliveryAddress(zone.name);
    setDeliveryLat(zone.lat.toString());
    setDeliveryLng(zone.lng.toString());
    setDeliveryZoneSearch(zone.name);
    setShowDeliveryDropdown(false);
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    // Validate stops
    for (const stop of stops) {
      if (!stop.address || !stop.lat || !stop.lng) {
        setError("Veuillez renseigner tous les points de collecte");
        return;
      }
    }
    if (!deliveryAddress || !deliveryLat || !deliveryLng) {
      setError("Veuillez renseigner la localisation du client");
      return;
    }

    setLoading(true);
    try {
      const results = await Promise.all(
        stops.map((stop) =>
          fetch("/api/deliveries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customerName,
              customerPhone,
              pickupAddress: stop.address,
              pickupLat: parseFloat(stop.lat),
              pickupLng: parseFloat(stop.lng),
              deliveryAddress,
              deliveryLat: parseFloat(deliveryLat),
              deliveryLng: parseFloat(deliveryLng),
              notes: stop.orderNotes || null,
              merchantId: stop.merchantId || null,
              category: stop.merchantId
                ? merchants.find((m) => m.id === stop.merchantId)?.category ?? null
                : null,
              priority: parseInt(priority),
            }),
          })
        )
      );

      const failed = results.find((r) => !r.ok);
      if (failed) {
        const data = await failed.json();
        setError(data.error || "Erreur lors de la création");
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white";
  const labelClass = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nouvelle course de livraison">
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Client ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Nom client *</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Mohammed Trabelsi"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Téléphone</label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="+216 XX XXX XXX"
              className={inputClass}
            />
          </div>
        </div>

        {/* ── Points de collecte ─────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={labelClass}>Points de collecte *</label>
            <button
              type="button"
              onClick={addStop}
              className="flex items-center gap-1 text-xs text-blue-600 font-semibold hover:text-blue-700"
            >
              <Plus size={13} /> Ajouter un arrêt
            </button>
          </div>

          <div className="space-y-3">
            {stops.map((stop, idx) => (
              <div key={stop._key} className="bg-purple-50 border border-purple-100 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-700">
                    Arrêt {idx + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    {/* Mode toggle */}
                    <button
                      type="button"
                      onClick={() => updateStop(stop._key, {
                        mode: stop.mode === "merchant" ? "text" : "merchant",
                        query: "", merchantId: null, merchantName: "",
                        address: "", lat: "", lng: "", showDropdown: false,
                      })}
                      className="text-xs text-purple-500 underline"
                    >
                      {stop.mode === "merchant" ? "Saisie libre" : "Chercher marchand"}
                    </button>
                    {stops.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeStop(stop._key)}
                        className="p-1 hover:bg-red-100 rounded-lg transition-colors"
                      >
                        <Trash2 size={13} className="text-red-400" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Merchant search */}
                {stop.mode === "merchant" ? (
                  <div className="relative">
                    <div className="relative">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={stop.query}
                        onChange={(e) => {
                          updateStop(stop._key, {
                            query: e.target.value,
                            merchantId: null,
                            address: "",
                            lat: "",
                            lng: "",
                            showDropdown: true,
                          });
                        }}
                        onFocus={() => updateStop(stop._key, { showDropdown: true })}
                        placeholder={merchants.length > 0 ? "Rechercher un restaurant, pharmacie…" : "Chargement des marchands…"}
                        className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
                      />
                      {stop.query && (
                        <button
                          type="button"
                          onClick={() => updateStop(stop._key, {
                            query: "", merchantId: null, address: "", lat: "", lng: "", showDropdown: false,
                          })}
                          className="absolute right-2 top-1/2 -translate-y-1/2"
                        >
                          <X size={13} className="text-gray-400" />
                        </button>
                      )}
                    </div>

                    {stop.showDropdown && filteredMerchants(stop.query).length > 0 && (
                      <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                        {filteredMerchants(stop.query).map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onMouseDown={() => selectMerchant(stop._key, m)}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-purple-50 text-left"
                          >
                            <span className="text-base">{CATEGORY_EMOJI[m.category] ?? "🏪"}</span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{m.name}</p>
                              {m.address && (
                                <p className="text-xs text-gray-500 truncate">{m.address}</p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {stop.merchantId && (
                      <p className="text-xs text-purple-600 mt-1 flex items-center gap-1">
                        <MapPin size={10} /> {stop.address}
                      </p>
                    )}
                  </div>
                ) : (
                  /* Free text mode */
                  <input
                    type="text"
                    value={stop.address}
                    onChange={(e) => updateStop(stop._key, { address: e.target.value, lat: "37.2744", lng: "9.8739" })}
                    placeholder="Ex: Restaurant Carthage, Rue Ibn Khaldoun…"
                    required
                    className={inputClass}
                  />
                )}

                {/* Order description */}
                <div>
                  <label className="block text-xs text-purple-600 font-medium mb-1">
                    <Package size={10} className="inline mr-1" />
                    Détail de la commande à cet arrêt
                  </label>
                  <input
                    type="text"
                    value={stop.orderNotes}
                    onChange={(e) => updateStop(stop._key, { orderNotes: e.target.value })}
                    placeholder="Ex: 2 pizzas Margherita + 1 boisson…"
                    className={inputClass}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Localisation client ────────────────────────────────────────── */}
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 space-y-2">
          <label className="block text-xs font-bold text-orange-700 uppercase tracking-wide">
            Localisation du client *
          </label>

          {/* Zone search */}
          <div className="relative" ref={deliveryRef}>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={deliveryZoneSearch}
                onChange={(e) => {
                  setDeliveryZoneSearch(e.target.value);
                  setDeliveryAddress(e.target.value);
                  setDeliveryLat("");
                  setDeliveryLng("");
                  setShowDeliveryDropdown(true);
                }}
                onFocus={() => setShowDeliveryDropdown(true)}
                onBlur={() => setTimeout(() => setShowDeliveryDropdown(false), 150)}
                placeholder="Quartier ou zone (Centre-ville, Zarzouna…)"
                className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              />
            </div>

            {showDeliveryDropdown && filteredZones.length > 0 && (
              <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-40 overflow-y-auto">
                {filteredZones.map((z) => (
                  <button
                    key={z.name}
                    type="button"
                    onMouseDown={() => selectZone(z)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-orange-50 text-left"
                  >
                    <MapPin size={12} className="text-orange-400 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{z.name}</span>
                  </button>
                ))}
              </div>
            )}

            {deliveryLat && (
              <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                <MapPin size={10} /> {deliveryAddress}
              </p>
            )}
          </div>

          {/* Free text instructions */}
          <div>
            <label className="block text-xs text-orange-600 font-medium mb-1">
              Instructions supplémentaires pour le livreur
            </label>
            <input
              type="text"
              placeholder="Ex: 3ème étage, sonner 2 fois, GPS partagé par le client…"
              className={inputClass}
              id="deliveryInstructions"
            />
          </div>
        </div>

        {/* ── Priorité ───────────────────────────────────────────────────── */}
        <div>
          <label className={labelClass}>Priorité</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className={inputClass}
          >
            <option value="0">Normale</option>
            <option value="1">Haute</option>
            <option value="2">Urgente</option>
          </select>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        {stops.length > 1 && (
          <p className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
            {stops.length} arrêts → {stops.length} livraisons seront créées pour ce client
          </p>
        )}

        <div className="flex gap-3 pt-1">
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
            className="flex-1 bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 disabled:opacity-50"
          >
            {loading
              ? "Création..."
              : stops.length > 1
              ? `Créer ${stops.length} courses`
              : "Créer la course"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
