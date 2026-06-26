"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type EditableVocab = {
  id?: string;
  arabic: string;
  arabicWithHarakat?: string | null;
  englishMeaning: string;
  type: string;
  root?: string | null;
  verbForm?: string | null;
  pastTense?: string | null;
  presentTense?: string | null;
  masdar?: string | null;
  imperative?: string | null;
  singular?: string | null;
  dual?: string | null;
  plural?: string | null;
  masculine?: string | null;
  feminine?: string | null;
  notes?: string | null;
  status?: string;
  masteryScore?: number;
  tags?: string[];
};

const TYPES = ["VERB", "NOUN", "ADJECTIVE", "PHRASE", "PARTICLE", "UNKNOWN"];
const STATUSES = ["NEW", "LEARNING", "REVIEW", "WEAK", "MASTERED"];

function Field({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input {...props} />
    </div>
  );
}

export function VocabEditDialog({
  item,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  item?: EditableVocab;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  const router = useRouter();
  const isEdit = Boolean(item?.id);
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<EditableVocab>(
    item ?? {
      arabic: "",
      englishMeaning: "",
      type: "UNKNOWN",
    },
  );

  React.useEffect(() => {
    if (item) setForm(item);
  }, [item, open]);

  const set = (k: keyof EditableVocab, v: unknown) =>
    setForm((p) => ({ ...p, [k]: v }));

  const isVerb = form.type === "VERB";
  const isNoun = form.type === "NOUN";
  const isAdj = form.type === "ADJECTIVE";

  async function save() {
    if (!form.arabic.trim() || !form.englishMeaning.trim()) {
      toast.error("Arabic and English are required.");
      return;
    }
    setSaving(true);
    try {
      const url = isEdit ? `/api/vocabulary/${item!.id}` : "/api/vocabulary";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          masteryScore:
            form.masteryScore != null ? Number(form.masteryScore) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Save failed.");
        return;
      }
      toast.success(isEdit ? "Word updated." : "Word added.");
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit word" : "Add a word"}</DialogTitle>
          <DialogDescription>
            All fields are optional except Arabic and English.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Arabic (with harakāt)</Label>
            <Input
              dir="rtl"
              className="arabic text-xl"
              value={form.arabicWithHarakat ?? form.arabic}
              onChange={(e) => {
                set("arabicWithHarakat", e.target.value);
                set("arabic", e.target.value);
              }}
            />
          </div>
          <Field
            label="English meaning"
            value={form.englishMeaning}
            onChange={(e) => set("englishMeaning", e.target.value)}
          />

          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select value={form.type} onValueChange={(v) => set("type", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Field
            label="Root (e.g. ك-ت-ب)"
            dir="rtl"
            value={form.root ?? ""}
            onChange={(e) => set("root", e.target.value)}
          />

          {isVerb && (
            <>
              <Field
                label="Verb form (e.g. Form I)"
                value={form.verbForm ?? ""}
                onChange={(e) => set("verbForm", e.target.value)}
              />
              <Field
                label="Past tense"
                dir="rtl"
                className="arabic"
                value={form.pastTense ?? ""}
                onChange={(e) => set("pastTense", e.target.value)}
              />
              <Field
                label="Present tense"
                dir="rtl"
                className="arabic"
                value={form.presentTense ?? ""}
                onChange={(e) => set("presentTense", e.target.value)}
              />
              <Field
                label="Maṣdar"
                dir="rtl"
                className="arabic"
                value={form.masdar ?? ""}
                onChange={(e) => set("masdar", e.target.value)}
              />
              <Field
                label="Imperative"
                dir="rtl"
                className="arabic"
                value={form.imperative ?? ""}
                onChange={(e) => set("imperative", e.target.value)}
              />
            </>
          )}

          {isNoun && (
            <>
              <Field
                label="Singular"
                dir="rtl"
                className="arabic"
                value={form.singular ?? ""}
                onChange={(e) => set("singular", e.target.value)}
              />
              <Field
                label="Dual"
                dir="rtl"
                className="arabic"
                value={form.dual ?? ""}
                onChange={(e) => set("dual", e.target.value)}
              />
              <Field
                label="Plural"
                dir="rtl"
                className="arabic"
                value={form.plural ?? ""}
                onChange={(e) => set("plural", e.target.value)}
              />
            </>
          )}

          {isAdj && (
            <>
              <Field
                label="Masculine"
                dir="rtl"
                className="arabic"
                value={form.masculine ?? ""}
                onChange={(e) => set("masculine", e.target.value)}
              />
              <Field
                label="Feminine"
                dir="rtl"
                className="arabic"
                value={form.feminine ?? ""}
                onChange={(e) => set("feminine", e.target.value)}
              />
            </>
          )}

          {isEdit && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => set("status", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.charAt(0) + s.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Field
                label="Mastery score (0–100)"
                type="number"
                min={0}
                max={100}
                value={form.masteryScore ?? 0}
                onChange={(e) => set("masteryScore", e.target.value)}
              />
            </>
          )}

          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Notes / nuance</Label>
            <Textarea
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Save changes" : "Add word"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
