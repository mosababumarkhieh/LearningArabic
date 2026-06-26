import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { deepDive } from "@/lib/ai";

export const maxDuration = 60;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const item = await prisma.vocabularyItem.findFirst({
      where: { id, userId },
    });
    if (!item) throw new Error("Word not found.");

    const data = await deepDive({
      arabic: item.arabicWithHarakat || item.arabic,
      english: item.englishMeaning,
      type: item.type,
      root: item.root,
    });

    if (!data) {
      return NextResponse.json(
        {
          error:
            "AI deep dive is unavailable. Configure AI_API_KEY to generate detailed morphology.",
        },
        { status: 503 },
      );
    }

    // Fill in only fields that are currently empty, so we never clobber edits.
    const fill = <T>(current: T, next: T | null | undefined): T =>
      current ? current : ((next ?? current) as T);

    const updated = await prisma.vocabularyItem.update({
      where: { id },
      data: {
        arabicWithHarakat: fill(item.arabicWithHarakat, data.arabicWithHarakat),
        type:
          item.type === "UNKNOWN" && data.type
            ? (data.type.toUpperCase() as never)
            : item.type,
        root: fill(item.root, data.root),
        verbForm: fill(item.verbForm, data.verbForm),
        pastTense: fill(item.pastTense, data.past),
        presentTense: fill(item.presentTense, data.present),
        masdar: fill(item.masdar, data.masdar),
        imperative: fill(item.imperative, data.imperative),
        singular: fill(item.singular, data.singular),
        dual: fill(item.dual, data.dual),
        plural: fill(item.plural, data.plural),
        masculine: fill(item.masculine, data.masculine),
        feminine: fill(item.feminine, data.feminine),
        notes: fill(item.notes, data.notes),
      },
    });

    // Refresh AI-generated conjugation forms.
    if (data.conjugation?.length) {
      await prisma.vocabularyForm.deleteMany({
        where: { vocabularyItemId: id, note: "AI" },
      });
      await prisma.vocabularyForm.createMany({
        data: data.conjugation.slice(0, 30).map((c) => ({
          vocabularyItemId: id,
          label: c.label,
          arabic: c.arabic,
          note: "AI",
        })),
      });
    }

    // Add example sentences if we have few.
    const existingExamples = await prisma.exampleSentence.count({
      where: { vocabularyItemId: id },
    });
    if (data.examples?.length && existingExamples < 2) {
      await prisma.exampleSentence.createMany({
        data: data.examples.slice(0, 3).map((e) => ({
          vocabularyItemId: id,
          arabic: e.arabic,
          english: e.english,
          source: "AI_GENERATED",
        })),
      });
    }

    return NextResponse.json({
      ok: true,
      item: updated,
      relatedRootWords: data.relatedRootWords ?? [],
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = err instanceof Error ? err.message : "Deep dive failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
