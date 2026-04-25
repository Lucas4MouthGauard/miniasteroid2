"use client";

import Image from "next/image";
import { parseEther } from "viem";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LoaderCircle,
  Rocket,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { base } from "wagmi/chains";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import { ConnectWalletButton } from "@/components/connect-wallet-button";
import {
  BLESSING_REWARD,
  DEFAULT_QUOTE_COPY,
  DISTRIBUTION_SUPPLY,
  ETH_PER_MINT,
  FAQ_ITEMS,
  LP_SUPPLY,
  MINT_BUNDLES,
  NAV_ITEMS,
  QUIZ_QUESTIONS,
  SOCIAL_TASKS,
  TOKENS_PER_MINT,
  TOTAL_GLOBAL_MINT_CAP,
  TOTAL_TOKEN_SUPPLY,
  type MintBundle,
  type MintBundleId,
  type QuizChoice,
  type SocialTaskId,
} from "@/lib/content";
import {
  EMPTY_ADDRESS_STATE,
  EMPTY_GLOBAL_LEDGER,
  buildMintReceipt,
  calculateEarnedQuota,
  calculateRemainingQuota,
  canVerifyTask,
  evaluateQuiz,
  formatCompactNumber,
  formatEth,
  getTaskCooldownRemaining,
  type AddressQuestState,
  type BlessingResult,
  type GlobalMintLedger,
} from "@/lib/mint";

type MintConfig = {
  x402Mode: "simulation" | "live";
  cap: number;
  tokenPerMint: number;
  paymentRail: string;
  contractAddress: `0x${string}` | null;
  payToAddress: `0x${string}` | null;
  distributionEnabled: boolean;
  distributorWalletAddress: `0x${string}` | null;
  explorerBaseUrl: string;
};

type Notice = {
  tone: "success" | "error" | "info";
  message: string;
};

type AgentResponse = BlessingResult & {
  ok: boolean;
  protocol: string;
  simulated: boolean;
  state?: AddressQuestState;
  globalLedger?: GlobalMintLedger;
  error?: string;
};

type PurchaseApiResponse = {
  ok: boolean;
  mode: "simulation" | "x402-live" | "native-eth-live";
  message: string;
  txLabel: string;
  bundle: MintBundle;
  state: AddressQuestState;
  globalLedger: GlobalMintLedger;
  distribution: DistributionStatusResponse;
  error?: string;
};

type DistributionStatusResponse = {
  ok: true;
  enabled: boolean;
  status: "idle" | "pending" | "submitting" | "submitted" | "confirmed" | "failed" | "simulated";
  purchasedUnits: number;
  deliveredUnits: number;
  pendingUnits: number;
  failedUnits: number;
  cumulativeAmount: string;
  deliveredAmount: string;
  pendingAmount: string;
  tokenContractAddress: `0x${string}` | null;
  distributorWalletAddress: `0x${string}` | null;
  latestTxHash: `0x${string}` | null;
  latestError: string | null;
  message: string;
};

type SnapshotApiResponse = {
  ok: boolean;
  state: AddressQuestState;
  globalLedger: GlobalMintLedger;
  error?: string;
};

type QuizApiResponse = SnapshotApiResponse & {
  result: ReturnType<typeof evaluateQuiz>;
};

const EMPTY_NOTICE: Notice | null = null;

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-3xl space-y-4">
      <span className="inline-flex rounded-full border border-[rgba(232,222,248,0.18)] bg-[rgba(232,222,248,0.1)] px-4 py-2 text-xs uppercase tracking-[0.24em] text-[rgba(255,251,254,0.82)] backdrop-blur-sm">
        {eyebrow}
      </span>
      <h2 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">
        {title}
      </h2>
      <p className="text-base leading-8 text-[rgba(232,222,248,0.74)] md:text-lg">
        {description}
      </p>
    </div>
  );
}

