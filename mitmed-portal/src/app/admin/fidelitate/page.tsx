import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";
import Link from "next/link";
import { listFidelityCardTypes, listIssuedFidelityCards } from "@/actions/fidelity";
import { FidelityCardProgress } from "@/components/FidelityProgress";
import { listTherapies } from "@/actions/therapies";
import { CardTypeForm } from "./CardTypeForm";
import { CardTypeRow } from "./CardTypeRow";

export default async function FidelityCardsPage() {
  await requireRole(Role.ADMIN);
  const [cardTypes, therapiesRaw, issuedCards] = await Promise.all([
    listFidelityCardTypes(),
    listTherapies(),
    listIssuedFidelityCards(),
  ]);
  const therapies = therapiesRaw.map((t) => ({ id: t.id, name: t.name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Carduri de fidelitate</h1>
        <p className="text-sm text-zinc-500">
          Un tip de card cuprinde una sau mai multe terapii: ședințele plătite din oricare dintre ele se adună pe același
          contor, iar reducerea se aplică la pragurile cardului (ex. a 5-a ședință -25%, a 10-a -50%). Ședințele din
          pachete nu se numără. Cardul se aplică doar după ce îl atribui unui client din fișa lui (tab Dosar medical),
          unde alegi și ce terapii de pe card i se aplică.
        </p>
      </div>

      <div className="overflow-hidden mm-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50/60 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="px-4 py-2.5">Nume</th>
                <th className="px-4 py-2.5">Terapii</th>
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
        <h2 className="text-sm font-medium text-zinc-700">Carduri atribuite — progres</h2>
        {issuedCards.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">Niciun card atribuit unui client încă.</p>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {issuedCards.map((card) => (
              <div key={card.id} className="mm-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link
                    href={`/admin/clienti/${card.client_id}?tab=dosar`}
                    className="text-sm font-semibold text-zinc-900 hover:text-[var(--mitmed-teal)] hover:underline"
                  >
                    {card.client_name}
                  </Link>
                  <span className="text-xs text-zinc-500">{card.card_type_name}</span>
                </div>
                <div className="mt-3">
                  <FidelityCardProgress card={card} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-medium text-zinc-700">Adaugă tip de card nou</h2>
        <CardTypeForm therapies={therapies} />
      </div>
    </div>
  );
}
