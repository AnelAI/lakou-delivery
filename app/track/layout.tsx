import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Suivi de commande — Better Call Motaz",
  description: "Suivez votre livraison en temps réel",
};

export const viewport: Viewport = {
  themeColor: "#f97316",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
