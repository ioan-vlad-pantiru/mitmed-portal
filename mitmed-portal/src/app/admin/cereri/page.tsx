import { listBookingRequests } from "@/actions/publicBookings";
import { BookingRequestRow } from "./BookingRequestRow";

export default async function BookingRequestsPage() {
  const requests = await listBookingRequests();
  const noi = requests.filter((r) => r.status === "NOU");
  const rezolvate = requests.filter((r) => r.status !== "NOU");

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">Cereri de programare</h1>
        <p className="text-sm text-zinc-500">
          Trimise de vizitatori de pe site-ul de prezentare, fără cont — confirmă manual pentru
          a crea contul + programarea.
        </p>
      </div>

      <div>
        <h2 className="text-base font-semibold text-zinc-900">Noi ({noi.length})</h2>
        <div className="mt-3 space-y-2">
          {noi.map((r) => (
            <BookingRequestRow key={r.id} request={r} />
          ))}
          {noi.length === 0 && <p className="text-sm text-zinc-400">Nicio cerere nouă.</p>}
        </div>
      </div>

      {rezolvate.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Rezolvate</h2>
          <div className="mt-3 space-y-2 opacity-60">
            {rezolvate.map((r) => (
              <BookingRequestRow key={r.id} request={r} readonly />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
