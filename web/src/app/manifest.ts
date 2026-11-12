import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Auto Bookmark",
    short_name: "Bookmarks",
    description: "Save anything once. Find it by describing it.",
    start_url: "/library",
    display: "standalone",
    background_color: "#e9edf1",
    theme_color: "#e9edf1",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
