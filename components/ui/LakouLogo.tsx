interface Props {
  size?: number;
  variant?: "icon" | "full" | "login";
}

export function LakouLogo({ size = 36, variant = "icon" }: Props) {
  if (variant === "login") {
    return (
      <div className="flex items-center gap-3">
        <div
          style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}
        >
          <img
            src="/logo.jpg"
            alt="Lakoud Delivery Express"
            width={44}
            height={44}
            className="w-full h-full object-cover"
          />
        </div>
        <div style={{ lineHeight: 1 }}>
          <div style={{ fontFamily: "Archivo, sans-serif", fontWeight: 800, fontSize: 16, color: "#FFFFFF", letterSpacing: "-0.02em" }}>
            LAKOUD
          </div>
          <div style={{ fontFamily: "Archivo, sans-serif", fontStyle: "italic", fontSize: 11, color: "#FF3B2F", fontWeight: 700, marginTop: 2 }}>
            ADMIN
          </div>
        </div>
      </div>
    );
  }

  if (variant === "full") {
    return (
      <div className="flex items-center gap-2.5">
        <div
          style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}
        >
          <img
            src="/logo.jpg"
            alt="Lakoud Delivery Express"
            width={size}
            height={size}
            className="w-full h-full object-cover"
          />
        </div>
        <div style={{ lineHeight: 1 }}>
          <div style={{ fontFamily: "Archivo, sans-serif", fontWeight: 800, fontSize: 14, letterSpacing: "-0.02em", color: "#0A0A0A" }}>
            LAKOUD
          </div>
          <div style={{ fontFamily: "Archivo, sans-serif", fontStyle: "italic", fontSize: 10, color: "#FF3B2F", fontWeight: 700, marginTop: 1 }}>
            ADMIN
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}
    >
      <img
        src="/logo.jpg"
        alt="Lakoud Delivery Express"
        width={size}
        height={size}
        className="w-full h-full object-cover"
      />
    </div>
  );
}
