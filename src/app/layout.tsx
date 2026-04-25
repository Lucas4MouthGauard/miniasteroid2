import type { Metadata } from "next";
import "@rainbow-me/rainbowkit/styles.css";
import { Roboto } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Asteroid",
  description:
    "Asteroid quest board with mint quota tracking, Base mint payments, and automatic token delivery.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${roboto.variable} h-full antialiased`}>
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
