import "server-only";
import { prisma } from "@/lib/db";

export async function getDashboardStats(userId: string) {
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000);

  const [
    statusGroups,
    total,
    aiGenerated,
    dueToday,
    neverSeen,
    lessonsCompleted,
    passagesCompleted,
    mostMissed,
    recentlyMastered,
    decks,
    reviews,
    pendingAi,
  ] = await Promise.all([
    prisma.vocabularyItem.groupBy({
      by: ["status"],
      where: { userId },
      _count: { _all: true },
    }),
    prisma.vocabularyItem.count({ where: { userId } }),
    prisma.vocabularyItem.count({
      where: { userId, sourceType: "AI_GENERATED" },
    }),
    prisma.vocabularyItem.count({
      where: { userId, nextReviewAt: { lte: endOfToday } },
    }),
    prisma.vocabularyItem.count({ where: { userId, totalSeen: 0 } }),
    prisma.lesson.count({ where: { userId, completed: true } }),
    prisma.lesson.count({
      where: { userId, completed: true, mode: "PARAGRAPH" },
    }),
    prisma.vocabularyItem.findMany({
      where: { userId, totalMissed: { gt: 0 } },
      orderBy: [{ totalMissed: "desc" }, { incorrectCount: "desc" }],
      take: 6,
      select: {
        id: true,
        arabic: true,
        arabicWithHarakat: true,
        englishMeaning: true,
        totalMissed: true,
        masteryScore: true,
      },
    }),
    prisma.vocabularyItem.findMany({
      where: { userId, status: "MASTERED" },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: {
        id: true,
        arabic: true,
        arabicWithHarakat: true,
        englishMeaning: true,
        updatedAt: true,
      },
    }),
    prisma.deckImport.findMany({
      where: { userId },
      select: { id: true, name: true, vocabulary: { select: { totalSeen: true } } },
    }),
    prisma.reviewAttempt.findMany({
      where: { userId, createdAt: { gte: fourteenDaysAgo } },
      select: { createdAt: true, result: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.aIIntroducedVocabulary.count({
      where: { userId, status: "PENDING" },
    }),
  ]);

  const counts = { NEW: 0, LEARNING: 0, REVIEW: 0, WEAK: 0, MASTERED: 0 };
  for (const g of statusGroups) counts[g.status] = g._count._all;

  const seen = total - neverSeen;
  const coverage = total ? Math.round((seen / total) * 100) : 0;

  const deckCoverage = decks
    .map((d) => {
      const t = d.vocabulary.length;
      const s = d.vocabulary.filter((v) => v.totalSeen > 0).length;
      return {
        id: d.id,
        name: d.name,
        total: t,
        seen: s,
        coverage: t ? Math.round((s / t) * 100) : 0,
      };
    })
    .sort((a, b) => a.coverage - b.coverage);

  // Accuracy over time — bucket by day.
  const buckets = new Map<string, { correct: number; total: number }>();
  for (const r of reviews) {
    const key = r.createdAt.toISOString().slice(0, 10);
    const b = buckets.get(key) ?? { correct: 0, total: 0 };
    b.total += 1;
    if (r.result === "CORRECT") b.correct += 1;
    else if (r.result === "PARTIAL") b.correct += 0.5;
    buckets.set(key, b);
  }
  const accuracyOverTime = [...buckets.entries()].map(([date, b]) => ({
    date: new Date(date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    accuracy: b.total ? Math.round((b.correct / b.total) * 100) : 0,
    reviews: b.total,
  }));

  const overallAccuracy = reviews.length
    ? Math.round(
        (reviews.reduce(
          (acc, r) =>
            acc + (r.result === "CORRECT" ? 1 : r.result === "PARTIAL" ? 0.5 : 0),
          0,
        ) /
          reviews.length) *
          100,
      )
    : 0;

  return {
    total,
    counts,
    aiGenerated,
    dueToday,
    neverSeen,
    coverage,
    lessonsCompleted,
    passagesCompleted,
    mostMissed,
    recentlyMastered,
    deckCoverage,
    accuracyOverTime,
    overallAccuracy,
    pendingAi,
    totalReviews: reviews.length,
  };
}
