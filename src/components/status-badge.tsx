import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { VocabStatus, SourceType } from "@prisma/client";

const STATUS_STYLES: Record<
  VocabStatus,
  { label: string; className: string }
> = {
  NEW: { label: "New", className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-transparent" },
  LEARNING: { label: "Learning", className: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-transparent" },
  REVIEW: { label: "Review", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-transparent" },
  WEAK: { label: "Weak", className: "bg-red-500/15 text-red-600 dark:text-red-400 border-transparent" },
  MASTERED: { label: "Mastered", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-transparent" },
};

export function StatusBadge({
  status,
  className,
}: {
  status: VocabStatus;
  className?: string;
}) {
  const s = STATUS_STYLES[status];
  return <Badge className={cn(s.className, className)}>{s.label}</Badge>;
}

const SOURCE_LABEL: Record<SourceType, string> = {
  ANKI_IMPORT: "Anki",
  AI_GENERATED: "AI-added",
  MANUAL: "Manual",
};

export function SourceBadge({ source }: { source: SourceType }) {
  return (
    <Badge variant="outline" className="text-xs">
      {SOURCE_LABEL[source]}
    </Badge>
  );
}

export function masteryColor(score: number): string {
  if (score >= 85) return "bg-emerald-500";
  if (score >= 70) return "bg-lime-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}
