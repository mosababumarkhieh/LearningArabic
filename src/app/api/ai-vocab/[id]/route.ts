import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { stripHarakat } from "@/lib/utils";
import { initialSrsState } from "@/lib/srs";

const schema = z.object({
  action: z.enum(["save", "reject", "ignore", "edit"]),
  arabicWithHarakat: z.string().optional(),
  englishMeaning: z.string().optional(),
  type: z
    .enum(["VERB", "NOUN", "ADJECTIVE", "PHRASE", "PARTICLE", "UNKNOWN"])
    .optional(),
  root: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const ai = await prisma.aIIntroducedVocabulary.findFirst({
      where: { id, userId },
    });
    if (!ai) throw new Error("AI word not found.");

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new Error("Invalid request.");
    const d = parsed.data;

    // Apply any field edits to the AI record first.
    const edited = await prisma.aIIntroducedVocabulary.update({
      where: { id },
      data: {
        arabicWithHarakat: d.arabicWithHarakat ?? ai.arabicWithHarakat,
        englishMeaning: d.englishMeaning ?? ai.englishMeaning,
        type: d.type ?? ai.type,
        root: d.root ?? ai.root,
        notes: d.notes ?? ai.notes,
        status: d.action === "edit" ? ai.status : ai.status,
      },
    });

    if (d.action === "reject") {
      await prisma.aIIntroducedVocabulary.update({
        where: { id },
        data: { status: "REJECTED" },
      });
      return NextResponse.json({ ok: true });
    }
    if (d.action === "ignore") {
      await prisma.aIIntroducedVocabulary.update({
        where: { id },
        data: { status: "IGNORED" },
      });
      return NextResponse.json({ ok: true });
    }
    if (d.action === "edit") {
      return NextResponse.json({ ok: true });
    }

    // action === "save": create or link a permanent VocabularyItem.
    const arabicForm = edited.arabicWithHarakat || edited.arabic;
    const bare = stripHarakat(arabicForm) || arabicForm;
    const existing = await prisma.vocabularyItem.findFirst({
      where: { userId, arabic: bare },
      select: { id: true },
    });

    let savedId: string;
    if (existing) {
      savedId = existing.id;
    } else {
      const status = edited.wasMissed ? "WEAK" : "LEARNING";
      const srs = initialSrsState(status);
      const created = await prisma.vocabularyItem.create({
        data: {
          userId,
          arabic: bare,
          arabicWithHarakat: arabicForm,
          englishMeaning: edited.englishMeaning,
          type: edited.type,
          root: edited.root,
          pastTense: edited.pastTense,
          presentTense: edited.presentTense,
          masdar: edited.masdar,
          imperative: edited.imperative,
          notes: edited.notes,
          sourceType: "AI_GENERATED",
          aiIntroduced: true,
          firstLessonId: edited.lessonId,
          status,
          masteryScore: srs.masteryScore ?? 0,
          nextReviewAt: srs.nextReviewAt ?? new Date(),
          examples:
            edited.exampleArabic && edited.exampleEnglish
              ? {
                  create: {
                    arabic: edited.exampleArabic,
                    english: edited.exampleEnglish,
                    source: "AI_GENERATED",
                  },
                }
              : undefined,
        },
      });
      savedId = created.id;
    }

    await prisma.aIIntroducedVocabulary.update({
      where: { id },
      data: { status: "SAVED", savedVocabularyItemId: savedId },
    });

    return NextResponse.json({ ok: true, savedVocabularyItemId: savedId });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = err instanceof Error ? err.message : "Action failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const ai = await prisma.aIIntroducedVocabulary.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!ai) throw new Error("AI word not found.");
    await prisma.aIIntroducedVocabulary.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = err instanceof Error ? err.message : "Delete failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
