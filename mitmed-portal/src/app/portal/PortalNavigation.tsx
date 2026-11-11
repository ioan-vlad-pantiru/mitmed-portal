"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardCheck, CreditCard, HeartPulse, House, UserRound } from "lucide-react";

const links = [
  { href: "/portal", label: "Acasă", short: "Acasă", icon: House, mobile: true },
  { href: "/portal/programari", label: "Programări", short: "Programări", icon: CalendarDays, mobile: true },
  { href: "/portal/dosar", label: "Dosarul meu", short: "Dosar", icon: HeartPulse, mobile: true },
  { href: "/portal/documente", label: "Documente", short: "Documente", icon: ClipboardCheck, mobile: false },
  { href: "/portal/plati", label: "Plăți și pachete", short: "Plăți", icon: CreditCard, mobile: true },
  { href: "/portal/profil", label: "Contul meu", short: "Cont", icon: UserRound, mobile: true },
];

function isActive(pathname: string, href: string) {
  if (href === "/portal") return pathname === "/portal";
  // Documents live under "Cont" on phones.
  return pathname.startsWith(href);
}

/** Sidebar on desktop; a fixed bottom tab bar on phones (thumb reach, always visible). */
export function PortalNavigation({ pendingDocuments = 0 }: { pendingDocuments?: number }) {
  const pathname = usePathname();
  return (
    <>
      <nav aria-label="Secțiuni portal" className="portal-main-nav">
        {links.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={isActive(pathname, href) ? "is-active" : ""} aria-current={isActive(pathname, href) ? "page" : undefined}>
            <Icon size={20} />
            <span>{label}</span>
            {href === "/portal/documente" && pendingDocuments > 0 && <em className="portal-nav-count">{pendingDocuments}</em>}
          </Link>
        ))}
      </nav>
      <nav aria-label="Navigare rapidă" className="portal-tabbar">
        {links
          .filter((l) => l.mobile)
          .map(({ href, short, icon: Icon }) => {
            const active = isActive(pathname, href) || (href === "/portal/profil" && pathname.startsWith("/portal/documente"));
            return (
              <Link key={href} href={href} className={active ? "is-active" : ""} aria-current={active ? "page" : undefined}>
                <Icon size={22} />
                <span>{short}</span>
                {href === "/portal/profil" && pendingDocuments > 0 && <em className="portal-nav-dot" aria-label="Documente de semnat" />}
              </Link>
            );
          })}
      </nav>
    </>
  );
}
