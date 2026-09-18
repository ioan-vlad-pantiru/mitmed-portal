import { UserRound } from "lucide-react";
import { getOwnClientData } from "@/actions/clients";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { ProfileForm, type ClientProfileData } from "../ProfileForm";
import { DataRightsPanel } from "../DataRightsPanel";

export default async function ProfilePage() {
  const raw = await getOwnClientData(); const client = raw as { full_name: string; birth_date: string | null; profile_data: ClientProfileData };
  return <div className="portal-subpage"><header><p>Profilul meu</p><h1>Preferințele tale contează.</h1><span>Păstrează actualizate datele de contact și informațiile care ne ajută să îți oferim o experiență mai bună.</span></header><section className="portal-feature-panel"><div className="portal-panel-title"><UserRound /><h2>{client.full_name}</h2></div><ProfileForm initial={client.profile_data} birthDate={client.birth_date ? client.birth_date.slice(0, 10) : null} /></section><section className="portal-feature-panel"><div className="portal-panel-title"><h2>Schimbă parola</h2></div><ChangePasswordForm /></section><DataRightsPanel /></div>;
}
