"use client";

import { useEffect, useState, useCallback } from "react";
import type { Stats } from "@/lib/types";
import { getPusherClient, ADMIN_CHANNEL, EVENTS } from "@/lib/pusher-client";
import { Users, Package, Truck, CheckCircle, AlertTriangle, Clock } from "lucide-react";

interface Props {
  initialStats: Stats;
}

export function StatsBar({ initialStats }: Props) {
  const [stats, setStats] = useState<Stats>(initialStats);

  const refreshStats = useCallback(async () => {
    const res = await fetch("/api/stats");
    if (res.ok) setStats(await res.json());
  }, []);

  useEffect(() => {
    const client = getPusherClient();
    const channel = client.subscribe(ADMIN_CHANNEL);

    const refresh = () => { refreshStats(); };
    channel.bind(EVENTS.DELIVERIES_UPDATED, refresh);
    channel.bind(EVENTS.DELIVERIES_NEW, refresh);
    channel.bind(EVENTS.COURIERS_UPDATED, refresh);
    channel.bind(EVENTS.ALERTS_NEW, refresh);
    channel.bind(EVENTS.ALERTS_UPDATED, refresh);

    const interval = setInterval(refreshStats, 30000);

    return () => {
      channel.unbind_all();
      client.unsubscribe(ADMIN_CHANNEL);
      clearInterval(interval);
    };
  }, [refreshStats]);

  const items = [
    { icon: <Users size={16} />, label: "Coursiers actifs", value: `${stats.activeCouriers}/${stats.totalCouriers}`, color: "text-blue-600", bg: "bg-blue-50" },
    { icon: <Clock size={16} />, label: "En attente", value: stats.pendingDeliveries, color: "text-orange-600", bg: "bg-orange-50" },
    { icon: <Truck size={16} />, label: "En cours", value: stats.activeDeliveries, color: "text-purple-600", bg: "bg-purple-50" },
    { icon: <CheckCircle size={16} />, label: "Livrées aujourd'hui", value: stats.deliveredToday, color: "text-green-600", bg: "bg-green-50" },
    { icon: <AlertTriangle size={16} />, label: "Alertes actives", value: stats.activeAlerts, color: stats.activeAlerts > 0 ? "text-red-600" : "text-gray-400", bg: stats.activeAlerts > 0 ? "bg-red-50" : "bg-gray-50" },
  ];

  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {items.map((item) => (
        <div key={item.label} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${item.bg} flex-shrink-0`}>
          <span className={item.color}>{item.icon}</span>
          <div>
            <div className={`text-lg font-bold leading-none ${item.color}`}>{item.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{item.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
