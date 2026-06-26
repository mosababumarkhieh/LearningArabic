import "server-only";
import path from "node:path";
import AdmZip from "adm-zip";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import {
  stripHtml,
  stripHarakat,
  hasHarakat,
  stripAnkiMedia,
  stripTransliteration,
} from "@/lib/utils";

/**
 * .apkg files are ZIP archives containing an SQLite "collection" database.
 * We support the classic uncompressed formats (collection.anki2 / .anki21).
 * The newest zstd-compressed `collection.anki21b` is detected and rejected
 * with a clear, actionable message.
 */

export type ParsedCard = {
  arabic: string;
  arabicWithHarakat: string | null;
  englishMeaning: string;
  deckName: string;
  section: string | null;
  tags: string[];
  rawFields: Record<string, string>;
  ambiguous: boolean;
};

export type ParsedDeck = {
  primaryDeck: string;
  totalNotes: number;
  cards: ParsedCard[];
};

const FIELD_SEPARATOR = String.fromCharCode(0x1f); // Anki note field separator

let sqlPromise: Promise<SqlJsStatic> | null = null;
function getSql(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: (file) =>
        path.join(process.cwd(), "node_modules", "sql.js", "dist", file),
    });
  }
  return sqlPromise;
}

function arabicCount(s: string): number {
  return (s.match(/[؀-ۿݐ-ݿ]/g) || []).length;
}
function latinCount(s: string): number {
  return (s.match(/[A-Za-z]/g) || []).length;
}

const ARABIC_FIELD_HINTS = ["arabic", "front", "word", "عربي", "expression"];
const ENGLISH_FIELD_HINTS = [
  "english",
  "meaning",
  "translation",
  "definition",
  "back",
  "answer",
  "gloss",
];
// Fields that are clearly not the English meaning — audio, images, and
// transliteration/pronunciation. These must never win the English slot.
const ENGLISH_AVOID_HINTS = [
  "sound",
  "audio",
  "recording",
  "media",
  "image",
  "picture",
  "transliter",
  "romaniz",
  "translit",
  "pronunc",
  "phonetic",
  "ipa",
  "reading",
];

