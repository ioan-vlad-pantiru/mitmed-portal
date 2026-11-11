import { Phone } from "lucide-react";
import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";
import { logout } from "@/actions/auth";
import { Logo } from "@/components/Logo";
import { getOwnConsents, listActiveConsentTemplates } from "@/actions/consents";
import { CLINIC_PHONE, CLINIC_PHONE_HREF } from "@/lib/clinic";
import { PortalNavigation } from "./PortalNavigation";
import { unsignedTemplates } from "./portalData";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  await requireRole(Role.CLIENT);
  const [consents, templates] = await Promise.all([getOwnConsents(), listActiveConsentTemplates()]);
  const pendingDocuments = unsignedTemplates(templates, consents).length;

  return (
    <div className="portal-shell">
      <header className="portal-header">
        <a href="/portal" className="flex items-center gap-2.5 text-[var(--mitmed-mist)]">
          <Logo size={32} />
          <span className="text-base font-bold tracking-tight">MitMed</span>
          <span className="portal-header-divider" />
          <span className="text-sm font-medium text-[var(--mitmed-mist)]/75">Portal client</span>
        </a>
        <div className="flex items-center gap-1">
          <a href={CLINIC_PHONE_HREF} className="portal-header-call">
            <Phone size={17} />
            <span>{CLINIC_PHONE}</span>
          </a>
          <form action={logout}>
            <button type="submit" className="portal-logout">
              Ieșire
            </button>
          </form>
        </div>
      </header>
      <div className="portal-app-shell">
        <PortalNavigation pendingDocuments={pendingDocuments} />
        <main className="portal-main">{children}</main>
      </div>
    </div>
  );
}
