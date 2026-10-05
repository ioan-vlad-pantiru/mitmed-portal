"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  issueFidelityCard,
  toggleClientFidelityCard,
  updateClientCardTherapies,
  type ClientFidelityCard,
  type FidelityCardType,
} from "@/actions/fidelity";
import { FidelityCardProgress } from "@/components/FidelityProgress";
import { useToast } from "@/components/Toast";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";

function TherapyChecklist({
  cardType,
  selected,
  onChange,
  name,
}: {
  cardType: FidelityCardType;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  name?: string;
}) {
  const allSelected = cardType.therapies.every((t) => selected.has(t.therapy_id));
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {cardType.therapies.length > 1 && (
        <button
          type="button"
          onClick={() => onChange(new Set(allSelected ? [] : cardType.therapies.map((t) => t.therapy_id)))}
          className="text-xs font-medium text-[var(--mitmed-teal)] hover:underline"
        >
          {allSelected ? "Debifează toate" : "Bifează toate"}
        </button>
      )}
      {cardType.therapies.map((t) => (
        <label key={t.therapy_id} className="flex items-center gap-1.5 text-sm text-zinc-700">
          <input
            type="checkbox"
            name={name}
            value={t.therapy_id}
            checked={selected.has(t.therapy_id)}
            onChange={(e) => {
              const next = new Set(selected);
              if (e.target.checked) next.add(t.therapy_id);
              else next.delete(t.therapy_id);
              onChange(next);
            }}
            className="h-4 w-4 accent-[var(--mitmed-teal)]"
          />
          {t.therapy_name}
        </label>
      ))}
    </div>
  );
}

function CardRow({
  clientId,
  card,
  cardType,
  isAdmin,
}: {
  clientId: string;
  card: ClientFidelityCard;
  cardType: FidelityCardType | undefined;
  isAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(() => new Set(card.therapies.map((t) => t.therapy_id)));
  const toast = useToast();
  const router = useRouter();
  // Terapii ale tipului de card pe care adminul nu le-a activat pentru acest client.
  const inactiveCount = cardType ? cardType.therapies.length - card.therapies.length : 0;

  return (
    <div className={`rounded-lg border px-3 py-3 ${card.active ? "border-zinc-200" : "border-zinc-100 opacity-60"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-zinc-800">{card.card_type_name}</p>
        <div className="flex items-center gap-3">
          {!card.active && <Badge variant="neutral">Revocat</Badge>}
          {isAdmin && card.active && cardType && cardType.therapies.length > 1 && (
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="text-xs font-medium text-[var(--mitmed-teal)] underline-offset-2 hover:underline"
            >
              {editing ? "Renunță" : "Alege terapiile"}
            </button>
          )}
          {isAdmin && (
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
          )}
        </div>
      </div>

      {editing && cardType && (
        <div className="mt-2 rounded-md bg-zinc-50 p-3">
          <p className="mb-2 text-xs text-zinc-500">
            Terapiile de pe card care se aplică acestui client. Contorul cardului e comun, așa că schimbarea
            terapiilor nu îi pierde progresul.
          </p>
          <TherapyChecklist cardType={cardType} selected={selected} onChange={setSelected} />
          <Button
            type="button"
            variant="secondary"
            className="mt-3"
            disabled={pending || selected.size === 0}
            onClick={() =>
              startTransition(async () => {
                const result = await updateClientCardTherapies(clientId, card.id, [...selected]);
                if (result.ok) {
                  toast.success("Terapiile cardului au fost actualizate.");
                  setEditing(false);
                  router.refresh();
                } else {
                  toast.error(result.message);
                }
              })
            }
          >
            Salvează terapiile
          </Button>
        </div>
      )}

      <div className="mt-3">
        <FidelityCardProgress card={card} />
      </div>
      {inactiveCount > 0 && !editing && (
        <p className="mt-2 text-xs text-zinc-400">
          {inactiveCount === 1 ? "O terapie" : `${inactiveCount} terapii`} de pe acest tip de card nu{" "}
          {inactiveCount === 1 ? "este activată" : "sunt activate"} pentru client.
        </p>
      )}
    </div>
  );
}

function IssueCardForm({ clientId, issuableTypes }: { clientId: string; issuableTypes: FidelityCardType[] }) {
  const [state, action, pending] = useActionState(issueFidelityCard.bind(null, clientId), undefined);
  const [selectedTypeId, setSelectedTypeId] = useState(issuableTypes[0]?.id ?? "");
  const selectedType = issuableTypes.find((t) => t.id === selectedTypeId);
  const [selectedTherapies, setSelectedTherapies] = useState(
    () => new Set(selectedType?.therapies.map((t) => t.therapy_id) ?? [])
  );

  return (
    <form action={action} className="mt-3 space-y-3 border-t border-zinc-100 pt-3">
      <div>
        <label className="block text-xs font-medium text-zinc-700">Atribuie un card acestui client</label>
        <Select
          name="cardTypeId"
          value={selectedTypeId}
          onChange={(e) => {
            setSelectedTypeId(e.target.value);
            const type = issuableTypes.find((t) => t.id === e.target.value);
            setSelectedTherapies(new Set(type?.therapies.map((t) => t.therapy_id) ?? []));
          }}
          className="mt-1 min-w-[220px]"
        >
          {issuableTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>
      {selectedType && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-700">Terapii incluse pentru acest client</p>
          <TherapyChecklist
            cardType={selectedType}
            selected={selectedTherapies}
            onChange={setSelectedTherapies}
            name="therapyIds"
          />
        </div>
      )}
      <Button type="submit" variant="secondary" disabled={pending || selectedTherapies.size === 0}>
        {pending ? "Se atribuie…" : "Atribuie card"}
      </Button>
      {state?.message && <p className={`text-sm ${state.success ? "text-emerald-700" : "text-red-600"}`}>{state.message}</p>}
    </form>
  );
}

export function FidelityCardsPanel({
  clientId,
  cards,
  cardTypes,
  isAdmin,
}: {
  clientId: string;
  cards: ClientFidelityCard[];
  cardTypes: FidelityCardType[];
  isAdmin: boolean;
}) {
  const issuedTypeIds = new Set(cards.filter((c) => c.active).map((c) => c.card_type_id));
  const issuableTypes = cardTypes.filter((t) => t.active && !issuedTypeIds.has(t.id));
  const typesById = new Map(cardTypes.map((t) => [t.id, t]));

  return (
    <div className="mt-3 mm-card p-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-400">Carduri de fidelitate</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Cardurile se aplică doar clienților cărora adminul le-a atribuit unul. Ședințele plătite din oricare terapie a
        cardului se adună pe același contor, iar reducerea se aplică automat la plată când se atinge un prag. Ședințele
        din pachete nu se numără.
      </p>

      {cards.length > 0 && (
        <div className="mt-3 space-y-2">
          {cards.map((c) => (
            <CardRow key={c.id} clientId={clientId} card={c} cardType={typesById.get(c.card_type_id)} isAdmin={isAdmin} />
          ))}
        </div>
      )}
      {cards.length === 0 && <p className="mt-3 text-sm text-zinc-400">Niciun card atribuit încă.</p>}

      {!isAdmin ? (
        <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-400">
          Doar un administrator poate atribui sau revoca un card de fidelitate.
        </p>
      ) : issuableTypes.length > 0 ? (
        <IssueCardForm key={issuableTypes.map((t) => t.id).join()} clientId={clientId} issuableTypes={issuableTypes} />
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
