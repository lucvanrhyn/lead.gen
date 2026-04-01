"use client";

import { usePathname } from "next/navigation";

import { Sidebar } from "./sidebar";

type SidebarShellProps = {
  readonly children: React.ReactNode;
};

export function SidebarShell({ children }: SidebarShellProps) {
  const pathname = usePathname();
  const hideSidebar = pathname === "/login" || pathname.startsWith("/assets/");

  if (hideSidebar) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      {/* pt-14 on mobile to clear the fixed top bar, md:pt-0 for desktop */}
      <div className="flex flex-1 flex-col min-w-0 pt-14 md:pt-0">{children}</div>
    </div>
  );
}
