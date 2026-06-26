import "server-only";
import type { VocabularyItem, UserSettings } from "@prisma/client";
import { prisma } from "@/lib/db";
import { reviewPriority } from "@/lib/srs";
import type { WordBrief } from "@/lib/ai";

function toBrief(item: VocabularyItem, role: string): WordBrief {
  return {
    id: item.id,
    arabic: item.arabic,
    arabicWithHarakat: item.arabicWithHarakat,
    english: item.englishMeaning,
    type: item.type,
    role,
  };
}

function sortByPriority(items: VocabularyItem[], now: Date): VocabularyItem[] {
  return items
    .map((i) => ({
      i,
      p: reviewPriority({
        status: i.status,
        masteryScore: i.masteryScore,
        nextReviewAt: i.nextReviewAt,
        totalSeen: i.totalSeen,
        now,
      }),
    }))
    .sort((a, b) => b.p - a.p)
    .map((x) => x.i);
}

/** Select words for an isolated-recall quiz, prioritising due / weak / new. */
export async function selectIsolatedWords(
  userId: string,
  count: number,
): Promise<VocabularyItem[]> {
  const now = new Date();
  const all = await prisma.vocabularyItem.findMany({
    where: { userId },
    take: 1000,
  });
  if (!all.length) return [];
  return sortByPriority(all, now).slice(0, count);
}

export type LessonSelection = {
  mastered: WordBrief[];
  review: WordBrief[];
  weak: WordBrief[];
  newWords: WordBrief[];
  mustInclude: WordBrief[];
  avoidOverusing: string[];
  allItems: Map<string, VocabularyItem>;
};

/** Select and bucket words for paragraph generation, per the user's settings. */
export async function selectLessonWords(
  userId: string,
  settings: UserSettings,
): Promise<LessonSelection> {
  const now = new Date();
  const items = await prisma.vocabularyItem.findMany({
    where: { userId },
    take: 2000,
  });

  const byStatus = (s: VocabularyItem["status"]) =>
    sortByPriority(
      items.filter((i) => i.status === s),
      now,
    );

  const mastered = byStatus("MASTERED").slice(0, settings.masteredWordsPerLesson);
  const review = byStatus("REVIEW").slice(0, settings.reviewWordsPerLesson);
  const weak = byStatus("WEAK").slice(
    0,
    settings.prioritizeWeakWords
      ? settings.weakWordsPerLesson + 2
      : settings.weakWordsPerLesson,
  );
  const learning = byStatus("LEARNING");
  const newRaw = settings.includeNewWords
    ? [...byStatus("NEW"), ...learning].slice(0, settings.newWordsPerLesson)
    : [];

  // Words seen in the most recent completed lesson should not dominate again.
  const recentLesson = await prisma.lesson.findFirst({
    where: { userId, mode: "PARAGRAPH", completed: true },
    orderBy: { createdAt: "desc" },
    include: { items: { select: { vocabularyItem: { select: { arabic: true } } } } },
  });
  const avoidOverusing =
    recentLesson?.items.map((li) => li.vocabularyItem.arabic) ?? [];

  // Must-include: the most urgent weak words (so they reliably resurface).
  const mustInclude = weak.slice(0, Math.min(2, weak.length));

  const allItems = new Map(items.map((i) => [i.id, i]));

  return {
    mastered: mastered.map((i) => toBrief(i, "mastered")),
    review: review.map((i) => toBrief(i, "review")),
    weak: weak.map((i) => toBrief(i, "weak")),
    newWords: newRaw.map((i) => toBrief(i, "new")),
    mustInclude: mustInclude.map((i) => toBrief(i, "weak")),
    avoidOverusing,
    allItems,
  };
}
