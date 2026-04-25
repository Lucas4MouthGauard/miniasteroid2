"use client";

import Image from "next/image";
import { PropsWithChildren, useState } from "react";
import { RainbowKitProvider, midnightTheme, type AvatarComponent } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";

const MascotAvatar: AvatarComponent = ({ size }) => (
  <span
    style={{
      display: "block",
      position: "relative",
      width: size,
      height: size,
      borderRadius: "999px",
      overflow: "hidden",
      background: "transparent",
    }}
  >
    <Image
      src="/mini-asteroid-logo.png"
      alt="Asteroid avatar"
      fill
      unoptimized
      sizes={`${size}px`}
      style={{ objectFit: "contain" }}
    />
  </span>
);

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          appInfo={{
            appName: "Asteroid",
            learnMoreUrl: "https://x.com/base_asteroid",
          }}
          avatar={MascotAvatar}
          modalSize="compact"
          showRecentTransactions={false}
          theme={midnightTheme({
            accentColor: "#c8b9ff",
            accentColorForeground: "#1b1630",
            borderRadius: "large",
            fontStack: "system",
            overlayBlur: "small",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
