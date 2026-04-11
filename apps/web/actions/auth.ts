"use server";

import { signIn, signOut } from "@/lib/auth";
import { db, schema } from "@mindmap/db";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  name: z.string().min(1, "Name is required."),
  role: z.enum(["student", "teacher"]),
});

export async function signUpAction(formData: FormData) {
  const raw = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    name: formData.get("name") as string,
    role: formData.get("role") as string,
  };

  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { email, password, name, role } = parsed.data;

  // Check if email already exists
  const existing = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });
  if (existing) {
    return { error: "An account with this email already exists. Log in instead." };
  }

  // Hash password with bcryptjs (salt rounds 12)
  const passwordHash = await bcrypt.hash(password, 12);

  // Create user
  await db.insert(schema.users).values({
    email,
    name,
    role,
    passwordHash,
  });

  // Sign in the newly created user
  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch (error) {
    // signIn may throw a NEXT_REDIRECT which is expected behavior
    throw error;
  }

  return { success: true };
}

export async function signInAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch (error: any) {
    if (error?.type === "CredentialsSignin") {
      return { error: "Incorrect email or password. Check your details and try again." };
    }
    throw error;
  }

  // Look up the user's role to guide redirect
  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });

  return { success: true, role: user?.role ?? "student" };
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
