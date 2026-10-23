/**
 * Right-sized copies of news images, for hosts that take the size in the URL: a card asks
 * for a small copy, the article hero for a sharp one. Other hosts are left alone
 * (VnExpress and The Guardian sign their image URLs, so their sizes cannot be changed).
 */
export function imageSrcSet(src?: string): string | undefined {
  if (!src) return undefined;
  try {
    const u = new URL(src);
    // https://e0.365dm.com/26/10/1920x1080/name.jpg
    if (/(^|\.)365dm\.com$/.test(u.hostname) && /\/\d{3,4}x\d{3,4}\//.test(u.pathname)) {
      const at = (w: number, h: number) => src.replace(/\/\d{3,4}x\d{3,4}\//, `/${w}x${h}/`);
      return `${at(384, 216)} 384w, ${at(768, 432)} 768w, ${at(1600, 900)} 1600w`;
    }
    // ArchDaily: .../newsletter/x.jpg is 750px; .../slideshow/x.jpg is about 1600px
    if (/(^|\.)adsttc\.com$/.test(u.hostname) && /\/(?:newsletter|(?:medium|large)_jpg)\//.test(u.pathname)) {
      const at = (size: string) => src.replace(/\/(?:newsletter|(?:medium|large)_jpg)\//, `/${size}/`);
      return `${at("newsletter")} 750w, ${at("slideshow")} 1582w`;
    }
  } catch {}
  return undefined;
}

/** Image servers too slow for browsers to load a gallery from; served through /api/img. */
export const SLOW_IMAGE_HOSTS = new Set(["cms.abduzeedo.com"]);

/** The URL to put in <img src>: slow hosts go through our image relay. */
export function imgSrc(src: string): string;
export function imgSrc(src?: string): string | undefined;
export function imgSrc(src?: string) {
  if (!src) return src;
  try {
    if (SLOW_IMAGE_HOSTS.has(new URL(src).hostname)) return `/api/img?u=${encodeURIComponent(src)}`;
  } catch {}
  return src;
}

/** Image widths on screen: full width on phones, a grid column or the hero on desktop. */
export const SIZES = {
  card: "(max-width: 520px) 100vw, (max-width: 1024px) 50vw, 300px",
  hero: "(max-width: 760px) 100vw, 720px",
};
