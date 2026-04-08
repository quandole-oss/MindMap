import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function StudentDashboard() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const name = session.user.name ?? "Student";

  return (
    <div className="pt-8 pb-8">
      <h1 className="text-[20px] font-semibold text-[#18181b] mb-6">
        Welcome, {name}
      </h1>

      {/* Profile stub */}
      <div className="bg-[#f4f4f5] rounded-xl p-6">
        <p className="text-[16px] text-[#52525b]">You haven&apos;t joined a class</p>
        <p className="text-[14px] text-[#71717a] mt-1">
          Ask your teacher for a join code to get started.
        </p>
      </div>
    </div>
  );
}
