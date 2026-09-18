import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";
import { logout } from "@/actions/auth";
import { Logo } from "@/components/Logo";
import { PortalNavigation } from "./PortalNavigation";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  await requireRole(Role.CLIENT);

  return (
    <div className="portal-shell">
      <header className="portal-header">
        <a href="/portal" className="flex items-center gap-2.5 text-[var(--mitmed-mist)]"><Logo size={32} /><span className="text-base font-bold tracking-tight">MitMed</span><span className="portal-header-divider" /> <span className="text-xs font-medium text-[var(--mitmed-mist)]/65">Portal client</span></a>
        <form action={logout}>
          <button
            type="submit"
            className="portal-logout"
          >
            Deconectare
          </button>
        </form>
      </header>
      <div className="portal-app-shell"><PortalNavigation /><main className="w-full min-w-0 px-4 py-8 sm:px-6 lg:px-10 lg:py-12">{children}</main></div>
    </div>
  );
}
