import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getTeacherClasses } from "@/actions/class";

export default async function TeacherLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const classes = await getTeacherClasses();

  return (
    <AppShell role="teacher" userName={session.user.name} classes={classes}>
      {children}
    </AppShell>
  );
}
