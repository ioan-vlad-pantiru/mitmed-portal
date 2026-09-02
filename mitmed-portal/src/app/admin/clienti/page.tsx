import Link from "next/link";
import { listClients, listPendingClients } from "@/actions/clients";
import { PendingClientRow } from "./PendingClientRow";
import { CreateClientForm } from "./CreateClientForm";

export default async function ClientsPage() {
  const [clients, pending] = await Promise.all([listClients(), listPendingClients()]);

  return (
    <div className="space-y-8">
      {pending.length > 0 && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 className="font-medium text-amber-900">
            Conturi în așteptare de aprobare ({pending.length})
          </h2>
          <ul className="mt-3 space-y-2">
            {pending.map((u) => (
              <PendingClientRow
                key={u.id}
                userId={u.id}
                email={u.email}
                fullName={u.full_name ?? "—"}
              />
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-zinc-900">Clienți ({clients.length})</h1>
        </div>
        <div className="mt-4 overflow-hidden mm-card">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50/60 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="px-4 py-2.5">Nume</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Telefon</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {clients.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-zinc-50/70">
                  <td className="px-4 py-2 text-zinc-900">{c.full_name}</td>
                  <td className="px-4 py-2 text-zinc-600">{c.email}</td>
                  <td className="px-4 py-2 text-zinc-600">{c.phone ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link href={`/admin/clienti/${c.id}`} className="text-sky-600 hover:underline">
                      Vezi fișa
                    </Link>
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-400">
                    Niciun client încă.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-zinc-700">Creează cont client manual</h2>
        <CreateClientForm />
      </section>
    </div>
  );
}
