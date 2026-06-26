import Link from "next/link";
import { Sparkles, ExternalLink } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { aiIsLive } from "@/lib/ai";
import { PageHeader, EmptyState } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AiVocabActions } from "@/components/ai-vocab-actions";
import { formatRelative } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "warning" | "success" | "secondary" | "destructive" | "muted"> = {
  PENDING: "warning",
  SAVED: "success",
  IGNORED: "secondary",
  REJECTED: "destructive",
  EDITED: "muted",
};

export default async function AiVocabPage() {
  const user = await requireUser();
  const items = await prisma.aIIntroducedVocabulary.findMany({
    where: { userId: user.id },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: { lesson: { select: { id: true, title: true } } },
  });

  const pending = items.filter((i) => i.status === "PENDING");
  const resolved = items.filter((i) => i.status !== "PENDING");

  return (
    <div>
      <PageHeader
        title="AI-Added Vocabulary"
        description="Words the AI introduced beyond your decks — managed separately from Anki-imported vocabulary."
      >
        <Badge variant={aiIsLive() ? "success" : "muted"}>
          {aiIsLive() ? "AI live" : "Offline"}
        </Badge>
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No AI words yet"
          description="When you do a paragraph lesson, the AI may weave in a few new words. Missed ones are saved automatically; the rest land here for you to review."
          action={
            <Button asChild>
              <Link href="/practice/paragraph">Generate a passage</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">
                Awaiting your decision ({pending.length})
              </h2>
              <div className="space-y-3">
                {pending.map((item) => (
                  <AiCard key={item.id} item={item} actions />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-lg font-semibold">
              Resolved ({resolved.length})
            </h2>
            {resolved.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing resolved yet.</p>
            ) : (
              <div className="space-y-2">
                {resolved.map((item) => (
                  <AiCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function AiCard({
  item,
  actions = false,
}: {
  item: {
    id: string;
    arabic: string;
    arabicWithHarakat: string | null;
    englishMeaning: string;
    type: string;
    root: string | null;
    status: string;
    wasMissed: boolean;
    savedVocabularyItemId: string | null;
    createdAt: Date;
    lesson: { id: string; title: string | null } | null;
  };
  actions?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="arabic text-3xl" dir="rtl">
              {item.arabicWithHarakat || item.arabic}
            </CardTitle>
            <CardDescription className="mt-1 text-base">
              {item.englishMeaning}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-[10px]">
              {item.type.toLowerCase()}
            </Badge>
            {item.wasMissed && <Badge variant="destructive">missed</Badge>}
            <Badge variant={STATUS_VARIANT[item.status] ?? "muted"}>
              {item.status.toLowerCase()}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {item.root && (
            <span className="arabic" dir="rtl">
              root: {item.root}
            </span>
          )}
          <span>introduced {formatRelative(item.createdAt)}</span>
          {item.lesson && (
            <Link
              href={`/lessons/${item.lesson.id}`}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              from lesson <ExternalLink className="h-3 w-3" />
            </Link>
          )}
          {item.savedVocabularyItemId && (
            <Link
              href={`/vocabulary/${item.savedVocabularyItemId}`}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              in library <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
        {actions && <AiVocabActions id={item.id} status={item.status} />}
      </CardContent>
    </Card>
  );
}
