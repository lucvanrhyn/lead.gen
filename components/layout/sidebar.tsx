"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, LayoutList, Settings } from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { label: "Discover", href: "/leads", icon: Compass },
  { label: "Leads", href: "/leads", icon: LayoutList },
  { label: "Settings", href: "/leads", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-[240px] md:flex-shrink-0 md:flex-col">
      <div className="flex h-full flex-col border-r border-[rgba(101,122,179,0.14)] bg-[rgba(255,255,255,0.72)] backdrop-blur-[18px]">
        {/* Logo / App name */}
        <div className="flex items-center gap-3 px-6 py-7">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#1d2a47] to-[#2f4273]">
            <Compass className="h-4 w-4 text-white" />
          </div>
          <span className="font-display text-lg text-[#172033]">Lead Engine</span>
        </div>

        <div className="mx-4 border-b border-[rgba(101,122,179,0.1)]" />

        {/* Navigation */}
        <nav className="mt-4 flex flex-col gap-1 px-3" aria-label="Primary navigation">
          {navItems.map(({ label, href, icon: Icon }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={label}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition",
                  isActive
                    ? "bg-[rgba(110,127,217,0.14)] text-[#1d2a47] font-medium"
                    : "text-[rgba(22,32,51,0.62)] hover:bg-[rgba(101,122,179,0.08)] hover:text-[#1d2a47]",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 flex-shrink-0",
                    isActive ? "text-[#2f4273]" : "text-[rgba(22,32,51,0.48)]",
                  )}
                />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom spacer */}
        <div className="flex-1" />

        <div className="px-6 pb-6">
          <p className="text-xs text-[rgba(22,32,51,0.36)] uppercase tracking-[0.18em]">
            Lead Intelligence
          </p>
        </div>
      </div>
    </aside>
  );
}
