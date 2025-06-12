import type React from "react";
import { Suspense } from "react";
import ProjectSkeleton from "@/components/dashboard/ProjectSkeleton";
import UserNav from "@/components/shared/UserNav";
import Sidebar from "@/components/shared/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Suspense fallback={<ProjectSkeleton />}>
        <Sidebar />
      </Suspense>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 md:h-16 border-b bg-card px-4 md:px-6 flex items-center">
          <UserNav />
        </header>

        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
