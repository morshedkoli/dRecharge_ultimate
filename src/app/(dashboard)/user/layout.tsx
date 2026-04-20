"use client";
import { useState } from "react";
import { UserGuard } from "@/components/user/UserGuard";
import { UserSidebar } from "@/components/user/UserSidebar";
import { UserTopbar } from "@/components/user/UserTopbar";
import { SubscriptionGate, SubscriptionWarningBanner } from "@/components/SubscriptionGate";

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <UserGuard>
      <SubscriptionGate>
        <div className="flex h-screen overflow-hidden bg-surface">
          <UserSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <UserTopbar onMenuClick={() => setSidebarOpen(true)} />
            <main className="flex-1 overflow-y-auto">
              <SubscriptionWarningBanner />
              {children}
            </main>
          </div>
        </div>
      </SubscriptionGate>
    </UserGuard>
  );
}
