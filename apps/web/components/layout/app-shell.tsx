import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";

interface AppShellProps {
  children: ReactNode;
  role: "student" | "teacher";
  userName?: string | null;
}

export function AppShell({ children, role, userName }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar role={role} userName={userName} />
      {/* Main content offset by sidebar width */}
      <main className="flex-1 ml-[240px] px-8">
        {children}
      </main>
    </div>
  );
}
