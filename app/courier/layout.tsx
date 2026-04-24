import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Lakou Delivery — Coursier",
  description: "Application de tracking GPS pour les coursiers Lakou Delivery",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Lakou",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#1d4ed8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function CourierLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="manifest" href="/manifest.json" />
      <script dangerouslySetInnerHTML={{ __html: `
        if ('serviceWorker' in navigator) {
          window.addEventListener('load', function() {
            navigator.serviceWorker.register('/sw.js', { scope: '/courier/' })
              .catch(function(e) { console.warn('SW registration failed', e); });
          });
        }
      `}} />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        {children}
      </div>
    </>
  );
}
