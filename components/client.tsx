"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { imgSrc } from "@/lib/img";

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

export function Thumb({
  src,
  alt,
  color,
  label,
  priority = false,
  srcSet,
  sizes,
}: {
  src?: string;
  alt: string;
  color: string;
  label: string;
  priority?: boolean;
  srcSet?: string;
  sizes?: string;
}) {
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    // The image may have loaded or failed before React attached its handlers.
    const img = ref.current;
    if (img?.complete) img.naturalWidth === 0 ? setBroken(true) : setLoaded(true);
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
      <img
        ref={ref}
        src={imgSrc(src)}
        srcSet={srcSet}
        sizes={srcSet ? sizes : undefined}
        alt={alt}
        // The hero shows at once; lazy images fade in when they arrive.
        className={priority ? undefined : `fade${loaded ? " in" : ""}`}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setBroken(true)}
      />
    </div>
  );
}

/**
 * Shown when a page rendered before its translations were ready: refreshes once a few
 * seconds later, when the background translation has filled the cache. At most twice per page.
 */
export function RefreshSoon({ ms = 4000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    const key = `refresh:${location.pathname}${location.search}`;
    let tries = 0;
    try {
      tries = Number(sessionStorage.getItem(key) ?? 0);
    } catch {}
    if (tries >= 2) return;
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem(key, String(tries + 1));
      } catch {}
      router.refresh();
    }, ms);
    return () => clearTimeout(t);
  }, [router, ms]);
  return null;
}

type VTDocument = Document & { startViewTransition?: (cb: () => Promise<void>) => { finished: Promise<void> } };

/**
 * Resolves once test() is true, or after maxMs. Polls with setTimeout: the browser pauses
 * requestAnimationFrame while a view transition waits for the new page.
 */
function waitFor(test: () => boolean, maxMs = 700) {
  const start = performance.now();
  return new Promise<void>((done) => {
    const check = () => (test() || performance.now() - start > maxMs ? done() : setTimeout(check, 16));
    check();
  });
}

/**
 * Card → article transition with the View Transitions API. The list fades away while the
 * clicked card's title moves and grows into the article headline; then the article body
 * fades up. Going back reverses it: the headline shrinks into its card and the list returns.
 * Browsers without the API, modified clicks and reduced motion get a normal navigation.
 */
