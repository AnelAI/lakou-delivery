"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/";

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
   console.log("Submitting login form with password", password);
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        console.log("Login successful, redirecting to", redirect);
        router.push(redirect);
        // router.refresh();
      } else {
        const data = await res.json();
        setError(data.error ?? "Erreur de connexion");
      }
    } catch {
      setError("Erreur réseau, veuillez réessayer");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "Inter, sans-serif", background: "#0A0A0A" }}>
      {/* Left — brand panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 48, position: "relative", overflow: "hidden" }} className="hidden md:flex">
        {/* Speed-line background */}
        <div style={{ position: "absolute", inset: "-20%", backgroundImage: "repeating-linear-gradient(-18deg, rgba(255,59,47,0.07) 0 2px, transparent 2px 40px)" }} />

        {/* Logo */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
            <img src="/logo.jpg" alt="Lakoud" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div style={{ lineHeight: 1 }}>
            <div style={{ fontFamily: "Archivo, sans-serif", fontWeight: 800, fontSize: 16, color: "#FFFFFF", letterSpacing: "-0.02em" }}>LAKOUD</div>
            <div style={{ fontFamily: "Archivo, sans-serif", fontStyle: "italic", fontSize: 11, color: "#FF3B2F", fontWeight: 700, marginTop: 2 }}>ADMIN</div>
          </div>
        </div>

        {/* Headline */}
        <div style={{ position: "relative" }}>
          <div style={{ fontFamily: "Archivo, sans-serif", fontWeight: 900, fontSize: 52, lineHeight: 0.95, color: "#FFFFFF", letterSpacing: "-0.03em" }}>
            Bienvenue<br />
            <span style={{ fontStyle: "italic", color: "#FF3B2F" }}>à bord.</span>
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginTop: 14 }}>
            Plateforme d&apos;administration Lakoud Delivery Express.
          </div>
        </div>

        {/* Stats */}
        <div style={{ position: "relative", display: "flex", gap: 32 }}>
          {[["4", "Coursiers actifs"], ["23", "Livrées auj."], ["99.1%", "Taux livraison"]].map(([v, l]) => (
            <div key={l}>
              <div style={{ fontFamily: "Archivo, sans-serif", fontWeight: 800, fontSize: 24, color: "#FFFFFF" }}>{v}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right — form */}
      <div style={{ width: "100%", maxWidth: 420, background: "#FAFAF8", display: "flex", flexDirection: "column", justifyContent: "center", padding: "48px 40px" }} className="md:w-[420px] md:max-w-none">
        {/* Mobile logo */}
        <div className="flex md:hidden items-center gap-3 mb-8">
          <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden" }}>
            <img src="/logo.jpg" alt="Lakoud" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div>
            <div style={{ fontFamily: "Archivo, sans-serif", fontWeight: 800, fontSize: 14, color: "#0A0A0A" }}>LAKOUD</div>
            <div style={{ fontFamily: "Archivo, sans-serif", fontStyle: "italic", fontSize: 10, color: "#FF3B2F", fontWeight: 700 }}>ADMIN</div>
          </div>
        </div>

        <div style={{ fontFamily: "Archivo, sans-serif", fontWeight: 800, fontSize: 26, letterSpacing: "-0.02em", marginBottom: 6, color: "#0A0A0A" }}>
          Connexion
        </div>
        <div style={{ fontSize: 13, color: "#5A5A5A", marginBottom: 32 }}>
          Accès réservé aux administrateurs.
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, color: "#5A5A5A", marginBottom: 6 }}>
              MOT DE PASSE
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoFocus
              style={{ width: "100%", padding: "12px 14px", background: "#FFFFFF", border: "1.5px solid #E8E8E8", borderRadius: 12, fontSize: 14, color: "#0A0A0A", outline: "none", boxSizing: "border-box" }}
              onFocus={(e) => (e.target.style.borderColor = "#0A0A0A")}
              onBlur={(e) => (e.target.style.borderColor = "#E8E8E8")}
            />
          </div>

          {error && (
            <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(255,59,47,0.08)", border: "1px solid rgba(255,59,47,0.2)", borderRadius: 10, fontSize: 13, color: "#FF3B2F", display: "flex", alignItems: "center", gap: 8 }}>
              <span>⚠️</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            style={{ width: "100%", padding: 14, background: loading || !password ? "#8A8A8A" : "#0A0A0A", color: "#FFFFFF", border: "none", borderRadius: 12, fontFamily: "Archivo, sans-serif", fontWeight: 800, fontSize: 15, cursor: loading || !password ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Connexion…
              </>
            ) : (
              <>
                Se connecter
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 8h8M9 5l3 3-3 3"/></svg>
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: 24, padding: "12px 14px", background: "#F4F4F4", borderRadius: 12, fontSize: 11, color: "#5A5A5A", textAlign: "center" }}>
          🔒 Accès sécurisé · Lakoud Delivery Express
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
