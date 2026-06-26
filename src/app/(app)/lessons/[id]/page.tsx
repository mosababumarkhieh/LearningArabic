import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Languages, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { safeJsonParse, formatDate } from "@/lib/utils";

type Feedback = {
  summary?: string;
  fullTranslation?: string;
  corrections?: { original: string; correction: string; why: string }[];
  grammarNotes?: string[];
  missedWords?: { arabic: string; english: string }[];
};

export default async function LessonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const lesson = await prisma.lesson.findFirst({
    where: { id, userId: user.id },
    include: {
      items: { include: { vocabularyItem: true } },
      aiVocab: true,
    },
  });
  if (!lesson) notFound();

  const fb = safeJsonParse<Feedback>(lesson.aiFeedback, {});

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/lessons">
            <ArrowLeft className="h-4 w-4" /> History
          </Link>
        </Button>
        {lesson.score != null && (
          <Badge variant="secondary" className="text-base">
            {lesson.score}%
          </Badge>
        )}
      </div>

      <h1 className="text-2xl font-bold">{lesson.title}</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        {lesson.topic} · {formatDate(lesson.createdAt)}
      </p>

      {lesson.passageHarakat && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Passage</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="passage" dir="rtl">
              {lesson.passageHarakat}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {lesson.userTranslation && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your translation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-relaxed">{lesson.userTranslation}</p>
            </CardContent>
          </Card>
        )}

        {fb.fullTranslation && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Languages className="h-4 w-4" /> Natural translation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-relaxed">{fb.fullTranslation}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {fb.summary && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{fb.summary}</p>
            {fb.corrections && fb.corrections.length > 0 && (
              <div className="space-y-2">
                {fb.corrections.map((c, i) => (
                  <div key={i} className="rounded-md border p-2">
                    <p className="text-red-600 line-through dark:text-red-400">
                      {c.original}
                    </p>
                    <p className="text-emerald-600 dark:text-emerald-400">
                      {c.correction}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {fb.grammarNotes && fb.grammarNotes.length > 0 && (
              <ul className="list-disc space-y-1 pl-5">
                {fb.grammarNotes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {lesson.aiVocab.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" /> AI-introduced words
            </CardTitle>
            <CardDescription>
              Outcomes recorded for this lesson.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {lesson.aiVocab.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-md border p-2"
              >
                <div>
                  <span className="arabic text-xl" dir="rtl">
                    {a.arabicWithHarakat || a.arabic}
                  </span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {a.englishMeaning}
                  </span>
                </div>
                <Badge
                  variant={
                    a.status === "SAVED"
                      ? "warning"
                      : a.status === "IGNORED"
                        ? "success"
                        : "muted"
                  }
                >
                  {a.status.toLowerCase()}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">
            Words in this lesson ({lesson.items.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {lesson.items.map((li) => (
            <Link
              key={li.id}
              href={`/vocabulary/${li.vocabularyItem.id}`}
              className="rounded-md border px-2.5 py-1.5 text-sm hover:bg-accent"
            >
              <span className="arabic text-base" dir="rtl">
                {li.vocabularyItem.arabicWithHarakat || li.vocabularyItem.arabic}
              </span>
              <Badge variant="outline" className="ml-2 text-[10px]">
                {li.role}
              </Badge>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
