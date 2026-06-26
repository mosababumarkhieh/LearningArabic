"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeepDiveButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function run() {
    setLoading(true);
    try {
      const res = await fetch(`/api/vocabulary/${id}/deep-dive`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not generate deep dive.");
        return;
      }
      toast.success("Deep dive generated and saved.");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={run} disabled={loading} variant="secondary">
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
      AI deep dive
    </Button>
  );
}
