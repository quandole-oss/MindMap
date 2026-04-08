import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getStreak } from "@/actions/questions";

export default async function StudentLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const streak = await getStreak();

  return (
    <AppShell role="student" userName={session.user.name} streak={streak}>
      {children}
    </AppShell>
  );
}
