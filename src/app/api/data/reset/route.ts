import { z } from "zod";
import { prisma } from "@/lib/db";
import { withUser } from "@/lib/api";

const schema = z.object({
  scope: z.enum(["progress", "all"]).default("progress"),
  confirm: z.literal(true),
});

export const POST = withUser(async (userId, req) => {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new Error("Confirmation required.");

  if (parsed.data.scope === "all") {
    // Wipe all learning data but keep the account.
    await prisma.$transaction([
      prisma.reviewAttempt.deleteMany({ where: { userId } }),
      prisma.mistake.deleteMany({ where: { userId } }),
      prisma.lesson.deleteMany({ where: { userId } }),
      prisma.aIIntroducedVocabulary.deleteMany({ where: { userId } }),
      prisma.vocabularyItem.deleteMany({ where: { userId } }),
      prisma.deckImport.deleteMany({ where: { userId } }),
    ]);
    return { ok: true };
  }

  // Reset progress only: keep vocabulary, zero out SRS state.
  await prisma.$transaction([
    prisma.reviewAttempt.deleteMany({ where: { userId } }),
    prisma.mistake.deleteMany({ where: { userId } }),
    prisma.vocabularyItem.updateMany({
      where: { userId },
      data: {
        status: "NEW",
        masteryScore: 0,
        correctCount: 0,
        incorrectCount: 0,
        consecutiveCorrectCount: 0,
        totalSeen: 0,
        totalMissed: 0,
        appearedInLessons: 0,
        lastReviewedAt: null,
        nextReviewAt: new Date(),
      },
    }),
  ]);
  return { ok: true };
});
