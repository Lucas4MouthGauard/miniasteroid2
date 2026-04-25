"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ChevronDown, Wallet } from "lucide-react";

export function ConnectWalletButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        mounted,
        openAccountModal,
        openChainModal,
        openConnectModal,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        if (!ready) {
          return (
            <button className="primary-button px-5" disabled type="button">
              <Wallet className="h-4 w-4" />
              Connect Wallet
            </button>
          );
        }

        if (!connected) {
          return (
            <button className="primary-button px-5" onClick={openConnectModal} type="button">
              <Wallet className="h-4 w-4" />
              Connect Wallet
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button className="secondary-button px-5" onClick={openChainModal} type="button">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-300 shadow-[0_0_14px_rgba(253,164,175,0.7)]" />
              Wrong Network
            </button>
          );
        }

        return (
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button className="secondary-button px-4" onClick={openChainModal} type="button">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(74,222,128,0.8)]" />
              {chain.name ?? "Wallet"}
            </button>
            <button className="primary-button px-5" onClick={openAccountModal} type="button">
              <Wallet className="h-4 w-4" />
              <span>{account.displayName}</span>
              {account.displayBalance ? (
                <span className="rounded-full bg-black/20 px-2 py-0.5 text-[11px] text-white/90">
                  {account.displayBalance}
                </span>
              ) : null}
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
