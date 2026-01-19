import { ReactNode } from "react";
import { cn } from "../lib/utils";

interface AppLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
  status?: string;
  className?: string;
}

export function AppLayout({ sidebar, children, status, className }: AppLayoutProps) {
  return (
    <div className={cn("flex h-[calc(100vh-3.5rem)] w-screen overflow-hidden bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50", className)}>
      {sidebar}
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-hidden relative">
            {children}
        </main>
        {status && (
          <div className="border-t border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 truncate" title={status}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
