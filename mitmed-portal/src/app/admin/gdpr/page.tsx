import { listPendingDataSubjectRequests } from "@/actions/clients";
import { DataRequestRow } from "./DataRequestRow";

export default async function GdprRequestsPage() {
  const requests = await listPendingDataSubjectRequests();

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">Cereri GDPR</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Cereri de ștergere a contului trimise de clienți din portal. &bdquo;Anonimizează contul&rdquo; elimină
          datele de identificare/contact și chestionarul medical, dar păstrează fișele clinice și plățile —
          obligatoriu conform arhivării legale a documentației medicale/fiscale.
        </p>
      </header>

      <section className="space-y-3">
        {requests.length ? (
          requests.map((request) => <DataRequestRow key={request.id} request={request} />)
        ) : (
          <p className="text-sm text-zinc-500">Nu există cereri în așteptare.</p>
        )}
      </section>
    </div>
  );
}
