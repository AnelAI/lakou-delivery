interface Props {
  size?: number;
  variant?: "icon" | "full" | "login";
}

export function LakouLogo({ size = 36, variant = "icon" }: Props) {
  if (variant === "login") {
    return (
      <div className="flex flex-col items-center gap-3">
        <div
          style={{ width: 96, height: 96 }}
          className="rounded-full overflow-hidden bg-black shadow-xl shadow-blue-500/30 ring-2 ring-blue-400/40"
        >
          <img
            src="/logo.jpg"
            alt="Lakoud Delivery Express"
            width={96}
            height={96}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="text-center">
          <div className="text-2xl font-black text-white tracking-tight">
            <span className="text-blue-300">L</span>akou{" "}
            <span className="text-white">Delivery</span>
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
          className="rounded-full overflow-hidden bg-black flex-shrink-0 shadow-md shadow-blue-500/20"
        >
          <img
            src="/logo.jpg"
            alt="Lakoud Delivery Express"
            width={size}
            height={size}
            className="w-full h-full object-cover"
          />
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
      className="rounded-full overflow-hidden bg-black flex-shrink-0 shadow-md shadow-blue-500/20"
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
