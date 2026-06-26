import { z } from "zod";
import { prisma } from "@/lib/db";
import { withUser } from "@/lib/api";
import { getUserSettings } from "@/lib/settings";

const schema = z.object({
  isolatedWordsPerQuiz: z.number().int().min(1).max(50),
  newWordsPerLesson: z.number().int().min(0).max(20),
  weakWordsPerLesson: z.number().int().min(0).max(20),
  reviewWordsPerLesson: z.number().int().min(0).max(20),
  masteredWordsPerLesson: z.number().int().min(0).max(30),
  ratioMastered: z.number().int().min(0).max(100),
  ratioReview: z.number().int().min(0).max(100),
  ratioNew: z.number().int().min(0).max(100),
  paragraphLength: z.enum(["SHORT", "MEDIUM", "LONG", "ESSAY"]),
  difficulty: z.enum(["EASY", "MEDIUM", "CHALLENGING"]),
  harakatMode: z.enum(["FULL", "PARTIAL", "NONE", "TOGGLE"]),
  topicPreference: z.string(),
  includeNewWords: z.boolean(),
  prioritizeWeakWords: z.boolean(),
  onlyImportedWords: z.boolean(),
  aiVocabMode: z.enum(["OFF", "CONSERVATIVE", "NORMAL", "AGGRESSIVE"]),
});

export const GET = withUser(async (userId) => {
  const settings = await getUserSettings(userId);
  return settings;
});

export const PUT = withUser(async (userId, req) => {
  const body = await req.json().catch(() => null);
  const parsed = schema.partial().safeParse(body);
  if (!parsed.success) throw new Error("Invalid settings.");
  await getUserSettings(userId); // ensure row exists
  const settings = await prisma.userSettings.update({
    where: { userId },
    data: parsed.data,
  });
  return { ok: true, settings };
});
