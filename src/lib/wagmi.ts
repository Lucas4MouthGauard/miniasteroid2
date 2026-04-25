"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { createConfig, http, injected } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const chains = [base, baseSepolia] as const;

export const wagmiConfig = walletConnectProjectId
  ? getDefaultConfig({
      appName: "Asteroid",
      appDescription: "Asteroid quest board and mint panel",
      appUrl,
      appIcon: `${appUrl}/mini-asteroid-logo.png`,
      projectId: walletConnectProjectId,
      ssr: true,
      chains,
    })
  : createConfig({
      chains,
      ssr: true,
      connectors: [injected()],
      transports: {
        [base.id]: http(),
        [baseSepolia.id]: http(),
      },
    });

export const isWalletConnectConfigured = Boolean(walletConnectProjectId);