export async function parseApkg(buffer: Buffer): Promise<ParsedDeck> {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const names = entries.map((e) => e.entryName);

  // Prefer the most modern readable format.
  const dbEntry =
    entries.find((e) => e.entryName === "collection.anki21") ||
    entries.find((e) => e.entryName === "collection.anki2");

  if (!dbEntry) {
    if (names.includes("collection.anki21b")) {
      throw new Error(
        "This .apkg uses Anki's newest compressed format. In Anki, re-export the deck with “Support older Anki versions” checked, then upload again.",
      );
    }
    throw new Error(
      "No Anki collection database found inside this .apkg file. Is it a valid Anki export?",
    );
  }

  const SQL = await getSql();
  const db = new SQL.Database(dbEntry.getData());

  try {
    // ----- models + decks metadata from the single `col` row -----
    const colRes = db.exec("SELECT models, decks FROM col LIMIT 1");
    if (!colRes.length) throw new Error("Anki collection is empty.");
    const [modelsJson, decksJson] = colRes[0].values[0] as [string, string];
    const models = JSON.parse(modelsJson) as Record<
      string,
      { name: string; flds: { name: string; ord: number }[] }
    >;
    const decks = JSON.parse(decksJson) as Record<string, { name: string }>;

    // ----- map note id -> deck name via the cards table -----
    const noteDeck = new Map<string, string>();
    const cardsRes = db.exec("SELECT nid, did FROM cards");
    if (cardsRes.length) {
      for (const row of cardsRes[0].values) {
        const nid = String(row[0]);
        const did = String(row[1]);
        if (!noteDeck.has(nid)) {
          noteDeck.set(nid, decks[did]?.name ?? "Imported Deck");
        }
      }
    }

    // ----- notes -----
    const notesRes = db.exec("SELECT id, mid, flds, tags FROM notes");
    const cards: ParsedCard[] = [];
    const deckTally = new Map<string, number>();

    if (notesRes.length) {
      for (const row of notesRes[0].values) {
        const id = String(row[0]);
        const mid = String(row[1]);
        const flds = String(row[2] ?? "");
        const tagsRaw = String(row[3] ?? "");

        const model = models[mid];
        const values = flds.split(FIELD_SEPARATOR).map((v) => stripHtml(v));
        const fieldNames =
          model?.flds
            ?.slice()
            .sort((a, b) => a.ord - b.ord)
            .map((f) => f.name) ?? values.map((_, i) => `Field ${i + 1}`);

        const rawFields: Record<string, string> = {};
        values.forEach((v, i) => {
          rawFields[fieldNames[i] ?? `Field ${i + 1}`] = v;
        });

        const card = buildCard(rawFields, fieldNames, values);
        if (!card) continue; // entirely empty note

        const deckName = noteDeck.get(id) ?? "Imported Deck";
        card.deckName = deckName;
        card.section = sectionFromDeck(deckName);
        card.tags = tagsRaw.trim() ? tagsRaw.trim().split(/\s+/) : [];

        deckTally.set(deckName, (deckTally.get(deckName) ?? 0) + 1);
        cards.push(card);
      }
    }

    const primaryDeck =
      [...deckTally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
      "Imported Deck";

    return { primaryDeck, totalNotes: cards.length, cards };
  } finally {
    db.close();
  }
}

function sectionFromDeck(deckName: string): string | null {
  // Anki uses "::" for subdecks, e.g. "AMAU::Book 1::Lesson 3".
  if (deckName.includes("::")) {
    const parts = deckName.split("::");
    return parts[parts.length - 1] || null;
  }
  return null;
}

function buildCard(
  rawFields: Record<string, string>,
  fieldNames: string[],
  values: string[],
): ParsedCard | null {
  if (values.every((v) => !v.trim())) return null;

  // Pre-clean each field: media-stripped (for the English slot) and
  // transliteration-stripped (for the Arabic slot). Scoring uses the cleaned
  // text so a `[sound:…]`-only field can never be mistaken for the meaning.
  const mediaClean = values.map((v) => stripAnkiMedia(v));
  const arabicClean = values.map((v) => stripTransliteration(stripAnkiMedia(v)));

  // Score each field for "arabic-ness" and "english-ness", blending content
  // signal with field-name hints.
  let arabicIdx = -1;
  let arabicScore = -1;
  let englishIdx = -1;
  let englishScore = -1;

  values.forEach((_, i) => {
    const name = (fieldNames[i] ?? "").toLowerCase();
    const ar = arabicCount(arabicClean[i]);
    const la = latinCount(mediaClean[i]);
    const avoid = ENGLISH_AVOID_HINTS.some((h) => name.includes(h));

    let aScore = ar * 2;
    if (ARABIC_FIELD_HINTS.some((h) => name.includes(h))) aScore += 5;
    if (ar > 0 && aScore > arabicScore) {
      arabicScore = aScore;
      arabicIdx = i;
    }

    // English slot: real Latin meaning text only — never audio/transliteration.
    let eScore = la;
    if (ENGLISH_FIELD_HINTS.some((h) => name.includes(h))) eScore += 8;
    if (avoid) eScore -= 100;
    if (ar > la) eScore -= ar; // penalise mostly-Arabic fields for english slot
    if (la > 0 && !avoid && eScore > englishScore) {
      englishScore = eScore;
      englishIdx = i;
    }
  });

  // Don't let the same field be both.
  if (englishIdx === arabicIdx) {
    englishIdx = values.findIndex(
      (_, i) =>
        i !== arabicIdx &&
        latinCount(mediaClean[i]) > 0 &&
        !ENGLISH_AVOID_HINTS.some((h) =>
          (fieldNames[i] ?? "").toLowerCase().includes(h),
        ),
    );
  }

  // Clean values: Arabic free of transliteration, English free of media tags.
  const arabicField = arabicIdx >= 0 ? arabicClean[arabicIdx] : "";
  const englishField = englishIdx >= 0 ? mediaClean[englishIdx] : "";

  const ambiguous = !arabicField.trim() || !englishField.trim();

  const withHarakat = hasHarakat(arabicField) ? arabicField : null;
  const bareArabic = stripHarakat(arabicField) || arabicField;

  return {
    arabic: bareArabic.trim(),
    arabicWithHarakat: withHarakat,
    englishMeaning: englishField.trim(),
    deckName: "Imported Deck",
    section: null,
    tags: [],
    rawFields,
    ambiguous,
  };
}
