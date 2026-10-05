// Harta paginilor din admin — o singură sursă pentru breadcrumbs, butonul
// „Înapoi” și căutarea rapidă (⌘K). `parent` = unde duce „Înapoi”.
export type AdminPage = {
  href: string;
  label: string;
  parent?: string;
  adminOnly?: boolean;
  /** Tasta din scurtătura „g + tastă” (ex. g c = Clienți). */
  shortcut?: string;
  keywords?: string;
};

export const ADMIN_PAGES: AdminPage[] = [
  { href: "/admin", label: "Bord", shortcut: "b", keywords: "acasa calendar azi programari" },
  { href: "/admin/cereri", label: "Cereri", parent: "/admin", shortcut: "r", keywords: "programari site" },
  { href: "/admin/clienti", label: "Clienți", parent: "/admin", shortcut: "c", keywords: "pacienti" },
  { href: "/admin/insights", label: "Insights", parent: "/admin", shortcut: "i", keywords: "rapoarte venituri" },
  { href: "/admin/setari", label: "Setări", parent: "/admin", adminOnly: true, shortcut: "s" },
  { href: "/admin/program", label: "Program și concedii", parent: "/admin/setari", adminOnly: true, keywords: "ore vacanta" },
  { href: "/admin/terapii", label: "Terapii", parent: "/admin/setari", adminOnly: true, keywords: "preturi servicii" },
  { href: "/admin/fidelitate", label: "Carduri de fidelitate", parent: "/admin/setari", adminOnly: true },
  { href: "/admin/pachete", label: "Pachete", parent: "/admin/setari", adminOnly: true, keywords: "reduceri" },
  { href: "/admin/cupoane", label: "Cupoane", parent: "/admin/setari", adminOnly: true, keywords: "reduceri" },
  { href: "/admin/fisa-consultatie", label: "Fișe medicale", parent: "/admin/setari", adminOnly: true, keywords: "fisa consultatie tratament campuri" },
  { href: "/admin/site", label: "Site de prezentare", parent: "/admin/setari", adminOnly: true, keywords: "bara anunt mitmed.ro" },
  { href: "/admin/documente", label: "Documente și acorduri", parent: "/admin/setari", adminOnly: true, keywords: "consimtaminte gdpr" },
  { href: "/admin/gdpr", label: "Cereri GDPR", parent: "/admin/setari", adminOnly: true, keywords: "stergere date" },
  { href: "/admin/cont", label: "Contul meu", parent: "/admin", keywords: "parola" },
];

export const CLIENT_TABS: Record<string, string> = {
  profil: "Profil",
  dosar: "Dosar medical",
  plati: "Plăți",
  programari: "Programări",
};

export function findAdminPage(href: string): AdminPage | undefined {
  return ADMIN_PAGES.find((p) => p.href === href);
}

// Clienții deschiși recent (localStorage) — pentru revenirea rapidă din ⌘K.
const RECENT_CLIENTS_KEY = "mm-recent-clients";
const RECENT_LIMIT = 5;

export function readRecentClientIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_CLIENTS_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function rememberRecentClient(id: string): void {
  try {
    const ids = [id, ...readRecentClientIds().filter((x) => x !== id)].slice(0, RECENT_LIMIT);
    localStorage.setItem(RECENT_CLIENTS_KEY, JSON.stringify(ids));
  } catch {
    // Stocare indisponibilă — doar lista de recenți nu se ține minte.
  }
}
