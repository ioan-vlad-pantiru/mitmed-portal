"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  issueFidelityCard,
  toggleClientFidelityCard,
  type ClientFidelityCard,
  type FidelityCardType,
} from "@/actions/fidelity";
import { useToast } from "@/components/Toast";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";

function CardRow({ clientId, card }: { clientId: string; card: ClientFidelityCard }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();
  // Poziția curentă în ciclu, 1-indexată — "ședința 3 din 6", ca să se
  // înțeleagă la o privire unde e clientul față de programul de reduceri.
  const position = card.cycle_length > 0 ? (card.stamps % card.cycle_length) + 1 : card.stamps + 1;

  return (
    <div className={`rounded-lg border px-3 py-2 ${card.active ? "border-zinc-200" : "border-zinc-100 opacity-60"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-zinc-800">
            {card.card_type_name} <span className="font-normal text-zinc-400">· {card.therapy_name}</span>
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Ședința {position} din {card.cycle_length} din ciclul curent
            {card.next_discount_percent && (
              <>
                {" · "}
                <span className="font-medium text-emerald-700">
                  următoarea are -{Number(card.next_discount_percent)}%
                </span>
              </>
            )}
            {card.discounted_sessions_used > 0 && (
              <span className="text-zinc-400"> · {card.discounted_sessions_used} reduceri acordate până acum</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!card.active && <Badge variant="neutral">Revocat</Badge>}
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await toggleClientFidelityCard(clientId, card.id, !card.active);
                  toast.success(card.active ? "Card revocat." : "Card reactivat.");
                  router.refresh();
                } catch {
                  toast.error("Nu am putut actualiza cardul. Încearcă din nou.");
                }
              })
            }
            className="text-xs font-medium text-zinc-400 underline-offset-2 hover:text-red-600 hover:underline disabled:opacity-50"
          >
            {card.active ? "Revocă" : "Reactivează"}
          </button>
        </div>
      </div>
      <p className="mt-1.5 text-xs text-zinc-400">
        Program: {card.tiers.map((t) => `a ${t.session_number}-a -${Number(t.discount_percent)}%`).join(", ")}
      </p>
    </div>
  );
}

export function FidelityCardsPanel({
  clientId,
  cards,
  cardTypes,
}: {
  clientId: string;
  cards: ClientFidelityCard[];
  cardTypes: FidelityCardType[];
}) {
  const [state, action, pending] = useActionState(issueFidelityCard.bind(null, clientId), undefined);
  const issuedTypeIds = new Set(cards.filter((c) => c.active).map((c) => c.card_type_id));
  const issuableTypes = cardTypes.filter((t) => t.active && !issuedTypeIds.has(t.id));
  const [selectedType, setSelectedType] = useState(issuableTypes[0]?.id ?? "");

  return (
    <div className="mt-3 mm-card p-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-400">Carduri de fidelitate</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Un client poate avea mai multe carduri simultan, câte unul per terapie. Reducerea se aplică automat, la
        ședințele potrivite din program, la fiecare plată încasată din terapia cardului.
      </p>

      {cards.length > 0 && (
        <div className="mt-3 space-y-2">
          {cards.map((c) => (
            <CardRow key={c.id} clientId={clientId} card={c} />
          ))}
        </div>
      )}
      {cards.length === 0 && <p className="mt-3 text-sm text-zinc-400">Niciun card emis încă.</p>}

      {issuableTypes.length > 0 ? (
        <form action={action} className="mt-3 flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700">Emite un card nou</label>
            <Select
              name="cardTypeId"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="mt-1 min-w-[220px]"
            >
              {issuableTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.therapy_name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? "Se emite…" : "Emite card"}
          </Button>
          {state?.message && <p className={`w-full text-sm ${state.success ? "text-emerald-700" : "text-red-600"}`}>{state.message}</p>}
        </form>
      ) : (
        <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-400">
          {cardTypes.length === 0
            ? "Nu există niciun tip de card definit — adaugă unul din Setări → Carduri de fidelitate."
            : "Clientul are deja un card activ pentru fiecare tip disponibil."}
        </p>
      )}
    </div>
  );
}
