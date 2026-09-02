import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";
import { listConsentTemplates } from "@/actions/consents";
import { TemplateForm } from "./TemplateForm";

const LABELS: Record<string, string> = {
  GDPR: "Acord GDPR — prelucrarea datelor medicale",
  RISC_PRET: "Declarație riscuri tratament și politică de preț (fără rambursare)",
};

export default async function DocumentsPage() {
  await requireRole(Role.ADMIN);
  const templates = await listConsentTemplates();

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">Documente de semnat</h1>
        <p className="text-sm text-zinc-500">
          Textul pe care fiecare client trebuie să-l semneze digital, în portalul lui. O
          editare aici se aplică doar semnăturilor viitoare — ce a semnat deja un client
          rămâne neschimbat (istoric).
        </p>
      </div>

      {templates.map((t) => (
        <section key={t.type}>
          <h2 className="text-base font-semibold text-zinc-900">{LABELS[t.type] ?? t.type}</h2>
          <TemplateForm type={t.type} title={LABELS[t.type] ?? t.type} initialText={t.text} />
        </section>
      ))}
    </div>
  );
}
