import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Literata, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

const grotesk = Schibsted_Grotesk({
  variable: "--font-grotesk",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${grotesk.variable} ${literata.variable} antialiased`}>
      <body className="min-h-dvh">
        <ClerkProvider
          signInFallbackRedirectUrl="/library"
          signUpFallbackRedirectUrl="/library"
          appearance={{
            variables: {
              colorPrimary: "#2446c7",
              colorForeground: "#1b2430",
              colorMutedForeground: "#4a5565",
              colorDanger: "#b42318",
              colorBackground: "#f9fafb",
              fontFamily: "var(--font-grotesk), system-ui, sans-serif",
              borderRadius: "0.75rem",
            },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
