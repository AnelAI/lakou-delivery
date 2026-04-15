import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Better Call Motaz — Livraison à Bizerte",
  description: "Commandez votre livraison et suivez-la en temps réel. Rapide, fiable, à Bizerte.",
  manifest: "/manifest-order.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Better Call Motaz",
  },
};

export const viewport: Viewport = {
  themeColor: "#f97316",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Override manifest + apple icon for the customer app */}
      {/* These go into <head> via Next.js metadata — extra tags below */}
      {children}
    </>
  );
}