function Pill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "border-[rgba(157,217,191,0.35)] bg-[rgba(157,217,191,0.14)] text-[rgba(240,255,248,0.92)]"
      : tone === "warning"
        ? "border-[rgba(255,216,165,0.3)] bg-[rgba(255,216,165,0.12)] text-[rgba(255,246,236,0.94)]"
        : "border-[rgba(232,222,248,0.18)] bg-[rgba(232,222,248,0.1)] text-[rgba(255,251,254,0.92)]";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium tracking-[0.02em] ${toneClass}`}
    >
      {children}
    </span>
  );
}

function AnswerChoice({
  label,
  copy,
  selected,
  locked,
  onClick,
  avatarSrc,
  avatarAlt,
}: {
  label: string;
  copy: string;
  selected: boolean;
  locked: boolean;
  onClick: () => void;
  avatarSrc?: string;
  avatarAlt?: string;
}) {
  return (
    <button
      type="button"
      disabled={locked}
      onClick={onClick}
      className={`flex min-h-18 w-full items-start gap-3 rounded-[24px] border px-4 py-4 text-left transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${
        selected
          ? "border-[rgba(200,185,255,0.7)] bg-[rgba(200,185,255,0.14)] shadow-[0_20px_60px_rgba(157,120,255,0.16)]"
          : "border-white/10 bg-white/8 hover:border-white/20 hover:bg-white/12"
      } ${locked ? "cursor-default" : "active:scale-[0.98]"}`}
    >
      {avatarSrc ? (
        <span className="relative mt-0.5 h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/12 bg-white/10">
          <Image
            src={avatarSrc}
            alt={avatarAlt ?? label}
            fill
            unoptimized
            sizes="40px"
            className="object-cover"
          />
          <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-[rgba(18,15,30,0.85)] bg-[rgba(232,222,248,0.95)] text-[10px] font-semibold text-[#1d192b]">
            {label}
          </span>
        </span>
      ) : (
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
            selected
              ? "bg-[rgba(232,222,248,0.95)] text-[#1d192b]"
              : "bg-white/12 text-slate-100/85"
          }`}
        >
          {label}
        </span>
      )}
      <span className="text-sm leading-6 text-slate-100/88">{copy}</span>
    </button>
  );
}

