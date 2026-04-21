"use client";

import { CheckCircle, Package, MapPin, X } from "lucide-react";

export type ToastType = "acknowledged" | "picked_up" | "delivered";

export interface ToastData {
  id: string;
  type: ToastType;
  courierName: string;
  orderNumber: string;
  customerName: string;
}

const TYPE_META: Record<ToastType, { icon: React.ReactNode; label: string; color: string }> = {
  acknowledged: { icon: <CheckCircle size={16} />, label: "A pris en compte la course", color: "text-blue-400" },
  picked_up:    { icon: <Package size={16} />,    label: "Colis récupéré",              color: "text-purple-400" },
  delivered:    { icon: <MapPin size={16} />,     label: "Course livrée ✓",             color: "text-green-400" },
};

interface Props {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-4 right-4 z-[2000] flex flex-col gap-2 w-72">
      {toasts.map((t) => {
        const meta = TYPE_META[t.type];
        return (
          <div key={t.id} className="flex items-start gap-3 bg-gray-900 border border-gray-700 text-white px-4 py-3 rounded-xl shadow-xl">
            <span className={`flex-shrink-0 mt-0.5 ${meta.color}`}>{meta.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{t.courierName}</p>
              <p className={`text-xs mt-0.5 ${meta.color}`}>{meta.label}</p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{t.orderNumber} · {t.customerName}</p>
            </div>
            <button onClick={() => onDismiss(t.id)} className="flex-shrink-0 text-gray-500 hover:text-white transition-colors mt-0.5">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
