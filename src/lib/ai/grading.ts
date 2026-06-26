/**
 * Deterministic, offline answer matching for English meanings.
 * Used as the primary path for isolated quizzes and as a fallback when no AI
 * provider is configured.
 */

export type MatchResult = "correct" | "partial" | "incorrect";

const STOPWORDS = new Set([
  "to",
  "the",
  "a",
  "an",
  "of",
  "for",
  "is",
  "be",
  "being",
  "it",
  "that",
  "this",
  "with",
  "and",
  "or",
  "in",
  "on",
  "at",
  "his",
  "her",
  "their",
  "i",
  "you",
  "he",
  "she",
  "they",
  "we",
]);

function normalize(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ") // drop parentheticals
    .replace(/[^a-z\s'-]/g, " ")
    .replace(/\b(to|the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Light stemming so "write"/"writing"/"writes" and singular/plural align. */
function stem(token: string): string {
  return token
    .replace(/(ies)$/, "y")
    .replace(/(ing|ed|es|s)$/, "")
    .replace(/(.)\1$/, "$1");
}

function tokens(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

/** Split a dictionary meaning into individual candidate senses. */
function candidates(meaning: string): string[] {
  return meaning
    .split(/[,;/]|(?:\bor\b)/i)
    .map((s) => normalize(s))
    .filter(Boolean);
}

export function matchMeaning(userAnswer: string, correctMeaning: string): MatchResult {
  const user = normalize(userAnswer);
  if (!user) return "incorrect";

  const cands = candidates(correctMeaning);
  const userTokens = new Set(tokens(userAnswer));
  if (userTokens.size === 0) return "incorrect";

  // Lenient by design: we grade for conveying the meaning, not verbatim wording.
  // Any shared key content word with any accepted sense counts as correct.
  for (const cand of cands) {
    if (!cand) continue;
    if (cand === user || cand.includes(user) || user.includes(cand)) {
      return "correct";
    }
    const candTokens = tokens(cand);
    if (candTokens.length === 0) continue;
    for (const t of candTokens) {
      if (userTokens.has(t)) return "correct";
    }
  }

  return "incorrect";
}
