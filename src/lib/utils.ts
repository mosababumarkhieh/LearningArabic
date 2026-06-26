import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Arabic harakat (diacritics) unicode range. */
const HARAKAT_REGEX = /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭ࣓-ࣣ࣡-ࣿ]/g;

/** Tatweel / kashida. */
const TATWEEL_REGEX = /ـ/g;

/** Any Arabic letter. */
export const ARABIC_LETTER_REGEX = /[؀-ۿݐ-ݿࢠ-ࣿ]/;

/** Strip harakat and tatweel to get the bare consonantal skeleton. */
export function stripHarakat(input: string): string {
  return (input || "")
    .replace(HARAKAT_REGEX, "")
    .replace(TATWEEL_REGEX, "")
    .trim();
}

export function hasHarakat(input: string): boolean {
  return HARAKAT_REGEX.test(input || "");
}

export function containsArabic(input: string): boolean {
  return ARABIC_LETTER_REGEX.test(input || "");
}

/** Remove HTML tags, decode a few common entities, collapse whitespace. */
export function stripHtml(input: string): string {
  if (!input) return "";
  return input
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Remove Anki media markup and bare audio/image filenames. These often leak
 * into the "English" slot (e.g. `book[sound:rec_1234.mp3]`) and must be dropped.
 */
export function stripAnkiMedia(input: string): string {
  if (!input) return "";
  return input
    .replace(/\[sound:[^\]]*\]/gi, " ")
    .replace(/\[anki:[^\]]*\]/gi, " ")
    .replace(/\[\[[^\]]*\]\]/g, " ")
    .replace(/\S+\.(mp3|ogg|wav|m4a|webm|flac|aac|jpg|jpeg|png|gif|svg)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Strip Latin-script transliteration (and Latin-containing notes in brackets)
 * out of an Arabic field, keeping Arabic script + harakāt intact. Used so the
 * imported Arabic is clean without manual editing.
 */
const TRANSLIT_CHARS = "A-Za-z\\u00c0-\\u024f\\u1e00-\\u1eff\\u02bc-\\u02bf";
const TRANSLIT_RUN = new RegExp(`[${TRANSLIT_CHARS}][${TRANSLIT_CHARS}'\\-]*`, "g");

export function stripTransliteration(input: string): string {
  if (!input) return "";
  let s = input;
  // Drop parenthesised / bracketed notes that contain Latin letters.
  s = s.replace(/\([^()]*[A-Za-z][^()]*\)/g, " ");
  s = s.replace(/\[[^\][]*[A-Za-z][^\][]*\]/g, " ");
  // Drop Latin-script runs (with common transliteration diacritics).
  s = s.replace(TRANSLIT_RUN, " ");
  // Clean up now-empty brackets and stray separators left behind.
  s = s.replace(/[()[\]{}]/g, " ").replace(/[-–—:;,/|]+/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

/** Normalize an Arabic string for duplicate detection. */
export function normalizeArabicKey(input: string): string {
  return stripHarakat(input)
    .replace(/[آأإٱ]/g, "ا") // alef variants -> bare alef
    .replace(/ة/g, "ه") // ta marbuta -> ha
    .replace(/ى/g, "ي") // alef maqsura -> ya
    .replace(/[^؀-ۿ]/g, "")
    .trim();
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return "never";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = d.getTime() - Date.now();
  const abs = Math.abs(diff);
  const day = 86400000;
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (abs < 3600000) return rtf.format(Math.round(diff / 60000), "minute");
  if (abs < day) return rtf.format(Math.round(diff / 3600000), "hour");
  if (abs < day * 30) return rtf.format(Math.round(diff / day), "day");
  return rtf.format(Math.round(diff / (day * 30)), "month");
}

export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
