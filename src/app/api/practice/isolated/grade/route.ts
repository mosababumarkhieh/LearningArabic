import { z } from "zod";
import { prisma } from "@/lib/db";
import { withUser } from "@/lib/api";
import { gradeIsolated } from "@/lib/ai";
import { recordReview, resultFromMatch } from "@/lib/review";

const schema = z.object({
  lessonId: z.string(),
  answers: z.array(
    z.object({
      id: z.string(),
      answer: z.string(),
    }),
  ),
});

export const POST = withUser(async (userId, req) => {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new Error("Invalid submission.");
  const { lessonId, answers } = parsed.data;

  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, userId },
  });
  if (!lesson) throw new Error("Lesson not found.");

  const ids = answers.map((a) => a.id);
  const items = await prisma.vocabularyItem.findMany({
    where: { id: { in: ids }, userId },
  });
  const byId = new Map(items.map((i) => [i.id, i]));

  // Grade (deterministic + optional AI).
  const graded = await gradeIsolated(
    answers
      .filter((a) => byId.has(a.id))
      .map((a) => {
        const item = byId.get(a.id)!;
        return {
          id: a.id,
          arabic: item.arabicWithHarakat || item.arabic,
          correctMeaning: item.englishMeaning,
          userAnswer: a.answer,
        };
      }),
  );
  const gradeById = new Map(graded.map((g) => [g.id, g]));

  const results = [];
  let correctCount = 0;

  for (const a of answers) {
    const item = byId.get(a.id);
    if (!item) continue;
    const g = gradeById.get(a.id);
    const matchResult = a.answer.trim() ? g?.result ?? "incorrect" : "skipped";
    const result = resultFromMatch(matchResult);
    if (result === "CORRECT") correctCount++;

    const next = await recordReview({
      userId,
      item,
      result,
      mode: "ISOLATED",
      lessonId,
      userAnswer: a.answer,
      aiFeedback: g?.note ?? null,
    });

    results.push({
      id: item.id,
      arabic: item.arabicWithHarakat || item.arabic,
      yourAnswer: a.answer,
      correctMeaning: item.englishMeaning,
      result: matchResult,
      note: g?.note ?? null,
      type: item.type,
      root: item.root,
      pastTense: item.pastTense,
      presentTense: item.presentTense,
      masdar: item.masdar,
      imperative: item.imperative,
      singular: item.singular,
      dual: item.dual,
      plural: item.plural,
      masculine: item.masculine,
      feminine: item.feminine,
      masteryScore: next.masteryScore,
      status: next.status,
    });
  }

  const score = answers.length
    ? Math.round((correctCount / answers.length) * 100)
    : 0;

  await prisma.lesson.update({
    where: { id: lessonId },
    data: { completed: true, completedAt: new Date(), score },
  });

  return { score, correctCount, total: answers.length, results };
});
