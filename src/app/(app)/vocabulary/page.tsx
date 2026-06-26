import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatusBadge, SourceBadge, masteryColor } from "@/components/status-badge";
import { VocabEditDialog } from "@/components/vocab-edit-dialog";
import { VocabRowActions } from "@/components/vocab-row-actions";
import { Library, Plus, ArrowRight } from "lucide-react";

const PAGE_SIZE = 30;
const STATUSES = ["", "NEW", "LEARNING", "REVIEW", "WEAK", "MASTERED"];
const SOURCES = ["", "ANKI_IMPORT", "AI_GENERATED", "MANUAL"];

export default async function VocabularyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = sp.q?.trim() || "";
  const status = sp.status || "";
  const source = sp.source || "";
  const deck = sp.deck || "";
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.VocabularyItemWhereInput = {
    userId: user.id,
    ...(status ? { status: status as never } : {}),
    ...(source ? { sourceType: source as never } : {}),
    ...(deck ? { sourceDeck: deck } : {}),
    ...(q
      ? {
          OR: [
            { arabic: { contains: q, mode: "insensitive" } },
            { arabicWithHarakat: { contains: q, mode: "insensitive" } },
            { englishMeaning: { contains: q, mode: "insensitive" } },
            { root: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total, decks] = await Promise.all([
    prisma.vocabularyItem.findMany({
      where,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.vocabularyItem.count({ where }),
    prisma.vocabularyItem.findMany({
      where: { userId: user.id, sourceDeck: { not: null } },
      distinct: ["sourceDeck"],
      select: { sourceDeck: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const deckOptions = decks
    .map((d) => d.sourceDeck)
    .filter(Boolean) as string[];

  const buildQuery = (overrides: Record<string, string | number>) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (source) params.set("source", source);
    if (deck) params.set("deck", deck);
    for (const [k, v] of Object.entries(overrides)) {
      if (v) params.set(k, String(v));
      else params.delete(k);
    }
    const s = params.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div>
      <PageHeader
        title="Vocabulary Library"
        description={`${total} word${total === 1 ? "" : "s"} in your database.`}
      >
        <VocabEditDialog
          trigger={
            <Button>
              <Plus className="h-4 w-4" /> Add word
            </Button>
          }
        />
      </PageHeader>

      {/* Filters (native GET form for SSR-friendly filtering) */}
      <form className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search Arabic, English, root…"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm lg:col-span-2"
        />
        <select
          name="status"
          defaultValue={status}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s ? s.charAt(0) + s.slice(1).toLowerCase() : "All statuses"}
            </option>
          ))}
        </select>
        <select
          name="source"
          defaultValue={source}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
        >
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s
                ? s === "ANKI_IMPORT"
                  ? "Anki imported"
                  : s === "AI_GENERATED"
                    ? "AI-added"
                    : "Manual"
                : "All sources"}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <select
            name="deck"
            defaultValue={deck}
            className="h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
          >
            <option value="">All decks</option>
            {deckOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <Button type="submit" variant="secondary">
            Filter
          </Button>
        </div>
      </form>

      {items.length === 0 ? (
        <EmptyState
          icon={Library}
          title={total === 0 && !q ? "No vocabulary yet" : "No matches"}
          description={
            total === 0 && !q
              ? "Import an Anki deck or add a word manually to get started."
              : "Try adjusting your filters."
          }
          action={
            total === 0 ? (
              <Button asChild>
                <Link href="/import">Import a deck</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Card key={item.id} className="transition-colors hover:bg-accent/30">
              <CardContent className="flex items-center gap-4 py-3">
                <Link
                  href={`/vocabulary/${item.id}`}
                  className="flex min-w-0 flex-1 items-center gap-4"
                >
                  <div className="w-40 shrink-0">
                    <p className="arabic text-2xl leading-tight" dir="rtl">
                      {item.arabicWithHarakat || item.arabic}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.englishMeaning}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">
                        {item.type.toLowerCase()}
                      </Badge>
                      {item.root && (
                        <span className="arabic text-xs text-muted-foreground" dir="rtl">
                          {item.root}
                        </span>
                      )}
                      <SourceBadge source={item.sourceType} />
                    </div>
                  </div>
                  <div className="hidden w-32 shrink-0 sm:block">
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{item.masteryScore}%</span>
                    </div>
                    <Progress
                      value={item.masteryScore}
                      indicatorClassName={masteryColor(item.masteryScore)}
                    />
                  </div>
                  <div className="w-24 shrink-0">
                    <StatusBadge status={item.status} />
                  </div>
                </Link>
                <VocabRowActions
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
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            asChild
            disabled={page <= 1}
          >
            <Link href={buildQuery({ page: page - 1 })}>Previous</Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            asChild
            disabled={page >= totalPages}
          >
            <Link href={buildQuery({ page: page + 1 })}>
              Next <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
