import { ReactNode } from "react";
import { cn } from "../lib/utils";

interface AppLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
  className?: string;
}

export function AppLayout({ sidebar, children, className }: AppLayoutProps) {
  return (
    <div className={cn("flex flex-1 min-h-0 w-screen overflow-hidden bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50", className)}>
      {sidebar}
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-hidden relative">
            {children}
        </main>
      </div>
    </div>
  );
}
