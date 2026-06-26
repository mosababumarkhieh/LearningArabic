import { stripHarakat } from "@/lib/utils";

/**
 * External dictionary links. We only build clean search URLs — no scraping of
 * copyrighted material (Hans Wehr / Lane's are linked, not reproduced).
 */
export function dictionaryLinks(arabic: string, root?: string | null) {
  const word = encodeURIComponent(stripHarakat(arabic));
  const rootQuery = root ? encodeURIComponent(root.replace(/[\s-]+/g, "")) : word;
  return [
    {
      name: "Wiktionary",
      url: `https://en.wiktionary.org/wiki/${word}`,
      note: "Definitions, etymology, conjugation tables",
    },
    {
      name: "Almaany",
      url: `https://www.almaany.com/ar/dict/ar-en/${word}/`,
      note: "Arabic–English dictionary",
    },
    {
      name: "Quranic Arabic Corpus",
      url: `https://corpus.quran.com/search.jsp?q=${rootQuery}`,
      note: "Root usage across the Qurʾān",
    },
    {
      name: "Lane's Lexicon",
      url: `https://lexicon.quranic-research.net/search.html?q=${word}`,
      note: "Classical lexicon (search)",
    },
    {
      name: "Hans Wehr (search)",
      url: `https://www.google.com/search?q=${word}+Hans+Wehr`,
      note: "External search — not reproduced here",
    },
  ];
}
