/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  serverExternalPackages: ["linkedom", "@mozilla/readability", "rss-parser"],
  // League logos in the scores ticker rarely change: let browsers keep them for a week.
  async headers() {
    return [{ source: "/leagues/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }] }];
  },
};
