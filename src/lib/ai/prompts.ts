import type { ChatMessage } from "./types";

/**
 * Structured prompt builders. Each task gets its own focused prompt rather than
 * one giant static blob. All prompts share a strict rule: the model must never
 * invent the learner's progress — progress always comes from the database and
 * is passed in explicitly.
 */

const BASE_RULES = `You are an expert Modern Standard Arabic teacher helping an English-speaking learner.
Hard rules:
- NEVER claim to know the learner's progress, mastery, or history beyond the data you are given.
- Use accurate Modern Standard Arabic (fuṣḥā) with correct harakāt (tashkīl).
- Be concise and pedagogically useful. No filler.
- When asked for JSON, output ONLY valid minified JSON — no markdown, no commentary.`;

export type WordBrief = {
  id: string;
  arabic: string;
  arabicWithHarakat?: string | null;
  english: string;
  type?: string | null;
  role: string; // mastered | review | weak | new
};

export type LessonGenInput = {
  topic: string;
  difficulty: string;
  harakatMode: string;
  targetWords: number;
  ratio: { mastered: number; review: number; new: number };
  mastered: WordBrief[];
  review: WordBrief[];
  weak: WordBrief[];
  newWords: WordBrief[];
  mustInclude: WordBrief[];
  avoidOverusing: string[];
  aiVocab: { mode: string; min: number; max: number };
  styleDirective?: string;
  avoidOpenings?: string[];
  avoidIntroduce?: string[];
};

function wordList(words: WordBrief[]): string {
  if (!words.length) return "(none)";
  return words
    .map(
      (w) =>
        `- ${w.arabicWithHarakat || w.arabic} = ${w.english}${w.type ? ` [${w.type.toLowerCase()}]` : ""}`,
    )
    .join("\n");
}

/** Paragraph / passage generation. */
export function lessonGenerationPrompt(input: LessonGenInput): ChatMessage[] {
  const harakatInstruction =
    input.harakatMode === "NONE"
      ? "Write the passage WITHOUT harakāt."
      : input.harakatMode === "PARTIAL"
        ? "Add harakāt only where needed to disambiguate."
        : "Write the passage with FULL harakāt on every word.";

  const user = `Generate a coherent Arabic reading passage for translation practice.

TOPIC: ${input.topic}
DIFFICULTY: ${input.difficulty}
TARGET LENGTH: about ${input.targetWords} Arabic words.
COMPOSITION TARGET: ~${input.ratio.mastered}% known/mastered, ~${input.ratio.review}% review/weak, ~${input.ratio.new}% new.
${harakatInstruction}

VARIETY (very important): ${input.styleDirective || "Vary the genre, structure, and tone."}
- Make this passage clearly DIFFERENT from previous ones in opening line, structure, setting, and tone.
- Do NOT open with weather or time-of-day clichés (e.g. "On a calm morning / في صباح هادئ"). Start somewhere fresh.
${
  input.avoidOpenings && input.avoidOpenings.length
    ? `- Do NOT reuse any of these recent openings: ${input.avoidOpenings.map((o) => `"${o}"`).join(" | ")}`
    : ""
}

COVERAGE: Use as MANY of the provided words as read naturally. Include MOST of the WEAK, REVIEW and NEW words, plus a good spread of the MASTERED words for context. A rich passage that exercises many words is better than a sparse one — write tightly so the words fit the target length.

MASTERED / KNOWN words to draw from:
${wordList(input.mastered)}

REVIEW words to weave in:
${wordList(input.review)}

WEAK words to emphasise (use these more):
${wordList(input.weak)}

NEW imported words to introduce gently:
${wordList(input.newWords)}

WORDS THAT MUST APPEAR:
${wordList(input.mustInclude)}

AVOID OVERUSING these recently-seen words (lean on different ones): ${input.avoidOverusing.join("، ") || "(none)"}

AI-INTRODUCED VOCABULARY:
Mode = ${input.aiVocab.mode}. You MAY introduce between ${input.aiVocab.min} and ${input.aiVocab.max} brand-new common Arabic words that are NOT in the lists above, only if they fit naturally. If mode is OFF, introduce ZERO new words.
NEVER introduce any of these as "new" — the learner already knows or has already seen them: ${input.avoidIntroduce && input.avoidIntroduce.length ? input.avoidIntroduce.join("، ") : "(none)"}

Return ONLY JSON shaped exactly like:
{
  "title": "short English title",
  "passageArakat": "Arabic passage WITH harakāt",
  "passagePlain": "same passage WITHOUT harakāt",
  "usedWordIds": ["ids of provided words you actually used"],
  "aiIntroduced": [
    {"arabic":"with harakāt","english":"meaning","type":"verb|noun|adjective|phrase|particle","root":"ف-ع-ل or null"}
  ]
}`;

  return [
    { role: "system", content: BASE_RULES },
    { role: "user", content: user },
  ];
}

