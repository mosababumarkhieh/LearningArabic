"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TOPIC_OPTIONS,
  PARAGRAPH_LENGTH_OPTIONS,
  DIFFICULTY_OPTIONS,
  HARAKAT_OPTIONS,
  AI_VOCAB_MODE_OPTIONS,
} from "@/lib/settings";

export type SettingsShape = {
  isolatedWordsPerQuiz: number;
  newWordsPerLesson: number;
  weakWordsPerLesson: number;
  reviewWordsPerLesson: number;
  masteredWordsPerLesson: number;
  ratioMastered: number;
  ratioReview: number;
  ratioNew: number;
  paragraphLength: string;
  difficulty: string;
  harakatMode: string;
  topicPreference: string;
  includeNewWords: boolean;
  prioritizeWeakWords: boolean;
  onlyImportedWords: boolean;
  aiVocabMode: string;
};

function NumberField({
  label,
  hint,
  value,
  onChange,
  min = 0,
  max = 50,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (b: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function SettingsForm({ initial }: { initial: SettingsShape }) {
  const router = useRouter();
  const [s, setS] = React.useState<SettingsShape>(initial);
  const [saving, setSaving] = React.useState(false);
  const set = <K extends keyof SettingsShape>(k: K, v: SettingsShape[K]) =>
    setS((p) => ({ ...p, [k]: v }));

  const ratioSum = s.ratioMastered + s.ratioReview + s.ratioNew;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not save settings.");
        return;
      }
      toast.success("Settings saved.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lesson composition</CardTitle>
          <CardDescription>
            How many words of each kind to pull into a lesson.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField
            label="Isolated words per quiz"
            value={s.isolatedWordsPerQuiz}
            onChange={(v) => set("isolatedWordsPerQuiz", v)}
            max={50}
          />
          <NumberField
            label="New imported words / lesson"
            value={s.newWordsPerLesson}
            onChange={(v) => set("newWordsPerLesson", v)}
            max={20}
          />
          <NumberField
            label="Weak words / lesson"
            value={s.weakWordsPerLesson}
            onChange={(v) => set("weakWordsPerLesson", v)}
            max={20}
          />
          <NumberField
            label="Review words / lesson"
            value={s.reviewWordsPerLesson}
            onChange={(v) => set("reviewWordsPerLesson", v)}
            max={20}
          />
          <NumberField
            label="Mastered words / lesson"
            value={s.masteredWordsPerLesson}
            onChange={(v) => set("masteredWordsPerLesson", v)}
            max={30}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Default lesson ratio</CardTitle>
          <CardDescription>
            Target mix for generated passages. Currently sums to {ratioSum}%
            {ratioSum !== 100 && " — values are used as relative weights."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <NumberField
            label="Mastered / known %"
            value={s.ratioMastered}
            onChange={(v) => set("ratioMastered", v)}
            max={100}
          />
          <NumberField
            label="Review / weak %"
            value={s.ratioReview}
            onChange={(v) => set("ratioReview", v)}
            max={100}
          />
          <NumberField
            label="New %"
            value={s.ratioNew}
            onChange={(v) => set("ratioNew", v)}
            max={100}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Passage generation</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-sm">Paragraph length</Label>
            <Select
              value={s.paragraphLength}
              onValueChange={(v) => set("paragraphLength", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PARAGRAPH_LENGTH_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label} · {o.sentences}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Arabic difficulty</Label>
            <Select
              value={s.difficulty}
              onValueChange={(v) => set("difficulty", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIFFICULTY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Harakāt mode</Label>
            <Select
              value={s.harakatMode}
              onValueChange={(v) => set("harakatMode", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HARAKAT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Topic preference</Label>
            <Select
              value={s.topicPreference}
              onValueChange={(v) => set("topicPreference", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOPIC_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Behaviour</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ToggleRow
            label="Include new words in lessons"
            hint="Gently introduce words you haven't studied yet."
            checked={s.includeNewWords}
            onChange={(b) => set("includeNewWords", b)}
          />
          <ToggleRow
            label="Prioritise weak words"
            hint="Resurface words you keep missing more often."
            checked={s.prioritizeWeakWords}
            onChange={(b) => set("prioritizeWeakWords", b)}
          />
          <ToggleRow
            label="Use only imported / manual vocabulary"
            hint="When on, the AI will not introduce any brand-new words."
            checked={s.onlyImportedWords}
            onChange={(b) => set("onlyImportedWords", b)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI-introduced vocabulary</CardTitle>
          <CardDescription>
            Controls how many brand-new words the AI may weave into a passage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {AI_VOCAB_MODE_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => set("aiVocabMode", o.value)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  s.aiVocabMode === o.value
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "hover:bg-accent"
                }`}
              >
                <p className="font-medium">{o.label}</p>
                <p className="text-xs text-muted-foreground">{o.hint}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={save} disabled={saving} size="lg" className="shadow-lg">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save settings
        </Button>
      </div>
    </div>
  );
}
