import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { ImportWizard } from "@/components/import-wizard";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default async function ImportPage() {
  const user = await requireUser();
  const decks = await prisma.deckImport.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div>
      <PageHeader
        title="Import Anki Deck"
        description="Bring your Arabic vocabulary in from .apkg exports. Import as many decks as you like over time."
      />
      <ImportWizard />

      {decks.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Previous imports</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {decks.map((d) => (
              <Card key={d.id}>
                <CardContent className="space-y-2 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium leading-tight">{d.name}</p>
                    <Badge variant="secondary">{d.importedCount} words</Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {d.fileName}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatDate(d.createdAt)}</span>
                    <span>{d.duplicateCount} dupes skipped</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
