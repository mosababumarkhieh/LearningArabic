"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VocabEditDialog, type EditableVocab } from "@/components/vocab-edit-dialog";

export function VocabRowActions({ item }: { item: EditableVocab }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);

  async function remove() {
    if (!confirm(`Delete “${item.englishMeaning}”? This cannot be undone.`)) {
      return;
    }
    const res = await fetch(`/api/vocabulary/${item.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Word deleted.");
      router.refresh();
    } else {
      toast.error("Could not delete the word.");
    }
  }

  async function resetProgress() {
    const res = await fetch(`/api/vocabulary/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "NEW", masteryScore: 0 }),
    });
    if (res.ok) {
      toast.success("Progress reset.");
      router.refresh();
    } else {
      toast.error("Could not reset progress.");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={resetProgress}>
            <RotateCcw className="h-4 w-4" /> Reset progress
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={remove}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <VocabEditDialog item={item} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}
