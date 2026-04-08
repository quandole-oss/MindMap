import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function TeacherDashboard() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const name = session.user.name ?? "Teacher";

  return (
    <div className="pt-8 pb-8">
      <h1 className="text-[20px] font-semibold text-[#18181b] mb-6">
        Welcome, {name}
      </h1>

      {/* Empty state */}
      <div className="bg-[#f4f4f5] rounded-xl p-6">
        <p className="text-[16px] text-[#52525b]">No classes yet</p>
        <p className="text-[14px] text-[#71717a] mt-1">
          Create your first class to get started.
        </p>
      </div>
    </div>
  );
}
