import "server-only";
import { getAIProvider, extractJson } from "./provider";
import {
  lessonGenerationPrompt,
  translationGradingPrompt,
  isolatedGradingPrompt,
  deepDivePrompt,
  wordEnrichmentPrompt,
  type LessonGenInput,
  type WordBrief,
} from "./prompts";
import { matchMeaning, type MatchResult } from "./grading";
import { stripHarakat } from "@/lib/utils";

export type { WordBrief, LessonGenInput };
export { matchMeaning };

// ---------------------------------------------------------------------------
// Lesson (paragraph) generation
// ---------------------------------------------------------------------------

export type GeneratedLesson = {
  title: string;
  passageHarakat: string;
  passagePlain: string;
  usedWordIds: string[];
  aiIntroduced: {
    arabic: string;
    english: string;
    type?: string;
    root?: string | null;
  }[];
  source: "ai" | "offline";
};

export async function generateLesson(
  input: LessonGenInput,
): Promise<GeneratedLesson> {
  const provider = getAIProvider();
  if (provider.isLive) {
    try {
      const raw = await provider.complete(lessonGenerationPrompt(input), {
        temperature: 0.8,
        json: true,
        maxTokens: 2000,
      });
      const parsed = extractJson<{
        title: string;
        passageArakat?: string;
        passageHarakat?: string;
        passagePlain: string;
        usedWordIds?: string[];
        aiIntroduced?: GeneratedLesson["aiIntroduced"];
      }>(raw);
      const harakat = parsed.passageHarakat || parsed.passageArakat || parsed.passagePlain;
      return {
        title: parsed.title || `${input.topic} passage`,
        passageHarakat: harakat,
        passagePlain: parsed.passagePlain || stripHarakat(harakat),
        usedWordIds: parsed.usedWordIds ?? [],
        aiIntroduced: (parsed.aiIntroduced ?? []).slice(0, input.aiVocab.max),
        source: "ai",
      };
    } catch (err) {
      console.error("[ai] lesson generation failed, using offline:", err);
    }
  }
  return offlineLesson(input);
}

/** Offline passage: stitches the selected words into simple sentences. */
function offlineLesson(input: LessonGenInput): GeneratedLesson {
  const pool = [
    ...input.mustInclude,
    ...input.weak,
    ...input.review,
    ...input.mastered,
    ...input.newWords,
  ];
  const seen = new Set<string>();
  const chosen: WordBrief[] = [];
  for (const w of pool) {
    if (seen.has(w.id)) continue;
    seen.add(w.id);
    chosen.push(w);
    if (chosen.length >= Math.max(6, Math.round(input.targetWords / 6))) break;
  }
  const sentences = chosen.map(
    (w) => `${w.arabicWithHarakat || w.arabic} ${"مُهِمٌّ"}.`,
  );
  const harakat = sentences.join(" ");
  return {
    title: `${input.topic} practice`,
    passageHarakat: harakat,
    passagePlain: stripHarakat(harakat),
    usedWordIds: chosen.map((w) => w.id),
    aiIntroduced: [],
    source: "offline",
  };
}

// ---------------------------------------------------------------------------
// Isolated word grading
// ---------------------------------------------------------------------------

export type IsolatedGradeItem = {
  id: string;
  arabic: string;
  correctMeaning: string;
  userAnswer: string;
};

export type IsolatedGradeResult = {
  id: string;
  result: MatchResult;
  note?: string;
};

export async function gradeIsolated(
  items: IsolatedGradeItem[],
): Promise<IsolatedGradeResult[]> {
  // Deterministic baseline is always computed (works offline, instant).
  const deterministic: IsolatedGradeResult[] = items.map((it) => ({
    id: it.id,
    result: matchMeaning(it.userAnswer, it.correctMeaning),
  }));

  const provider = getAIProvider();
  if (!provider.isLive) return deterministic;

  try {
    const raw = await provider.complete(isolatedGradingPrompt(items), {
      temperature: 0,
      json: true,
      maxTokens: 1200,
    });
    const parsed = extractJson<{ results: IsolatedGradeResult[] }>(raw);
    const byId = new Map(parsed.results.map((r) => [r.id, r]));
    // Prefer AI judgement but keep deterministic where AI omitted an item.
    return items.map((it) => {
      const ai = byId.get(it.id);
      if (ai && ["correct", "partial", "incorrect"].includes(ai.result)) {
        return { id: it.id, result: ai.result, note: ai.note };
      }
      return deterministic.find((d) => d.id === it.id)!;
    });
  } catch (err) {
    console.error("[ai] isolated grading failed, using deterministic:", err);
    return deterministic;
  }
}

// ---------------------------------------------------------------------------
// Translation grading
// ---------------------------------------------------------------------------

export type TranslationFeedback = {
  score: number;
  summary: string;
  fullTranslation: string;
  corrections: { original: string; correction: string; why: string }[];
  grammarNotes: string[];
  missedWords: {
    arabic: string;
    english: string;
    type?: string;
    root?: string | null;
    past?: string | null;
    present?: string | null;
    masdar?: string | null;
    imperative?: string | null;
    example?: string;
    exampleEnglish?: string;
  }[];
  wordResults: { id: string; result: MatchResult }[];
  aiWordResults: { arabic: string; english: string; outcome: "known" | "missed" }[];
  source: "ai" | "offline";
};

