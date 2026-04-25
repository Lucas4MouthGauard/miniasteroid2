import {
  BLESSING_REWARD,
  ETH_PER_MINT,
  MAX_ADDRESS_QUOTA,
  QUIZ_QUESTIONS,
  QUIZ_REWARD,
  SOCIAL_TASKS,
  TOKENS_PER_MINT,
  TOTAL_GLOBAL_MINT_CAP,
  type MintBundle,
  type MintBundleId,
  type QuizChoice,
} from "@/lib/content";

export type SocialTaskProgress = {
  launchedAt: number | null;
  verified: boolean;
};

export type BlessingResult = {
  score: number;
  passed: boolean;
  reason: string;
  checkedAt: number;
};

export type AddressQuestState = {
  social: Record<"follow" | "quote", SocialTaskProgress>;
  quoteDraft: string;
  quizAnswers: Record<number, QuizChoice | null>;
  quizPassed: boolean;
  blessingText: string;
  blessingResult: BlessingResult | null;
  mintedUsed: number;
};

export type GlobalMintLedger = {
  minted: number;
};

export const EMPTY_ADDRESS_STATE = (quoteDraft: string): AddressQuestState => ({
  social: {
    follow: { launchedAt: null, verified: false },
    quote: { launchedAt: null, verified: false },
  },
  quoteDraft,
  quizAnswers: Object.fromEntries(
    QUIZ_QUESTIONS.map((question) => [question.id, null])
  ) as Record<number, QuizChoice | null>,
  quizPassed: false,
  blessingText: "",
  blessingResult: null,
  mintedUsed: 0,
});

export const EMPTY_GLOBAL_LEDGER: GlobalMintLedger = {
  minted: 0,
};

export function getTaskCooldownRemaining(launchedAt: number | null, now = Date.now()) {
  if (!launchedAt) {
    return 3000;
  }

  return Math.max(0, 3000 - (now - launchedAt));
}

export function canVerifyTask(launchedAt: number | null, now = Date.now()) {
  return launchedAt !== null && getTaskCooldownRemaining(launchedAt, now) === 0;
}

export function calculateEarnedQuota(state: AddressQuestState) {
  const socialReward = SOCIAL_TASKS.reduce((sum, task) => {
    return sum + (state.social[task.id].verified ? task.reward : 0);
  }, 0);

  const quizReward = state.quizPassed ? QUIZ_REWARD : 0;
  const blessingReward = state.blessingResult?.passed ? BLESSING_REWARD : 0;

  return Math.min(MAX_ADDRESS_QUOTA, socialReward + quizReward + blessingReward);
}

export function calculateRemainingQuota(state: AddressQuestState) {
  return Math.max(0, calculateEarnedQuota(state) - state.mintedUsed);
}

export function evaluateQuiz(answers: Record<number, QuizChoice | null>) {
  const wrongIds = QUIZ_QUESTIONS.filter(
    (question) => answers[question.id] !== question.answer
  ).map((question) => question.id);

  const unansweredIds = QUIZ_QUESTIONS.filter(
    (question) => !answers[question.id]
  ).map((question) => question.id);

  return {
    allAnswered: unansweredIds.length === 0,
    passed: wrongIds.length === 0 && unansweredIds.length === 0,
    wrongIds,
    unansweredIds,
  };
}

export function getBundleById(bundles: MintBundle[], id: MintBundleId) {
  return bundles.find((bundle) => bundle.id === id) ?? bundles[0];
}

export function buildMintReceipt(bundle: MintBundle, totalMinted: number) {
  const tokenAmount = bundle.quotaCost * TOKENS_PER_MINT;
  const ethRaised = totalMinted * ETH_PER_MINT;

  return {
    mintedUnits: bundle.quotaCost,
    tokenAmount,
    ethRaised,
    completion: totalMinted / TOTAL_GLOBAL_MINT_CAP,
  };
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value);
}

export function formatQuota(value: number) {
  return `${value.toLocaleString("en-US")}x`;
}

export function formatEth(value: number) {
  return `${value.toFixed(value < 0.01 ? 3 : 2)} ETH`;
}
