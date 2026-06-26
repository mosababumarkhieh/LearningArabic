import { prisma } from "@/lib/db";
import { withUser } from "@/lib/api";
import { getUserSettings, aiVocabRange, paragraphTargetWords } from "@/lib/settings";
import { selectLessonWords } from "@/lib/lesson-builder";
import { generateLesson, type WordBrief } from "@/lib/ai";

export const maxDuration = 60;

export const POST = withUser(async (userId, req) => {
  const body = await req.json().catch(() => ({}));
  const settings = await getUserSettings(userId);
  const topic =
    (body?.topic as string) ||
    (settings.topicPreference === "Mixed"
      ? "Mixed (daily life, masjid, studying, family)"
      : settings.topicPreference);

  const selection = await selectLessonWords(userId, settings);

  const totalSelected =
    selection.mastered.length +
    selection.review.length +
    selection.weak.length +
    selection.newWords.length;
  if (totalSelected === 0) {
    throw new Error(
      "You need some vocabulary first. Import an Anki deck or add words.",
    );
  }

  // OFF when the user restricts to imported/manual vocabulary only.
  const aiMode = settings.onlyImportedWords ? "OFF" : settings.aiVocabMode;
  const range = aiVocabRange(aiMode);

  const generated = await generateLesson({
    topic,
    difficulty: settings.difficulty,
    harakatMode: settings.harakatMode,
    targetWords: paragraphTargetWords(settings.paragraphLength),
    ratio: {
      mastered: settings.ratioMastered,
      review: settings.ratioReview,
      new: settings.ratioNew,
    },
    mastered: selection.mastered,
    review: selection.review,
    weak: selection.weak,
    newWords: selection.newWords,
    mustInclude: selection.mustInclude,
    avoidOverusing: selection.avoidOverusing,
    aiVocab: { mode: aiMode, min: range.min, max: range.max },
  });

  // Which provided words ended up in the passage.
  const allBriefs: WordBrief[] = [
    ...selection.mastered,
    ...selection.review,
    ...selection.weak,
    ...selection.newWords,
  ];
  const briefById = new Map(allBriefs.map((b) => [b.id, b]));
  const usedIds = new Set<string>(
    generated.usedWordIds.filter((id) => briefById.has(id)),
  );
  // Always include must-include words; offline mode uses all selected words.
  selection.mustInclude.forEach((b) => usedIds.add(b.id));
  if (generated.source === "offline") allBriefs.forEach((b) => usedIds.add(b.id));

  const lesson = await prisma.lesson.create({
    data: {
      userId,
      mode: "PARAGRAPH",
      title: generated.title,
      topic,
      passageArabic: generated.passagePlain,
      passageHarakat: generated.passageHarakat,
      promptData: JSON.stringify({
        usedWordIds: [...usedIds],
        offered: allBriefs.length,
        source: generated.source,
      }),
      settingsSnapshot: JSON.stringify({
        ratio: {
          mastered: settings.ratioMastered,
          review: settings.ratioReview,
          new: settings.ratioNew,
        },
        difficulty: settings.difficulty,
        harakatMode: settings.harakatMode,
        paragraphLength: settings.paragraphLength,
        aiVocabMode: aiMode,
      }),
      items: {
        create: [...usedIds].map((id) => ({
          vocabularyItemId: id,
          role: briefById.get(id)?.role ?? "review",
        })),
      },
      aiVocab: {
        create: generated.aiIntroduced.map((w) => ({
          userId,
          arabic: w.arabic,
          arabicWithHarakat: w.arabic,
          englishMeaning: w.english,
          type: (w.type?.toUpperCase() as never) ?? "UNKNOWN",
          root: w.root ?? null,
          status: "PENDING",
        })),
      },
    },
  });

  return {
    lessonId: lesson.id,
    title: generated.title,
    topic,
    passageHarakat: generated.passageHarakat,
    passagePlain: generated.passagePlain,
    harakatMode: settings.harakatMode,
    source: generated.source,
    wordCount: usedIds.size,
  };
});
