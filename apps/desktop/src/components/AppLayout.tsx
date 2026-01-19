import { ReactNode } from "react";
import { cn } from "../lib/utils";

interface AppLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
  className?: string;
}

export function AppLayout({ sidebar, children, className }: AppLayoutProps) {
  return (
    <div className={cn("flex flex-1 min-h-0 w-screen overflow-hidden bg-zinc-900 text-zinc-50 p-[5px]", className)}>
      {sidebar}
      <div className="flex flex-1 flex-col overflow-hidden bg-[#101013] rounded-lg border dark:border-zinc-800 ml-[5px]">
        <main className="flex-1 overflow-hidden relative">
            {children}
        </main>
      </div>
    </div>
  );
}