function XBadge() {
  return (
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#0f1728] text-white shadow-[0_12px_30px_rgba(0,0,0,0.28)]">
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-[18px] w-[18px] fill-current"
      >
        <path d="M18.244 2H21l-6.02 6.88L22 22h-5.49l-4.3-5.9L7.04 22H4.28l6.44-7.36L2 2h5.63l3.89 5.35zm-.97 18h1.52L6.8 3.9H5.17z" />
      </svg>
    </span>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="surface-card group relative overflow-hidden">
      <div
        aria-hidden="true"
        className={`absolute inset-auto right-0 top-0 h-20 w-20 rounded-full blur-2xl ${accent}`}
      />
      <p className="text-sm uppercase tracking-[0.2em] text-slate-200/62">{label}</p>
      <p className="mt-4 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}

function ProtocolStrip({
  label,
  text,
}: {
  label: string;
  text: React.ReactNode;
}) {
  return (
    <div className="rounded-[26px] border border-white/10 bg-white/7 px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <Pill>{label}</Pill>
        <p className="text-sm font-medium text-white/88">{text}</p>
      </div>
    </div>
  );
}

const EIP_8004_AGENT_URL = "https://8004scan.io/agents/base/45592";

function Eip8004Link() {
  return (
    <a
      href={EIP_8004_AGENT_URL}
      target="_blank"
      rel="noreferrer"
      className="underline decoration-white/55 underline-offset-4 transition-colors duration-300 hover:text-white"
    >
      EIP-8004
    </a>
  );
}

function renderProtocolText(text: string) {
  const marker = "EIP-8004";
  if (!text.includes(marker)) {
    return text;
  }

  const [before, ...rest] = text.split(marker);
  return (
    <>
      {before}
      <Eip8004Link />
      {rest.join(marker)}
    </>
  );
}

export function HomeShell() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId: base.id });
  const { data: walletClient } = useWalletClient();

  const [questState, setQuestState] = useState<AddressQuestState>(
    EMPTY_ADDRESS_STATE(DEFAULT_QUOTE_COPY)
  );
  const [globalLedger, setGlobalLedger] =
    useState<GlobalMintLedger>(EMPTY_GLOBAL_LEDGER);
  const [now, setNow] = useState(() => Date.now());
  const [notice, setNotice] = useState<Notice | null>(EMPTY_NOTICE);
  const [quizMessage, setQuizMessage] = useState<Notice | null>(EMPTY_NOTICE);
  const [mintConfig, setMintConfig] = useState<MintConfig | null>(null);
  const [isScoring, setIsScoring] = useState(false);
  const [agentProtocol, setAgentProtocol] = useState("Base · EIP-8004 Agent");
  const [mintPendingId, setMintPendingId] = useState<MintBundleId | null>(null);
  const [, setMintMessage] = useState<Notice | null>(EMPTY_NOTICE);
  const [distributionStatus, setDistributionStatus] =
    useState<DistributionStatusResponse | null>(null);

  async function refreshState(nextAddress?: string | null) {
    const search = nextAddress ? `?address=${encodeURIComponent(nextAddress)}` : "";

    try {
      const response = await fetch(`/api/state${search}`);
      const payload = (await response.json()) as SnapshotApiResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "State sync failed.");
      }

      setQuestState(payload.state);
      setGlobalLedger(payload.globalLedger);
    } catch {
      if (!nextAddress) {
        setQuestState(EMPTY_ADDRESS_STATE(DEFAULT_QUOTE_COPY));
        setGlobalLedger(EMPTY_GLOBAL_LEDGER);
      }
    }
  }

  function applySnapshot(payload: SnapshotApiResponse) {
    setQuestState(payload.state);
    setGlobalLedger(payload.globalLedger);
  }

  async function refreshDistributionStatus(nextAddress?: string | null) {
    if (!nextAddress) {
      setDistributionStatus(null);
      return null;
    }

    try {
      const response = await fetch(
        `/api/distribution/status?address=${encodeURIComponent(nextAddress)}`
      );
      const payload = (await response.json()) as DistributionStatusResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "Distribution status sync failed.");
      }

      setDistributionStatus(payload);
      return payload;
    } catch {
      setDistributionStatus(null);
      return null;
    }
  }

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    fetch("/api/mint/config")
      .then((response) => response.json())
      .then((data: MintConfig) => {
        setMintConfig(data);
      })
      .catch(() => {
        setMintConfig({
          x402Mode: "simulation",
          cap: TOTAL_GLOBAL_MINT_CAP,
          tokenPerMint: TOKENS_PER_MINT,
          paymentRail: "Base ETH payment",
          contractAddress: null,
          payToAddress: null,
          distributionEnabled: false,
          distributorWalletAddress: null,
          explorerBaseUrl: "https://basescan.org",
        });
      });
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void refreshState(address?.toLowerCase() ?? null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [address]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void refreshDistributionStatus(address?.toLowerCase() ?? null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [address, questState.mintedUsed]);

  useEffect(() => {
    if (
      !address ||
      !distributionStatus ||
      distributionStatus.pendingUnits === 0 ||
      distributionStatus.status === "failed"
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      void refreshDistributionStatus(address.toLowerCase());
    }, 9000);

    return () => window.clearTimeout(timer);
  }, [address, distributionStatus]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const earnedQuota = calculateEarnedQuota(questState);
  const remainingQuota = calculateRemainingQuota(questState);
  const mintedPercent = Math.min(100, (globalLedger.minted / TOTAL_GLOBAL_MINT_CAP) * 100);
  const ethRaised = globalLedger.minted * ETH_PER_MINT;
  const distributedTokens = globalLedger.minted * TOKENS_PER_MINT;
  const globalRemainingMint = Math.max(0, TOTAL_GLOBAL_MINT_CAP - globalLedger.minted);
  const isOnBase = chainId === base.id;
  const socialDone = SOCIAL_TASKS.filter(
    (task) => questState.social[task.id].verified
  ).length;
  const completedMajorTasks = [
    socialDone === 2,
    questState.quizPassed,
    questState.blessingResult?.passed ?? false,
  ].filter(Boolean).length;

  function ensureWallet() {
    if (isConnected && address) {
      return true;
    }

    setNotice({
      tone: "info",
      message: "Connect a wallet first to bind progress to your address and unlock mint quota.",
    });
    return false;
  }

  function updateQuestState(updater: (current: AddressQuestState) => AddressQuestState) {
    setQuestState((current) => updater(current));
  }

  async function handleLaunchSocialTask(taskId: SocialTaskId) {
    if (!ensureWallet() || !address) {
      return;
    }

    const taskDefinition = SOCIAL_TASKS.find((task) => task.id === taskId);
    if (!taskDefinition) {
      return;
    }

    window.open(taskDefinition.href, "_blank", "noopener,noreferrer");

    try {
      const response = await fetch("/api/tasks/social/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          taskId,
        }),
      });

      const payload = (await response.json()) as SnapshotApiResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Task launch could not be recorded.");
      }

      applySnapshot(payload);
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Task launch could not be recorded.",
      });
      return;
    }

    setNotice({
      tone: "info",
      message:
        taskId === "follow"
          ? "The follow page is open. Come back in a moment to verify it."
          : "The quote page is open. Come back in a moment to verify it.",
    });
  }

  async function handleVerifySocialTask(taskId: SocialTaskId) {
    if (!ensureWallet() || !address) {
      return;
    }

    const progress = questState.social[taskId];
    if (!canVerifyTask(progress.launchedAt, now) || progress.verified) {
      return;
    }

    try {
      const response = await fetch("/api/tasks/social/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, taskId }),
      });

      const payload = (await response.json()) as SnapshotApiResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Task verification failed.");
      }

      applySnapshot(payload);
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Task verification failed.",
      });
      return;
    }

    const reward = SOCIAL_TASKS.find((task) => task.id === taskId)?.reward ?? 0;
    setNotice({
      tone: "success",
      message: `${taskId === "follow" ? "Follow task" : "Quote task"} verified. ${reward} mint quota added.`,
    });
  }

  function handleQuizChoice(questionId: number, choice: QuizChoice) {
    if (!ensureWallet()) {
      return;
    }

    if (questState.quizPassed) {
      return;
    }

    updateQuestState((current) => ({
      ...current,
      quizAnswers: {
        ...current.quizAnswers,
        [questionId]: choice,
      },
    }));
  }

  async function handleSubmitQuiz() {
    if (!ensureWallet() || !address) {
      return;
    }

    if (questState.quizPassed) {
      return;
    }

    const result = evaluateQuiz(questState.quizAnswers);

    if (!result.allAnswered) {
      setQuizMessage({
        tone: "error",
        message: "Some answers are still missing. All 8 questions must be answered before submission.",
      });
      return;
    }

    if (!result.passed) {
      setQuizMessage({
        tone: "error",
        message: `${result.wrongIds.length} answer(s) are still incorrect. Task 2 only unlocks after a perfect 8 out of 8.`,
      });
      return;
    }

    try {
      const response = await fetch("/api/tasks/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          answers: questState.quizAnswers,
        }),
      });

      const payload = (await response.json()) as QuizApiResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Quiz submission failed.");
      }

      applySnapshot(payload);
    } catch (error) {
      setQuizMessage({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Quiz submission failed.",
      });
      return;
    }

    setQuizMessage({
      tone: "success",
      message: "The Musk x Liv dialogue task is complete. 8 mint quota unlocked.",
    });
  }

  async function handleBlessingSubmit() {
    if (!ensureWallet() || !address) {
      return;
    }

    if (!questState.blessingText.trim()) {
      setNotice({
        tone: "error",
        message: "Write your blessing first, then start the agent review.",
      });
      return;
    }

    setIsScoring(true);
    setNotice({
      tone: "info",
      message: "The agent is reviewing your blessing. Please wait a moment.",
    });

    try {
      const response = await fetch("/api/agent/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          message: questState.blessingText,
        }),
      });

      const payload = (await response.json()) as AgentResponse;

      if (!response.ok || !payload.ok) {
        throw new Error("Agent review failed.");
      }

      setAgentProtocol(payload.protocol);
      if (payload.state && payload.globalLedger) {
        applySnapshot(payload as SnapshotApiResponse);
      } else {
        updateQuestState((current) => ({
          ...current,
          blessingResult: {
            score: payload.score,
            passed: payload.passed,
            reason: payload.reason,
            checkedAt: Date.now(),
          },
        }));
      }

      setNotice({
        tone: payload.passed ? "success" : "error",
        message: payload.passed
          ? `Blessing approved. The agent gave it ${payload.score}/10 and unlocked ${BLESSING_REWARD} mint quota.`
          : `Blessing not approved yet. The agent gave it ${payload.score}/10.`,
      });
    } catch {
      setNotice({
        tone: "error",
        message: "The agent review endpoint is temporarily unavailable. Please try again shortly.",
      });
    } finally {
      setIsScoring(false);
    }
  }

  async function handleMint(bundle: MintBundle) {
    if (!ensureWallet() || !address) {
      return;
    }

    if (mintPendingId) {
      return;
    }

    if (remainingQuota < bundle.quotaCost) {
      setMintMessage({
        tone: "error",
        message: `You need ${bundle.quotaCost} quota for this bundle. Finish more tasks or choose a smaller mint option.`,
      });
      return;
    }

    if (globalLedger.minted + bundle.quotaCost > TOTAL_GLOBAL_MINT_CAP) {
      setMintMessage({
        tone: "error",
        message: "The global mint cap is almost full, so this bundle is no longer available.",
      });
      return;
    }

    if (mintConfig?.payToAddress && !mintConfig.distributionEnabled) {
      setMintMessage({
        tone: "error",
        message:
          "Automatic delivery is not configured yet, so live mint is paused to avoid collecting ETH without paying out tokens.",
      });
      return;
    }

    setMintPendingId(bundle.id);
    setMintMessage({
      tone: "info",
      message: "Confirm the Base payment in your wallet.",
    });

    try {
      let payload: PurchaseApiResponse;

      if (mintConfig?.payToAddress) {
        if (!walletClient || !publicClient || !isOnBase || !address) {
          throw new Error("Switch to Base mainnet and reconnect your wallet.");
        }

        const activeWalletClient = walletClient;
        const txHash = await activeWalletClient.sendTransaction({
          account: activeWalletClient.account ?? address,
          to: mintConfig.payToAddress,
          value: parseEther(String(bundle.priceEth)),
          chain: base,
        });

        setMintMessage({
          tone: "info",
          message: "Payment sent. Waiting for Base confirmation...",
        });

        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
        });

        if (receipt.status !== "success") {
          throw new Error("The payment did not complete onchain.");
        }

        const liveResponse = await fetch("/api/mint/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address,
            bundleId: bundle.id,
            txHash,
          }),
        });

        payload = (await liveResponse.json()) as PurchaseApiResponse;

        if (!liveResponse.ok || !payload.ok) {
          throw new Error(payload.message || "Base payment confirmation failed.");
        }
      } else {
        const response = await fetch("/api/mint/demo-purchase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address,
            bundleId: bundle.id,
          }),
        });

        payload = (await response.json()) as PurchaseApiResponse;

        if (!response.ok || !payload.ok) {
          throw new Error(payload.message || "Simulated purchase failed.");
        }
      }

      applySnapshot(payload);
      setDistributionStatus(payload.distribution);

      const receipt = buildMintReceipt(bundle, payload.globalLedger.minted);
      const deliveryState = payload.distribution;
      setMintMessage({
        tone:
          deliveryState.failedUnits > 0
            ? "error"
            : deliveryState.pendingUnits > 0
              ? "info"
              : "success",
        message: `${payload.txLabel} · ${receipt.mintedUnits} mint locked in this purchase, and ${receipt.tokenAmount.toLocaleString(
          "en-US"
        )} tokens ${
          deliveryState.failedUnits > 0
            ? "are waiting for a distributor retry."
            : deliveryState.pendingUnits > 0
              ? "are being auto-delivered to your wallet."
              : "have been auto-delivered to your wallet."
        }`,
      });
    } catch (error) {
      setMintMessage({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Mint payment failed. Please try again.",
      });
    } finally {
      setMintPendingId(null);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-transparent text-slate-100">
      <div className="app-background" aria-hidden="true" />
      <div className="grid-overlay" aria-hidden="true" />
      <div className="orb orb-a" aria-hidden="true" />
      <div className="orb orb-b" aria-hidden="true" />
      <div className="orb orb-c" aria-hidden="true" />

      <header className="sticky top-0 z-40 border-b border-white/10 bg-[rgba(18,15,30,0.62)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 md:px-8">
          <a href="#" className="flex items-center gap-4">
            <div className="relative h-14 w-14 overflow-hidden rounded-[20px] border border-[rgba(232,222,248,0.22)] bg-[rgba(232,222,248,0.08)] p-1.5 shadow-[0_20px_60px_rgba(33,24,56,0.35)]">
              <Image
                src="/mini-asteroid-logo.png"
                alt="Asteroid mascot"
                fill
                priority
                unoptimized
                sizes="56px"
                className="object-contain"
              />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-[rgba(232,222,248,0.78)]">
                Asteroid
              </p>
            </div>
          </a>

          <nav className="hidden items-center gap-6 lg:flex">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 text-sm text-slate-200/80 transition-all duration-300 hover:bg-white/8 hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="https://x.com/base_asteroid"
              target="_blank"
              rel="noreferrer"
              aria-label="Open Asteroid on X"
              className="secondary-button h-12 w-12 px-0"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-[18px] w-[18px] fill-current"
              >
                <path d="M18.244 2H21l-6.02 6.88L22 22h-5.49l-4.3-5.9L7.04 22H4.28l6.44-7.36L2 2h5.63l3.89 5.35zm-.97 18h1.52L6.8 3.9H5.17z" />
              </svg>
            </a>
            <ConnectWalletButton />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-16 pt-8 md:px-8 md:pb-24">
        {notice ? (
          <div
            className={`surface-card flex items-start gap-3 ${
              notice.tone === "success"
                ? "border-emerald-300/20"
                : notice.tone === "error"
                  ? "border-rose-300/18"
                  : "border-[rgba(200,185,255,0.2)]"
            }`}
          >
            {notice.tone === "success" ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
            ) : notice.tone === "error" ? (
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-200" />
            ) : (
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[rgba(200,185,255,0.94)]" />
            )}
            <p className="text-sm leading-7 text-slate-100/92">{notice.message}</p>
          </div>
        ) : null}

        <section id="overview" className="hero-shell overflow-hidden">
          <div className="relative grid gap-8 xl:grid-cols-[0.84fr_1.16fr]">
            <div className="flex h-full flex-col gap-12 xl:justify-between xl:gap-20">
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                  <Pill>
                    <Rocket className="h-3.5 w-3.5" />
                    Asteroid
                  </Pill>
                  <Pill tone="success">Base</Pill>
                  <Pill>20 Max / Wallet</Pill>
                </div>

                <div className="space-y-4">
                  <h2 className="text-4xl font-semibold leading-[1.05] tracking-tight text-white md:text-6xl">
                    Asteroid
                  </h2>
                  <p className="max-w-xl text-base leading-7 text-slate-100/74 md:text-lg">
                    Finish 3 tasks and unlock up to 20 mint quota.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Pill>
                    <span className="relative h-4 w-4 overflow-hidden rounded-full bg-black/10">
                      <Image
                        src="/mini-asteroid-logo.png"
                        alt="Asteroid mascot"
                        fill
                        unoptimized
                        sizes="16px"
                        className="object-contain"
                      />
                    </span>
                    Cute Mode
                  </Pill>
                  <Pill>☄️ Asteroid Trail</Pill>
                  <Pill>🚀 Rocket Ready</Pill>
                </div>

                <div className="flex flex-wrap gap-4">
                  <a href="#tasks" className="primary-button px-7">
                    <span className="relative h-5 w-5 overflow-hidden rounded-full bg-black/10">
                      <Image
                        src="/mini-asteroid-logo.png"
                        alt="Asteroid mascot"
                        fill
                        unoptimized
                        sizes="20px"
                        className="object-contain"
                      />
                    </span>
                    Start Tasks
                  </a>
                  <a href="#mint" className="secondary-button px-7">
                    <Rocket className="h-4 w-4" />
                    View Mint
                  </a>
                </div>
              </div>

              <div className="space-y-4 xl:pb-1">
                <div className="space-y-4">
                  <ProtocolStrip
                    label="EIP-8004"
                    text={
                      <>
                        Blessing review via <Eip8004Link />.
                      </>
                    }
                  />
                  <ProtocolStrip
                    label="BASE ETH"
                    text="Mint settles in ETH on Base."
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <StatCard
                    label="Progress"
                    value={`${completedMajorTasks}/3`}
                    accent="bg-[rgba(200,185,255,0.28)]"
                  />
                  <StatCard
                    label="Unlocked"
                    value={`${earnedQuota}/20`}
                    accent="bg-[rgba(232,222,248,0.24)]"
                  />
                  <StatCard
                    label="Available"
                    value={`${remainingQuota}/20`}
                    accent="bg-[rgba(255,216,165,0.2)]"
                  />
                </div>
              </div>
            </div>

            <div id="mint" className="space-y-6">
              <div className="surface-card relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(200,185,255,0.22),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(255,209,106,0.12),transparent_35%)]" />
                <div className="relative space-y-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-200/58">
                        Mint Progress
                      </p>
                      <h3 className="mt-2 text-3xl font-semibold text-white">
                        {mintedPercent.toFixed(2)}%
                      </h3>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-200/54">
                        Total Minted
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {globalLedger.minted}/{TOTAL_GLOBAL_MINT_CAP}
                      </p>
                    </div>
                  </div>

                  <div className="h-4 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#c8b9ff_0%,#e8def8_54%,#ffd8a5_100%)] transition-all duration-700 ease-[cubic-bezier(0.2,0,0,1)]"
                      style={{ width: `${mintedPercent}%` }}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-[22px] bg-white/8 p-4">
                      <p className="text-sm text-slate-200/58">Raised</p>
                      <p className="mt-2 text-xl font-semibold text-white">
                        {ethRaised.toFixed(3)} ETH
                      </p>
                    </div>
                    <div className="rounded-[22px] bg-white/8 p-4">
                      <p className="text-sm text-slate-200/58">Remaining</p>
                      <p className="mt-2 text-xl font-semibold text-white">
                        {globalRemainingMint}
                      </p>
                    </div>
                    <div className="rounded-[22px] bg-white/8 p-4">
                      <p className="text-sm text-slate-200/58">Distributed</p>
                      <p className="mt-2 text-xl font-semibold text-white">
                        {formatCompactNumber(distributedTokens)}
                      </p>
                    </div>
                    <div className="rounded-[22px] bg-white/8 p-4">
                      <p className="text-sm text-slate-200/58">Available</p>
                      <p className="mt-2 text-xl font-semibold text-white">{remainingQuota}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="surface-card space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-200/58">
                      Mint
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">Bundles</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-200/66">
                      1 mint = 20,000 tokens
                    </p>
                  </div>
                  <Pill tone="success">{remainingQuota} Available</Pill>
                </div>

                <div className="grid gap-3">
                  {MINT_BUNDLES.map((bundle) => {
                    const featured = bundle.id === "tenPack";
                    const disabled =
                      !isConnected ||
                      remainingQuota < bundle.quotaCost ||
                      Boolean(mintPendingId && mintPendingId !== bundle.id);

                    return (
                      <div
                        key={bundle.id}
                        className={`rounded-[28px] border p-4 transition-all duration-300 ${
                          featured
                            ? "border-[rgba(200,185,255,0.55)] bg-[rgba(200,185,255,0.12)] md:-translate-y-1"
                            : "border-white/10 bg-white/7 hover:border-white/18 hover:bg-white/10"
                        }`}
                      >
                        <div className="grid gap-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
                          <div className="flex items-center">
                            <Pill>{bundle.label}</Pill>
                          </div>

                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                              <h4 className="text-lg font-semibold text-white">{bundle.title}</h4>
                              <span className="text-sm font-medium text-slate-100/72">
                                {formatEth(bundle.priceEth)}
                              </span>
                            </div>
                            <p className="text-sm leading-6 text-slate-100/70">
                              Uses {bundle.quotaCost} quota ·{" "}
                              {(bundle.quotaCost * TOKENS_PER_MINT).toLocaleString("en-US")} tokens
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleMint(bundle)}
                            disabled={disabled}
                            className={`w-full px-5 md:w-auto ${
                              featured ? "primary-button" : "secondary-button"
                            } disabled:cursor-not-allowed disabled:opacity-45`}
                          >
                            {mintPendingId === bundle.id ? (
                              <>
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                                Processing
                              </>
                            ) : (
                              <>
                                Mint
                                <ArrowRight className="h-4 w-4" />
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            </div>
          </div>
        </section>

        <section id="tasks" className="section-shell space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Pill>Tasks</Pill>
            <Pill tone="success">20 Max</Pill>
          </div>

          <div className="space-y-6">
            <div className="surface-card">
              <div className="grid gap-6 xl:grid-cols-[220px_1fr]">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-200/62">
                    Task 1
                  </p>
                  <h3 className="mt-2 text-2xl font-medium text-white">Social</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-200/68">
                    Follow and quote for 2 quota.
                  </p>
                  <div className="mt-4">
                    <Pill tone={socialDone === 2 ? "success" : "default"}>
                      {socialDone}/2
                    </Pill>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  {SOCIAL_TASKS.map((task) => {
                    const progress = questState.social[task.id];
                    const remainingMs = getTaskCooldownRemaining(progress.launchedAt, now);
                    const canVerify = canVerifyTask(progress.launchedAt, now);
                    const isVerified = progress.verified;

                    return (
                      <div
                        key={task.id}
                        className="rounded-[26px] border border-white/10 bg-white/7 p-5 transition-all duration-300 hover:border-white/18 hover:bg-white/10"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <XBadge />
                            <div>
                              <p className="text-xs uppercase tracking-[0.18em] text-slate-200/48">
                                {task.label}
                              </p>
                              <h4 className="text-lg font-medium text-white">{task.title}</h4>
                              <p className="mt-1 text-sm text-slate-200/64">
                                {task.description}
                              </p>
                            </div>
                          </div>
                          <Pill tone={isVerified ? "success" : "default"}>
                            {isVerified ? "Done" : `${task.reward}`}
                          </Pill>
                        </div>

                        <div className="mt-5 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleLaunchSocialTask(task.id)}
                            disabled={!isConnected}
                            className="primary-button px-5 disabled:opacity-50"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Open Task
                          </button>
                          <button
                            type="button"
                            onClick={() => handleVerifySocialTask(task.id)}
                            disabled={!isConnected || isVerified || !canVerify}
                            className="secondary-button px-5 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/6 disabled:text-slate-200/40"
                          >
                            {isVerified ? (
                              <>
                                <CheckCircle2 className="h-4 w-4" />
                                Verified
                              </>
                            ) : remainingMs > 0 && progress.launchedAt ? (
                              <>
                                <Clock3 className="h-4 w-4" />
                                {Math.ceil(remainingMs / 1000)}s
                              </>
                            ) : (
                              "Verify"
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="surface-card">
              <div className="grid gap-6 xl:grid-cols-[220px_1fr]">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-200/62">
                    Task 2
                  </p>
                  <h3 className="mt-2 text-2xl font-medium text-white">Musk x Liv</h3>
                  <p className="mt-2 text-sm text-slate-200/68">
                    Get all 8 answers correct to unlock 8 quota.
                  </p>
                  <div className="mt-4">
                    <Pill tone={questState.quizPassed ? "success" : "default"}>8 Quota</Pill>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-4">
                    {QUIZ_QUESTIONS.map((question) => {
                      const selected = questState.quizAnswers[question.id];

                      return (
                        <div
                          key={question.id}
                          className="rounded-[28px] border border-white/10 bg-white/7 p-5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <Pill>Question {question.id}</Pill>
                            {questState.quizPassed ? (
                              <Pill tone="success">{question.answerLabel}</Pill>
                            ) : null}
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-[auto_1fr]">
                            <div className="relative h-11 w-11 overflow-hidden rounded-full border border-white/12 bg-white/8">
                              <Image
                                src="/mini-asteroid-logo.png"
                                alt="Liv icon"
                                fill
                                unoptimized
                                sizes="44px"
                                className="object-contain p-1"
                              />
                            </div>
                            <p className="rounded-[24px] border border-white/10 bg-[rgba(255,255,255,0.05)] px-4 py-4 text-sm leading-7 text-slate-100/88">
                              {question.prompt}
                            </p>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <AnswerChoice
                              label="A"
                              copy={question.optionA}
                              selected={selected === "A"}
                              locked={questState.quizPassed}
                              onClick={() => handleQuizChoice(question.id, "A")}
                              avatarSrc="/musk-avatar.jpg"
                              avatarAlt="Musk answer option"
                            />
                            <AnswerChoice
                              label="B"
                              copy={question.optionB}
                              selected={selected === "B"}
                              locked={questState.quizPassed}
                              onClick={() => handleQuizChoice(question.id, "B")}
                              avatarSrc="/musk-avatar.jpg"
                              avatarAlt="Musk answer option"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSubmitQuiz}
                      disabled={!isConnected || questState.quizPassed}
                      className="primary-button px-6 disabled:opacity-55"
                    >
                      {questState.quizPassed ? "Passed" : "Submit Answers"}
                    </button>
                    <Pill tone={questState.quizPassed ? "success" : "warning"}>
                      8 / 8 required
                    </Pill>
                  </div>

                  {quizMessage ? (
                    <div
                      className={`rounded-[24px] border p-4 ${
                        quizMessage.tone === "success"
                          ? "border-emerald-300/20 bg-emerald-300/10"
                          : "border-rose-300/16 bg-rose-300/8"
                      }`}
                    >
                      <p className="text-sm leading-7 text-slate-100/88">
                        {quizMessage.message}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="surface-card">
              <div className="grid gap-6 xl:grid-cols-[220px_1fr]">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-200/62">
                    Task 3
                  </p>
                  <h3 className="mt-2 text-2xl font-medium text-white">For Liv</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-200/68">
                    Write a blessing and pass with 7 or more.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Pill tone={questState.blessingResult?.passed ? "success" : "default"}>
                      {questState.blessingResult
                        ? `${questState.blessingResult.score}/10`
                        : "7+ Pass"}
                    </Pill>
                    <Pill>{renderProtocolText(agentProtocol)}</Pill>
                  </div>
                </div>

                <div className="space-y-4">
                  <textarea
                    rows={7}
                    value={questState.blessingText}
                    onChange={(event) =>
                      updateQuestState((current) => ({
                        ...current,
                        blessingText: event.target.value,
                      }))
                    }
                    className="input-shell min-h-[220px] resize-none"
                    placeholder="Write a blessing for Liv."
                  />

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleBlessingSubmit}
                      disabled={!isConnected || isScoring}
                      className="primary-button px-5 disabled:opacity-55"
                    >
                      {isScoring ? (
                        <>
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                          Reviewing...
                        </>
                      ) : (
                        <>
                          <Bot className="h-4 w-4" />
                          Start Agent
                        </>
                      )}
                    </button>

                    {questState.blessingResult ? (
                      <Pill tone={questState.blessingResult.passed ? "success" : "warning"}>
                        Score {questState.blessingResult.score}/10
                      </Pill>
                    ) : null}
                  </div>

                  {questState.blessingResult ? (
                    <div className="rounded-[24px] border border-white/12 bg-white/8 p-4">
                      <p className="text-sm leading-7 text-slate-100/86">
                        {questState.blessingResult.reason}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="tokenomics" className="section-shell">
          <SectionTitle
            eyebrow="Tokenomics"
            title="4,000 mint units. 8 ETH target."
            description="Each mint unit corresponds to 20,000 tokens."
          />

          <div className="grid gap-6 lg:grid-cols-4">
            <div className="surface-card lg:col-span-2">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-200/62">
                Supply Split
              </p>
              <div className="mt-5 h-5 overflow-hidden rounded-full bg-white/10">
                <div className="flex h-full">
                  <div
                    className="h-full bg-[linear-gradient(90deg,#c8b9ff_0%,#b69cff_100%)]"
                    style={{ width: `${(DISTRIBUTION_SUPPLY / TOTAL_TOKEN_SUPPLY) * 100}%` }}
                  />
                  <div
                    className="h-full bg-[linear-gradient(90deg,#ffb48a_0%,#ffd16a_100%)]"
                    style={{ width: `${(LP_SUPPLY / TOTAL_TOKEN_SUPPLY) * 100}%` }}
                  />
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] bg-white/8 p-4">
                  <p className="text-sm text-slate-200/62">Task Distribution</p>
                  <p className="mt-2 text-3xl font-semibold text-white">
                    {formatCompactNumber(DISTRIBUTION_SUPPLY)}
                  </p>
                </div>
                <div className="rounded-[24px] bg-white/8 p-4">
                  <p className="text-sm text-slate-200/62">LP Allocation</p>
                  <p className="mt-2 text-3xl font-semibold text-white">
                    {formatCompactNumber(LP_SUPPLY)}
                  </p>
                </div>
              </div>
            </div>

            <StatCard
              label="Total Supply"
              value={formatCompactNumber(TOTAL_TOKEN_SUPPLY)}
              accent="bg-[rgba(200,185,255,0.24)]"
            />
            <StatCard label="Raise Target" value="8 ETH" accent="bg-[rgba(255,216,165,0.2)]" />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="surface-card">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-200/62">
                Formula
              </p>
              <p className="mt-4 text-lg leading-8 text-slate-100/82">
                20,000 × 4,000 = 80,000,000
              </p>
            </div>
            <div className="surface-card">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-200/62">
                Pricing
              </p>
              <p className="mt-4 text-lg leading-8 text-slate-100/82">
                0.002 ETH / mint
              </p>
            </div>
            <div className="surface-card">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-200/62">
                Limit
              </p>
              <p className="mt-4 text-lg leading-8 text-slate-100/82">
                20 quota max / address
              </p>
            </div>
          </div>
        </section>

        <section className="section-shell">
          <SectionTitle
            eyebrow="FAQ"
            title="FAQ"
            description="Simple answers to the core flow and tech stack."
          />

          <div className="grid gap-4">
            {FAQ_ITEMS.map((item) => (
              <div
                key={item.question}
                className="surface-card transition-all duration-300 hover:border-white/18 hover:bg-white/10"
              >
                <h3 className="text-xl font-medium text-white">{item.question}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-100/72">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
