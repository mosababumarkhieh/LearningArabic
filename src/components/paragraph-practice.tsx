"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Loader2,
  Sparkles,
  BookOpenText,
  Eye,
  EyeOff,
  Check,
  X,
  Minus,
  RotateCcw,
  Languages,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { masteryColor } from "@/components/status-badge";
import { TOPIC_OPTIONS } from "@/lib/settings";

type Generated = {
  lessonId: string;
  title: string;
  topic: string;
  passageHarakat: string;
  passagePlain: string;
  harakatMode: string;
  source: "ai" | "offline";
  wordCount: number;
};

type Feedback = {
  score: number;
  summary: string;
  fullTranslation: string;
  corrections: { original: string; correction: string; why: string }[];
  grammarNotes: string[];
  missedWords: {
    arabic: string;
    english: string;
    type?: string;
    root?: string | null;
    past?: string | null;
    present?: string | null;
    masdar?: string | null;
    imperative?: string | null;
    example?: string;
    exampleEnglish?: string;
  }[];
  wordOutcomes: {
    id: string;
    arabic: string;
    english: string;
    result: string;
    masteryScore: number;
    status: string;
  }[];
  aiOutcomes: {
    arabic: string;
    english: string;
    outcome: "known" | "missed";
    saved: boolean;
  }[];
  source: "ai" | "offline";
};

type Phase = "idle" | "generating" | "reading" | "grading" | "feedback";

