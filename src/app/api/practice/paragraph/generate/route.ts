import { prisma } from "@/lib/db";
import { withUser } from "@/lib/api";
import { getUserSettings, aiVocabRange, paragraphTargetWords } from "@/lib/settings";
import { selectLessonWords, knownWordKeys } from "@/lib/lesson-builder";
import { generateLesson, type WordBrief } from "@/lib/ai";
import { normalizeArabicKey } from "@/lib/utils";

export const maxDuration = 60;

// Rotating style directives so each generation reads differently.
const FORMATS = [
  "Write it as a short story with a small plot.",
  "Write it as a dialogue between two people.",
  "Write it as a personal diary entry.",
  "Write it as a friendly letter or message.",
  "Write it as a vivid description of a place or scene.",
  "Write it as a short news-style report.",
  "Write it as a reflection or opinion piece.",
  "Write it as a step-by-step account of a day or an errand.",
  "Write it as a conversation at the market, masjid, or school.",
  "Write it as a brief anecdote with a lesson at the end.",
];
const TONES = [
  "warm and reflective",
  "lively and energetic",
  "calm and descriptive",
  "curious and questioning",
  "practical and matter-of-fact",
  "lightly humorous",
];

function randomStyleDirective(): string {
  const f = FORMATS[Math.floor(Math.random() * FORMATS.length)];
  const t = TONES[Math.floor(Math.random() * TONES.length)];
  return `${f} Tone: ${t}.`;
}

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

  // Words the user already knows / has resolved — never reintroduce these.
  const { keys: knownKeys, recentAiWords } = await knownWordKeys(userId);

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
    styleDirective: randomStyleDirective(),
    avoidOpenings: selection.recentOpenings,
    avoidIntroduce: recentAiWords,
  });

  // Hard guard: drop any AI-introduced word the learner already has or has
  // already resolved (e.g. previously marked "I know it"), and de-dupe.
  const seenAiKeys = new Set<string>();
  const freshAiWords = generated.aiIntroduced.filter((w) => {
    const key = normalizeArabicKey(w.arabic);
    if (!key || knownKeys.has(key) || seenAiKeys.has(key)) return false;
    seenAiKeys.add(key);
    return true;
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
        create: freshAiWords.map((w) => ({
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
