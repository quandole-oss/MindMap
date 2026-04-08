import type { ReactNode } from "react";

export default function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f4f4f5] flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-6">
        <span className="text-[20px] font-semibold text-[#18181b]">MindMap</span>
      </div>
      <div className="w-full max-w-[400px] bg-white rounded-xl shadow-sm p-6">
        {children}
      </div>
    </div>
  );
}
