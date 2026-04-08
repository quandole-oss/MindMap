"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { joinClassAction } from "@/actions/class"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function JoinClassForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [joinCode, setJoinCode] = useState("")

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.set("joinCode", joinCode)
      const result = await joinClassAction(formData)
      if (result.error) {
        setError(result.error)
      } else if (result.success && result.className) {
        setSuccess(result.className)
        // Redirect to student dashboard after short delay
        setTimeout(() => router.push("/student"), 1500)
      }
    })
  }

  if (success) {
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-[#f4f4f5] rounded-xl p-6">
          <p className="text-[16px] font-semibold text-[#18181b]">
            You&apos;ve joined {success}!
          </p>
          <p className="text-[14px] text-[#71717a] mt-1">
            Taking you to your dashboard…
          </p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <h1 className="text-[20px] font-semibold text-[#18181b]">Join a class</h1>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="joinCode" className="text-[14px]">
          Enter your class code
        </Label>
        <Input
          id="joinCode"
          name="joinCode"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase().trim())}
          placeholder="e.g. AB3XZ9"
          maxLength={6}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="uppercase tracking-widest font-mono text-[16px]"
          aria-describedby={error ? "join-error" : undefined}
          aria-invalid={!!error}
        />
        {error && (
          <p id="join-error" className="text-[14px] text-[#ef4444]" role="alert">
            {error}
          </p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isPending || joinCode.length !== 6}
        className="h-11 bg-[#18181b] text-white hover:bg-[#27272a] text-[14px]"
      >
        {isPending ? "Joining…" : "Join class"}
      </Button>
    </form>
  )
}
