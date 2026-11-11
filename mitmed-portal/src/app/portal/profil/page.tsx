import Link from "next/link";
import { ChevronRight, ClipboardCheck, KeyRound, MessageSquareText, UserRound } from "lucide-react";
import { getOwnClientData } from "@/actions/clients";
import { getOwnConsents, listActiveConsentTemplates } from "@/actions/consents";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { ProfileForm, type ClientProfileData } from "../ProfileForm";
import { DataRightsPanel } from "../DataRightsPanel";
import { PortalPageHeader } from "../_components/PortalPageHeader";
import { unsignedTemplates } from "../portalData";

export default async function ProfilePage() {
  const [raw, consents, templates] = await Promise.all([getOwnClientData(), getOwnConsents(), listActiveConsentTemplates()]);
  const client = raw as { full_name: string; phone: string | null; birth_date: string | null; profile_data: ClientProfileData };
  const pendingDocuments = unsignedTemplates(templates, consents).length;

  return (
    <div className="portal-subpage">
      <PortalPageHeader title="Contul meu" description={[client.full_name, client.phone].filter(Boolean).join(" · ")} />

      <nav className="portal-todo-list" aria-label="Scurtături cont">
        <Link href="/portal/documente" className={pendingDocuments ? "is-urgent" : ""}>
          <span className="portal-todo-icon">
            <ClipboardCheck size={20} />
          </span>
          <span className="portal-todo-text">
            <strong>Documente</strong>
            <small>{pendingDocuments ? `${pendingDocuments} de semnat` : "Toate sunt semnate"}</small>
          </span>
          <span className="portal-todo-action">
            Deschide <ChevronRight size={16} />
          </span>
        </Link>
        <Link href="/portal/sondaj">
          <span className="portal-todo-icon">
            <MessageSquareText size={20} />
          </span>
          <span className="portal-todo-text">
            <strong>Părerea ta despre vizite</strong>
            <small>Sondajul de satisfacție</small>
          </span>
          <span className="portal-todo-action">
            Deschide <ChevronRight size={16} />
          </span>
        </Link>
      </nav>

      <section className="portal-feature-panel">
        <div className="portal-panel-title">
          <UserRound />
          <div>
            <h2>Despre tine</h2>
            <span className="portal-panel-caption">Opțional. Ne ajută să îți recomandăm ce ți se potrivește.</span>
          </div>
        </div>
        <ProfileForm initial={client.profile_data} birthDate={client.birth_date ? client.birth_date.slice(0, 10) : null} />
      </section>

      <section className="portal-feature-panel">
        <div className="portal-panel-title">
          <KeyRound />
          <h2>Schimbă parola</h2>
        </div>
        <ChangePasswordForm />
      </section>

      <DataRightsPanel />
    </div>
  );
}
