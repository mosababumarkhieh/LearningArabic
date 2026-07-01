import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const DEFAULT_SETTINGS = {
  isolatedWordsPerQuiz: 10,
  newWordsPerLesson: 2,
  weakWordsPerLesson: 4,
  reviewWordsPerLesson: 4,
  masteredWordsPerLesson: 6,
  ratioMastered: 70,
  ratioReview: 20,
  ratioNew: 10,
  paragraphLength: "MEDIUM",
  difficulty: "MEDIUM",
  harakatMode: "FULL",
  topicPreference: "Mixed",
  includeNewWords: true,
  prioritizeWeakWords: true,
  onlyImportedWords: false,
  aiVocabMode: "NORMAL",
  passageTheme: "DECK",
} satisfies Partial<Prisma.UserSettingsCreateInput>;

export const PASSAGE_THEME_OPTIONS = [
  {
    value: "DECK",
    label: "Deck-focused",
    hint: "Coherent passages built mainly from your vocabulary",
  },
  {
    value: "EVERYDAY",
    label: "Everyday life",
    hint: "Shopping, doctor visits, friends, food, books & shows (modern MSA)",
  },
  {
    value: "ISLAMIC",
    label: "Islamic stories",
    hint: "Stories of the prophets, companions & good character (AI-written)",
  },
  {
    value: "QURAN",
    label: "Qurʾān (verse study)",
    hint: "An authentic verse from the Qurʾān with its translation",
  },
  {
    value: "HADITH",
    label: "Hadith",
    hint: "An authentic hadith (Bukhari/Muslim/Abu Dawud) with translation",
  },
  {
    value: "MODERN",
    label: "Modern literary",
    hint: "Contemporary novel/essay style",
  },
  {
    value: "CLASSICAL",
    label: "Classical Arabic",
    hint: "Elevated heritage (turāth) register",
  },
  {
    value: "MIXED",
    label: "Mixed (surprise me)",
    hint: "Randomly varies the theme each time",
  },
] as const;

export const TOPIC_OPTIONS = [
  "Daily life",
  "Masjid",
  "Islamic studies",
  "Books/reading",
  "Family",
  "Travel",
  "School/studying",
  "Mixed",
] as const;

export const PARAGRAPH_LENGTH_OPTIONS = [
  { value: "SHORT", label: "Short", sentences: "3–4 sentences" },
  { value: "MEDIUM", label: "Medium", sentences: "5–7 sentences" },
  { value: "LONG", label: "Long", sentences: "8–12 sentences" },
  { value: "ESSAY", label: "Essay-length", sentences: "13+ sentences" },
] as const;

export const DIFFICULTY_OPTIONS = [
  { value: "EASY", label: "Easy" },
  { value: "MEDIUM", label: "Medium" },
  { value: "CHALLENGING", label: "Challenging" },
] as const;

export const HARAKAT_OPTIONS = [
  { value: "FULL", label: "Full harakāt" },
  { value: "PARTIAL", label: "Partial harakāt" },
  { value: "NONE", label: "No harakāt" },
  { value: "TOGGLE", label: "Toggle / reveal" },
] as const;

export const AI_VOCAB_MODE_OPTIONS = [
  { value: "OFF", label: "Off", hint: "Only imported / manual vocabulary" },
  { value: "CONSERVATIVE", label: "Conservative", hint: "0–1 AI word per lesson" },
  { value: "NORMAL", label: "Normal", hint: "1–2 AI words per lesson" },
  { value: "AGGRESSIVE", label: "Aggressive", hint: "3–5 AI words per lesson" },
] as const;

/** Get a user's settings, creating defaults if they don't exist yet. */
export async function getUserSettings(userId: string) {
  let settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!settings) {
    settings = await prisma.userSettings.create({
      data: { userId, ...DEFAULT_SETTINGS },
    });
  }
  return settings;
}

/** Resolve the allowed range of AI-introduced words for a mode. */
export function aiVocabRange(mode: string): { min: number; max: number } {
  switch (mode) {
    case "OFF":
      return { min: 0, max: 0 };
    case "CONSERVATIVE":
      return { min: 0, max: 1 };
    case "AGGRESSIVE":
      return { min: 3, max: 5 };
    case "NORMAL":
    default:
      return { min: 1, max: 2 };
  }
}

const AI_WRITTEN_THEMES = ["DECK", "EVERYDAY", "ISLAMIC", "MODERN", "CLASSICAL"];
const VALID_THEMES = PASSAGE_THEME_OPTIONS.map((o) => o.value) as string[];

/** Resolve the effective theme (request override → setting → default), expanding MIXED. */
export function resolvePassageTheme(
  requested: string | undefined,
  fallback: string,
): string {
  let theme = requested && VALID_THEMES.includes(requested) ? requested : fallback;
  if (!VALID_THEMES.includes(theme)) theme = "DECK";
  if (theme === "MIXED") {
    theme = AI_WRITTEN_THEMES[Math.floor(Math.random() * AI_WRITTEN_THEMES.length)];
  }
  return theme;
}

export function isAuthenticTheme(theme: string): boolean {
  return theme === "QURAN" || theme === "HADITH";
}

/** Subject/style directive + whether to bias toward using deck words. */
export function themeDirective(
  theme: string,
  topic: string,
): { directive: string; deckFocused: boolean } {
  switch (theme) {
    case "EVERYDAY":
      return {
        directive: `A realistic modern-life scene in natural Modern Standard Arabic — e.g. shopping or the mall, choosing clothes, ordering food, a doctor's visit describing where it hurts and how you feel, meeting a friend, or discussing a book, show, or movie. Make it feel like real life. Topic hint: ${topic}.`,
        deckFocused: false,
      };
    case "ISLAMIC":
      return {
        directive: `An Islamic story or moral lesson told in your OWN words — e.g. a story of a prophet or a companion, an act of good character (akhlāq), or a reflection on gratitude, patience, or honesty. Do NOT quote the Qurʾān or any hadith verbatim; narrate in your own MSA prose.`,
        deckFocused: false,
      };
    case "MODERN":
      return {
        directive: `An excerpt in modern literary Arabic, like a page from a contemporary novel or a thoughtful personal essay. Topic hint: ${topic}.`,
        deckFocused: false,
      };
    case "CLASSICAL":
      return {
        directive: `A passage in classical / heritage Arabic (فصحى تراثية) with a slightly elevated literary register — like classical adab or a traditional tale with wisdom.`,
        deckFocused: false,
      };
    case "DECK":
    default:
      return {
        directive: `A clear everyday scene or simple story. Topic hint: ${topic}.`,
        deckFocused: true,
      };
  }
}

export function paragraphTargetWords(length: string): number {
  switch (length) {
    case "SHORT":
      return 45;
    case "LONG":
      return 140;
    case "ESSAY":
      return 220;
    case "MEDIUM":
    default:
      return 85;
  }
}
