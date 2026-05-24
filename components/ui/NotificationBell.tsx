"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { getPusherClient, ADMIN_CHANNEL, EVENTS } from "@/lib/pusher-client";
import { Bell } from "lucide-react";
import Link from "next/link";

interface Props {
  activeAlerts: number;
}

export function NotificationBell({ activeAlerts }: Props) {
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [pulse, setPulse] = useState(false);
  const pathname = usePathname();

  // Load unread count from API (persistent DB)
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const notifs: { read: boolean }[] = await res.json();
        setUnreadNotifs(notifs.filter((n) => !n.read).length);
      }
    } catch { /* silent */ }
  }, []);

  // Re-fetch whenever the user navigates away from the alerts page
  useEffect(() => {
    fetchUnreadCount();
  }, [pathname, fetchUnreadCount]);

  // Listen to Pusher delivery events to bump count in real-time
  useEffect(() => {
    const client = getPusherClient();
    const channel = client.subscribe(ADMIN_CHANNEL);

    const bump = () => {
      setUnreadNotifs((prev) => prev + 1);
      setPulse(true);
      setTimeout(() => setPulse(false), 2500);
    };

    channel.bind(EVENTS.DELIVERY_ACKNOWLEDGED, bump);
    channel.bind(EVENTS.DELIVERY_REFUSED, bump);
    channel.bind(EVENTS.DELIVERY_ARRIVED, bump);
    channel.bind(EVENTS.DELIVERIES_UPDATED, (d: { status?: string }) => {
      if (d.status === "picked_up" || d.status === "delivered") bump();
    });
    channel.bind(EVENTS.ALERTS_NEW, () => {
      setPulse(true);
      setTimeout(() => setPulse(false), 2500);
    });

    return () => {
      channel.unbind_all();
      client.unsubscribe(ADMIN_CHANNEL);
    };
  }, []);

  const total = activeAlerts + unreadNotifs;
  const hasNew = total > 0;

  return (
    <Link
      href="/alerts"
      title={hasNew ? `${total} notification${total > 1 ? "s" : ""}` : "Notifications"}
      className="relative flex items-center justify-center rounded-xl transition-all"
      style={{
        width: 38,
        height: 38,
        background: hasNew ? "rgba(255,59,47,0.08)" : "#F4F4F4",
        border: hasNew ? "1.5px solid rgba(255,59,47,0.20)" : "1.5px solid #E8E8E8",
      }}
    >
      {/* Pulse ring when new notification arrives */}
      {pulse && (
        <span
          className="absolute inset-0 rounded-xl animate-ping"
          style={{ background: "rgba(255,59,47,0.15)" }}
        />
      )}

      <Bell
        size={16}
        style={{
          color: hasNew ? "#FF3B2F" : "#8A8A8A",
          transition: "color 0.2s",
        }}
        strokeWidth={hasNew ? 2.5 : 2}
      />

      {/* Badge */}
      {hasNew && (
        <span
          className="absolute flex items-center justify-center text-white font-bold leading-none"
          style={{
            top: -6,
            right: -6,
            minWidth: total > 9 ? 20 : 17,
            height: 17,
            fontSize: 10,
            borderRadius: 999,
            background: "#FF3B2F",
            border: "2px solid white",
            paddingInline: total > 9 ? 4 : 0,
            fontFamily: "Archivo, sans-serif",
          }}
        >
          {total > 99 ? "99+" : total}
        </span>
      )}

      {/* Sub-badge for GPS alerts */}
      {activeAlerts > 0 && unreadNotifs > 0 && (
        <span
          className="absolute flex items-center justify-center text-white font-bold leading-none"
          style={{
            bottom: -5,
            right: -5,
            width: 14,
            height: 14,
            fontSize: 8,
            borderRadius: 999,
            background: "#FFB800",
            border: "2px solid white",
            fontFamily: "Archivo, sans-serif",
          }}
          title={`${activeAlerts} alerte(s) GPS`}
        >
          !
        </span>
      )}
    </Link>
  );
}
