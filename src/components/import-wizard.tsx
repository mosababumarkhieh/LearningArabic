"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Upload,
  Loader2,
  FileUp,
  CheckCircle2,
  AlertTriangle,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type WordType = "VERB" | "NOUN" | "ADJECTIVE" | "PHRASE" | "PARTICLE" | "UNKNOWN";

type ParsedCard = {
  arabic: string;
  arabicWithHarakat: string | null;
  englishMeaning: string;
  type: WordType;
  deckName: string;
  section: string | null;
  tags: string[];
  rawFields: Record<string, string>;
  ambiguous: boolean;
  include: boolean;
};

type ParseResult = {
  fileName: string;
  primaryDeck: string;
  totalNotes: number;
  ambiguousCount: number;
  cards: Omit<ParsedCard, "include">[];
};

const TYPES: WordType[] = [
  "VERB",
  "NOUN",
  "ADJECTIVE",
  "PHRASE",
  "PARTICLE",
  "UNKNOWN",
];

export function ImportWizard() {
  const router = useRouter();
  const [parsing, setParsing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [result, setResult] = React.useState<ParseResult | null>(null);
  const [cards, setCards] = React.useState<ParsedCard[]>([]);
  const [filter, setFilter] = React.useState("");
  const [showAmbiguousOnly, setShowAmbiguousOnly] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setParsing(true);
    setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/import/parse", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to parse the deck.");
        return;
      }
      setResult(data);
      setCards(data.cards.map((c: ParsedCard) => ({ ...c, include: true })));
      toast.success(
        `Parsed ${data.totalNotes} notes from “${data.primaryDeck}”.`,
      );
    } catch {
      toast.error("Could not read the file.");
    } finally {
      setParsing(false);
    }
  }

  function updateCard(index: number, patch: Partial<ParsedCard>) {
    setCards((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    );
  }

  async function save() {
    const toSave = cards.filter(
      (c) => c.include && c.arabic.trim() && c.englishMeaning.trim(),
    );
    if (!toSave.length) {
      toast.error("Nothing to import — check your selections.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/import/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: result?.fileName,
          primaryDeck: result?.primaryDeck,
          cards: toSave.map((c) => ({
            arabic: c.arabic,
            arabicWithHarakat: c.arabicWithHarakat,
            englishMeaning: c.englishMeaning,
            type: c.type,
            deckName: c.deckName,
            section: c.section,
            tags: c.tags,
            rawFields: c.rawFields,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Import failed.");
        return;
      }
      toast.success(
        `Imported ${data.imported} words · ${data.duplicates} duplicates skipped.`,
      );
      router.push("/vocabulary");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const visible = cards
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => {
      if (showAmbiguousOnly && !c.ambiguous) return false;
      if (!filter) return true;
      const q = filter.toLowerCase();
      return (
        c.arabic.toLowerCase().includes(q) ||
        c.englishMeaning.toLowerCase().includes(q)
      );
    });

  const includedCount = cards.filter((c) => c.include).length;

  // ---- Upload step ----
  if (!result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upload an Anki deck</CardTitle>
          <CardDescription>
            Select a <code>.apkg</code> export. Arabic and English fields are
            detected automatically; you can correct them before saving.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-14 text-center"
          >
            {parsing ? (
              <>
                <Loader2 className="h-9 w-9 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Reading the collection…
                </p>
              </>
            ) : (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <FileUp className="h-7 w-7 text-primary" />
                </div>
                <p className="font-medium">Drag a .apkg file here</p>
                <p className="text-sm text-muted-foreground">or</p>
                <Button onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4" /> Choose file
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".apkg"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </>
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Tip: if your deck uses Anki&apos;s newest format, re-export with
            “Support older Anki versions” enabled.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ---- Review step ----
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Deck</p>
              <p className="font-semibold">{result.primaryDeck}</p>
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary">{result.totalNotes} notes</Badge>
              <Badge variant="default">{includedCount} selected</Badge>
              {result.ambiguousCount > 0 && (
                <Badge variant="warning">
                  {result.ambiguousCount} need review
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                setCards([]);
              }}
            >
              Start over
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Import {includedCount} words
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter words…"
            className="pl-8"
          />
        </div>
        <Button
          variant={showAmbiguousOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setShowAmbiguousOnly((v) => !v)}
        >
          <AlertTriangle className="h-4 w-4" />
          Ambiguous only
        </Button>
      </div>

      <div className="space-y-2">
        {visible.slice(0, 400).map(({ c, i }) => (
          <Card
            key={i}
            className={c.ambiguous ? "border-amber-400/60" : undefined}
          >
            <CardContent className="grid gap-3 py-3 sm:grid-cols-[auto_1fr_1fr_140px]">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={c.include}
                  onChange={(e) => updateCard(i, { include: e.target.checked })}
                  className="h-4 w-4 accent-[hsl(var(--primary))]"
                />
              </label>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Arabic</label>
                <Input
                  dir="rtl"
                  className="arabic text-lg"
                  value={c.arabicWithHarakat || c.arabic}
                  onChange={(e) =>
                    updateCard(i, {
                      arabic: e.target.value,
                      arabicWithHarakat: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">English</label>
                <Input
                  value={c.englishMeaning}
                  onChange={(e) =>
                    updateCard(i, { englishMeaning: e.target.value })
                  }
                  placeholder={c.ambiguous ? "Needs a meaning" : ""}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Type</label>
                <Select
                  value={c.type}
                  onValueChange={(v) => updateCard(i, { type: v as WordType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.charAt(0) + t.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {Object.keys(c.rawFields).length > 0 && (
                <details className="sm:col-span-4">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Raw Anki fields
                  </summary>
                  <div className="mt-2 grid gap-1 rounded-md bg-muted/50 p-2 text-xs">
                    {Object.entries(c.rawFields).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="font-medium text-muted-foreground">
                          {k}:
                        </span>
                        <span dir="auto">{v}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        ))}
        {visible.length > 400 && (
          <p className="py-2 text-center text-sm text-muted-foreground">
            Showing first 400 of {visible.length}. All selected words will be
            imported. Use the filter to find specific words.
          </p>
        )}
      </div>
    </div>
  );
}
