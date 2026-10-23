export type Lang = "vi" | "en";

export type Category = {
  slug: string;
  vi: string;
  en: string;
  color: string;
};

export type Source = {
  name: string;
  url: string;
  category: string;
  lang: Lang;
  region: "vn" | "intl";
};

export const CATEGORIES: Category[] = [
  { slug: "cong-nghe", vi: "Công nghệ", en: "Tech", color: "#2563eb" },
  { slug: "crypto", vi: "Crypto", en: "Crypto", color: "#f59e0b" },
  { slug: "tai-chinh", vi: "Tài chính", en: "Finance", color: "#059669" },
  { slug: "the-thao", vi: "Thể thao", en: "Sports", color: "#dc2626" },
  { slug: "design", vi: "Design", en: "Design", color: "#9333ea" },
  { slug: "ui-ux", vi: "UI/UX", en: "UI/UX", color: "#db2777" },
  { slug: "noi-that", vi: "Nội thất", en: "Interiors", color: "#a16207" },
];

// Add or remove sources here. Feeds that fail are skipped silently.
export const SOURCES: Source[] = [
  // Công nghệ
  { name: "VnExpress Số hóa", url: "https://vnexpress.net/rss/so-hoa.rss", category: "cong-nghe", lang: "vi", region: "vn" },
  { name: "Tuổi Trẻ Nhịp sống số", url: "https://tuoitre.vn/rss/nhip-song-so.rss", category: "cong-nghe", lang: "vi", region: "vn" },
  { name: "Thanh Niên Công nghệ", url: "https://thanhnien.vn/rss/cong-nghe.rss", category: "cong-nghe", lang: "vi", region: "vn" },
  { name: "TechCrunch", url: "https://techcrunch.com/feed/", category: "cong-nghe", lang: "en", region: "intl" },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", category: "cong-nghe", lang: "en", region: "intl" },
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", category: "cong-nghe", lang: "en", region: "intl" },

  // Crypto
  { name: "Tạp chí Bitcoin", url: "https://tapchibitcoin.io/feed", category: "crypto", lang: "vi", region: "vn" },
  { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/", category: "crypto", lang: "en", region: "intl" },
  { name: "Cointelegraph", url: "https://cointelegraph.com/rss", category: "crypto", lang: "en", region: "intl" },
  { name: "Decrypt", url: "https://decrypt.co/feed", category: "crypto", lang: "en", region: "intl" },

  // Tài chính
  { name: "VnExpress Kinh doanh", url: "https://vnexpress.net/rss/kinh-doanh.rss", category: "tai-chinh", lang: "vi", region: "vn" },
  { name: "CafeF Chứng khoán", url: "https://cafef.vn/thi-truong-chung-khoan.rss", category: "tai-chinh", lang: "vi", region: "vn" },
  { name: "Thanh Niên Kinh tế", url: "https://thanhnien.vn/rss/kinh-te.rss", category: "tai-chinh", lang: "vi", region: "vn" },
  { name: "CNBC", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", category: "tai-chinh", lang: "en", region: "intl" },
  { name: "MarketWatch", url: "https://feeds.marketwatch.com/marketwatch/topstories/", category: "tai-chinh", lang: "en", region: "intl" },

  // Thể thao
  { name: "VnExpress Thể thao", url: "https://vnexpress.net/rss/the-thao.rss", category: "the-thao", lang: "vi", region: "vn" },
  { name: "Thanh Niên Thể thao", url: "https://thanhnien.vn/rss/the-thao.rss", category: "the-thao", lang: "vi", region: "vn" },
  { name: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/rss.xml", category: "the-thao", lang: "en", region: "intl" },
  { name: "ESPN", url: "https://www.espn.com/espn/rss/news", category: "the-thao", lang: "en", region: "intl" },

  // Design
  { name: "Dezeen", url: "https://www.dezeen.com/feed/", category: "design", lang: "en", region: "intl" },
  { name: "designboom", url: "https://www.designboom.com/feed/", category: "design", lang: "en", region: "intl" },
  { name: "Creative Bloq", url: "https://www.creativebloq.com/feeds/all", category: "design", lang: "en", region: "intl" },

  // UI/UX
  { name: "Smashing Magazine", url: "https://www.smashingmagazine.com/feed/", category: "ui-ux", lang: "en", region: "intl" },
  { name: "UX Collective", url: "https://uxdesign.cc/feed", category: "ui-ux", lang: "en", region: "intl" },
  { name: "Nielsen Norman Group", url: "https://www.nngroup.com/feed/rss/", category: "ui-ux", lang: "en", region: "intl" },
  { name: "UX Planet", url: "https://uxplanet.org/feed", category: "ui-ux", lang: "en", region: "intl" },

  // Nội thất
  { name: "Kiến Việt", url: "https://kienviet.net/feed/", category: "noi-that", lang: "vi", region: "vn" },
  { name: "Dezeen Interiors", url: "https://www.dezeen.com/interiors/feed/", category: "noi-that", lang: "en", region: "intl" },
  { name: "ArchDaily", url: "https://feeds.feedburner.com/Archdaily", category: "noi-that", lang: "en", region: "intl" },
  { name: "Architectural Digest", url: "https://www.architecturaldigest.com/feed/rss", category: "noi-that", lang: "en", region: "intl" },
];

export function getCategory(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug);
}
