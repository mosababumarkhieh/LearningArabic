import "server-only";
import type { WordType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeArabicKey, stripHarakat } from "@/lib/utils";
import { initialSrsState } from "@/lib/srs";

/** Heuristic part-of-speech guess from an English gloss. */
export function guessType(english: string): WordType {
  const e = english.toLowerCase().trim();
  if (/^to\s+\w/.test(e)) return "VERB";
  if (/^(a|an|the)\s/.test(e)) return "NOUN";
  return "UNKNOWN";
}

export type ImportCardInput = {
  arabic: string;
  arabicWithHarakat?: string | null;
  englishMeaning: string;
  type?: WordType;
  deckName: string;
  section?: string | null;
  tags?: string[];
  rawFields?: Record<string, string> | null;
};

export type ImportSummary = {
  imported: number;
  duplicates: number;
  skipped: number;
};

/**
 * Insert parsed cards for a user, skipping duplicates (by normalized Arabic
 * key) against both the existing database and within the batch itself.
 * Newly imported words start with status NEW.
 */
export async function importCards(
  userId: string,
  deckImportId: string,
  cards: ImportCardInput[],
): Promise<ImportSummary> {
  // Preload existing normalized keys for fast dedupe.
  const existing = await prisma.vocabularyItem.findMany({
    where: { userId },
    select: { arabic: true },
  });
  const seen = new Set(existing.map((v) => normalizeArabicKey(v.arabic)));

  let imported = 0;
  let duplicates = 0;
  let skipped = 0;

  const toCreate: Prisma.VocabularyItemCreateManyInput[] = [];

  for (const card of cards) {
    const arabic = (card.arabic || "").trim();
    const english = (card.englishMeaning || "").trim();
    if (!arabic || !english) {
      skipped++;
      continue;
    }
    const key = normalizeArabicKey(arabic);
    if (!key || seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);

    const srs = initialSrsState("NEW");
    toCreate.push({
      userId,
      deckImportId,
      arabic: stripHarakat(arabic) || arabic,
      arabicWithHarakat: card.arabicWithHarakat || null,
      englishMeaning: english,
      type: card.type ?? guessType(english),
      tags: card.tags ?? [],
      rawFields: card.rawFields ? JSON.stringify(card.rawFields) : null,
      sourceType: "ANKI_IMPORT",
      sourceDeck: card.deckName,
      sourceSection: card.section ?? null,
      status: "NEW",
      masteryScore: srs.masteryScore ?? 0,
      nextReviewAt: srs.nextReviewAt ?? new Date(),
    });
    imported++;
  }

  if (toCreate.length) {
    await prisma.vocabularyItem.createMany({ data: toCreate });
  }

  return { imported, duplicates, skipped };
}

/** Counts by status for a user — used by the dashboard and headers. */
export async function vocabStatusCounts(userId: string) {
  const grouped = await prisma.vocabularyItem.groupBy({
    by: ["status"],
    where: { userId },
    _count: { _all: true },
  });
  const base = { NEW: 0, LEARNING: 0, REVIEW: 0, WEAK: 0, MASTERED: 0 };
  for (const g of grouped) {
    base[g.status] = g._count._all;
  }
  return base;
}
