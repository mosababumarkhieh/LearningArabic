import { z } from "zod";
import { prisma } from "@/lib/db";
import { withUser } from "@/lib/api";
import { gradeTranslation, type WordBrief } from "@/lib/ai";
import { recordReview, resultFromMatch } from "@/lib/review";
import { normalizeArabicKey, stripHarakat } from "@/lib/utils";
import { initialSrsState } from "@/lib/srs";

const schema = z.object({
  lessonId: z.string(),
  translation: z.string().min(1, "Please enter a translation."),
});

export const maxDuration = 60;

export const POST = withUser(async (userId, req) => {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Invalid submission.");
  }
  const { lessonId, translation } = parsed.data;

  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, userId },
    include: {
      items: { include: { vocabularyItem: true } },
      aiVocab: true,
    },
  });
  if (!lesson) throw new Error("Lesson not found.");

  const lessonWords: WordBrief[] = lesson.items.map((li) => ({
    id: li.vocabularyItem.id,
    arabic: li.vocabularyItem.arabic,
    arabicWithHarakat: li.vocabularyItem.arabicWithHarakat,
    english: li.vocabularyItem.englishMeaning,
    type: li.vocabularyItem.type,
    role: li.role,
  }));

  const feedback = await gradeTranslation({
    passageArabic: lesson.passageArabic ?? "",
    passageHarakat: lesson.passageHarakat ?? "",
    userTranslation: translation,
    lessonWords,
    aiIntroduced: lesson.aiVocab.map((a) => ({
      arabic: a.arabicWithHarakat || a.arabic,
      english: a.englishMeaning,
    })),
    // For Qur'an/Hadith lessons this holds the authoritative translation.
    referenceTranslation: lesson.passageEnglish,
  });

  // ---- Update mastery for database words used in the passage ----
  const itemById = new Map(
    lesson.items.map((li) => [li.vocabularyItem.id, li.vocabularyItem]),
  );
  const reviewed = new Set<string>();
  const wordOutcomes: { id: string; arabic: string; english: string; result: string; masteryScore: number; status: string }[] = [];

  for (const wr of feedback.wordResults) {
    const item = itemById.get(wr.id);
    if (!item || reviewed.has(wr.id)) continue;
    reviewed.add(wr.id);
    const result = resultFromMatch(wr.result);
    const next = await recordReview({
      userId,
      item,
      result,
      mode: "PARAGRAPH",
      lessonId,
      userAnswer: null,
      aiFeedback: feedback.summary,
    });
    wordOutcomes.push({
      id: item.id,
      arabic: item.arabicWithHarakat || item.arabic,
      english: item.englishMeaning,
      result: wr.result,
      masteryScore: next.masteryScore,
      status: next.status,
    });
  }
  // Words the AI didn't judge: count as a neutral exposure (partial) so they
  // still advance the schedule without a harsh penalty.
  for (const li of lesson.items) {
    if (reviewed.has(li.vocabularyItem.id)) continue;
    const next = await recordReview({
      userId,
      item: li.vocabularyItem,
      result: "PARTIAL",
      mode: "PARAGRAPH",
      lessonId,
    });
    wordOutcomes.push({
      id: li.vocabularyItem.id,
      arabic: li.vocabularyItem.arabicWithHarakat || li.vocabularyItem.arabic,
      english: li.vocabularyItem.englishMeaning,
      result: "partial",
      masteryScore: next.masteryScore,
      status: next.status,
    });
  }

  // ---- Resolve AI-introduced words ----
  const missedByKey = new Map(
    feedback.missedWords.map((m) => [normalizeArabicKey(m.arabic), m]),
  );
  const aiOutcomes: {
    arabic: string;
    english: string;
    outcome: "known" | "missed";
    saved: boolean;
  }[] = [];

  for (const ai of lesson.aiVocab) {
    const key = normalizeArabicKey(ai.arabic);
    const judged = feedback.aiWordResults.find(
      (r) => normalizeArabicKey(r.arabic) === key,
    );
    // Default to "missed" when the grader is unsure — safer for retention.
    const outcome: "known" | "missed" = judged?.outcome === "known" ? "known" : "missed";

    if (outcome === "missed") {
      const saved = await saveAiWord(userId, lessonId, ai, missedByKey.get(key));
      await prisma.aIIntroducedVocabulary.update({
        where: { id: ai.id },
        data: {
          status: "SAVED",
          wasMissed: true,
          savedVocabularyItemId: saved,
        },
      });
      aiOutcomes.push({
        arabic: ai.arabicWithHarakat || ai.arabic,
        english: ai.englishMeaning,
        outcome,
        saved: true,
      });
    } else {
      // Known: do not persist permanently, just mark ignored (user can save later).
      await prisma.aIIntroducedVocabulary.update({
        where: { id: ai.id },
        data: { status: "IGNORED", wasMissed: false },
      });
      aiOutcomes.push({
        arabic: ai.arabicWithHarakat || ai.arabic,
        english: ai.englishMeaning,
        outcome,
        saved: false,
      });
    }
  }

  await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      userTranslation: translation,
      aiFeedback: JSON.stringify(feedback),
      score: feedback.score,
      completed: true,
      completedAt: new Date(),
    },
  });

  return {
    score: feedback.score,
    summary: feedback.summary,
    // Prefer the authoritative reference translation when we have one.
    fullTranslation: lesson.passageEnglish || feedback.fullTranslation,
    corrections: feedback.corrections,
    grammarNotes: feedback.grammarNotes,
    missedWords: feedback.missedWords,
    wordOutcomes,
    aiOutcomes,
    source: feedback.source,
  };
});

/** Persist a missed AI-introduced word as a permanent VocabularyItem. */
async function saveAiWord(
  userId: string,
  lessonId: string,
  ai: {
    arabic: string;
    arabicWithHarakat: string | null;
    englishMeaning: string;
    type: string;
    root: string | null;
  },
  missed?: {
    type?: string;
    root?: string | null;
    past?: string | null;
    present?: string | null;
    masdar?: string | null;
    imperative?: string | null;
    example?: string;
    exampleEnglish?: string;
  },
): Promise<string> {
  const bare = stripHarakat(ai.arabic) || ai.arabic;
  // Dedupe: if the word already exists, link to it instead of duplicating.
  const existing = await prisma.vocabularyItem.findFirst({
    where: { userId, arabic: bare },
    select: { id: true },
  });
  if (existing) return existing.id;

  const srs = initialSrsState("WEAK");
  const created = await prisma.vocabularyItem.create({
    data: {
      userId,
      arabic: bare,
      arabicWithHarakat: ai.arabicWithHarakat || ai.arabic,
      englishMeaning: ai.englishMeaning,
      type: ((missed?.type?.toUpperCase() as never) ?? ai.type) || "UNKNOWN",
      root: missed?.root ?? ai.root ?? null,
      pastTense: missed?.past ?? null,
      presentTense: missed?.present ?? null,
      masdar: missed?.masdar ?? null,
      imperative: missed?.imperative ?? null,
      sourceType: "AI_GENERATED",
      aiIntroduced: true,
      firstLessonId: lessonId,
      status: "WEAK",
      masteryScore: srs.masteryScore ?? 25,
      nextReviewAt: srs.nextReviewAt ?? new Date(),
      examples: missed?.example
        ? {
            create: {
              arabic: missed.example,
              english: missed.exampleEnglish ?? "",
              source: "AI_GENERATED",
            },
          }
        : undefined,
    },
  });
  return created.id;
}
