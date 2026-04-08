import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface JoinCodeDisplayProps {
  joinCode: string
  className?: string
}

export function JoinCodeDisplay({ joinCode, className }: JoinCodeDisplayProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="text-[14px] font-medium text-[#52525b]">Class join code</p>
      <Badge
        className="bg-[#18181b] text-white text-[20px] font-mono tracking-widest px-4 py-2 rounded-lg self-start border-transparent"
      >
        {joinCode}
      </Badge>
      <p className="text-[14px] text-[#71717a]">
        Share this 6-character code with your students.
      </p>
    </div>
  )
}
