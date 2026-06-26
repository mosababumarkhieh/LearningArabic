import { requireUser } from "@/lib/auth";
import { vocabStatusCounts } from "@/lib/vocab";
import { PageHeader } from "@/components/page-header";
import { IsolatedQuiz } from "@/components/isolated-quiz";

export default async function IsolatedPracticePage() {
  const user = await requireUser();
  const counts = await vocabStatusCounts(user.id);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div>
      <PageHeader
        title="Isolated Word Translation"
        description={
          total > 0
            ? "Recall the English meaning of each Arabic word."
            : "Add vocabulary first to start practising."
        }
      />
      <IsolatedQuiz />
    </div>
  );
}
