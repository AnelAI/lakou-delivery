"use client";

import { useEffect, useRef, useState } from "react";
import { Search, MapPin, CheckCircle, X } from "lucide-react";

interface Suggestion {
  label: string;
  lat: number;
  lng: number;
}

interface Props {
  value: string;
  placeholder?: string;
  confirmed?: boolean;
  borderColor?: string;
  bgColor?: string;
  onTextChange: (text: string) => void;
  onPlaceSelect: (address: string, lat: number, lng: number) => void;
  onClear?: () => void;
}

export function PlacesInput({
  value, placeholder, confirmed = false,
  borderColor = "#E5E7EB", bgColor = "#FAFAFA",
  onTextChange, onPlaceSelect, onClear,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);

  // Sync controlled value → DOM input
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value;
    }
  }, [value]);

  const fetchSuggestions = async (text: string) => {
    if (!text || text.length < 2) { setSuggestions([]); setOpen(false); return; }
    try {
      setFetching(true);
      // Viewbox: Bizerte governorate bounding box (lng_min, lat_min, lng_max, lat_max)
      const url = `https://nominatim.openstreetmap.org/search?` + new URLSearchParams({
        q: text,
        countrycodes: "tn",
        viewbox: "9.4,36.9,10.2,37.55",
        bounded: "1",
        format: "json",
        limit: "6",
        addressdetails: "0",
        "accept-language": "fr",
      });
      const res = await fetch(url, { headers: { "User-Agent": "LakoudDelivery/1.0" } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any[] = await res.json();
      const results: Suggestion[] = data.map(item => ({
        label: item.display_name as string,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      }));
      setSuggestions(results);
      setOpen(results.length > 0);
    } catch (err) {
      console.warn("[PlacesInput] Nominatim error:", err);
    } finally {
      setFetching(false);
    }
  };

  const handleChange = (text: string) => {
    onTextChange(text);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(text), 350);
  };

  const handleSelect = (s: Suggestion) => {
    setOpen(false);
    setSuggestions([]);
    if (inputRef.current) inputRef.current.value = s.label;
    onPlaceSelect(s.label, s.lat, s.lng);
  };

  const handleClear = () => {
    if (inputRef.current) inputRef.current.value = "";
    setSuggestions([]); setOpen(false);
    onClear?.();
  };

  return (
    <div className="relative">
      {/* Leading icon */}
      <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
        {confirmed
          ? <CheckCircle size={13} style={{ color: "#10B981" }} />
          : <Search size={13} style={{ color: "#9CA3AF" }} />}
      </span>

      {/* Input (uncontrolled DOM, synced via useEffect) */}
      <input
        ref={inputRef}
        type="text"
        defaultValue={value}
        placeholder={placeholder ?? "Rechercher une adresse…"}
        autoComplete="off"
        onChange={e => handleChange(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        className="w-full pl-9 pr-9 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
        style={{
          border: `1px solid ${confirmed ? "#6EE7B7" : borderColor}`,
          background: confirmed ? "#F0FDF4" : bgColor,
        }}
      />

      {/* Trailing area */}
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {fetching && (
          <span className="w-3.5 h-3.5 rounded-full border-2 border-indigo-200 border-t-indigo-500 animate-spin block" />
        )}
        {confirmed && !fetching && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "#D1FAE5", color: "#059669" }}>
            GPS
          </span>
        )}
        {value && onClear && !fetching && (
          <button type="button" onMouseDown={handleClear} className="p-0.5 rounded hover:bg-gray-100">
            <X size={11} style={{ color: "#9CA3AF" }} />
          </button>
        )}
      </span>

      {/* Suggestions dropdown */}
      {open && suggestions.length > 0 && (
        <div
          className="absolute z-9999 mt-1 w-full bg-white rounded-xl shadow-2xl overflow-y-auto"
          style={{ border: "1px solid #E5E7EB", maxHeight: 230 }}
        >
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => handleSelect(s)}
              className="w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-indigo-50"
            >
              <MapPin size={12} className="mt-0.5 shrink-0" style={{ color: "#6366F1" }} />
              <span className="text-sm leading-snug line-clamp-2" style={{ color: "#111827" }}>{s.label}</span>
            </button>
          ))}
          <div className="px-3 py-1.5 text-right" style={{ borderTop: "1px solid #F5F5F5" }}>
            <span className="text-[10px]" style={{ color: "#C4C4C4" }}>© OpenStreetMap</span>
          </div>
        </div>
      )}
    </div>
  );
}
