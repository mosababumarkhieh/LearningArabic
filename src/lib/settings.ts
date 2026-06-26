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
} satisfies Partial<Prisma.UserSettingsCreateInput>;

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
