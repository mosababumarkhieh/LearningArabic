import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <p className="text-6xl font-bold text-primary">٤٠٤</p>
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">
        This page doesn&apos;t exist or has moved.
      </p>
      <Button asChild>
        <Link href="/">Back to dashboard</Link>
      </Button>
    </div>
  );
}
