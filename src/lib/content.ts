import "server-only";

/**
 * Authentic source texts (Qur'an, Hadith) fetched from external APIs — NEVER
 * written or altered by the AI, so the sacred Arabic is always correct. The AI
 * only helps the learner understand and grade their translation of this text.
 */
export type SourceText = {
  kind: "quran" | "hadith";
  arabic: string; // with harakāt, as provided by the source
  english: string; // authoritative reference translation
  citation: string; // e.g. "Qurʾān 2:255 — Al-Baqarah" or "Sahih al-Bukhari #1"
};

const AYAH_COUNT = 6236;

/** A random Qur'an verse (Uthmani script + Sahih International translation). */
export async function fetchRandomAyah(): Promise<SourceText> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const n = 1 + Math.floor(Math.random() * AYAH_COUNT);
    const url = `https://api.alquran.cloud/v1/ayah/${n}/editions/quran-uthmani,en.sahih`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        data?: {
          text?: string;
          edition?: { language?: string };
          numberInSurah?: number;
          surah?: { number?: number; englishName?: string; name?: string };
        }[];
      };
      const data = json.data;
      if (!Array.isArray(data) || data.length < 2) continue;

      const ar = data.find((d) => d.edition?.language === "ar") ?? data[0];
      const en = data.find((d) => d.edition?.language === "en") ?? data[1];
      const arabic = (ar?.text ?? "").trim();
      const english = (en?.text ?? "").trim();
      if (!arabic || !english) continue;

      // Keep exercises a manageable length; retry for a shorter verse.
      if (arabic.length > 480 && attempt < 3) continue;

      return {
        kind: "quran",
        arabic,
        english,
        citation: `Qurʾān ${ar?.surah?.number ?? ""}:${ar?.numberInSurah ?? ""} — ${ar?.surah?.englishName ?? ""}`.trim(),
      };
    } catch {
      // network hiccup — try another verse
    }
  }
  throw new Error("Could not fetch a Qurʾān verse right now. Please try again.");
}

const HADITH_BOOKS = [
  { slug: "bukhari", name: "Sahih al-Bukhari", max: 7000 },
  { slug: "muslim", name: "Sahih Muslim", max: 7000 },
  { slug: "abudawud", name: "Sunan Abi Dawud", max: 5000 },
] as const;

const HADITH_BASE =
  "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions";

/** A random hadith (authentic Arabic + English), from a CDN-hosted dataset. */
export async function fetchRandomHadith(): Promise<SourceText> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const book = HADITH_BOOKS[Math.floor(Math.random() * HADITH_BOOKS.length)];
    const n = 1 + Math.floor(Math.random() * book.max);
    try {
      const [arRes, enRes] = await Promise.all([
        fetch(`${HADITH_BASE}/ara-${book.slug}/${n}.json`, {
          signal: AbortSignal.timeout(12_000),
        }),
        fetch(`${HADITH_BASE}/eng-${book.slug}/${n}.json`, {
          signal: AbortSignal.timeout(12_000),
        }),
      ]);
      if (!arRes.ok || !enRes.ok) continue;

      const arJson = (await arRes.json()) as { hadiths?: { text?: string }[] };
      const enJson = (await enRes.json()) as { hadiths?: { text?: string }[] };
      const arabic = (arJson.hadiths?.[0]?.text ?? "").trim();
      const english = (enJson.hadiths?.[0]?.text ?? "").trim();
      if (!arabic || !english) continue;

      // Prefer shorter narrations for a focused exercise.
      if (arabic.length > 650 && attempt < 5) continue;

      return {
        kind: "hadith",
        arabic,
        english,
        citation: `${book.name} #${n}`,
      };
    } catch {
      // try another
    }
  }
  throw new Error("Could not fetch a hadith right now. Please try again.");
}

/** Tokenize Arabic text into words (for matching deck vocabulary present). */
export function tokenizeArabic(text: string): string[] {
  return (text || "")
    .split(/[\s،.:؛!؟"'()«»\[\]{}\-—…]+/)
    .filter(Boolean);
}
