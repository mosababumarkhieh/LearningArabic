"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  Library,
  Type,
  BookOpenText,
  History,
  Settings,
  Sparkles,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/import", label: "Import Deck", icon: Upload },
  { href: "/vocabulary", label: "Vocabulary", icon: Library },
  { href: "/practice/isolated", label: "Isolated Words", icon: Type },
  { href: "/practice/paragraph", label: "Paragraph", icon: BookOpenText },
  { href: "/lessons", label: "Lesson History", icon: History },
  { href: "/ai-vocab", label: "AI Vocabulary", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppNav({
  user,
  aiLive,
}: {
  user: { email: string; name: string | null };
  aiLive: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const NavLinks = (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive(item.href)
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b px-4 py-3 lg:hidden">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <BookOpenText className="h-5 w-5 text-primary" />
          عربي · Arabic
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-b p-4 lg:hidden">{NavLinks}</div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card/40 p-4 lg:flex lg:h-screen lg:sticky lg:top-0">
        <Link href="/" className="mb-6 flex items-center gap-2 px-2 text-lg font-bold">
          <BookOpenText className="h-6 w-6 text-primary" />
          <span>
            عربي <span className="text-muted-foreground font-normal text-sm">Learn</span>
          </span>
        </Link>

        {NavLinks}

        <div className="mt-auto space-y-3 pt-4">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs text-muted-foreground">AI engine</span>
            <Badge variant={aiLive ? "success" : "muted"} className="text-[10px]">
              {aiLive ? "Live" : "Offline"}
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-lg border p-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {user.name || "Learner"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            </div>
            <div className="flex items-center">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                aria-label="Log out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
