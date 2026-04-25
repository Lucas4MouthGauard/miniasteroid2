import {
  DEFAULT_QUOTE_COPY,
  type MintBundleId,
  type MintBundle,
} from "@/lib/content";
import {
  EMPTY_ADDRESS_STATE,
  EMPTY_GLOBAL_LEDGER,
  type AddressQuestState,
  type GlobalMintLedger,
} from "@/lib/mint";

const ADDRESS_PREFIX = "mini-asteroid:address:";
const GLOBAL_LEDGER_KEY = "mini-asteroid:global-ledger";

function normalizeBlessingReason(reason: string | undefined): string {
  if (!reason) {
    return "";
  }

  const legacyMap: Record<string, string> = {
    "内容太短，像占位语，还没有形成真正的祝福。":
      "This feels too short and still reads like a placeholder rather than a real blessing.",
    "情感和细节都比较到位，既有纪念感，也有温柔的力量。":
      "The message has both warmth and detail, with a strong memorial tone and gentle emotional weight.",
    "表达出了真诚祝福，也提到了人物或梦想，足以通过当前 Agent 评分。":
      "The blessing feels sincere and personal enough to pass the current agent review.",
    "有基础善意，但还不够具体或缺少情感细节，建议再写得更真诚一些。":
      "The message is kind, but it still needs more detail or emotional specificity to feel truly personal.",
  };

  return legacyMap[reason] ?? reason;
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function loadAddressState(address: string | undefined | null) {
  if (typeof window === "undefined" || !address) {
    return EMPTY_ADDRESS_STATE(DEFAULT_QUOTE_COPY);
  }

  const key = `${ADDRESS_PREFIX}${address.toLowerCase()}`;
  const raw = safeParse<Partial<AddressQuestState>>(
    window.localStorage.getItem(key),
    {}
  );

  return {
    ...EMPTY_ADDRESS_STATE(DEFAULT_QUOTE_COPY),
    ...raw,
    social: {
      ...EMPTY_ADDRESS_STATE(DEFAULT_QUOTE_COPY).social,
      ...raw.social,
    },
    quizAnswers: {
      ...EMPTY_ADDRESS_STATE(DEFAULT_QUOTE_COPY).quizAnswers,
      ...raw.quizAnswers,
    },
    blessingResult: raw.blessingResult
      ? {
          ...raw.blessingResult,
          reason: normalizeBlessingReason(raw.blessingResult.reason),
        }
      : null,
  } satisfies AddressQuestState;
}

export function saveAddressState(address: string | undefined | null, state: AddressQuestState) {
  if (typeof window === "undefined" || !address) {
    return;
  }

  const key = `${ADDRESS_PREFIX}${address.toLowerCase()}`;
  window.localStorage.setItem(key, JSON.stringify(state));
}

export function loadGlobalLedger() {
  if (typeof window === "undefined") {
    return EMPTY_GLOBAL_LEDGER;
  }

  const raw = safeParse<Partial<GlobalMintLedger>>(
    window.localStorage.getItem(GLOBAL_LEDGER_KEY),
    {}
  );

  return {
    ...EMPTY_GLOBAL_LEDGER,
    ...raw,
  } satisfies GlobalMintLedger;
}

export function saveGlobalLedger(ledger: GlobalMintLedger) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(GLOBAL_LEDGER_KEY, JSON.stringify(ledger));
}

export type PurchasePayload = {
  address: `0x${string}`;
  bundleId: MintBundleId;
};

export type PurchaseResponse = {
  ok: boolean;
  mode: "simulation" | "x402-live";
  bundle: MintBundle;
  txLabel: string;
  message: string;
};
