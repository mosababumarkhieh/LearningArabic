import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, UnauthorizedError } from "@/lib/auth";

const COLUMNS = [
  "arabic",
  "arabicWithHarakat",
  "englishMeaning",
  "type",
  "root",
  "verbForm",
  "pastTense",
  "presentTense",
  "masdar",
  "imperative",
  "singular",
  "dual",
  "plural",
  "masculine",
  "feminine",
  "notes",
  "sourceType",
  "sourceDeck",
  "status",
  "masteryScore",
  "correctCount",
  "incorrectCount",
  "totalSeen",
  "totalMissed",
] as const;

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }

  const format = new URL(req.url).searchParams.get("format") || "json";
  const items = await prisma.vocabularyItem.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  const date = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const header = COLUMNS.join(",");
    const rows = items.map((it) =>
      COLUMNS.map((c) => csvCell((it as Record<string, unknown>)[c])).join(","),
    );
    const csv = [header, ...rows].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="arabic-vocab-${date}.csv"`,
      },
    });
  }

  const json = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      count: items.length,
      vocabulary: items,
    },
    null,
    2,
  );
  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="arabic-vocab-${date}.json"`,
    },
  });
}
