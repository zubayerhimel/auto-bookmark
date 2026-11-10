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

export const metadata: Metadata = {
  title: "Auto Bookmark",
  description: "Save pages, posts on X and YouTube videos in one click. AI summarizes and files them; find them again by describing them.",
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
