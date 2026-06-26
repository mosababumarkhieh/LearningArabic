import { requireUser } from "@/lib/auth";
import { aiIsLive } from "@/lib/ai";
import { AppNav } from "@/components/app-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const aiLive = aiIsLive();

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <AppNav user={{ email: user.email, name: user.name }} aiLive={aiLive} />
      <main className="flex-1 min-w-0">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
