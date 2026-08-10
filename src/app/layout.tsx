import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { TRPCProvider } from "@/lib/trpc-provider";
import "./globals.css";

// Stripe's UI typeface is a proprietary Sohne derivative; Inter is the
// closest freely-licensed match (same grotesque-sans family, similar
// metrics) and is what most Stripe-inspired design systems use in practice.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Event Venue Studio",
  description: "Discover premium event venues and design hall layouts in 2D and 3D.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
