"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardCheck, CreditCard, HeartPulse, House, UserRound } from "lucide-react";

const links = [
  { href: "/portal", label: "Acasă", icon: House },
  { href: "/portal/programari", label: "Programări", icon: CalendarDays },
  { href: "/portal/dosar", label: "Dosarul meu", icon: HeartPulse },
  { href: "/portal/documente", label: "Documente", icon: ClipboardCheck },
  { href: "/portal/plati", label: "Plăți", icon: CreditCard },
  { href: "/portal/profil", label: "Profil", icon: UserRound },
];

export function PortalNavigation() {
  const pathname = usePathname();
  return <nav aria-label="Secțiuni portal" className="portal-main-nav">{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={pathname === href ? "is-active" : ""}><Icon size={18} /><span>{label}</span></Link>)}</nav>;
}
