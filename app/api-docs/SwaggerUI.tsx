"use client";

import { useEffect, useRef, useState } from "react";

const SWAGGER_VERSION = "5.17.14";
const CSS_URL = `https://unpkg.com/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui.css`;
const BUNDLE_URL = `https://unpkg.com/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui-bundle.js`;
const PRESET_URL = `https://unpkg.com/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui-standalone-preset.js`;

type SwaggerUIConstructor = (config: Record<string, unknown>) => unknown;

declare global {
  interface Window {
    SwaggerUIBundle?: SwaggerUIConstructor & {
      presets: { apis: unknown };
      plugins: { DownloadUrl: unknown };
    };
    SwaggerUIStandalonePreset?: unknown;
  }
}

function loadStylesheet(href: string) {
  if (document.querySelector(`link[data-swagger="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.swagger = href;
  document.head.appendChild(link);
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-swagger="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.swagger = src;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    });
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
    document.head.appendChild(script);
  });
}

export default function SwaggerUI({ specUrl }: { specUrl: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        loadStylesheet(CSS_URL);
        await loadScript(BUNDLE_URL);
        await loadScript(PRESET_URL);
        if (cancelled || !containerRef.current || !window.SwaggerUIBundle) return;

        window.SwaggerUIBundle({
          url: specUrl,
          domNode: containerRef.current,
          deepLinking: true,
          docExpansion: "list",
          defaultModelsExpandDepth: 1,
          tryItOutEnabled: true,
          persistAuthorization: true,
          withCredentials: true,
          requestSnippetsEnabled: true,
          syntaxHighlight: { activate: true, theme: "agate" },
          presets: [
            window.SwaggerUIBundle.presets.apis,
            window.SwaggerUIStandalonePreset,
          ],
          plugins: [window.SwaggerUIBundle.plugins.DownloadUrl],
          layout: "BaseLayout",
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load Swagger UI");
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [specUrl]);

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF8", fontFamily: "Inter, sans-serif" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "#0A0A0A",
          color: "#FFFFFF",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
          <img src="/logo.jpg" alt="Lakoud" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <div style={{ lineHeight: 1.1 }}>
          <div
            style={{
              fontFamily: "Archivo, sans-serif",
              fontWeight: 800,
              fontSize: 15,
              letterSpacing: "-0.02em",
            }}
          >
            LAKOUD <span style={{ color: "#FF3B2F", fontStyle: "italic" }}>API</span>
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
            OpenAPI 3.0 · Interactive Reference
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <a
            href={specUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: 12,
              padding: "8px 14px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              color: "#FFFFFF",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            spec.json
          </a>
          <a
            href="/"
            style={{
              fontSize: 12,
              padding: "8px 14px",
              borderRadius: 999,
              background: "#FF3B2F",
              color: "#FFFFFF",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            ← Dashboard
          </a>
        </div>
      </header>

      {error ? (
        <div
          style={{
            margin: "40px auto",
            maxWidth: 640,
            padding: 24,
            background: "rgba(255,59,47,0.08)",
            border: "1px solid rgba(255,59,47,0.2)",
            borderRadius: 12,
            color: "#FF3B2F",
            fontSize: 14,
          }}
        >
          <strong>Impossible de charger Swagger UI :</strong> {error}
        </div>
      ) : (
        <div
          ref={containerRef}
          id="swagger-ui"
          style={{ background: "#FFFFFF" }}
        />
      )}
    </div>
  );
}
