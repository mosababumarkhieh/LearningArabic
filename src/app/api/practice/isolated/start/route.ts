import { prisma } from "@/lib/db";
import { withUser } from "@/lib/api";
import { getUserSettings } from "@/lib/settings";
import { selectIsolatedWords } from "@/lib/lesson-builder";

export const POST = withUser(async (userId, req) => {
  const body = await req.json().catch(() => ({}));
  const settings = await getUserSettings(userId);
  const count = Math.min(
    50,
    Math.max(1, Number(body?.count) || settings.isolatedWordsPerQuiz),
  );

  const words = await selectIsolatedWords(userId, count);
  if (!words.length) {
    throw new Error(
      "No vocabulary to practise yet. Import a deck or add words first.",
    );
  }

  const lesson = await prisma.lesson.create({
    data: {
      userId,
      mode: "ISOLATED",
      title: `Isolated quiz · ${words.length} words`,
      items: {
        create: words.map((w) => ({
          vocabularyItemId: w.id,
          role: w.status.toLowerCase(),
        })),
      },
    },
  });

  return {
    lessonId: lesson.id,
    words: words.map((w) => ({
      id: w.id,
      arabic: w.arabic,
      arabicWithHarakat: w.arabicWithHarakat,
      type: w.type,
    })),
  };
});
