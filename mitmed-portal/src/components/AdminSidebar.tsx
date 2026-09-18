"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, UserCog } from "lucide-react";
import {
  IconCalendar,
  IconUsers,
  IconTherapy,
  IconChart,
  IconInbox,
} from "@/components/icons";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { label: string; items: NavItem[] };

export function AdminSidebar({
  isAdmin,
  onNavigate,
  onCollapse,
}: {
  isAdmin: boolean;
  onNavigate?: () => void;
  onCollapse?: () => void;
}) {
  const pathname = usePathname();

  // Grupat pe intenție, nu doar înșirat — "Astăzi" e ce se folosește minut cu
  // minut, "Configurare" e ce se atinge rar (setup de clinică, nu operare zilnică).
  const groups: NavGroup[] = [
    {
      label: "Astăzi",
      items: [
        { href: "/admin", label: "Bord", icon: IconCalendar },
        { href: "/admin/cereri", label: "Cereri", icon: IconInbox },
      ],
    },
    {
      label: "Clienți",
      items: [{ href: "/admin/clienti", label: "Clienți", icon: IconUsers }],
    },
    {
      label: "Rapoarte",
      items: [{ href: "/admin/insights", label: "Insights", icon: IconChart }],
    },
    ...(isAdmin
      ? [
          {
            label: "Administrare",
            items: [{ href: "/admin/setari", label: "Setări", icon: IconTherapy }],
          },
        ]
      : []),
    {
      label: "Cont",
      items: [{ href: "/admin/cont", label: "Contul meu", icon: UserCog }],
    },
  ];

  return (
    <nav className="flex h-[calc(100vh-3.5rem)] w-56 shrink-0 flex-col overflow-y-auto border-r border-zinc-200/70 bg-white px-2.5 py-5 shadow-xl sm:h-full sm:shadow-none">
      {onCollapse && (
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Restrânge meniul"
          title="Restrânge meniul"
          className="mb-2 hidden w-fit items-center gap-1 self-end rounded-md p-1.5 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 sm:flex"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">{group.label}</p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-[var(--mitmed-sky)]/12 text-[var(--mitmed-teal-deep)]"
                        : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-[var(--mitmed-teal)]" />
                    )}
                    <Icon
                      className={`h-[18px] w-[18px] transition-colors ${
                        active ? "text-[var(--mitmed-teal)]" : "text-zinc-400 group-hover:text-zinc-600"
                      }`}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-zinc-400">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--mitmed-orange)]" />
        Puterea vindecării
      </div>
    </nav>
  );
}
