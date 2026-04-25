export type SocialTaskId = "follow" | "quote";
export type QuizChoice = "A" | "B";
export type MintBundleId = "single" | "tenPack" | "fullPack";

export type SocialTaskDefinition = {
  id: SocialTaskId;
  label: string;
  title: string;
  description: string;
  reward: number;
  href: string;
};

export type QuizQuestion = {
  id: number;
  prompt: string;
  optionA: string;
  optionB: string;
  answer: QuizChoice;
  answerLabel: string;
};

export type MintBundle = {
  id: MintBundleId;
  label: string;
  title: string;
  priceEth: number;
  quotaCost: number;
  blurb: string;
};

export const X_HANDLE = "base_asteroid";
export const X_PROFILE_URL = "https://x.com/base_asteroid";
export const X_POST_URL =
  "https://x.com/base_asteroid/status/2047638958646190096?s=20";

export const SOCIAL_TASKS: SocialTaskDefinition[] = [
  {
    id: "follow",
    label: "Task 1A",
    title: "Follow the official X account",
    description: "Come back and claim 1 quota after completion.",
    reward: 1,
    href: X_PROFILE_URL,
  },
  {
    id: "quote",
    label: "Task 1B",
    title: "Repost the official X post",
    description: "Open the post, repost it, then come back for 1 quota.",
    reward: 1,
    href: X_POST_URL,
  },
];

export const DEFAULT_QUOTE_COPY = "Asteroid is live. See you in orbit.";

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    prompt: "Are you going to make your own phone?",
    optionA: "Yes",
    optionB: "No",
    answer: "B",
    answerLabel: "No",
  },
  {
    id: 2,
    prompt: "Are you expanding the Tesla Diner to new areas?",
    optionA: "Yes",
    optionB: "No",
    answer: "A",
    answerLabel: "Yes",
  },
  {
    id: 3,
    prompt: "Will there be any new games with any upcoming Tesla updates?",
    optionA: "Yes",
    optionB: "No",
    answer: "A",
    answerLabel: "Yes",
  },
  {
    id: 4,
    prompt: "What is your favorite anime?",
    optionA: "Dragon Ball",
    optionB: "Your Name",
    answer: "B",
    answerLabel: "Your Name",
  },
  {
    id: 5,
    prompt: "Have you ever been to Japan? What was your favorite place/thing there?",
    optionA: "Yes, a several times. Kyoto. teamLab.",
    optionB: "No",
    answer: "A",
    answerLabel: "Yes, a several times. Kyoto. teamLab.",
  },
  {
    id: 6,
    prompt: "Do you know who Hatsune Miku is?",
    optionA: "Yes",
    optionB: "No",
    answer: "A",
    answerLabel: "Yes",
  },
  {
    id: 7,
    prompt: "Was Ani inspired from Misa from Death Note?",
    optionA: "Yes",
    optionB: "No",
    answer: "A",
    answerLabel: "Yes",
  },
  {
    id: 8,
    prompt:
      "Can you make Asteroid (the Shiba Inu zero-g indicator she designed for the Polaris Dawn mission) the mascot for SpaceX?",
    optionA: "Ok 😀",
    optionB: "No",
    answer: "A",
    answerLabel: "Ok 😀",
  },
];

export const QUIZ_REWARD = 8;
export const BLESSING_REWARD = 10;
export const MAX_ADDRESS_QUOTA = 20;
export const TOTAL_GLOBAL_MINT_CAP = 4000;
export const TOKENS_PER_MINT = 20_000;
export const TOTAL_TOKEN_SUPPLY = 100_000_000;
export const DISTRIBUTION_SUPPLY = 80_000_000;
export const LP_SUPPLY = 20_000_000;
export const ETH_PER_MINT = 0.002;

export const MINT_BUNDLES: MintBundle[] = [
  {
    id: "single",
    label: "A",
    title: "1 Mint",
    priceEth: 0.002,
    quotaCost: 1,
    blurb: "0.002 ETH · uses 1 quota",
  },
  {
    id: "tenPack",
    label: "B",
    title: "10 Mint",
    priceEth: 0.02,
    quotaCost: 10,
    blurb: "0.02 ETH · uses 10 quota",
  },
  {
    id: "fullPack",
    label: "C",
    title: "20 Mint",
    priceEth: 0.04,
    quotaCost: 20,
    blurb: "0.04 ETH · uses 20 quota",
  },
];

export const TASK_SUMMARY = [
  {
    title: "Task 1",
    subtitle: "Social",
    reward: 2,
    description: "Follow and quote for 2 quota.",
  },
  {
    title: "Task 2",
    subtitle: "Dialogue",
    reward: 8,
    description: "Answer all 8 correctly for 8 quota.",
  },
  {
    title: "Task 3",
    subtitle: "Blessing",
    reward: 10,
    description: "Pass the blessing review for 10 quota.",
  },
];

export const NAV_ITEMS = [
  { label: "Overview", href: "#overview" },
  { label: "Mint", href: "#mint" },
  { label: "Tasks", href: "#tasks" },
  { label: "Tokenomics", href: "#tokenomics" },
];

export const FAQ_ITEMS = [
  {
    question: "How do I claim Task 1 quota?",
    answer: "Complete the follow and quote actions, then verify each one to claim 1 quota per step.",
  },
  {
    question: "Why must Task 2 be 8 out of 8?",
    answer: "Task 2 only unlocks after all 8 answers are correct, and then it grants 8 quota at once.",
  },
  {
    question: "How do quota and mint bundles work?",
    answer: "Tasks unlock quota first, then each mint bundle spends 1, 10, or 20 quota.",
  },
  {
    question: "What is X402?",
    answer: "X402 is the API payment standard kept for machine-to-machine flows. The site wallet checkout settles directly in ETH on Base.",
  },
  {
    question: "What is EIP-8004?",
    answer: "EIP-8004 is used here as the agent-style protocol label for the blessing review flow, showing that the scoring step is handled as an agent interaction.",
  },
  {
    question: "Why does the site use a database?",
    answer: "The live flow uses a SQLite ledger on the server so quota, task progress, and the 4,000 mint cap stay consistent across refreshes and devices.",
  },
];
