/**
 * Smaller copies of news images. Sky Sports takes the size in the URL, so a card can ask
 * for a 384px or 768px copy instead of the 1920px original. Other hosts are left alone
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
  } catch {}
  return undefined;
}

/** Image widths on screen: full width on phones, a grid column or the hero on desktop. */
export const SIZES = {
  card: "(max-width: 520px) 100vw, (max-width: 1024px) 50vw, 300px",
  hero: "(max-width: 760px) 100vw, 720px",
};
