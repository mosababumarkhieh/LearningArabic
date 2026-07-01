import { requireUser } from "@/lib/auth";
import { getUserSettings } from "@/lib/settings";
import { PageHeader } from "@/components/page-header";
import { SettingsForm, type SettingsShape } from "@/components/settings-form";
import { DataManagement } from "@/components/data-management";

export default async function SettingsPage() {
  const user = await requireUser();
  const settings = await getUserSettings(user.id);

  const initial: SettingsShape = {
    isolatedWordsPerQuiz: settings.isolatedWordsPerQuiz,
    newWordsPerLesson: settings.newWordsPerLesson,
    weakWordsPerLesson: settings.weakWordsPerLesson,
    reviewWordsPerLesson: settings.reviewWordsPerLesson,
    masteredWordsPerLesson: settings.masteredWordsPerLesson,
    ratioMastered: settings.ratioMastered,
    ratioReview: settings.ratioReview,
    ratioNew: settings.ratioNew,
    paragraphLength: settings.paragraphLength,
    difficulty: settings.difficulty,
    harakatMode: settings.harakatMode,
    topicPreference: settings.topicPreference,
    includeNewWords: settings.includeNewWords,
    prioritizeWeakWords: settings.prioritizeWeakWords,
    onlyImportedWords: settings.onlyImportedWords,
    aiVocabMode: settings.aiVocabMode,
    passageTheme: settings.passageTheme,
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Tune how lessons are generated and how vocabulary grows."
      />
      <SettingsForm initial={initial} />
      <div className="mt-4">
        <DataManagement />
      </div>
    </div>
  );
}
