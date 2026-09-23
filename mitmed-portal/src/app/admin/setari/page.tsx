import Link from "next/link";
import { IconClock, IconFileText, IconPackage, IconShield, IconTag, IconTherapy } from "@/components/icons";

const settings = [
  { href: "/admin/program", title: "Program și concedii", description: "Orele cabinetului pe zile ale săptămânii și perioadele de vacanță.", icon: IconClock },
  { href: "/admin/terapii", title: "Terapii", description: "Servicii, durate, prețuri și disponibilitate.", icon: IconTherapy },
  { href: "/admin/pachete", title: "Pachete", description: "Pachete de ședințe și combinații de terapii.", icon: IconPackage },
  { href: "/admin/cupoane", title: "Cupoane", description: "Reduceri, condiții de folosire și valabilitate.", icon: IconTag },
  { href: "/admin/documente", title: "Documente și acorduri", description: "Texte, consimțăminte și documente cerute clienților.", icon: IconFileText },
  { href: "/admin/gdpr", title: "Cereri GDPR", description: "Cereri de ștergere a contului trimise de clienți.", icon: IconShield },
];

export default function SettingsPage() {
  return <div className="space-y-7"><header><h1 className="text-xl font-bold tracking-tight text-zinc-900">Setări</h1><p className="mt-1 text-sm text-zinc-500">Configurează catalogul și documentele clinicii. Operațiunile zilnice rămân în meniul principal.</p></header><section className="grid gap-3 sm:grid-cols-2">{settings.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} className="group mm-card p-5 transition-shadow hover:shadow-md"><span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--mitmed-sky)]/15 text-[var(--mitmed-teal)]"><Icon className="h-5 w-5" /></span><h2 className="mt-4 text-base font-semibold text-zinc-900">{item.title}</h2><p className="mt-1 text-sm leading-6 text-zinc-500">{item.description}</p><span className="mt-4 inline-flex text-sm font-semibold text-[var(--mitmed-teal)]">Deschide setarea →</span></Link>; })}</section></div>;
}
