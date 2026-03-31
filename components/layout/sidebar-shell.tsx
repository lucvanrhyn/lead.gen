"use client";

import { usePathname } from "next/navigation";

import { Sidebar } from "./sidebar";

type SidebarShellProps = {
  readonly children: React.ReactNode;
};

export function SidebarShell({ children }: SidebarShellProps) {
  const pathname = usePathname();
  const hideSidebar = pathname === "/login";

  if (hideSidebar) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">{children}</div>
    </div>
  );
}
