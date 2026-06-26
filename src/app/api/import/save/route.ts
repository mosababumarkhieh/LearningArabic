import { z } from "zod";
import { prisma } from "@/lib/db";
import { withUser } from "@/lib/api";
import { importCards } from "@/lib/vocab";

const cardSchema = z.object({
  arabic: z.string(),
  arabicWithHarakat: z.string().nullable().optional(),
  englishMeaning: z.string(),
  type: z
    .enum(["VERB", "NOUN", "ADJECTIVE", "PHRASE", "PARTICLE", "UNKNOWN"])
    .optional(),
  deckName: z.string(),
  section: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  rawFields: z.record(z.string()).nullable().optional(),
});

const schema = z.object({
  fileName: z.string(),
  primaryDeck: z.string(),
  cards: z.array(cardSchema),
});

export const POST = withUser(async (userId, req) => {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new Error("Invalid import payload.");
  }
  const { fileName, primaryDeck, cards } = parsed.data;

  const deckImport = await prisma.deckImport.create({
    data: {
      userId,
      name: primaryDeck,
      fileName,
      totalNotes: cards.length,
    },
  });

  const summary = await importCards(
    userId,
    deckImport.id,
    cards.map((c) => ({
      arabic: c.arabic,
      arabicWithHarakat: c.arabicWithHarakat ?? null,
      englishMeaning: c.englishMeaning,
      type: c.type,
      deckName: c.deckName,
      section: c.section ?? null,
      tags: c.tags ?? [],
      rawFields: c.rawFields ?? null,
    })),
  );

  await prisma.deckImport.update({
    where: { id: deckImport.id },
    data: {
      importedCount: summary.imported,
      duplicateCount: summary.duplicates,
      ambiguousCount: summary.skipped,
    },
  });

  return {
    ok: true,
    deckImportId: deckImport.id,
    ...summary,
  };
});
