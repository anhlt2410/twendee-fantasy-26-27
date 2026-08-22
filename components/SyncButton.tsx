"use client";

import { useState, useTransition } from "react";

type Toast = { ok: boolean; msg: string } | null;

export default function SyncButton() {
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<Toast>(null);

  function onClick() {
    setToast(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/sync", {
          method: "POST",
          cache: "no-store",
        });
        const r = await res.json();
        if (res.ok && r.ok) {
          const parts: string[] = [];
          if (r.processedGws?.length)
            parts.push(`GW ${r.processedGws.join(", ")}`);
          parts.push(`${r.h2hMatches ?? 0} trận H2H`);
          setToast({ ok: true, msg: `Đã cập nhật · ${parts.join(" · ")}` });
          // Hard reload AFTER the sync committed, so every tab (Overview,
          // Classic, H2H, Achievements, Stats) re-reads the fresh data.
          setTimeout(() => window.location.reload(), 700);
        } else {
          setToast({ ok: false, msg: r.error ?? "Sync thất bại." });
          setTimeout(() => setToast(null), 4000);
        }
      } catch (e) {
        setToast({
          ok: false,
          msg: e instanceof Error ? e.message : "Sync thất bại.",
        });
        setTimeout(() => setToast(null), 4000);
      }
    });
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-label="Sync dữ liệu từ FPL"
        className="flex items-center gap-1.5 rounded-full border border-sea-border bg-sea-surface/70 px-3 py-1.5 text-xs font-bold text-sea-text shadow-glow ring-1 ring-sea-border transition hover:bg-sea-surface disabled:opacity-60"
      >
        <RefreshIcon spinning={pending} />
        <span className="hidden sm:inline">
          {pending ? "Đang đồng bộ" : "Đồng bộ từ FPL"}
        </span>
      </button>

      {toast && (
        <div
          role="status"
          className={`absolute right-0 top-full z-20 mt-2 w-max max-w-[70vw] rounded-lg px-3 py-2 text-[11px] font-semibold shadow-lg ring-1 ${
            toast.ok
              ? "bg-sea-teal/10 text-sea-teal ring-sea-teal/30"
              : "bg-sea-rose/10 text-sea-rose ring-sea-rose/30"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-3.5 w-3.5 ${spinning ? "animate-spin" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}
