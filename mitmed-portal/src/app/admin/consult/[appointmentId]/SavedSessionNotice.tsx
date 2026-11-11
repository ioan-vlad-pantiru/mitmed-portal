import { CheckCircle2 } from "lucide-react";

/** Banner shown in Consult when the appointment already has a saved sheet: the
 * same sheet appears in the patient file, and saving here updates it. */
export function SavedSessionNotice({ readOnly }: { readOnly: boolean }) {
  return (
    <p data-variant="success" className="mm-alert">
      <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
      {readOnly
        ? "Fișa acestei programări e deja salvată în dosarul pacientului. Doar adminul o mai poate modifica."
        : "Fișa acestei programări e deja salvată în dosarul pacientului. Modificările de aici o actualizează pe aceeași fișă."}
    </p>
  );
}
