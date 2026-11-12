import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/library", "/categories", "/extension", "/api/"] },
    sitemap: "https://auto-bookmark.vercel.app/sitemap.xml",
  };
}