export async function gradeTranslation(args: {
  passageArabic: string;
  passageHarakat: string;
  userTranslation: string;
  lessonWords: WordBrief[];
  aiIntroduced: { arabic: string; english: string }[];
}): Promise<TranslationFeedback> {
  const provider = getAIProvider();
  if (provider.isLive) {
    try {
      const raw = await provider.complete(translationGradingPrompt(args), {
        temperature: 0.2,
        json: true,
        maxTokens: 2200,
      });
      const parsed = extractJson<Omit<TranslationFeedback, "source">>(raw);
      return {
        score: clampScore(parsed.score),
        summary: parsed.summary ?? "",
        fullTranslation: parsed.fullTranslation ?? "",
        corrections: parsed.corrections ?? [],
        grammarNotes: parsed.grammarNotes ?? [],
        missedWords: parsed.missedWords ?? [],
        wordResults: parsed.wordResults ?? [],
        aiWordResults: parsed.aiWordResults ?? [],
        source: "ai",
      };
    } catch (err) {
      console.error("[ai] translation grading failed, using offline:", err);
    }
  }
  return offlineTranslationGrade(args);
}

/** Heuristic offline grading: keyword overlap against known meanings. */
function offlineTranslationGrade(args: {
  userTranslation: string;
  lessonWords: WordBrief[];
  aiIntroduced: { arabic: string; english: string }[];
}): TranslationFeedback {
  const text = args.userTranslation.toLowerCase();
  const wordResults = args.lessonWords.map((w) => {
    const r: MatchResult = w.english
      .toLowerCase()
      .split(/[,;/]/)
      .some((m) => {
        const key = m.replace(/\b(to|the|a|an)\b/g, "").trim();
        return key.length > 2 && text.includes(key);
      })
      ? "correct"
      : "partial";
    return { id: w.id, result: r };
  });
  const hits = wordResults.filter((r) => r.result === "correct").length;
  const score = args.lessonWords.length
    ? Math.round((hits / args.lessonWords.length) * 100)
    : 0;
  return {
    score,
    summary:
      "Offline grading (no AI key configured). Scored by keyword overlap; configure AI_API_KEY for full corrections and a natural translation.",
    fullTranslation: args.lessonWords
      .map((w) => w.english)
      .join("; "),
    corrections: [],
    grammarNotes: [],
    missedWords: [],
    wordResults,
    aiWordResults: args.aiIntroduced.map((w) => ({
      arabic: w.arabic,
      english: w.english,
      outcome: text.includes(w.english.toLowerCase().split(/[,;/]/)[0].trim())
        ? "known"
        : "missed",
    })),
    source: "offline",
  };
}

// ---------------------------------------------------------------------------
// Deep dive + enrichment
// ---------------------------------------------------------------------------

export type DeepDiveData = {
  arabicWithHarakat?: string;
  type?: string;
  root?: string | null;
  verbForm?: string | null;
  past?: string | null;
  present?: string | null;
  masdar?: string | null;
  imperative?: string | null;
  singular?: string | null;
  dual?: string | null;
  plural?: string | null;
  masculine?: string | null;
  feminine?: string | null;
  conjugation?: { label: string; arabic: string }[];
  relatedRootWords?: { arabic: string; english: string }[];
  notes?: string;
  examples?: { arabic: string; english: string }[];
};

export async function deepDive(word: {
  arabic: string;
  english: string;
  type?: string | null;
  root?: string | null;
}): Promise<DeepDiveData | null> {
  const provider = getAIProvider();
  if (!provider.isLive) return null;
  try {
    const raw = await provider.complete(deepDivePrompt(word), {
      temperature: 0.2,
      json: true,
      maxTokens: 1500,
    });
    return extractJson<DeepDiveData>(raw);
  } catch {
    return null;
  }
}

export type EnrichedWord = {
  arabicWithHarakat?: string;
  englishMeaning?: string;
  type?: string;
  root?: string | null;
  verbForm?: string | null;
  past?: string | null;
  present?: string | null;
  masdar?: string | null;
  imperative?: string | null;
  singular?: string | null;
  dual?: string | null;
  plural?: string | null;
  masculine?: string | null;
  feminine?: string | null;
  example?: string;
  exampleEnglish?: string;
  notes?: string;
};

export async function enrichWord(word: {
  arabic: string;
  english?: string;
}): Promise<EnrichedWord | null> {
  const provider = getAIProvider();
  if (!provider.isLive) return null;
  try {
    const raw = await provider.complete(wordEnrichmentPrompt(word), {
      temperature: 0.2,
      json: true,
      maxTokens: 800,
    });
    return extractJson<EnrichedWord>(raw);
  } catch {
    return null;
  }
}

function clampScore(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function aiIsLive(): boolean {
  return getAIProvider().isLive;
}
