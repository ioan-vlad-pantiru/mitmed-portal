"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, Star, UserCog } from "lucide-react";
import { IconCalendar, IconUsers, IconTherapy, IconChart, IconInbox } from "@/components/icons";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { label: string; items: NavItem[] };

/**
 * Admin navigation. Full width shows labels; collapsed it becomes a slim icon
 * rail (names in tooltips) instead of disappearing, so every page stays one
 * click away and the toggle sits in the same spot either way.
 */
export function AdminSidebar({
  isAdmin,
  collapsed = false,
  onNavigate,
  onToggleCollapsed,
}: {
  isAdmin: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
  /** Desktop only; absent in the mobile drawer. */
  onToggleCollapsed?: () => void;
}) {
  const pathname = usePathname();

  // Grouped by intent: "Astăzi" is used minute by minute, "Administrare" rarely.
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
      items: [
        { href: "/admin/insights", label: "Insights", icon: IconChart },
        ...(isAdmin ? [{ href: "/admin/sondaj", label: "Satisfacție", icon: Star }] : []),
      ],
    },
    ...(isAdmin ? [{ label: "Administrare", items: [{ href: "/admin/setari", label: "Setări", icon: IconTherapy }] }] : []),
    {
      label: "Cont",
      items: [{ href: "/admin/cont", label: "Contul meu", icon: UserCog }],
    },
  ];

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <nav
      aria-label="Meniu principal"
      className={`flex h-[calc(100vh-3.5rem)] shrink-0 flex-col overflow-y-auto overflow-x-hidden border-r border-zinc-200/70 bg-white py-4 shadow-xl transition-[width] duration-200 sm:sticky sm:top-0 sm:h-[calc(100vh-3.5rem)] sm:shadow-none ${
        collapsed ? "w-16 px-2" : "w-56 px-2.5"
      }`}
    >
      <div className="flex flex-col gap-4">
        {groups.map((group, index) => (
          <div key={group.label}>
            {collapsed ? (
              index > 0 && <div className="mx-2 mb-3 border-t border-zinc-100" aria-hidden />
            ) : (
              <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">{group.label}</p>
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex h-10 items-center rounded-lg text-sm font-medium transition-colors ${
                      collapsed ? "justify-center" : "gap-3 px-3"
                    } ${
                      active
                        ? "bg-[var(--mitmed-sky)]/12 text-[var(--mitmed-teal-deep)]"
                        : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                    }`}
                  >
                    {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-[var(--mitmed-teal)]" />}
                    <Icon
                      className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                        active ? "text-[var(--mitmed-teal)]" : "text-zinc-400 group-hover:text-zinc-600"
                      }`}
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-4">
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Extinde meniul" : "Restrânge meniul"}
            title={collapsed ? "Extinde meniul" : "Restrânge meniul"}
            aria-expanded={!collapsed}
            className={`hidden h-10 w-full items-center rounded-lg text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 sm:flex ${
              collapsed ? "justify-center" : "gap-3 px-3"
            }`}
          >
            <ToggleIcon className="h-[18px] w-[18px] shrink-0 text-zinc-400" strokeWidth={1.75} />
            {!collapsed && "Restrânge meniul"}
          </button>
        )}
        {!collapsed && (
          <div className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--mitmed-orange)]" />
            Puterea vindecării
          </div>
        )}
      </div>
    </nav>
  );
}
