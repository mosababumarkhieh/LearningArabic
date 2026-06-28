import "server-only";
import type { VocabularyItem, UserSettings } from "@prisma/client";
import { prisma } from "@/lib/db";
import { reviewPriority } from "@/lib/srs";
import { normalizeArabicKey } from "@/lib/utils";
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

function priorityOf(item: VocabularyItem, now: Date): number {
  return reviewPriority({
    status: item.status,
    masteryScore: item.masteryScore,
    nextReviewAt: item.nextReviewAt,
    totalSeen: item.totalSeen,
    now,
  });
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Weighted random pick WITHOUT replacement. Higher review priority => more
 * likely to be chosen, but every word has a chance — so lessons rotate across
 * the whole deck instead of recycling the same top-N every time.
 */
function weightedSample(
  items: VocabularyItem[],
  count: number,
  now: Date,
): VocabularyItem[] {
  if (count <= 0 || items.length === 0) return [];
  if (items.length <= count) return shuffle(items);
  const pool = items.map((i) => ({ i, w: Math.max(0.25, priorityOf(i, now)) }));
  const chosen: VocabularyItem[] = [];
  while (chosen.length < count && pool.length) {
    const total = pool.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * total;
    let idx = 0;
    while (idx < pool.length - 1 && (r -= pool[idx].w) > 0) idx++;
    chosen.push(pool[idx].i);
    pool.splice(idx, 1);
  }
  return chosen;
}

/** Select words for an isolated-recall quiz — rotated, but due/weak weighted. */
export async function selectIsolatedWords(
  userId: string,
  count: number,
): Promise<VocabularyItem[]> {
  const now = new Date();
  const all = await prisma.vocabularyItem.findMany({
    where: { userId },
    take: 5000,
  });
  if (!all.length) return [];
  return weightedSample(all, count, now);
}

export type LessonSelection = {
  mastered: WordBrief[];
  review: WordBrief[];
  weak: WordBrief[];
  newWords: WordBrief[];
  mustInclude: WordBrief[];
  avoidOverusing: string[];
  recentOpenings: string[];
  allItems: Map<string, VocabularyItem>;
};

/**
 * Select and bucket words for paragraph generation. Pools are generous and
 * randomized so the AI draws from a lot of the deck and produces a different
 * passage each time, while weak/due words stay favoured.
 */
export async function selectLessonWords(
  userId: string,
  settings: UserSettings,
): Promise<LessonSelection> {
  const now = new Date();
  const items = await prisma.vocabularyItem.findMany({
    where: { userId },
    take: 5000,
  });

  const byStatus = (s: VocabularyItem["status"]) =>
    items.filter((i) => i.status === s);

  // Effective pool sizes: respect settings as a floor but keep them generous so
  // passages are rich and rotate across the deck.
  const masteredCount = Math.max(settings.masteredWordsPerLesson, 10);
  const reviewCount = Math.max(settings.reviewWordsPerLesson, 6);
  const weakCount =
    Math.max(settings.weakWordsPerLesson, 6) +
    (settings.prioritizeWeakWords ? 2 : 0);
  const newCount = settings.includeNewWords
    ? Math.max(settings.newWordsPerLesson, 3)
    : 0;

  const weakAll = byStatus("WEAK");
  const mastered = weightedSample(byStatus("MASTERED"), masteredCount, now);
  const review = weightedSample(byStatus("REVIEW"), reviewCount, now);
  const weak = weightedSample(weakAll, weakCount, now);
  const newPool = [...byStatus("NEW"), ...byStatus("LEARNING")];
  const newWords = weightedSample(newPool, newCount, now);

  // Look back over the last few lessons to actively vary away from them.
  const recentLessons = await prisma.lesson.findMany({
    where: { userId, mode: "PARAGRAPH" },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      items: { select: { vocabularyItem: { select: { arabic: true } } } },
    },
  });
  const avoidOverusing = [
    ...new Set(
      recentLessons.flatMap((l) => l.items.map((li) => li.vocabularyItem.arabic)),
    ),
  ].slice(0, 25);
  const recentOpenings = recentLessons
    .map((l) =>
      (l.passageHarakat || l.passageArabic || "")
        .trim()
        .split(/\s+/)
        .slice(0, 6)
        .join(" "),
    )
    .filter(Boolean);

  // A couple of the most urgent weak words must appear so they keep resurfacing.
  const mustInclude = weightedSample(weakAll, Math.min(2, weakAll.length), now);

  const allItems = new Map(items.map((i) => [i.id, i]));

  return {
    mastered: mastered.map((i) => toBrief(i, "mastered")),
    review: review.map((i) => toBrief(i, "review")),
    weak: weak.map((i) => toBrief(i, "weak")),
    newWords: newWords.map((i) => toBrief(i, "new")),
    mustInclude: mustInclude.map((i) => toBrief(i, "weak")),
    avoidOverusing,
    recentOpenings,
    allItems,
  };
}

/**
 * Normalized keys of every word the user already has or has already resolved as
 * an AI-introduced word — so the generator never reintroduces a known word.
 */
export async function knownWordKeys(userId: string): Promise<{
  keys: Set<string>;
  recentAiWords: string[];
}> {
  const [vocab, ai] = await Promise.all([
    prisma.vocabularyItem.findMany({ where: { userId }, select: { arabic: true } }),
    prisma.aIIntroducedVocabulary.findMany({
      where: { userId },
      select: { arabic: true, arabicWithHarakat: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const keys = new Set<string>();
  for (const v of vocab) keys.add(normalizeArabicKey(v.arabic));
  for (const a of ai) keys.add(normalizeArabicKey(a.arabicWithHarakat || a.arabic));
  const recentAiWords = ai
    .slice(0, 40)
    .map((a) => a.arabicWithHarakat || a.arabic);
  return { keys, recentAiWords };
}
