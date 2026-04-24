"use client";

import { useEffect, useState } from "react";
import { MapPin, Bike, ArrowRight } from "lucide-react";
import Link from "next/link";

// Landing page: courier enters their ID or scans QR
// In production, the admin would give each courier their direct link
export default function CourierLandingPage() {
  const [savedId, setSavedId] = useState<string | null>(null);
  const [inputId, setInputId] = useState("");

  useEffect(() => {
    console.log("Checking for saved courier ID in localStorage");
    const id = localStorage.getItem("lakou_courier_id");
    if (id) setSavedId(id);
  }, []);

  const handleSave = () => {
    if (inputId.trim()) {
      localStorage.setItem("lakou_courier_id", inputId.trim());
      window.location.href = `/courier/${inputId.trim()}`;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-6">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-900/50">
          <Bike size={40} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white">Lakou Delivery</h1>
        <p className="text-gray-400 mt-1">Application Coursier</p>
      </div>

      {savedId ? (
        <div className="w-full max-w-sm space-y-3">
          <Link
            href={`/courier/${savedId}`}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-4 rounded-2xl text-lg font-bold hover:bg-blue-700 active:bg-blue-800 transition-colors"
          >
            <MapPin size={20} />
            Reprendre le tracking
            <ArrowRight size={20} />
          </Link>
          <button
            onClick={() => { localStorage.removeItem("lakou_courier_id"); setSavedId(null); }}
            className="w-full text-gray-500 text-sm py-2"
          >
            Changer de compte
          </button>
        </div>
      ) : (
        <div className="w-full max-w-sm space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Entrez votre identifiant coursier
            </label>
            <input
              type="text"
              value={inputId}
              onChange={(e) => setInputId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="ID fourni par votre admin..."
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-600"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={!inputId.trim()}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl text-lg font-bold hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            Démarrer
          </button>
          <p className="text-center text-xs text-gray-600">
            Votre admin vous a fourni un lien direct — utilisez-le directement.
          </p>
        </div>
      )}
    </div>
  );
}
