import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";
import { listFidelityCardTypes } from "@/actions/fidelity";
import { listTherapies } from "@/actions/therapies";
import { CardTypeForm } from "./CardTypeForm";
import { CardTypeRow } from "./CardTypeRow";

export default async function FidelityCardsPage() {
  await requireRole(Role.ADMIN);
  const [cardTypes, therapiesRaw] = await Promise.all([listFidelityCardTypes(), listTherapies()]);
  const therapies = therapiesRaw.map((t) => ({ id: t.id, name: t.name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Carduri de fidelitate</h1>
        <p className="text-sm text-zinc-500">
          Fiecare tip de card contorizează ședințele plătite dintr-o singură terapie și aplică automat o reducere la
          anumite ședințe din program (ex. a 5-a -25%, a 6-a -50%). Emite un card unui client anume din fișa lui (tab
          Dosar medical).
        </p>
      </div>

      <div className="overflow-hidden mm-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50/60 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="px-4 py-2.5">Nume</th>
                <th className="px-4 py-2.5">Terapie</th>
                <th className="px-4 py-2.5">Program</th>
                <th className="px-4 py-2.5">Activ</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {cardTypes.map((c) => (
                <CardTypeRow key={c.id} cardType={c} therapies={therapies} />
              ))}
              {cardTypes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-400">
                    Niciun tip de card încă.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium text-zinc-700">Adaugă tip de card nou</h2>
        <CardTypeForm therapies={therapies} />
      </div>
    </div>
  );
}
