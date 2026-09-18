"use client";

import { useActionState } from "react";
import { AlertTriangle, LockKeyhole, Pill, Save } from "lucide-react";
import { updateOwnMedicalHistory } from "@/actions/clients";

type MedicalHistory = {
  allergies?: string;
  conditions?: string;
  medications?: string;
  previous_injuries?: string;
  notes?: string;
} | null;

export function MedicalHistoryForm({ initial }: { initial: MedicalHistory }) {
  const [state, action, pending] = useActionState(updateOwnMedicalHistory, undefined);

  return (
    <form action={action} className="medical-history-form">
      <div className="medical-history-privacy"><LockKeyhole size={18} /><p><strong>Date confidențiale</strong> Informațiile de mai jos sunt vizibile doar echipei MitMed care se ocupă de tratamentul tău.</p></div>
      <fieldset className="medical-history-section"><legend><AlertTriangle size={17} /> Istoric relevant</legend><div className="medical-history-grid"><label>Alergii<input name="allergies" defaultValue={initial?.allergies} placeholder="De exemplu: latex, penicilină" /></label><label>Afecțiuni cunoscute<input name="conditions" defaultValue={initial?.conditions} placeholder="De exemplu: hipertensiune" /></label><label>Leziuni sau operații anterioare<input name="previousInjuries" defaultValue={initial?.previous_injuries} placeholder="Zona și anul, dacă le știi" /></label></div></fieldset>
      <fieldset className="medical-history-section"><legend><Pill size={17} /> Tratament curent</legend><label className="medical-history-full">Medicamente sau suplimente<input name="medications" defaultValue={initial?.medications} placeholder="Numele medicamentelor relevante" /></label><label className="medical-history-full">Alte informații pentru terapeut<textarea name="notes" rows={3} defaultValue={initial?.notes} placeholder="Ce ar trebui să știe echipa înainte de ședință?" /></label></fieldset>
      {state?.message && <p className={`medical-history-result ${state.success ? "is-success" : "is-error"}`} role="alert">{state.message}</p>}
      <div className="medical-history-actions"><p>Actualizează dosarul când apar schimbări importante pentru recuperarea ta.</p><button type="submit" disabled={pending}>{pending ? "Se salvează…" : <><Save size={16} /> Salvează modificările</>}</button></div>
    </form>
  );
}
