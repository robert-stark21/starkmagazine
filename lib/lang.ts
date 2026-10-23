import { cookies } from "next/headers";
import type { Lang } from "./sources";

export async function getLang(): Promise<Lang> {
  const c = (await cookies()).get("lang")?.value;
  return c === "en" ? "en" : "vi";
}

/** Kindle (e-ink) reading mode, chosen with the header switch and kept in a cookie. */
export async function getKindle(): Promise<boolean> {
  return (await cookies()).get("mode")?.value === "kindle";
}

export const UI = {
  vi: {
    tagline: "Tin tức tổng hợp, cập nhật mỗi 10 phút",
    home: "Trang chủ",
    top: "Tin nổi bật",
    latest: "Mới nhất",
    seeAll: "Xem tất cả",
    all: "Tất cả",
    vn: "Việt Nam",
    intl: "Quốc tế",
    updated: "Cập nhật lúc",
    minRead: "phút đọc",
    summary: "Tóm tắt nhanh",
    readOriginal: "Đọc bài gốc tại",
    translatedFrom: "Đã dịch tự động sang tiếng Việt",
    noArticles: "Chưa lấy được tin cho mục này. Thử lại sau ít phút.",
    back: "Quay lại",
    related: "Cùng chuyên mục",
    fullUnavailable: "Không lấy được toàn văn bài viết, đang hiển thị phần mô tả từ nguồn.",
    sources: "nguồn",
    sourceLabel: "Nguồn",
    publishedLabel: "Đăng lúc",
    readingLabel: "Thời gian đọc",
    openOriginal: "Mở bài gốc",
    ago: { m: "phút trước", h: "giờ trước", d: "ngày trước", now: "vừa xong" },
  },
  en: {
    tagline: "Curated news, refreshed every 10 minutes",
    home: "Home",
    top: "Top stories",
    latest: "Latest",
    seeAll: "See all",
    all: "All",
    vn: "Vietnam",
    intl: "International",
    updated: "Updated at",
    minRead: "min read",
    summary: "Quick summary",
    readOriginal: "Read the original at",
    translatedFrom: "Machine-translated to English",
    noArticles: "No stories loaded for this section yet. Try again in a few minutes.",
    back: "Back",
    related: "More in this section",
    fullUnavailable: "Could not load the full article, showing the source description instead.",
    sources: "sources",
    sourceLabel: "Source",
    publishedLabel: "Published",
    readingLabel: "Reading time",
    openOriginal: "Open original",
    ago: { m: "min ago", h: "h ago", d: "d ago", now: "just now" },
  },
} as const;

export function timeAgo(iso: string, lang: Lang): string {
  const t = UI[lang].ago;
  const diff = (Date.now() - new Date(iso).getTime()) / 60000;
  if (diff < 1) return t.now;
  if (diff < 60) return `${Math.floor(diff)} ${t.m}`;
  if (diff < 1440) return `${Math.floor(diff / 60)} ${t.h}`;
  return `${Math.floor(diff / 1440)} ${t.d}`;
}
