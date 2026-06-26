import Link from "next/link";
import { History, Type, BookOpenText, ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/utils";

export default async function LessonsPage() {
  const user = await requireUser();
  const lessons = await prisma.lesson.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 60,
    include: { _count: { select: { items: true, aiVocab: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Lesson History"
        description="Every lesson you've generated is saved with its words, your answers, and feedback."
      />

      {lessons.length === 0 ? (
        <EmptyState
          icon={History}
          title="No lessons yet"
          description="Start an isolated quiz or generate a paragraph to begin building history."
          action={
            <Button asChild>
              <Link href="/practice/paragraph">Start practising</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {lessons.map((l) => {
            const isParagraph = l.mode === "PARAGRAPH";
            const Icon = isParagraph ? BookOpenText : Type;
            const inner = (
              <CardContent className="flex items-center gap-4 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {l.title || (isParagraph ? "Paragraph" : "Isolated quiz")}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatRelative(l.createdAt)}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {l.mode.toLowerCase()}
                    </Badge>
                    <span>{l._count.items} words</span>
                    {l._count.aiVocab > 0 && (
                      <span>· {l._count.aiVocab} AI words</span>
                    )}
                    {!l.completed && <Badge variant="muted">in progress</Badge>}
                  </div>
                </div>
                {l.score != null && (
                  <div className="text-right">
                    <p className="text-lg font-bold">{l.score}%</p>
                  </div>
                )}
                {isParagraph && (
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </CardContent>
            );

            return isParagraph ? (
              <Link key={l.id} href={`/lessons/${l.id}`}>
                <Card className="transition-colors hover:bg-accent/30">{inner}</Card>
              </Link>
            ) : (
              <Card key={l.id}>{inner}</Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
