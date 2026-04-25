export type BlessingScore = {
  score: number;
  passed: boolean;
  reason: string;
};

const KEYWORDS = [
  "liv",
  "love",
  "miss",
  "dream",
  "dreams",
  "hope",
  "star",
  "stars",
  "asteroid",
  "space",
  "musk",
  "strength",
  "courage",
  "kind",
  "light",
  "peace",
  "勇敢",
  "梦想",
  "星",
  "宇宙",
  "希望",
  "温柔",
  "祝福",
  "光",
  "小女孩",
  "天堂",
  "安息",
];

export function scoreBlessingMessage(input: string): BlessingScore {
  const text = input.trim();
  const normalized = text.toLowerCase();

  if (text.length < 8) {
    return {
      score: 2,
      passed: false,
      reason: "This feels too short and still reads like a placeholder rather than a real blessing.",
    };
  }

  let score = 1;

  if (text.length >= 20) score += 2;
  if (text.length >= 48) score += 1;
  if (text.length >= 90) score += 1;

  const matchedKeywords = KEYWORDS.filter((keyword) =>
    normalized.includes(keyword)
  ).length;
  score += Math.min(4, matchedKeywords);

  if (/[!,.?。！？]/.test(text)) score += 1;

  const finalScore = Math.max(1, Math.min(10, score));
  const passed = finalScore >= 7;

  if (passed) {
    return {
      score: finalScore,
      passed,
      reason:
        finalScore >= 9
          ? "The message has both warmth and detail, with a strong memorial tone and gentle emotional weight."
          : "The blessing feels sincere and personal enough to pass the current agent review.",
    };
  }

  return {
    score: finalScore,
    passed,
    reason: "The message is kind, but it still needs more detail or emotional specificity to feel truly personal.",
  };
}
