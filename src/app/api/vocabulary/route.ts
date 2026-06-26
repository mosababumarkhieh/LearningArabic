import { z } from "zod";
import { prisma } from "@/lib/db";
import { withUser } from "@/lib/api";
import { normalizeArabicKey, stripHarakat } from "@/lib/utils";
import { initialSrsState } from "@/lib/srs";

const createSchema = z.object({
  arabic: z.string().min(1),
  arabicWithHarakat: z.string().optional().nullable(),
  englishMeaning: z.string().min(1),
  type: z
    .enum(["VERB", "NOUN", "ADJECTIVE", "PHRASE", "PARTICLE", "UNKNOWN"])
    .default("UNKNOWN"),
  root: z.string().optional().nullable(),
  verbForm: z.string().optional().nullable(),
  pastTense: z.string().optional().nullable(),
  presentTense: z.string().optional().nullable(),
  masdar: z.string().optional().nullable(),
  imperative: z.string().optional().nullable(),
  singular: z.string().optional().nullable(),
  dual: z.string().optional().nullable(),
  plural: z.string().optional().nullable(),
  masculine: z.string().optional().nullable(),
  feminine: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
});

export const POST = withUser(async (userId, req) => {
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) throw new Error("Invalid vocabulary data.");
  const d = parsed.data;

  const key = normalizeArabicKey(d.arabic);
  const existing = await prisma.vocabularyItem.findFirst({
    where: { userId, arabic: stripHarakat(d.arabic) },
    select: { id: true },
  });
  if (existing || !key) {
    throw new Error("This word already exists in your library.");
  }

  const srs = initialSrsState("LEARNING");
  const item = await prisma.vocabularyItem.create({
    data: {
      userId,
      arabic: stripHarakat(d.arabic) || d.arabic,
      arabicWithHarakat: d.arabicWithHarakat || d.arabic,
      englishMeaning: d.englishMeaning,
      type: d.type,
      root: d.root || null,
      verbForm: d.verbForm || null,
      pastTense: d.pastTense || null,
      presentTense: d.presentTense || null,
      masdar: d.masdar || null,
      imperative: d.imperative || null,
      singular: d.singular || null,
      dual: d.dual || null,
      plural: d.plural || null,
      masculine: d.masculine || null,
      feminine: d.feminine || null,
      notes: d.notes || null,
      tags: d.tags ?? [],
      sourceType: "MANUAL",
      status: "LEARNING",
      masteryScore: srs.masteryScore ?? 0,
      nextReviewAt: srs.nextReviewAt ?? new Date(),
    },
  });
  return { ok: true, id: item.id };
});
