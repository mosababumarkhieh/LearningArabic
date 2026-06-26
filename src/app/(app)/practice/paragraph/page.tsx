import { requireUser } from "@/lib/auth";
import { getUserSettings } from "@/lib/settings";
import { aiIsLive } from "@/lib/ai";
import { PageHeader } from "@/components/page-header";
import { ParagraphPractice } from "@/components/paragraph-practice";
import { Badge } from "@/components/ui/badge";

export default async function ParagraphPracticePage() {
  const user = await requireUser();
  const settings = await getUserSettings(user.id);
  const live = aiIsLive();

  return (
    <div>
      <PageHeader
        title="Paragraph Translation"
        description="The core mode: read a personalized Arabic passage, translate it, and learn from precise feedback."
      >
        <Badge variant={live ? "success" : "muted"}>
          {live ? "AI live" : "Offline mode"}
        </Badge>
      </PageHeader>
      <ParagraphPractice defaultTopic={settings.topicPreference} />
    </div>
  );
}
