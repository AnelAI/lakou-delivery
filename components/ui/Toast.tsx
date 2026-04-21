"use client";

import { useEffect } from "react";
import { CheckCircle, X } from "lucide-react";

export interface ToastData {
  id: string;
  courierName: string;
  orderNumber: string;
  customerName: string;
}

interface Props {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: Props) {
  return (
    <div className="fixed top-4 right-4 z-[2000] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function Toast({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div className="flex items-start gap-3 bg-gray-900 border border-gray-700 text-white px-4 py-3 rounded-xl shadow-xl" style={{ animation: "slideIn 0.2s ease-out" }}>
      <CheckCircle size={18} className="text-green-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{toast.courierName}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          A pris en compte · {toast.orderNumber}
        </p>
        <p className="text-xs text-gray-500 truncate">{toast.customerName}</p>
      </div>
      <button onClick={() => onDismiss(toast.id)} className="flex-shrink-0 text-gray-500 hover:text-white transition-colors">
        <X size={14} />
      </button>
    </div>
  );
}
