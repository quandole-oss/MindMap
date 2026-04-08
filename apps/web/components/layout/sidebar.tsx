"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Users, LogOut, User, MessageSquare, Network } from "lucide-react";

import { signOutAction } from "@/actions/auth";
import { cn } from "@/lib/utils";
import { StreakBadge } from "@/components/questions/streak-badge";

interface SidebarProps {
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

export function Sidebar({ role, userName, streak, classes = [] }: SidebarProps) {
  const pathname = usePathname();
  const navItems = role === "teacher" ? teacherNavItems : studentNavItems;

  return (
    <aside className="w-[240px] shrink-0 bg-[#f4f4f5] flex flex-col h-screen fixed left-0 top-0">
      {/* Wordmark */}
      <div className="px-4 py-5 border-b border-[#e4e4e7]">
        <span className="text-[20px] font-semibold text-[#18181b]">MindMap</span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-3 flex flex-col gap-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 h-10 px-4 rounded-lg text-[14px] font-normal transition-colors",
                isActive
                  ? "bg-[#18181b] text-white"
                  : "text-[#52525b] hover:bg-[#e4e4e7] hover:text-[#18181b]"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}

        {/* Class dashboard links (teacher only) */}
        {role === "teacher" && classes.length > 0 && (
          <>
            <p className="px-4 pt-4 pb-1 text-[11px] font-medium uppercase tracking-wider text-[#71717a]">
              Classes
            </p>
            {classes.map((cls) => {
              const href = `/teacher/classes/${cls.id}/dashboard`;
              const isActive = pathname === href || pathname.startsWith(href);
              return (
                <Link
                  key={cls.id}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 h-10 px-4 rounded-lg text-[14px] font-normal transition-colors",
                    isActive
                      ? "bg-[#18181b] text-white"
                      : "text-[#52525b] hover:bg-[#e4e4e7] hover:text-[#18181b]"
                  )}
                >
                  <BookOpen className="size-4 shrink-0" />
                  {cls.name}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Logout button */}
      <div className="px-2 py-3 border-t border-[#e4e4e7]">
        {userName && (
          <p className="px-4 pb-2 text-[12px] text-[#71717a] truncate">{userName}</p>
        )}
        {role === "student" && (
          <div className="px-4 pb-2">
            <StreakBadge streak={streak ?? 0} />
          </div>
        )}
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex items-center gap-3 h-10 px-4 w-full rounded-lg text-[14px] text-[#52525b] hover:bg-[#e4e4e7] hover:text-[#18181b] transition-colors text-left"
          >
            <LogOut className="size-4 shrink-0" />
            Log out
          </button>
        </form>
      </div>
    </aside>
  );
}
