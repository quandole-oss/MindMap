"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";

interface AppShellProps {
  children: ReactNode;
  role: "student" | "teacher";
  userName?: string | null;
  streak?: number;
  classes?: Array<{ id: string; name: string }>;
}

export function AppShell({ children, role, userName, streak, classes }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-white">
      {/* Desktop sidebar — hidden below lg breakpoint */}
      <div className="hidden lg:block">
        <Sidebar role={role} userName={userName} streak={streak} classes={classes} />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          aria-modal="true"
          role="dialog"
          aria-label="Navigation menu"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer panel */}
          <div className="absolute left-0 top-0 h-full z-50">
            <Sidebar role={role} userName={userName} streak={streak} classes={classes} />
          </div>
        </div>
      )}

      {/* Main content — full width on mobile, offset by sidebar on desktop */}
      <main className="flex-1 lg:ml-[240px] px-4 sm:px-6 lg:px-8 overflow-x-hidden">
        {/* Mobile header with hamburger */}
        <div className="flex items-center gap-3 py-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            className="flex items-center justify-center w-10 h-10 rounded-lg border border-[#e4e4e7] bg-white text-[#18181b] hover:bg-[#f4f4f5] transition-colors"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <span className="text-[18px] font-semibold text-[#18181b]">MindMap</span>
        </div>
        {children}
      </main>
    </div>
  );
}
