import { NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { parseApkg } from "@/lib/anki/parser";
import { guessType } from "@/lib/vocab";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "No file uploaded." },
        { status: 400 },
      );
    }
    const blob = file as File;
    if (!blob.name.toLowerCase().endsWith(".apkg")) {
      return NextResponse.json(
        { error: "Please upload a .apkg file (Anki deck export)." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    const parsed = await parseApkg(buffer);

    const cards = parsed.cards.map((c) => ({
      ...c,
      type: guessType(c.englishMeaning),
    }));

    return NextResponse.json({
      fileName: blob.name,
      primaryDeck: parsed.primaryDeck,
      totalNotes: parsed.totalNotes,
      ambiguousCount: cards.filter((c) => c.ambiguous).length,
      cards,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message =
      err instanceof Error ? err.message : "Failed to parse the .apkg file.";
    console.error("[import/parse]", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
