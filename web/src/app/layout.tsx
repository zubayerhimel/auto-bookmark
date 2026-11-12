import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import type { Metadata, Viewport } from "next";
import { Inter, Literata } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const description =
  "Save pages, posts on X and YouTube videos in one click. AI summarizes and files them; find them again by describing them.";

export const metadata: Metadata = {
  metadataBase: new URL("https://auto-bookmark.vercel.app"),
  title: { default: "Auto Bookmark", template: "%s · Auto Bookmark" },
  description,
  applicationName: "Auto Bookmark",
  keywords: ["bookmarks", "bookmark manager", "AI", "read later", "YouTube", "X", "Chrome extension", "semantic search"],
  openGraph: {
    type: "website",
    siteName: "Auto Bookmark",
    title: "Auto Bookmark: save anything once, find it by describing it",
    description,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Auto Bookmark: save anything once, find it by describing it",
    description,
  },
  appleWebApp: { title: "Auto Bookmark", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#e9edf1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("antialiased", inter.variable, literata.variable)}>
      <body className="min-h-dvh">
        <ClerkProvider
          signInFallbackRedirectUrl="/library"
          signUpFallbackRedirectUrl="/library"
          appearance={{ theme: shadcn, variables: { colorInput: "var(--card)" } }}
        >
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster position="top-center" />
        </ClerkProvider>
      </body>
    </html>
  );
}
