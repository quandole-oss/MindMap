"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { z } from "zod";

import { signInAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);

    const formData = new FormData();
    formData.set("email", values.email);
    formData.set("password", values.password);

    const result = await signInAction(formData);

    if (result?.error) {
      setServerError(result.error);
      return;
    }

    // Redirect based on role returned from server action
    const destination = result.role === "teacher" ? "/teacher" : "/student";
    router.push(destination);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <h1 className="text-[20px] font-semibold leading-[1.2] text-[#18181b]">
        Welcome back
      </h1>

      {/* Email field */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        {errors.email && (
          <p className="text-sm text-red-500">{errors.email.message}</p>
        )}
      </div>

      {/* Password field */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
        {errors.password && (
          <p className="text-sm text-red-500">{errors.password.message}</p>
        )}
      </div>

      {/* Server error */}
      {serverError && (
        <p className="text-sm text-red-500" role="alert">
          {serverError}
        </p>
      )}

      {/* Submit */}
      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full h-11 bg-[#18181b] text-white hover:bg-[#27272a]"
      >
        {isSubmitting ? "Logging in..." : "Log in"}
      </Button>

      <p className="text-center text-sm text-[#71717a]">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-[#18181b] font-medium underline underline-offset-4">
          Sign up
        </Link>
      </p>
    </form>
  );
}
