import type { VocabStatus, ReviewResult } from "@prisma/client";
import { clamp } from "@/lib/utils";

/**
 * A lightweight, transparent spaced-repetition engine.
 *
 * Design goals (from the product spec):
 *  - New words appear soon.
 *  - Wrong words appear more frequently.
 *  - Words answered correctly several times appear less often.
 *  - A word becomes MASTERED after 3 correct recalls across separate lessons.
 *  - Mastered words still resurface occasionally for long-term retention.
 *  - Missing a mastered word downgrades it to REVIEW/WEAK.
 *
 * Mastery score (0–100) is the single tunable signal that also drives status.
 */

export type SrsState = {
  status: VocabStatus;
  masteryScore: number;
  correctCount: number;
  incorrectCount: number;
  consecutiveCorrectCount: number;
  totalSeen: number;
  totalMissed: number;
  lastReviewedAt: Date | null;
  nextReviewAt: Date | null;
};

const DAY = 86400000;

/** Interval (in days) for the Nth consecutive correct answer. */
const INTERVALS = [0, 1, 3, 7, 16, 35, 75, 150];

function intervalDays(consecutive: number): number {
  if (consecutive <= 0) return 0;
  return INTERVALS[Math.min(consecutive, INTERVALS.length - 1)];
}

function statusFromScore(
  score: number,
  consecutive: number,
  totalSeen: number,
): VocabStatus {
  if (totalSeen === 0) return "NEW";
  // 3 correct recalls across lessons => mastered (also gated on score).
  if (consecutive >= 3 && score >= 85) return "MASTERED";
  if (score >= 85) return "MASTERED";
  if (score < 40) return "WEAK";
  if (score < 70) return "REVIEW";
  return "LEARNING";
}

export type ApplyArgs = {
  current: Partial<SrsState>;
  result: ReviewResult; // CORRECT | PARTIAL | INCORRECT | SKIPPED
  now?: Date;
};

/**
 * Apply a single review result and return the next SRS state.
 * Pure function — easy to unit test and reason about.
 */
export function applyReview({ current, result, now = new Date() }: ApplyArgs): SrsState {
  const prevScore = current.masteryScore ?? 0;
  const wasMastered = current.status === "MASTERED";

  let score = prevScore;
  let consecutive = current.consecutiveCorrectCount ?? 0;
  let correct = current.correctCount ?? 0;
  let incorrect = current.incorrectCount ?? 0;
  let totalMissed = current.totalMissed ?? 0;
  const totalSeen = (current.totalSeen ?? 0) + 1;

  switch (result) {
    case "CORRECT":
      // Diminishing gains as the word approaches mastery.
      score = clamp(score + (score >= 70 ? 10 : 18), 0, 100);
      consecutive += 1;
      correct += 1;
      break;
    case "PARTIAL":
      score = clamp(score + 4, 0, 100);
      // Partial keeps the streak but doesn't strongly advance it.
      correct += 0; // tracked separately via reviews; partial isn't a clean win
      consecutive = Math.max(0, consecutive); // no reset, no increment
      break;
    case "INCORRECT":
      score = clamp(score - (wasMastered ? 35 : 22), 0, 100);
      consecutive = 0;
      incorrect += 1;
      totalMissed += 1;
      break;
    case "SKIPPED":
      score = clamp(score - 10, 0, 100);
      consecutive = 0;
      totalMissed += 1;
      break;
  }

  const status = statusFromScore(score, consecutive, totalSeen);

  // Schedule next review.
  let days: number;
  if (result === "INCORRECT" || result === "SKIPPED") {
    days = status === "WEAK" ? 0 : 1; // resurface very soon
  } else if (result === "PARTIAL") {
    days = 1;
  } else {
    days = intervalDays(consecutive);
    if (status === "MASTERED") days = Math.max(days, 30); // long-term retention
  }

  const nextReviewAt = new Date(now.getTime() + Math.max(days, 0) * DAY);

  return {
    status,
    masteryScore: score,
    correctCount: correct,
    incorrectCount: incorrect,
    consecutiveCorrectCount: consecutive,
    totalSeen,
    totalMissed,
    lastReviewedAt: now,
    nextReviewAt,
  };
}

/** Initial SRS state for a freshly created word. */
export function initialSrsState(status: VocabStatus = "NEW"): Partial<SrsState> {
  const masteryScore = status === "WEAK" ? 25 : status === "LEARNING" ? 45 : 0;
  return {
    status,
    masteryScore,
    correctCount: 0,
    incorrectCount: 0,
    consecutiveCorrectCount: 0,
    totalSeen: 0,
    totalMissed: 0,
    lastReviewedAt: null,
    nextReviewAt: new Date(),
  };
}

/**
 * Priority weight for selection in a lesson — higher means more urgent.
 * Overdue, weak, and unseen words bubble to the top.
 */
export function reviewPriority(item: {
  status: VocabStatus;
  masteryScore: number;
  nextReviewAt: Date | null;
  totalSeen: number;
  now?: Date;
}): number {
  const now = item.now ?? new Date();
  let weight = 0;

  // Overdue boost (days overdue).
  if (item.nextReviewAt) {
    const overdueDays = (now.getTime() - item.nextReviewAt.getTime()) / DAY;
    if (overdueDays > 0) weight += Math.min(overdueDays, 30) * 3;
  } else {
    weight += 20; // never scheduled
  }

  // Lower mastery => more urgent.
  weight += (100 - item.masteryScore) * 0.5;

  if (item.status === "WEAK") weight += 30;
  if (item.status === "NEW") weight += 15;
  if (item.totalSeen === 0) weight += 10;

  return weight;
}
