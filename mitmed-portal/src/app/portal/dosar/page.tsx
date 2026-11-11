import { ClipboardPlus, Download, FileText, HeartPulse, Lightbulb } from "lucide-react";
import { getOwnClientData } from "@/actions/clients";
import { formatDate } from "@/lib/clinicTime";
import { MedicalHistoryForm } from "../MedicalHistoryForm";
import { PortalPageHeader } from "../_components/PortalPageHeader";
import { medicalFileEntries, type ClientRecord, type ClientSheet, type SharedNote } from "../portalData";

type Client = {
  medical_history: { allergies?: string; conditions?: string; medications?: string; previous_injuries?: string; notes?: string } | null;
  medical_records: ClientRecord[];
  consultation_sheets: ClientSheet[];
};

const isRecommendation = (note: SharedNote) => /recomand/i.test(note.label);

export default async function MedicalFilePage() {
  const client = (await getOwnClientData()) as Client;
  const entries = medicalFileEntries(client.medical_records, client.consultation_sheets);

  return (
    <div className="portal-subpage">
      <PortalPageHeader title="Dosarul meu" description="Tot ce ți-a transmis terapeutul, de la cea mai recentă vizită." />

      <section className="portal-feature-panel">
        <div className="portal-panel-title">
          <HeartPulse />
          <h2>Vizitele și fișele tale</h2>
        </div>
        {entries.length ? (
          <ol className="portal-record-list">
            {entries.map((entry, index) => {
              const latest = index === 0 ? <span>cea mai recentă</span> : null;
              if (entry.kind === "sheet") {
                const { sheet } = entry;
                const advice = sheet.shared.filter(isRecommendation);
                const other = sheet.shared.filter((n) => !isRecommendation(n));
                return (
                  <li key={`s-${sheet.id}`} className={index === 0 ? "is-latest" : ""}>
                    <p className="portal-record-date">
                      {formatDate(sheet.sheet_date)} · {sheet.template_name}
                      {latest}
                    </p>
                    {advice.map((note) => (
                      <Advice key={note.label} title={note.label} text={note.value} />
                    ))}
                    {other.map((note) => (
                      <Note key={note.label} label={note.label} text={note.value} />
                    ))}
                    <a href={`/portal/dosar/fise/${sheet.id}`} className="portal-secondary-btn portal-btn-sm mt-3">
                      <Download size={16} /> Descarcă fișa (PDF)
                    </a>
                  </li>
                );
              }
              const { record } = entry;
              return (
                <li key={`r-${record.id}`} className={index === 0 ? "is-latest" : ""}>
                  <p className="portal-record-date">
                    {formatDate(record.session_date)}
                    {record.therapy && ` · ${record.therapy.name}`}
                    {latest}
                  </p>
                  {record.treatment_plan && <Advice title="Ce ai de făcut" text={record.treatment_plan} />}
                  {record.shared.filter(isRecommendation).map((note) => (
                    <Advice key={note.label} title={note.label} text={note.value} />
                  ))}
                  {record.diagnosis && <Note label="Diagnostic" text={record.diagnosis} />}
                  {record.shared
                    .filter((n) => !isRecommendation(n))
                    .map((note) => (
                      <Note key={note.label} label={note.label} text={note.value} />
                    ))}
                  {record.notes && (
                    <details className="portal-record-notes" open={!record.treatment_plan}>
                      <summary>Ce am lucrat în ședință</summary>
                      <p>{record.notes}</p>
                    </details>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="portal-quiet">După prima vizită, aici vei vedea ce ți-a recomandat terapeutul.</p>
        )}
      </section>

      <section className="portal-feature-panel">
        <div className="portal-panel-title">
          <ClipboardPlus />
          <div>
            <h2>Ce trebuie să știe terapeutul</h2>
            <span className="portal-panel-caption">Alergii, boli, medicamente. Completează doar ce e relevant.</span>
          </div>
        </div>
        <MedicalHistoryForm initial={client.medical_history} />
      </section>
    </div>
  );
}

function Advice({ title, text }: { title: string; text: string }) {
  return (
    <div className="portal-record-advice">
      <Lightbulb size={20} />
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}

function Note({ label, text }: { label: string; text: string }) {
  return (
    <div className="portal-record-note">
      <FileText size={16} />
      <p>
        <strong>{label}:</strong> {text}
      </p>
    </div>
  );
}
