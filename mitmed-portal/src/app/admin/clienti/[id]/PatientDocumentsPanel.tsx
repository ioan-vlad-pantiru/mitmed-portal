"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadClientDocument, deleteClientDocument, type ClientDocument } from "@/actions/clients";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { IconImage, IconFileText, IconDownload, IconTrash } from "@/components/icons";
import { useToast } from "@/components/Toast";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentIcon({ contentType }: { contentType: string }) {
  const Icon = contentType.startsWith("image/") ? IconImage : IconFileText;
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--mm-info-bg)] text-[var(--mitmed-teal-deep)]">
      <Icon className="h-[18px] w-[18px]" />
    </span>
  );
}

function DocumentRow({ clientId, doc }: { clientId: string; doc: ClientDocument }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  return (
    <div className="mm-card flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <DocumentIcon contentType={doc.content_type} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-900">{doc.original_filename}</p>
          <p className="truncate text-xs text-zinc-500">
            {formatSize(doc.size_bytes)} · {new Date(doc.created_at).toLocaleDateString("ro-RO")} ·{" "}
            {doc.uploaded_by_label}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-1">
        <a
          href={`/admin/clienti/${clientId}/documents/${doc.id}`}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-[var(--mitmed-teal)] transition-colors hover:bg-[var(--mitmed-sky)]/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mitmed-sky)] focus-visible:ring-offset-1"
          title="Descarcă"
          aria-label={`Descarcă ${doc.original_filename}`}
        >
          <IconDownload className="h-[18px] w-[18px]" />
        </a>
        <IconButton
          icon={IconTrash}
          label={`Șterge ${doc.original_filename}`}
          variant="danger"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(`Ștergi definitiv documentul „${doc.original_filename}"? Nu poate fi anulat.`)) return;
            startTransition(async () => {
              try {
                await deleteClientDocument(clientId, doc.id);
                toast.success("Document șters.");
                router.refresh();
              } catch {
                toast.error("Nu am putut șterge documentul. Încearcă din nou.");
              }
            });
          }}
        />
      </div>
    </div>
  );
}

export function PatientDocumentsPanel({ clientId, documents }: { clientId: string; documents: ClientDocument[] }) {
  const uploadAction = uploadClientDocument.bind(null, clientId);
  const [state, formAction, pending] = useActionState(uploadAction, undefined);

  return (
    <div className="mt-3 space-y-3">
      {documents.length === 0 ? (
        <p className="text-sm text-zinc-400">Niciun document încă.</p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <DocumentRow key={doc.id} clientId={clientId} doc={doc} />
          ))}
        </div>
      )}

      <form action={formAction} className="mm-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <input
          type="file"
          name="file"
          required
          className="min-w-0 flex-1 text-sm text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-[var(--mm-info-bg)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--mitmed-teal-deep)] hover:file:bg-[var(--mitmed-sky)]/20"
        />
        <Button type="submit" disabled={pending} className="shrink-0">
          {pending ? "Se încarcă…" : "Încarcă document"}
        </Button>
      </form>
      {state?.message && (
        <p className={`text-sm ${state.success ? "text-emerald-600" : "text-red-600"}`}>{state.message}</p>
      )}
    </div>
  );
}
