"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Loader2,
  ArrowRight,
  Check,
  X,
  Minus,
  RotateCcw,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { masteryColor } from "@/components/status-badge";

type Word = {
  id: string;
  arabic: string;
  arabicWithHarakat: string | null;
  type: string;
};

type Result = {
  id: string;
  arabic: string;
  yourAnswer: string;
  correctMeaning: string;
  result: "correct" | "partial" | "incorrect" | "skipped";
  note: string | null;
  type: string;
  root: string | null;
  pastTense: string | null;
  presentTense: string | null;
  masdar: string | null;
  imperative: string | null;
  singular: string | null;
  dual: string | null;
  plural: string | null;
  masculine: string | null;
  feminine: string | null;
  masteryScore: number;
  status: string;
};

type Phase = "idle" | "loading" | "active" | "grading" | "done";

const RESULT_META = {
  correct: { icon: Check, variant: "success" as const, label: "Correct" },
  partial: { icon: Minus, variant: "warning" as const, label: "Partial" },
  incorrect: { icon: X, variant: "destructive" as const, label: "Incorrect" },
  skipped: { icon: Minus, variant: "muted" as const, label: "Skipped" },
};

export function IsolatedQuiz() {
  const router = useRouter();
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [lessonId, setLessonId] = React.useState<string | null>(null);
  const [words, setWords] = React.useState<Word[]>([]);
  const [idx, setIdx] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [current, setCurrent] = React.useState("");
  const [results, setResults] = React.useState<Result[]>([]);
  const [summary, setSummary] = React.useState<{ score: number; correctCount: number; total: number } | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function start() {
    setPhase("loading");
    try {
      const res = await fetch("/api/practice/isolated/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not start the quiz.");
        setPhase("idle");
        return;
      }
      setLessonId(data.lessonId);
      setWords(data.words);
      setIdx(0);
      setAnswers({});
      setCurrent("");
      setResults([]);
      setSummary(null);
      setPhase("active");
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch {
      toast.error("Network error.");
      setPhase("idle");
    }
  }

  function next() {
    const word = words[idx];
    const updated = { ...answers, [word.id]: current };
    setAnswers(updated);
    setCurrent("");
    if (idx + 1 < words.length) {
      setIdx(idx + 1);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      grade(updated);
    }
  }

  async function grade(finalAnswers: Record<string, string>) {
    setPhase("grading");
    try {
      const res = await fetch("/api/practice/isolated/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          answers: words.map((w) => ({
            id: w.id,
            answer: finalAnswers[w.id] ?? "",
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Grading failed.");
        setPhase("active");
        return;
      }
      setResults(data.results);
      setSummary({ score: data.score, correctCount: data.correctCount, total: data.total });
      setPhase("done");
      router.refresh();
    } catch {
      toast.error("Network error during grading.");
      setPhase("active");
    }
  }

  // ---- Idle ----
  if (phase === "idle" || phase === "loading") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Type className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Active-recall quiz</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              You&apos;ll see Arabic words one at a time and type the English
              meaning from memory. Words are picked by what&apos;s due, weak, or
              new.
            </p>
          </div>
          <Button size="lg" onClick={start} disabled={phase === "loading"}>
            {phase === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
            Start quiz
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ---- Active / grading ----
  if (phase === "active" || phase === "grading") {
    const word = words[idx];
    const progress = (idx / words.length) * 100;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Progress value={progress} className="flex-1" />
          <span className="text-sm text-muted-foreground">
            {idx + 1} / {words.length}
          </span>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-6 py-12">
            <Badge variant="outline">{word.type.toLowerCase()}</Badge>
            <p className="arabic text-6xl" dir="rtl">
              {word.arabicWithHarakat || word.arabic}
            </p>
            <form
              className="flex w-full max-w-md gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (phase !== "grading") next();
              }}
            >
              <Input
                ref={inputRef}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                placeholder="Type the English meaning…"
                className="h-11 text-center text-base"
                autoComplete="off"
                disabled={phase === "grading"}
              />
              <Button type="submit" size="lg" disabled={phase === "grading"}>
                {phase === "grading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : idx + 1 === words.length ? (
                  "Finish"
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
              </Button>
            </form>
            <button
              type="button"
              onClick={() => phase !== "grading" && next()}
              className="text-sm text-muted-foreground hover:text-foreground"
              disabled={phase === "grading"}
            >
              Skip / I don&apos;t know
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Results ----
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-5xl font-bold">{summary?.score}%</p>
          <p className="text-muted-foreground">
            {summary?.correctCount} of {summary?.total} correct
          </p>
          <div className="flex gap-2">
            <Button onClick={start}>
              <RotateCcw className="h-4 w-4" /> New quiz
            </Button>
            <Button variant="outline" asChild>
              <Link href="/practice/paragraph">Try paragraph mode</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {results.map((r) => {
          const meta = RESULT_META[r.result];
          const Icon = meta.icon;
          return (
            <Card key={r.id}>
              <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 py-3">
                <div className="flex items-center gap-3">
                  <Badge variant={meta.variant} className="gap-1">
                    <Icon className="h-3 w-3" /> {meta.label}
                  </Badge>
                  <span className="arabic text-2xl" dir="rtl">
                    {r.arabic}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{r.masteryScore}%</span>
                  <div className="w-16">
                    <Progress
                      value={r.masteryScore}
                      indicatorClassName={masteryColor(r.masteryScore)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 pt-0 text-sm">
                {r.result !== "correct" && r.yourAnswer && (
                  <p className="text-muted-foreground">
                    You wrote:{" "}
                    <span className="text-red-600 dark:text-red-400">
                      {r.yourAnswer}
                    </span>
                  </p>
                )}
                <p>
                  <span className="text-muted-foreground">Meaning: </span>
                  <span className="font-medium">{r.correctMeaning}</span>
                </p>
                {r.note && (
                  <p className="text-xs text-muted-foreground">{r.note}</p>
                )}
                <WordForms r={r} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function WordForms({ r }: { r: Result }) {
  const rows: [string, string | null][] = [];
  if (r.type === "VERB") {
    rows.push(
      ["Root", r.root],
      ["Past", r.pastTense],
      ["Present", r.presentTense],
      ["Maṣdar", r.masdar],
      ["Imperative", r.imperative],
    );
  } else if (r.type === "NOUN") {
    rows.push(["Singular", r.singular], ["Dual", r.dual], ["Plural", r.plural]);
  } else if (r.type === "ADJECTIVE") {
    rows.push(["Masculine", r.masculine], ["Feminine", r.feminine]);
  }
  const present = rows.filter(([, v]) => v);
  if (!present.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 rounded-md bg-muted/50 p-2 text-xs">
      {present.map(([label, value]) => (
        <span key={label}>
          <span className="text-muted-foreground">{label}: </span>
          <span className="arabic text-sm" dir="rtl">
            {value}
          </span>
        </span>
      ))}
    </div>
  );
}
