"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, RotateCcw, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function DataManagement() {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function reset(scope: "progress" | "all") {
    const message =
      scope === "all"
        ? "Delete ALL vocabulary, lessons, and progress? This cannot be undone."
        : "Reset all mastery scores and review history to zero? Your words are kept.";
    if (!confirm(message)) return;
    setBusy(scope);
    try {
      const res = await fetch("/api/data/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, confirm: true }),
      });
      if (res.ok) {
        toast.success(scope === "all" ? "All data cleared." : "Progress reset.");
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || "Reset failed.");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Data management</CardTitle>
        <CardDescription>
          Export your vocabulary or reset progress. Exports include every field
          and mastery stat.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <a href="/api/export?format=json">
            <Download className="h-4 w-4" /> Export JSON
          </a>
        </Button>
        <Button variant="outline" asChild>
          <a href="/api/export?format=csv">
            <Download className="h-4 w-4" /> Export CSV
          </a>
        </Button>
        <Button
          variant="outline"
          onClick={() => reset("progress")}
          disabled={!!busy}
        >
          {busy === "progress" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          Reset progress
        </Button>
        <Button
          variant="destructive"
          onClick={() => reset("all")}
          disabled={!!busy}
        >
          {busy === "all" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          Delete everything
        </Button>
      </CardContent>
    </Card>
  );
}
