"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Trophy, Swords, ScrollText, type LucideIcon } from "lucide-react";

const TABS: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/", label: "Tổng quan", Icon: LayoutGrid },
  { href: "/classic", label: "Classic", Icon: Trophy },
  { href: "/h2h", label: "H2H", Icon: Swords },
  { href: "/achievements", label: "Sổ đầu bài", Icon: ScrollText },
];

export default function TabNav() {
  const pathname = usePathname();

  return (
    // flush bottom menu bar on mobile, sticky floating pill on desktop
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-3xl sm:sticky sm:bottom-auto sm:top-2 sm:px-3 sm:pb-2">
      <div
        role="tablist"
        aria-label="Chuyển tab"
        className="flex gap-1 border-t border-[#2a2350] bg-[#141030] p-[5px] pb-[max(5px,env(safe-area-inset-bottom))] shadow-lg sm:rounded-2xl sm:border sm:pb-[5px]"
      >
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              role="tab"
              aria-selected={active}
              className={`flex min-h-[40px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-1 py-2.5 text-[13px] font-medium transition-all duration-200 sm:gap-2 sm:text-sm ${
                active
                  ? "bg-gradient-to-br from-[#2ee6a6] to-[#12c6e6] text-[#052a23] shadow-[0_4px_16px_rgba(46,230,166,0.3)]"
                  : "text-[#9a97bd] hover:text-slate-200"
              }`}
            >
              <t.Icon size={16} strokeWidth={2.25} className="shrink-0" aria-hidden />
              <span className="truncate">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
