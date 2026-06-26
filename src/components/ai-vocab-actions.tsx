"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X, EyeOff, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AiVocabActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function act(action: "save" | "ignore" | "reject") {
    setBusy(action);
    try {
      const res = await fetch(`/api/ai-vocab/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Action failed.");
        return;
      }
      toast.success(
        action === "save"
          ? "Saved to your library."
          : action === "ignore"
            ? "Marked as known."
            : "Rejected.",
      );
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!confirm("Delete this AI word permanently?")) return;
    setBusy("delete");
    try {
      const res = await fetch(`/api/ai-vocab/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Deleted.");
        router.refresh();
      } else {
        toast.error("Could not delete.");
      }
    } finally {
      setBusy(null);
    }
  }

  const isSaved = status === "SAVED";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!isSaved && (
        <Button size="sm" onClick={() => act("save")} disabled={!!busy}>
          {busy === "save" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Save to library
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={() => act("ignore")}
        disabled={!!busy}
      >
        <EyeOff className="h-4 w-4" /> I know it
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => act("reject")}
        disabled={!!busy}
      >
        <X className="h-4 w-4" /> Reject
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-destructive"
        onClick={remove}
        disabled={!!busy}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