/** Grade a full translation of a passage. */
export function translationGradingPrompt(args: {
  passageArabic: string;
  passageHarakat: string;
  userTranslation: string;
  lessonWords: WordBrief[];
  aiIntroduced: { arabic: string; english: string }[];
}): ChatMessage[] {
  const user = `Grade the learner's English translation of this Arabic passage.

ARABIC PASSAGE (with harakāt):
${args.passageHarakat || args.passageArabic}

VOCABULARY USED IN THIS PASSAGE (from the learner's database):
${wordList(args.lessonWords)}

AI-INTRODUCED WORDS in this passage (not yet in the learner's database):
${args.aiIntroduced.map((w) => `- ${w.arabic} = ${w.english}`).join("\n") || "(none)"}

LEARNER'S TRANSLATION:
"""${args.userTranslation}"""

Grade for OVERALL COMPREHENSION and accuracy of meaning — NOT for matching exact dictionary wording. Accept synonyms, paraphrases, natural rewordings, reordering, and reasonable interpretations as correct. The learner is translating for understanding, so do not penalise wording that differs from the reference as long as the meaning is right.

Tasks:
1. Correct ONLY genuine meaning errors — do not rewrite correct parts or nitpick style/word choice.
2. Identify genuinely misunderstood vocabulary and misunderstood grammar/structure.
3. For each missed or new word, give meaning + (for verbs) root, past, present, masdar, imperative-if-common, and ONE example sentence.
4. Provide a full, natural English translation of the WHOLE passage.
5. For every database word in the list, judge whether the learner conveyed its meaning in their translation: "correct" if the meaning came through (even if not verbatim), "incorrect" only if clearly misunderstood or omitted, "partial" sparingly. When in doubt, lean "correct".
6. For every AI-introduced word, judge whether the learner clearly knew it ("known") or struggled/missed/skipped it ("missed").
7. Give a generous overall score 0–100 that rewards accurate understanding of the passage.

Return ONLY JSON shaped exactly like:
{
  "score": 0,
  "summary": "1-2 sentence overall feedback",
  "fullTranslation": "natural English translation of the whole passage",
  "corrections": [{"original":"learner text","correction":"fixed text","why":"short reason"}],
  "grammarNotes": ["short note", "..."],
  "missedWords": [
    {"arabic":"with harakāt","english":"meaning","type":"verb|noun|adjective|phrase|particle","root":"or null","past":"or null","present":"or null","masdar":"or null","imperative":"or null","example":"one Arabic example sentence","exampleEnglish":"its translation"}
  ],
  "wordResults": [{"id":"db word id","result":"correct|partial|incorrect"}],
  "aiWordResults": [{"arabic":"...","english":"...","outcome":"known|missed"}]
}`;

  return [
    { role: "system", content: BASE_RULES },
    { role: "user", content: user },
  ];
}

/** Grade a batch of isolated word translations. */
export function isolatedGradingPrompt(
  items: { id: string; arabic: string; correctMeaning: string; userAnswer: string }[],
): ChatMessage[] {
  const list = items
    .map(
      (it) =>
        `- id=${it.id} | arabic="${it.arabic}" | correct="${it.correctMeaning}" | learner="${it.userAnswer}"`,
    )
    .join("\n");

  const user = `For each item, decide whether the learner's English answer conveys the meaning of the Arabic word.
Be LENIENT and generous — grade for understanding, not for matching the reference wording.
- Mark "correct" if the answer captures the general/accurate meaning, even with different wording, a synonym, a less specific term, a different part of speech, or extra/missing articles. The learner does NOT need to match the deck's exact phrasing.
- Use "partial" only when the answer is in the right area but clearly misses the core meaning.
- Mark "incorrect" only when the answer is wrong, unrelated, or empty.

ITEMS:
${list}

Return ONLY JSON:
{"results":[{"id":"...","result":"correct|partial|incorrect","note":"short note shown to learner"}]}`;

  return [
    { role: "system", content: BASE_RULES },
    { role: "user", content: user },
  ];
}

/** Generate rich morphological detail for a single word (deep dive). */
export function deepDivePrompt(word: {
  arabic: string;
  english: string;
  type?: string | null;
  root?: string | null;
}): ChatMessage[] {
  const user = `Produce a detailed lexical breakdown of this Arabic word.

WORD: ${word.arabic}
KNOWN MEANING: ${word.english}
${word.type ? `TYPE: ${word.type}` : ""}
${word.root ? `ROOT: ${word.root}` : ""}

Return ONLY JSON:
{
  "arabicWithHarakat":"fully vowelled form",
  "type":"verb|noun|adjective|phrase|particle|unknown",
  "root":"ف-ع-ل or null",
  "verbForm":"Form I..X or null",
  "past":"or null","present":"or null","masdar":"or null","imperative":"or null",
  "singular":"or null","dual":"or null","plural":"or null",
  "masculine":"or null","feminine":"or null",
  "conjugation":[{"label":"e.g. huwa (he, past)","arabic":"..."}],
  "relatedRootWords":[{"arabic":"...","english":"..."}],
  "notes":"nuance / usage notes",
  "examples":[{"arabic":"...","english":"..."}]
}`;

  return [
    { role: "system", content: BASE_RULES },
    { role: "user", content: user },
  ];
}

/** Enrich a missed/new word with full morphology before saving. */
export function wordEnrichmentPrompt(word: {
  arabic: string;
  english?: string;
}): ChatMessage[] {
  const user = `Provide structured data for this Arabic word for a vocabulary database.

WORD: ${word.arabic}
${word.english ? `HINT MEANING: ${word.english}` : ""}

Return ONLY JSON:
{
  "arabicWithHarakat":"...","englishMeaning":"...",
  "type":"verb|noun|adjective|phrase|particle|unknown",
  "root":"or null","verbForm":"or null",
  "past":"or null","present":"or null","masdar":"or null","imperative":"or null",
  "singular":"or null","dual":"or null","plural":"or null",
  "masculine":"or null","feminine":"or null",
  "example":"one Arabic example sentence","exampleEnglish":"its translation",
  "notes":"short nuance"
}`;

  return [
    { role: "system", content: BASE_RULES },
    { role: "user", content: user },
  ];
}
