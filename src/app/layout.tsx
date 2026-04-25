import type { Metadata } from "next";
import "@rainbow-me/rainbowkit/styles.css";
import { Calistoga, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const calistoga = Calistoga({
  variable: "--font-calistoga",
  subsets: ["latin"],
  weight: "400",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "AAVE Donation Claim",
  description:
    "Donation eligibility, X task checks, and one-time token claim.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${calistoga.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="preload" as="image" href="/space-bg.jpg" fetchPriority="high" />
        <link rel="preload" as="image" href="/mini-asteroid-logo.png" />
      </head>
      <body className="min-h-full">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
