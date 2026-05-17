"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Today's Briefing", icon: "📋" },
  { href: "/emails", label: "Email Summary", icon: "✉️" },
  { href: "/calendar", label: "Calendar", icon: "📅" },
  { href: "/tasks", label: "Tasks", icon: "✓" },
  { href: "/memory", label: "Memory Vault", icon: "🧠" },
  { href: "/audit", label: "Audit Log", icon: "📜" },
  { href: "/settings", label: "Privacy", icon: "🔒" },
];

interface NavSidebarProps {
  connections?: { gmail: boolean; calendar: boolean; drive: boolean };
}

export function NavSidebar({ connections }: NavSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-48 bg-[#020b18] border-r border-[#0f172a] p-4 flex flex-col gap-0.5 sticky top-14 h-[calc(100vh-56px)] overflow-y-auto">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] transition-all duration-150"
            style={{
              background: active ? "#0f172a" : "transparent",
              border: `1px solid ${active ? "#1e293b" : "transparent"}`,
              color: active ? "#e2e8f0" : "#64748b",
              fontWeight: active ? 600 : 400,
            }}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}

      <div className="flex-1" />

      {/* Connection status */}
      <div className="px-3 pt-3 border-t border-[#0f172a] mt-2">
        <div className="text-[10px] text-slate-700 font-bold uppercase tracking-widest mb-2">Connected</div>
        {[
          { label: "Gmail", active: connections?.gmail ?? false },
          { label: "Calendar", active: connections?.calendar ?? false },
          { label: "Drive", active: connections?.drive ?? false },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 mb-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: s.active ? "#22c55e" : "#374151" }}
            />
            <span className="text-[11px] text-slate-500">{s.label}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
