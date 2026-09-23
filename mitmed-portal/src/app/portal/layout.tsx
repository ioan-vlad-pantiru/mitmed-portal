import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";
import { logout } from "@/actions/auth";
import { Logo } from "@/components/Logo";
import { getOwnClientData } from "@/actions/clients";
import { PortalNavigation } from "./PortalNavigation";
import { ProfileCompletionPrompt } from "./ProfileCompletionPrompt";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  await requireRole(Role.CLIENT);
  const raw = await getOwnClientData();
  const profileData = (raw as { profile_data: Record<string, unknown> | null } | null)?.profile_data;
  const profileIncomplete = !profileData || Object.keys(profileData).length === 0;

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
      <ProfileCompletionPrompt incomplete={profileIncomplete} />
    </div>
  );
}
