import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  Pencil,
  BookMarked,
  AlertCircle,
  Clock,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { StatusBadge, SourceBadge, masteryColor } from "@/components/status-badge";
import { VocabEditDialog } from "@/components/vocab-edit-dialog";
import { DeepDiveButton } from "@/components/deep-dive-button";
import { dictionaryLinks } from "@/lib/dictionary";
import { formatDate, formatRelative } from "@/lib/utils";

function Detail({ label, value, arabic }: { label: string; value?: string | null; arabic?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 border-b py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={arabic ? "arabic text-lg" : "text-sm font-medium"} dir={arabic ? "rtl" : undefined}>
        {value}
      </span>
    </div>
  );
}

export default async function DeepDivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const item = await prisma.vocabularyItem.findFirst({
    where: { id, userId: user.id },
    include: {
      forms: { orderBy: { createdAt: "asc" } },
      examples: { orderBy: { createdAt: "asc" } },
      reviews: { orderBy: { createdAt: "desc" }, take: 15 },
      mistakes: { orderBy: { createdAt: "desc" }, take: 15 },
    },
  });
  if (!item) notFound();

  // Related words sharing the same root.
  const related = item.root
    ? await prisma.vocabularyItem.findMany({
        where: { userId: user.id, root: item.root, id: { not: item.id } },
        take: 8,
        select: { id: true, arabic: true, arabicWithHarakat: true, englishMeaning: true },
      })
    : [];

  const links = dictionaryLinks(item.arabicWithHarakat || item.arabic, item.root);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/vocabulary">
            <ArrowLeft className="h-4 w-4" /> Library
          </Link>
        </Button>
        <div className="flex gap-2">
          <DeepDiveButton id={item.id} />
          <VocabEditDialog
            item={{
              id: item.id,
              arabic: item.arabic,
              arabicWithHarakat: item.arabicWithHarakat,
              englishMeaning: item.englishMeaning,
              type: item.type,
              root: item.root,
              verbForm: item.verbForm,
              pastTense: item.pastTense,
              presentTense: item.presentTense,
              masdar: item.masdar,
              imperative: item.imperative,
              singular: item.singular,
              dual: item.dual,
              plural: item.plural,
              masculine: item.masculine,
              feminine: item.feminine,
              notes: item.notes,
              status: item.status,
              masteryScore: item.masteryScore,
              tags: item.tags,
            }}
            trigger={
              <Button variant="outline">
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            }
          />
        </div>
      </div>

      {/* Hero */}
      <Card className="mb-4">
        <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="arabic text-5xl leading-tight" dir="rtl">
              {item.arabicWithHarakat || item.arabic}
            </p>
            <p className="mt-2 text-xl text-muted-foreground">
              {item.englishMeaning}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline">{item.type.toLowerCase()}</Badge>
              {item.verbForm && <Badge variant="secondary">{item.verbForm}</Badge>}
              <StatusBadge status={item.status} />
              <SourceBadge source={item.sourceType} />
              {item.tags.map((t) => (
                <Badge key={t} variant="muted" className="text-[10px]">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
          <div className="w-full sm:w-52">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Mastery</span>
              <span className="font-semibold">{item.masteryScore}%</span>
            </div>
            <Progress
              value={item.masteryScore}
              indicatorClassName={masteryColor(item.masteryScore)}
            />
            <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
              <div className="rounded-md bg-emerald-500/10 py-1.5">
                <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {item.correctCount}
                </div>
                <div className="text-muted-foreground">correct</div>
              </div>
              <div className="rounded-md bg-red-500/10 py-1.5">
                <div className="font-semibold text-red-600 dark:text-red-400">
                  {item.incorrectCount}
                </div>
                <div className="text-muted-foreground">missed</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Morphology */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Morphology</CardTitle>
          </CardHeader>
          <CardContent>
            <Detail label="Root" value={item.root} arabic />
            <Detail label="Verb form" value={item.verbForm} />
            <Detail label="Past tense" value={item.pastTense} arabic />
            <Detail label="Present tense" value={item.presentTense} arabic />
            <Detail label="Maṣdar" value={item.masdar} arabic />
            <Detail label="Imperative" value={item.imperative} arabic />
            <Detail label="Singular" value={item.singular} arabic />
            <Detail label="Dual" value={item.dual} arabic />
            <Detail label="Plural" value={item.plural} arabic />
            <Detail label="Masculine" value={item.masculine} arabic />
            <Detail label="Feminine" value={item.feminine} arabic />
            {!item.root &&
              !item.verbForm &&
              !item.pastTense &&
              !item.singular &&
              !item.masculine && (
                <p className="py-4 text-sm text-muted-foreground">
                  No morphology recorded yet. Use{" "}
                  <span className="font-medium">AI deep dive</span> to generate
                  it, or edit the word.
                </p>
              )}
          </CardContent>
        </Card>

        {/* Notes + provenance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes & source</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {item.notes ? (
              <p className="leading-relaxed">{item.notes}</p>
            ) : (
              <p className="text-muted-foreground">No notes yet.</p>
            )}
            <Separator />
            <Detail label="Source deck" value={item.sourceDeck} />
            <Detail label="Section" value={item.sourceSection} />
            <Detail label="Times seen" value={String(item.totalSeen)} />
            <Detail
              label="Last reviewed"
              value={item.lastReviewedAt ? formatRelative(item.lastReviewedAt) : "never"}
            />
            <Detail
              label="Next review"
              value={item.nextReviewAt ? formatRelative(item.nextReviewAt) : "—"}
            />
          </CardContent>
        </Card>
      </div>

      {/* Conjugation forms */}
      {item.forms.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Conjugation / forms</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {item.forms.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <span className="text-xs text-muted-foreground">{f.label}</span>
                  <span className="arabic text-lg" dir="rtl">
                    {f.arabic}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Examples */}
      {item.examples.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Example sentences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {item.examples.map((e) => (
              <div key={e.id} className="rounded-md border p-3">
                <p className="arabic text-xl leading-relaxed" dir="rtl">
                  {e.arabicWithHarakat || e.arabic}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{e.english}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Related root words */}
        {related.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookMarked className="h-4 w-4" /> Same root
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {related.map((r) => (
                <Link
                  key={r.id}
                  href={`/vocabulary/${r.id}`}
                  className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
                >
                  <span className="arabic text-lg" dir="rtl">
                    {r.arabicWithHarakat || r.arabic}
                  </span>{" "}
                  <span className="text-muted-foreground">— {r.englishMeaning}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Dictionary links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">External dictionaries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {links.map((l) => (
              <a
                key={l.name}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <span className="font-medium">{l.name}</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  {l.note} <ExternalLink className="h-3 w-3" />
                </span>
              </a>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" /> Review history
            </CardTitle>
          </CardHeader>
          <CardContent>
            {item.reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reviews yet.</p>
            ) : (
              <div className="space-y-1.5">
                {item.reviews.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">
                      {formatDate(r.createdAt)} · {r.mode.toLowerCase()}
                    </span>
                    <Badge
                      variant={
                        r.result === "CORRECT"
                          ? "success"
                          : r.result === "PARTIAL"
                            ? "warning"
                            : "destructive"
                      }
                    >
                      {r.result.toLowerCase()}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4" /> Mistake history
            </CardTitle>
          </CardHeader>
          <CardContent>
            {item.mistakes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No mistakes recorded. 🎉
              </p>
            ) : (
              <div className="space-y-2">
                {item.mistakes.map((m) => (
                  <div key={m.id} className="rounded-md border p-2 text-sm">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatDate(m.createdAt)}</span>
                      {m.mistakeType && <span>{m.mistakeType}</span>}
                    </div>
                    {m.userAnswer && (
                      <p className="text-red-600 dark:text-red-400 line-through">
                        {m.userAnswer}
                      </p>
                    )}
                    <p className="text-emerald-600 dark:text-emerald-400">
                      {m.correctAnswer}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
