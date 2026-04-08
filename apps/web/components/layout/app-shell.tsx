import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";

interface AppShellProps {
  children: ReactNode;
  role: "student" | "teacher";
  userName?: string | null;
  streak?: number;
  classes?: Array<{ id: string; name: string }>;
}

export function AppShell({ children, role, userName, streak, classes }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar role={role} userName={userName} streak={streak} classes={classes} />
      {/* Main content offset by sidebar width */}
      <main className="flex-1 ml-[240px] px-8">
        {children}
      </main>
    </div>
  );
}
