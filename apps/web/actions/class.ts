"use server";

import { auth } from "@/lib/auth";
import { db, schema } from "@mindmap/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";

// ─── Join Code Generation ─────────────────────────────────────────────────────

// Exclude ambiguous characters (0, O, 1, I) for classroom dictation readability
function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((n) => chars[n % chars.length])
    .join("");
}

async function createUniqueJoinCode(): Promise<string> {
  let code: string;
  let attempts = 0;
  do {
    code = generateJoinCode();
    attempts++;
    if (attempts > 10) throw new Error("Failed to generate unique join code");
    const existing = await db.query.classes.findFirst({
      where: eq(schema.classes.joinCode, code),
    });
    if (!existing) return code;
  } while (true);
}

// ─── Create Class Action (AUTH-05, AUTH-08) ───────────────────────────────────

const createClassSchema = z.object({
  name: z.string().min(1, "Class name is required").max(100),
  gradeLevel: z.coerce.number().int().min(0).max(12), // 0=K, 1-12
});

export async function createClassAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  // Verify teacher role
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, session.user.id),
  });
  if (!user || user.role !== "teacher") return { error: "Only teachers can create classes" };

  const parsed = createClassSchema.safeParse({
    name: formData.get("name"),
    gradeLevel: formData.get("gradeLevel"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const joinCode = await createUniqueJoinCode();

  const [newClass] = await db.insert(schema.classes).values({
    name: parsed.data.name,
    joinCode,
    teacherId: session.user.id,
    gradeLevel: parsed.data.gradeLevel,
  }).returning();

  revalidatePath("/teacher");
  return { success: true, classId: newClass.id, joinCode };
}

// ─── Join Class Action (AUTH-06, AUTH-08) ─────────────────────────────────────

const joinClassSchema = z.object({
  joinCode: z.string().length(6, "Join code must be exactly 6 characters"),
});

export async function joinClassAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, session.user.id),
  });
  if (!user || user.role !== "student") return { error: "Only students can join classes" };

  const rawCode = (formData.get("joinCode") as string ?? "").toUpperCase().trim();

  const parsed = joinClassSchema.safeParse({ joinCode: rawCode });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const targetClass = await db.query.classes.findFirst({
    where: eq(schema.classes.joinCode, parsed.data.joinCode),
  });
  if (!targetClass) {
    return { error: "That code didn't match any class. Double-check the code with your teacher." };
  }

  // Check if already enrolled (T-04-05: double enrollment prevention)
  const existingEnrollment = await db.query.classEnrollments.findFirst({
    where: and(
      eq(schema.classEnrollments.classId, targetClass.id),
      eq(schema.classEnrollments.studentId, session.user.id),
    ),
  });
  if (existingEnrollment) {
    return { error: "You're already a member of this class." };
  }

  // Enroll student — grade level inherited from class (AUTH-08)
  await db.insert(schema.classEnrollments).values({
    classId: targetClass.id,
    studentId: session.user.id,
    gradeLevel: targetClass.gradeLevel,
  });

  revalidatePath("/student");
  return { success: true, className: targetClass.name };
}

// ─── Remove Student Action (AUTH-07) ─────────────────────────────────────────

export async function removeStudentAction(enrollmentId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  // Fetch enrollment first (two-query approach to avoid needing relation config)
  const enrollment = await db.query.classEnrollments.findFirst({
    where: eq(schema.classEnrollments.id, enrollmentId),
  });
  if (!enrollment) return { error: "Enrollment not found" };

  // Verify teacher owns the class (T-04-03: prevent cross-teacher access)
  const targetClass = await db.query.classes.findFirst({
    where: and(
      eq(schema.classes.id, enrollment.classId),
      eq(schema.classes.teacherId, session.user.id),
    ),
  });
  if (!targetClass) return { error: "Not authorized" };

  await db.delete(schema.classEnrollments)
    .where(eq(schema.classEnrollments.id, enrollmentId));

  revalidatePath(`/teacher/classes/${enrollment.classId}/roster`);
  return { success: true };
}

// ─── Data Fetching (AUTH-07) ──────────────────────────────────────────────────

export async function getClassRoster(classId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  // Verify teacher owns the class (T-04-04: prevent student roster access)
  const targetClass = await db.query.classes.findFirst({
    where: and(
      eq(schema.classes.id, classId),
      eq(schema.classes.teacherId, session.user.id),
    ),
  });
  if (!targetClass) return { error: "Not authorized" };

  const enrollments = await db
    .select({
      enrollmentId: schema.classEnrollments.id,
      studentId: schema.classEnrollments.studentId,
      gradeLevel: schema.classEnrollments.gradeLevel,
      enrolledAt: schema.classEnrollments.enrolledAt,
      studentName: schema.users.name,
      studentEmail: schema.users.email,
    })
    .from(schema.classEnrollments)
    .innerJoin(schema.users, eq(schema.classEnrollments.studentId, schema.users.id))
    .where(eq(schema.classEnrollments.classId, classId));

  return {
    class: targetClass,
    students: enrollments,
  };
}

export async function getTeacherClasses() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return db.query.classes.findMany({
    where: eq(schema.classes.teacherId, session.user.id),
  });
}

export async function getStudentEnrollments() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return db
    .select({
      enrollmentId: schema.classEnrollments.id,
      classId: schema.classes.id,
      className: schema.classes.name,
      gradeLevel: schema.classEnrollments.gradeLevel,
      joinCode: schema.classes.joinCode,
    })
    .from(schema.classEnrollments)
    .innerJoin(schema.classes, eq(schema.classEnrollments.classId, schema.classes.id))
    .where(eq(schema.classEnrollments.studentId, session.user.id));
}
