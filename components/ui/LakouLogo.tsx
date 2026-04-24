import Image from "next/image";

interface Props {
  size?: number;
  variant?: "icon" | "full" | "login";
}

export function LakouLogo({ size = 36, variant = "icon" }: Props) {
  if (variant === "login") {
    return (
      <div className="flex flex-col items-center gap-3">
        <div
          style={{ width: 112, height: 112 }}
          className="rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-xl shadow-blue-500/30"
        >
          <Image
            src="/logo.jpg"
            alt="Lakoud Delivery Express"
            width={112}
            height={112}
            priority
            className="w-full h-full object-cover"
          />
        </div>
        <div className="text-center">
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
          className="rounded-xl overflow-hidden bg-black flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20"
        >
          <Image
            src="/logo.jpg"
            alt="Lakoud Delivery Express"
            width={size}
            height={size}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex items-baseline gap-1 leading-none">
          <span className="font-black text-gray-800 text-base tracking-tight">
            Lakoud
          </span>
          <span className="font-black text-blue-600 text-base tracking-tight">
            Delivery
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-xl overflow-hidden bg-black flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20"
    >
      <Image
        src="/logo.jpg"
        alt="Lakoud Delivery Express"
        width={size}
        height={size}
        className="w-full h-full object-cover"
      />
    </div>
  );
}
