import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";
import { listConsentTemplates } from "@/actions/consents";
import { TemplateForm } from "./TemplateForm";
import { AddDocumentForm } from "./AddDocumentForm";

export default async function DocumentsPage() {
  await requireRole(Role.ADMIN);
  const templates = await listConsentTemplates();

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">Documente de semnat</h1>
        <p className="text-sm text-zinc-500">
          Textul pe care fiecare client trebuie să-l semneze digital, în portalul lui. O editare aici se aplică doar
          semnăturilor viitoare — ce a semnat deja un client rămâne neschimbat (istoric). Poți adăuga oricând un
          document nou, în afara celor două existente.
        </p>
      </div>

      {templates.map((t) => (
        <section key={t.type}>
          <TemplateForm type={t.type} initialLabel={t.label} initialText={t.text} active={t.active} />
        </section>
      ))}

      <AddDocumentForm />
    </div>
  );
}
