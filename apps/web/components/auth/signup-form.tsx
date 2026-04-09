"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { z } from "zod";

import { signUpAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const signUpSchema = z.object({
  name: z.string().min(1, "Name is required."),
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  role: z.enum(["student", "teacher"]),
});

type SignUpFormValues = z.infer<typeof signUpSchema>;

export function SignupForm({ onSwitchToLogin }: { onSwitchToLogin?: () => void } = {}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      role: "student",
    },
  });

  const role = watch("role");

  async function onSubmit(values: SignUpFormValues) {
    setServerError(null);

    const formData = new FormData();
    formData.set("name", values.name);
    formData.set("email", values.email);
    formData.set("password", values.password);
    formData.set("role", values.role);

    const result = await signUpAction(formData);

    if (result?.error) {
      setServerError(result.error);
      return;
    }

    // Redirect based on role
    router.push(values.role === "teacher" ? "/teacher" : "/student");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <h1 className="text-[20px] font-semibold leading-[1.2] text-white">
        Create your account
      </h1>

      {/* Name field */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="name" className="text-white/80">Name</Label>
        <Input
          id="name"
          type="text"
          autoComplete="name"
          aria-invalid={!!errors.name}
          {...register("name")}
        />
        {errors.name && (
          <p className="text-sm text-red-500">{errors.name.message}</p>
        )}
      </div>

      {/* Email field */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email" className="text-white/80">Email</Label>
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
        <Label htmlFor="password" className="text-white/80">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
        {errors.password && (
          <p className="text-sm text-red-500">{errors.password.message}</p>
        )}
      </div>

      {/* Role toggle — accessible fieldset */}
      <fieldset className="flex flex-col gap-2 border-0 m-0 p-0">
        <legend className="text-sm font-medium text-white/80 mb-1">I am a...</legend>
        <ToggleGroup
          value={[role]}
          onValueChange={(vals) => {
            if (vals.length > 0) {
              setValue("role", vals[vals.length - 1] as "student" | "teacher", {
                shouldValidate: true,
              });
            }
          }}
          className="w-full"
        >
          <ToggleGroupItem value="student" className="flex-1">
            I&apos;m a student
          </ToggleGroupItem>
          <ToggleGroupItem value="teacher" className="flex-1">
            I&apos;m a teacher
          </ToggleGroupItem>
        </ToggleGroup>
        {errors.role && (
          <p className="text-sm text-red-500">{errors.role.message}</p>
        )}
      </fieldset>

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
        {isSubmitting ? "Creating account..." : "Create account"}
      </Button>

      <p className="text-center text-sm text-white/60">
        Already have an account?{" "}
        {onSwitchToLogin ? (
          <button type="button" onClick={onSwitchToLogin} className="text-white font-medium underline underline-offset-4">
            Log in
          </button>
        ) : (
          <Link href="/login" className="text-white font-medium underline underline-offset-4">
            Log in
          </Link>
        )}
      </p>
    </form>
  );
}
