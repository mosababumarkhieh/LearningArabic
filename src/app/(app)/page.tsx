import Link from "next/link";
import {
  Library,
  CalendarClock,
  Trophy,
  AlertTriangle,
  Sparkles,
  Target,
  BookOpenText,
  Type,
  Upload,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDashboardStats } from "@/lib/stats";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AccuracyChart, StatusPie } from "@/components/charts";
import { masteryColor } from "@/components/status-badge";
import { formatRelative } from "@/lib/utils";

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "primary" | "warning" | "danger";
}) {
  const toneClass =
    tone === "primary"
      ? "text-primary"
      : tone === "warning"
        ? "text-amber-500"
        : tone === "danger"
          ? "text-red-500"
          : "text-muted-foreground";
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <Icon className={`h-5 w-5 ${toneClass}`} />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          {hint && <p className="truncate text-[11px] text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const s = await getDashboardStats(user.id);

  if (s.total === 0) {
    return (
      <div>
        <PageHeader
          title={`Welcome${user.name ? `, ${user.name}` : ""}`}
          description="Your personalized Arabic learning hub."
        />
        <EmptyState
          icon={Upload}
          title="Let's get your vocabulary in"
          description="Import an Anki .apkg deck to build your database. Everything you learn — mastery, mistakes, and AI-added words — is saved here permanently."
          action={
            <Button asChild size="lg">
              <Link href="/import">Import your first deck</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const pieData = [
    { name: "New", value: s.counts.NEW },
    { name: "Learning", value: s.counts.LEARNING },
    { name: "Review", value: s.counts.REVIEW },
    { name: "Weak", value: s.counts.WEAK },
    { name: "Mastered", value: s.counts.MASTERED },
  ];

  return (
    <div>
      <PageHeader
        title={`Welcome${user.name ? `, ${user.name}` : ""}`}
        description="Progress is saved to your database and never forgotten."
      >
        <Button asChild>
          <Link href="/practice/paragraph">
            <BookOpenText className="h-4 w-4" /> Practice
          </Link>
        </Button>
      </PageHeader>

      {s.pendingAi > 0 && (
        <Card className="mb-4 border-primary/40 bg-primary/5">
          <CardContent className="flex items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              {s.pendingAi} AI-introduced word{s.pendingAi === 1 ? "" : "s"} awaiting your review.
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link href="/ai-vocab">
                Review <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard icon={Library} label="Total vocabulary" value={s.total} />
        <StatCard
          icon={CalendarClock}
          label="Due today"
          value={s.dueToday}
          tone="warning"
        />
        <StatCard
          icon={Trophy}
          label="Mastered"
          value={s.counts.MASTERED}
          tone="primary"
        />
        <StatCard
          icon={AlertTriangle}
          label="Weak words"
          value={s.counts.WEAK}
          tone="danger"
        />
        <StatCard icon={Target} label="Accuracy (14d)" value={`${s.overallAccuracy}%`} />
        <StatCard icon={Sparkles} label="AI-added words" value={s.aiGenerated} />
        <StatCard
          icon={TrendingUp}
          label="Coverage"
          value={`${s.coverage}%`}
          hint={`${s.neverSeen} never seen`}
        />
        <StatCard
          icon={BookOpenText}
          label="Passages done"
          value={s.passagesCompleted}
          hint={`${s.lessonsCompleted} lessons total`}
        />
      </div>

      {/* Charts */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Accuracy over time</CardTitle>
          </CardHeader>
          <CardContent>
            <AccuracyChart data={s.accuracyOverTime} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vocabulary by status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusPie data={pieData} />
            <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
              {pieData.map((d) => (
                <span key={d.name}>
                  {d.name}: <span className="font-medium text-foreground">{d.value}</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lists */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Most missed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {s.mostMissed.length === 0 ? (
              <p className="text-sm text-muted-foreground">No misses yet. 🎉</p>
            ) : (
              s.mostMissed.map((w) => (
                <Link
                  key={w.id}
                  href={`/vocabulary/${w.id}`}
                  className="flex items-center justify-between gap-2 rounded-md p-1.5 hover:bg-accent"
                >
                  <span className="arabic text-xl" dir="rtl">
                    {w.arabicWithHarakat || w.arabic}
                  </span>
                  <Badge variant="destructive">{w.totalMissed}×</Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recently mastered</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {s.recentlyMastered.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keep going — mastery comes with practice.
              </p>
            ) : (
              s.recentlyMastered.map((w) => (
                <Link
                  key={w.id}
                  href={`/vocabulary/${w.id}`}
                  className="flex items-center justify-between gap-2 rounded-md p-1.5 hover:bg-accent"
                >
                  <span className="arabic text-xl" dir="rtl">
                    {w.arabicWithHarakat || w.arabic}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {w.englishMeaning}
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Deck coverage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {s.deckCoverage.length === 0 ? (
              <p className="text-sm text-muted-foreground">No decks imported.</p>
            ) : (
              s.deckCoverage.slice(0, 5).map((d) => (
                <div key={d.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate font-medium">{d.name}</span>
                    <span className="text-muted-foreground">
                      {d.seen}/{d.total}
                    </span>
                  </div>
                  <Progress
                    value={d.coverage}
                    indicatorClassName={masteryColor(d.coverage)}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Button variant="outline" asChild className="h-auto justify-start py-3">
          <Link href="/practice/isolated">
            <Type className="h-4 w-4" /> Isolated word quiz
          </Link>
        </Button>
        <Button variant="outline" asChild className="h-auto justify-start py-3">
          <Link href="/practice/paragraph">
            <BookOpenText className="h-4 w-4" /> Paragraph translation
          </Link>
        </Button>
        <Button variant="outline" asChild className="h-auto justify-start py-3">
          <Link href="/import">
            <Upload className="h-4 w-4" /> Import another deck
          </Link>
        </Button>
      </div>
    </div>
  );
}
