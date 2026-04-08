"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import Link from "next/link"

import { createClassAction } from "@/actions/class"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { JoinCodeDisplay } from "@/components/class/join-code-display"

const schema = z.object({
  name: z.string().min(1, "Class name is required").max(100),
  gradeLevel: z.coerce.number().int().min(0).max(12),
})

type FormValues = z.infer<typeof schema>

export function CreateClassForm() {
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [createdClass, setCreatedClass] = useState<{
    classId: string
    joinCode: string
    name: string
  } | null>(null)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { gradeLevel: 5 },
  })

  function onSubmit(values: FormValues) {
    setServerError(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.set("name", values.name)
      formData.set("gradeLevel", String(values.gradeLevel))
      const result = await createClassAction(formData)
      if (result.error) {
        setServerError(result.error)
      } else if (result.success && result.classId && result.joinCode) {
        setCreatedClass({
          classId: result.classId,
          joinCode: result.joinCode,
          name: getValues("name"),
        })
      }
    })
  }

  if (createdClass) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-[20px] font-semibold text-[#18181b] mb-1">
            Class created!
          </h2>
          <p className="text-[16px] text-[#52525b]">{createdClass.name}</p>
        </div>
        <JoinCodeDisplay joinCode={createdClass.joinCode} />
        <div className="flex gap-3">
          <Link
            href={`/teacher/classes/${createdClass.classId}/roster`}
            className="inline-flex items-center justify-center h-11 px-6 rounded-lg bg-[#18181b] text-white text-[14px] font-medium transition-colors hover:bg-[#27272a]"
          >
            View roster
          </Link>
          <Link
            href="/teacher"
            className="inline-flex items-center justify-center h-11 px-6 rounded-lg border border-[#e4e4e7] text-[14px] font-medium text-[#52525b] transition-colors hover:bg-[#f4f4f5]"
          >
            Back to classes
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <h1 className="text-[20px] font-semibold text-[#18181b]">Create a class</h1>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name" className="text-[14px]">
          Class name
        </Label>
        <Input
          id="name"
          placeholder="e.g. Period 3 Biology"
          autoComplete="off"
          aria-describedby={errors.name ? "name-error" : undefined}
          aria-invalid={!!errors.name}
          {...register("name")}
        />
        {errors.name && (
          <p id="name-error" className="text-[14px] text-[#ef4444]">
            {errors.name.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="gradeLevel" className="text-[14px]">
          Grade Level
        </Label>
        <select
          id="gradeLevel"
          className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-[16px] outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
          aria-describedby={errors.gradeLevel ? "grade-error" : undefined}
          aria-invalid={!!errors.gradeLevel}
          {...register("gradeLevel")}
        >
          <option value={0}>K (Kindergarten)</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
            <option key={g} value={g}>
              Grade {g}
            </option>
          ))}
        </select>
        {errors.gradeLevel && (
          <p id="grade-error" className="text-[14px] text-[#ef4444]">
            {errors.gradeLevel.message}
          </p>
        )}
      </div>

      {serverError && (
        <p className="text-[14px] text-[#ef4444]" role="alert">
          {serverError}
        </p>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="h-11 bg-[#18181b] text-white hover:bg-[#27272a] text-[14px]"
      >
        {isPending ? "Creating…" : "Create a class"}
      </Button>
    </form>
  )
}