export function CardTransitions() {
  const router = useRouter();
  const pathname = usePathname();
  const target = useRef<string | null>(null);
  // "vt-arrived" swaps the page's own entrance animation for the article body stagger.
  // It goes away on the next navigation that isn't a card transition.
  useEffect(() => {
    if (pathname !== target.current) document.documentElement.classList.remove("vt-arrived");
    target.current = null;
  }, [pathname]);

  useEffect(() => {
    const doc = document as VTDocument;
    if (!doc.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    let last: { list: string; article: string } | null = null;

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.<HTMLAnchorElement>("a.cover[href^='/a/']");
      if (!link || link.target) return;
      const href = link.getAttribute("href")!;
      if (href === location.pathname) return;
      const title = link.querySelector<HTMLElement>("h3");
      if (!title) return;
      e.preventDefault();
      // Exactly one element may carry the name: the clicked card's title, not the current headline.
      document.querySelector<HTMLElement>(".detail h1")?.style.setProperty("view-transition-name", "none");
      title.style.viewTransitionName = "vt-title";
      last = { list: location.pathname + location.search, article: href };
      target.current = href;
      root.classList.add("vt-arrived");
      root.classList.remove("vt-back");
      doc.startViewTransition!(async () => {
        title.style.viewTransitionName = "";
        router.push(href);
        await waitFor(() => location.pathname === href && !!document.querySelector(".detail h1"));
      });
    };

    // Back from the article to the list it was opened from: the headline shrinks into its card.
    // Next redraws the list before a view transition could capture the article, so this
    // direction is a hand-made FLIP: a copy of the headline flies to the card title.
    type NavEvent = Event & { navigationType: string; destination: { url: string } };
    const nav = (window as any).navigation as EventTarget | undefined;
    const onNavigate = (ev: Event) => {
      const e = ev as NavEvent;
      if (!last || e.navigationType !== "traverse" || location.pathname !== last.article) return;
      const dest = new URL(e.destination.url);
      if (dest.pathname + dest.search !== last.list) return;
      const { article } = last;
      last = null;
      const h1 = document.querySelector<HTMLElement>(".detail h1");
      if (!h1) return;
      const from = h1.getBoundingClientRect();
      const cs = getComputedStyle(h1);
      const ghost = h1.cloneNode(true) as HTMLElement;
      ghost.removeAttribute("class");
      Object.assign(ghost.style, {
        position: "fixed", left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, margin: "0",
        font: cs.font, letterSpacing: cs.letterSpacing, lineHeight: cs.lineHeight, color: cs.color,
        transformOrigin: "0 0", zIndex: "100", pointerEvents: "none", viewTransitionName: "none",
      } as Partial<CSSStyleDeclaration>);
      document.body.appendChild(ghost);
      root.classList.add("vt-back");
      const sel = `a.cover[href='${article}'] h3`;
      void waitFor(() => location.pathname !== article && !!document.querySelector(sel), 800).then(async () => {
        await new Promise((r) => setTimeout(r, 30)); // let Next restore the scroll position
        const card = document.querySelector<HTMLElement>(sel);
        const to = card?.getBoundingClientRect();
        if (!card || !to || to.bottom < 0 || to.top > innerHeight) {
          ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 }).finished.finally(() => ghost.remove());
          root.classList.remove("vt-back");
          return;
        }
        card.style.opacity = "0";
        const s = to.width / from.width;
        const move = ghost.animate(
          [{ transform: "none" }, { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${s})` }],
          { duration: 550, easing: "cubic-bezier(.65, 0, .35, 1)", fill: "forwards" }
        );
        await move.finished.catch(() => {});
        card.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 }).finished.finally(() => card.style.removeProperty("opacity"));
        ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "forwards" }).finished.finally(() => ghost.remove());
        root.classList.remove("vt-back");
      });
    };

    // Capture phase: runs before Next's <Link>, which then skips the click (defaultPrevented).
    document.addEventListener("click", onClick, true);
    nav?.addEventListener("navigate", onNavigate);
    return () => {
      document.removeEventListener("click", onClick, true);
      nav?.removeEventListener("navigate", onNavigate);
    };
  }, [router]);
  return null;
}

/**
 * Cursor spotlight on cards (after React Bits' SpotlightCard). One listener for the whole
 * page sets the pointer position on the hovered card; the glow itself is pure CSS.
 */
export function Spotlight() {
  useEffect(() => {
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const card = (e.target as Element | null)?.closest?.<HTMLElement>(".card:not(.compact)");
        if (!card) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - r.left}px`);
        card.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", onMove);
    };
  }, []);
  return null;
}

/** An image from the original article; hides itself if it fails to load. */
export function ProseImage({ src, caption, drawing = false }: { src: string; caption?: string; drawing?: boolean }) {
  const [broken, setBroken] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setBroken(true);
  }, [src]);
  if (broken) return null;
  return (
    <figure className={`prose-img${drawing ? " drawing" : ""}`}>
      <img ref={ref} src={imgSrc(src)} alt={caption ?? ""} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

/** Plays an HLS stream (.m3u8): natively in Safari, with hls.js elsewhere. */
export function HlsVideo({ src, poster }: { src: string; poster?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }
    let hls: import("hls.js").default | undefined;
    let cancelled = false;
    import("hls.js").then(({ default: Hls }) => {
      if (cancelled || !Hls.isSupported()) return;
      hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
    });
    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [src]);
  return <video ref={ref} poster={poster} controls preload="none" playsInline />;
}

/** Keeps the active category tab in view on narrow screens, where the menu scrolls sideways. */
export function ActiveTab() {
  useEffect(() => {
    const row = document.querySelector<HTMLElement>(".cats .row");
    const on = row?.querySelector<HTMLElement>("a.on");
    if (!row || !on) return;
    const left = on.offsetLeft - (row.clientWidth - on.offsetWidth) / 2;
    row.scrollTo({ left: Math.max(0, left), behavior: "instant" as ScrollBehavior });
  });
  return null;
}
