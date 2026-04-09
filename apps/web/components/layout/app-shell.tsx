"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, User, Network, MessageSquare, BookOpen, Users } from "lucide-react";
import { signOutAction } from "@/actions/auth";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: ReactNode;
  role: "student" | "teacher";
  userName?: string | null;
  streak?: number;
  classes?: Array<{ id: string; name: string }>;
}

const studentNavItems = [
  { href: "/student", label: "Dashboard", icon: User },
  { href: "/student/graph", label: "My Graph", icon: Network },
  { href: "/student/questions", label: "My Questions", icon: MessageSquare },
  { href: "/student/join", label: "Join a Class", icon: BookOpen },
];

const teacherNavItems = [
  { href: "/teacher", label: "My Classes", icon: Users },
  { href: "/teacher/classes/new", label: "Create a Class", icon: BookOpen },
];

export function AppShell({ children, role, userName, streak, classes }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const navItems = role === "teacher" ? teacherNavItems : studentNavItems;

  return (
    <div className="min-h-screen">
      {/* Floating transparent top nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center justify-between h-14 px-4 sm:px-6">
          {/* Left: logo + nav links */}
          <div className="flex items-center gap-6">
            <Link href={role === "student" ? "/student" : "/teacher"} className="text-[18px] font-semibold text-white">
              MindMap
            </Link>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== "/student" && item.href !== "/teacher" && pathname.startsWith(item.href));
                const isExactActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 h-8 px-3 rounded-md text-[13px] font-medium transition-colors",
                      isExactActive || isActive
                        ? "bg-white/15 text-white"
                        : "text-white/60 hover:text-white hover:bg-white/10"
                    )}
                  >
                    <Icon className="size-3.5" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right: user + logout */}
          <div className="hidden md:flex items-center gap-3">
            {userName && (
              <span className="text-[13px] text-white/60">{userName}</span>
            )}
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <LogOut className="size-3.5" />
                Log out
              </button>
            </form>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation"
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-md text-white/60 hover:text-white hover:bg-white/10"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="md:hidden border-t border-white/10 bg-black/60 backdrop-blur-md px-4 py-3 flex flex-col gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 h-10 px-3 rounded-md text-[14px] transition-colors",
                    isActive
                      ? "bg-white/15 text-white"
                      : "text-white/60 hover:text-white hover:bg-white/10"
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
            {userName && (
              <p className="px-3 pt-2 text-[12px] text-white/40">{userName}</p>
            )}
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex items-center gap-3 h-10 px-3 w-full rounded-md text-[14px] text-white/60 hover:text-white hover:bg-white/10 transition-colors text-left"
              >
                <LogOut className="size-4" />
                Log out
              </button>
            </form>
          </div>
        )}
      </nav>

      {/* Main content — offset by nav height */}
      <main className="pt-14">
        {children}
      </main>
    </div>
  );
}
