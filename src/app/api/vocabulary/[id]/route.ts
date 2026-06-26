import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { stripHarakat } from "@/lib/utils";

const updateSchema = z.object({
  arabic: z.string().min(1).optional(),
  arabicWithHarakat: z.string().nullable().optional(),
  englishMeaning: z.string().min(1).optional(),
  type: z
    .enum(["VERB", "NOUN", "ADJECTIVE", "PHRASE", "PARTICLE", "UNKNOWN"])
    .optional(),
  root: z.string().nullable().optional(),
  verbForm: z.string().nullable().optional(),
  pastTense: z.string().nullable().optional(),
  presentTense: z.string().nullable().optional(),
  masdar: z.string().nullable().optional(),
  imperative: z.string().nullable().optional(),
  singular: z.string().nullable().optional(),
  dual: z.string().nullable().optional(),
  plural: z.string().nullable().optional(),
  masculine: z.string().nullable().optional(),
  feminine: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  status: z
    .enum(["NEW", "LEARNING", "REVIEW", "WEAK", "MASTERED"])
    .optional(),
  masteryScore: z.number().min(0).max(100).optional(),
});

async function getOwned(userId: string, id: string) {
  const item = await prisma.vocabularyItem.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!item) throw new Error("Word not found.");
  return item;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    await getOwned(userId, id);

    const body = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) throw new Error("Invalid update.");
    const d = parsed.data;

    const data: Record<string, unknown> = { ...d };
    if (d.arabic) data.arabic = stripHarakat(d.arabic) || d.arabic;

    const updated = await prisma.vocabularyItem.update({
      where: { id },
      data,
    });
    return NextResponse.json({ ok: true, item: updated });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = err instanceof Error ? err.message : "Update failed.";
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
    await getOwned(userId, id);
    await prisma.vocabularyItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = err instanceof Error ? err.message : "Delete failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
