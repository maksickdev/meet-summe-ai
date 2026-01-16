import { ReactNode } from "react";
import { cn } from "../lib/utils";

interface AppLayoutProps {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
  className?: string;
}

export function AppLayout({ sidebar, header, children, className }: AppLayoutProps) {
  return (
    <div className={cn("flex h-screen w-screen overflow-hidden bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50", className)}>
      {sidebar}
      <div className="flex flex-1 flex-col overflow-hidden">
        {header}
        <main className="flex-1 overflow-hidden relative">
            {children}
        </main>
      </div>
    </div>
  );
}
