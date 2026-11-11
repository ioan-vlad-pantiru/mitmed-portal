import { UserCheck } from "lucide-react";
import { listClients, listPendingClients } from "@/actions/clients";
import { PendingClientRow } from "./PendingClientRow";
import { ClientsBrowser } from "./ClientsBrowser";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ nou?: string }> }) {
  const [{ nou }, clients, pending] = await Promise.all([searchParams, listClients(), listPendingClients()]);

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <section className="mm-card border-amber-200 bg-amber-50/60 p-4">
          <h2 className="flex items-center gap-2 font-semibold text-amber-900">
            <UserCheck size={18} /> {pending.length === 1 ? "Un cont nou așteaptă aprobarea" : `${pending.length} conturi noi așteaptă aprobarea`}
          </h2>
          <ul className="mt-3 space-y-2">
            {pending.map((u) => (
              <PendingClientRow key={u.id} userId={u.id} email={u.email} fullName={u.full_name ?? "—"} />
            ))}
          </ul>
        </section>
      )}

      <ClientsBrowser clients={clients} openNewClient={nou === "1"} />
    </div>
  );
}
