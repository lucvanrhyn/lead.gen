"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, LayoutList, Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { label: "Discover", href: "/leads", icon: Compass, exact: true },
  { label: "Leads", href: "/leads/industry", icon: LayoutList, exact: false },
] as const;

function isNavActive(pathname: string, href: string, exact: boolean) {
  if (exact) return pathname === href;
  return pathname.startsWith(href);
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      {navItems.map(({ label, href, icon: Icon, exact }) => {
        const active = isNavActive(pathname, href, exact);
        return (
          <Link
            key={label}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition",
              active
                ? "bg-[rgba(110,127,217,0.14)] text-[#1d2a47] font-medium"
                : "text-[rgba(22,32,51,0.62)] hover:bg-[rgba(101,122,179,0.08)] hover:text-[#1d2a47]",
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 flex-shrink-0",
                active ? "text-[#2f4273]" : "text-[rgba(22,32,51,0.48)]",
              )}
            />
            {label}
          </Link>
        );
      })}
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center gap-3 border-b border-[rgba(101,122,179,0.14)] bg-[rgba(255,255,255,0.92)] px-4 py-3 backdrop-blur-md md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-xl p-2 hover:bg-[rgba(101,122,179,0.08)]"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5 text-[#172033]" />
        </button>
        <span className="font-display text-base text-[#172033]">Lead Engine</span>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 flex w-[280px] flex-col border-r border-[rgba(101,122,179,0.14)] bg-white shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5">
              <span className="font-display text-lg text-[#172033]">Lead Engine</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-xl p-1.5 hover:bg-[rgba(101,122,179,0.08)]"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5 text-[#172033]" />
              </button>
            </div>
            <div className="mx-4 border-b border-[rgba(101,122,179,0.1)]" />
            <nav className="mt-4 flex flex-col gap-1 px-3" aria-label="Primary navigation">
              <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            </nav>
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-[240px] md:flex-shrink-0 md:flex-col">
        <div className="flex h-full flex-col border-r border-[rgba(101,122,179,0.14)] bg-[rgba(255,255,255,0.72)] backdrop-blur-[18px]">
          <div className="flex items-center gap-3 px-6 py-7">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#1d2a47] to-[#2f4273]">
              <Compass className="h-4 w-4 text-white" />
            </div>
            <span className="font-display text-lg text-[#172033]">Lead Engine</span>
          </div>

          <div className="mx-4 border-b border-[rgba(101,122,179,0.1)]" />

          <nav className="mt-4 flex flex-col gap-1 px-3" aria-label="Primary navigation">
            <NavLinks pathname={pathname} />
          </nav>

          <div className="flex-1" />

          <div className="px-6 pb-6">
            <p className="text-xs text-[rgba(22,32,51,0.36)] uppercase tracking-[0.18em]">
              Lead Intelligence
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
