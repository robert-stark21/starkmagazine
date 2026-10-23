"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function LangToggle({ lang }: { lang: "vi" | "en" }) {
  const router = useRouter();
  const set = (l: "vi" | "en") => {
    document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };
  return (
    <div className="lang" role="group" aria-label="Language">
      <button className={lang === "vi" ? "on" : ""} onClick={() => set("vi")}>VI</button>
      <button className={lang === "en" ? "on" : ""} onClick={() => set("en")}>EN</button>
    </div>
  );
}

/** Re-renders the page every 10 minutes so new stories appear without a reload. */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}

export function Thumb({ src, alt, color, label }: { src?: string; alt: string; color: string; label: string }) {
  const [broken, setBroken] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    // The image may have failed before React attached onError.
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setBroken(true);
  }, [src]);
  if (!src || broken) {
    return (
      <div className="thumb ph" style={{ background: `linear-gradient(135deg, ${color}22, ${color}55)` }}>
        <span style={{ color }}>{label}</span>
      </div>
    );
  }
  return (
    <div className="thumb" style={{ background: `linear-gradient(135deg, ${color}22, ${color}55)` }}>
      <img ref={ref} src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
    </div>
  );
}