export function ParagraphPractice({ defaultTopic }: { defaultTopic: string }) {
  const router = useRouter();
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [topic, setTopic] = React.useState(defaultTopic);
  const [lesson, setLesson] = React.useState<Generated | null>(null);
  const [showHarakat, setShowHarakat] = React.useState(true);
  const [translation, setTranslation] = React.useState("");
  const [feedback, setFeedback] = React.useState<Feedback | null>(null);

  async function generate() {
    setPhase("generating");
    setFeedback(null);
    setTranslation("");
    try {
      const res = await fetch("/api/practice/paragraph/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic === "Mixed" ? "" : topic }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not generate a passage.");
        setPhase("idle");
        return;
      }
      setLesson(data);
      setShowHarakat(data.harakatMode !== "NONE" && data.harakatMode !== "TOGGLE");
      setPhase("reading");
      if (data.source === "offline") {
        toast.info("Generated offline (no AI key). Set AI_API_KEY for natural passages.");
      }
    } catch {
      toast.error("Network error.");
      setPhase("idle");
    }
  }

  async function submit() {
    if (!translation.trim()) {
      toast.error("Write your translation first.");
      return;
    }
    setPhase("grading");
    try {
      const res = await fetch("/api/practice/paragraph/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: lesson!.lessonId, translation }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Grading failed.");
        setPhase("reading");
        return;
      }
      setFeedback(data);
      setPhase("feedback");
      router.refresh();
    } catch {
      toast.error("Network error during grading.");
      setPhase("reading");
    }
  }

  // ---- Idle / generating ----
  if (phase === "idle" || phase === "generating") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-5 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <BookOpenText className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Generate a passage</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              A coherent Arabic passage built from your mastered, weak, and new
              words — then translate it and get targeted corrections.
            </p>
          </div>
          <div className="flex w-full max-w-xs flex-col gap-2">
            <Select value={topic} onValueChange={setTopic}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOPIC_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="lg" onClick={generate} disabled={phase === "generating"}>
              {phase === "generating" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {phase === "generating" ? "Writing your passage…" : "Generate passage"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---- Reading / grading ----
  if (phase === "reading" || phase === "grading") {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <div>
              <CardTitle>{lesson?.title}</CardTitle>
              <CardDescription>
                {lesson?.topic} · {lesson?.wordCount} of your words
                {lesson?.source === "offline" && " · offline draft"}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHarakat((v) => !v)}
            >
              {showHarakat ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              {showHarakat ? "Hide harakāt" : "Show harakāt"}
            </Button>
          </CardHeader>
          <CardContent>
            <p className="passage" dir="rtl">
              {showHarakat ? lesson?.passageHarakat : lesson?.passagePlain}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your English translation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
              placeholder="Translate the passage as best you can…"
              className="min-h-[160px] text-base"
              disabled={phase === "grading"}
            />
            <div className="flex justify-between">
              <Button
                variant="ghost"
                onClick={() => setPhase("idle")}
                disabled={phase === "grading"}
              >
                Cancel
              </Button>
              <Button onClick={submit} disabled={phase === "grading"} size="lg">
                {phase === "grading" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Grading…
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" /> Submit translation
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Feedback ----
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-5xl font-bold">{feedback?.score}%</p>
          <p className="max-w-xl text-sm text-muted-foreground">
            {feedback?.summary}
          </p>
          <div className="flex gap-2">
            <Button onClick={generate}>
              <RotateCcw className="h-4 w-4" /> New passage
            </Button>
            <Button variant="outline" asChild>
              <Link href="/ai-vocab">Review AI words</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI-introduced words — revealed only now */}
      {feedback && feedback.aiOutcomes.length > 0 && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" /> AI-introduced words
            </CardTitle>
            <CardDescription>
              New words the AI wove in. Missed ones are saved to your library and
              scheduled for review; known ones are left out.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {feedback.aiOutcomes.map((a, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div>
                  <span className="arabic text-2xl" dir="rtl">
                    {a.arabic}
                  </span>
                  <span className="ml-3 text-sm text-muted-foreground">
                    {a.english}
                  </span>
                </div>
                <Badge variant={a.saved ? "warning" : "success"}>
                  {a.saved ? "Saved · review scheduled" : "You knew it · skipped"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Missed words with morphology */}
      {feedback && feedback.missedWords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Missed / new vocabulary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {feedback.missedWords.map((w, i) => (
              <div key={i} className="rounded-md border p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="arabic text-2xl" dir="rtl">
                    {w.arabic}
                  </span>
                  <span className="text-sm font-medium">{w.english}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {w.type && <span>{w.type}</span>}
                  {w.root && (
                    <span className="arabic" dir="rtl">
                      root: {w.root}
                    </span>
                  )}
                  {w.past && <span>past: {w.past}</span>}
                  {w.present && <span>present: {w.present}</span>}
                  {w.masdar && <span>maṣdar: {w.masdar}</span>}
                  {w.imperative && <span>imperative: {w.imperative}</span>}
                </div>
                {w.example && (
                  <p className="arabic mt-2 text-lg" dir="rtl">
                    {w.example}
                  </p>
                )}
                {w.exampleEnglish && (
                  <p className="text-xs text-muted-foreground">
                    {w.exampleEnglish}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Corrections */}
      {feedback && feedback.corrections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Corrections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {feedback.corrections.map((c, i) => (
              <div key={i} className="rounded-md border p-3 text-sm">
                <p className="text-red-600 line-through dark:text-red-400">
                  {c.original}
                </p>
                <p className="text-emerald-600 dark:text-emerald-400">
                  {c.correction}
                </p>
                {c.why && (
                  <p className="mt-1 text-xs text-muted-foreground">{c.why}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Grammar notes */}
      {feedback && feedback.grammarNotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Grammar & structure</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {feedback.grammarNotes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Natural translation */}
      {feedback?.fullTranslation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Languages className="h-4 w-4" /> Natural translation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="leading-relaxed">{feedback.fullTranslation}</p>
          </CardContent>
        </Card>
      )}

      {/* Word mastery updates */}
      {feedback && feedback.wordOutcomes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mastery updates</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {feedback.wordOutcomes.map((w) => {
              const Icon =
                w.result === "correct"
                  ? Check
                  : w.result === "partial"
                    ? Minus
                    : X;
              return (
                <div
                  key={w.id}
                  className="flex items-center justify-between gap-2 rounded-md border p-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon
                      className={
                        "h-4 w-4 shrink-0 " +
                        (w.result === "correct"
                          ? "text-emerald-500"
                          : w.result === "partial"
                            ? "text-amber-500"
                            : "text-red-500")
                      }
                    />
                    <span className="arabic text-lg" dir="rtl">
                      {w.arabic}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {w.english}
                    </span>
                  </div>
                  <div className="flex w-20 shrink-0 items-center gap-2">
                    <span className="text-xs">{w.masteryScore}%</span>
                    <Progress
                      value={w.masteryScore}
                      indicatorClassName={masteryColor(w.masteryScore)}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
