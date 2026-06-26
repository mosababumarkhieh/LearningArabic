import "server-only";
import type { ReviewResult, PracticeMode, VocabularyItem } from "@prisma/client";
import { prisma } from "@/lib/db";
import { applyReview } from "@/lib/srs";

export type RecordReviewArgs = {
  userId: string;
  item: VocabularyItem;
  result: ReviewResult;
  mode: PracticeMode;
  lessonId?: string | null;
  userAnswer?: string | null;
  aiFeedback?: string | null;
};

/**
 * Persist a single review: update the word's SRS state, log a ReviewAttempt,
 * and (on a miss) a Mistake. Returns the new mastery state. This is the single
 * place mastery is mutated, so progress stays consistent across modes.
 */
export async function recordReview(args: RecordReviewArgs) {
  const { userId, item, result, mode, lessonId, userAnswer, aiFeedback } = args;

  const next = applyReview({ current: item, result });

  await prisma.$transaction(async (tx) => {
    await tx.vocabularyItem.update({
      where: { id: item.id },
      data: {
        status: next.status,
        masteryScore: next.masteryScore,
        correctCount: next.correctCount,
        incorrectCount: next.incorrectCount,
        consecutiveCorrectCount: next.consecutiveCorrectCount,
        totalSeen: next.totalSeen,
        totalMissed: next.totalMissed,
        lastReviewedAt: next.lastReviewedAt,
        nextReviewAt: next.nextReviewAt,
        appearedInLessons: { increment: 1 },
      },
    });

    await tx.reviewAttempt.create({
      data: {
        userId,
        vocabularyItemId: item.id,
        lessonId: lessonId ?? null,
        mode,
        userAnswer: userAnswer ?? null,
        result,
        aiFeedback: aiFeedback ?? null,
        masteryBefore: item.masteryScore,
        masteryAfter: next.masteryScore,
      },
    });

    if (result === "INCORRECT" || result === "PARTIAL" || result === "SKIPPED") {
      await tx.mistake.create({
        data: {
          userId,
          vocabularyItemId: item.id,
          lessonId: lessonId ?? null,
          userAnswer: userAnswer ?? null,
          correctAnswer: item.englishMeaning,
          mistakeType: "vocabulary",
        },
      });
    }

    if (lessonId) {
      await tx.lessonVocabularyItem.updateMany({
        where: { lessonId, vocabularyItemId: item.id },
        data: { wasCorrect: result === "CORRECT" },
      });
    }
  });

  return next;
}

export function resultFromMatch(match: string): ReviewResult {
  if (match === "correct") return "CORRECT";
  if (match === "partial") return "PARTIAL";
  if (match === "skipped") return "SKIPPED";
  return "INCORRECT";
}
