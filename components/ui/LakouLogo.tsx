interface Props {
  size?: number;
  variant?: "icon" | "full" | "login";
}

export function LakouLogo({ size = 36, variant = "icon" }: Props) {
  if (variant === "login") {
    return (
      <div className="flex flex-col items-center gap-3">
        {/* Grande icône D */}
        <div
          style={{ width: 72, height: 72 }}
          className="rounded-2xl bg-blue-600 flex items-center justify-center shadow-xl shadow-blue-500/30"
        >
          <LogoD size={48} />
        </div>
        <div className="text-center">
          <div className="text-2xl font-black text-white tracking-tight">
            <span className="text-blue-300">L</span>akou{" "}
            <span className="text-white relative inline-block">
              <span className="relative z-10">D</span>
              <span className="absolute inset-0 text-blue-400 translate-x-0.5 translate-y-0.5 z-0 select-none">D</span>
            </span>elivery
          </div>
          <div className="text-blue-300 text-sm font-medium tracking-widest uppercase mt-0.5">
            Administration
          </div>
        </div>
      </div>
    );
  }

  if (variant === "full") {
    return (
      <div className="flex items-center gap-2.5">
        <div
          style={{ width: size, height: size }}
          className="rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20"
        >
          <LogoD size={size * 0.62} />
        </div>
        <div className="flex items-baseline gap-1 leading-none">
          <span className="font-black text-gray-800 text-base tracking-tight">
            Lakou
          </span>
          <span className="font-black text-blue-600 text-base tracking-tight">
            Delivery
          </span>
        </div>
      </div>
    );
  }

  // icon only
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20"
    >
      <LogoD size={size * 0.62} />
    </div>
  );
}

/* ── Le "D" SVG ── */
function LogoD({ size }: { size: number }) {
  const s = size;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 48 48"
      fill="none"
    >
      {/* Barre verticale gauche */}
      <rect x="7" y="5" width="9" height="38" rx="3" fill="white" />

      {/* Courbe du D — forme en C qui se ferme sur la barre */}
      <path
        d="M16 5 C16 5 43 5 43 24 C43 43 16 43 16 43"
        stroke="white"
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />

      {/* Trait intérieur du D — créé l'espace vide */}
      <path
        d="M16 14 C16 14 34 14 34 24 C34 34 16 34 16 34"
        stroke="#2563eb"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />

      {/* Petite puce de vitesse en bas à droite — signature */}
      <circle cx="38" cy="38" r="3.5" fill="white" opacity="0.5" />
      <circle cx="30" cy="42" r="2.5" fill="white" opacity="0.3" />
    </svg>
  );
}
