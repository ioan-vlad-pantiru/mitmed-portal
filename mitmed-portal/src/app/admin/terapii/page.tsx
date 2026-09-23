import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";
import { listTherapies } from "@/actions/therapies";
import { TherapyForm } from "./TherapyForm";
import { TherapyRow } from "./TherapyRow";

export default async function TherapiesPage() {
  await requireRole(Role.ADMIN);
  const therapies = await listTherapies();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Catalog terapii</h1>
        <p className="text-sm text-zinc-500">
          Fiecare terapie e o ședință unică. Pentru pachete cu mai multe ședințe (dintr-o singură terapie sau
          combinate), vezi{" "}
          <a href="/admin/pachete" className="text-sky-600 hover:underline">
            Pachete
          </a>
          .
        </p>
      </div>

      <div className="overflow-hidden mm-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50/60 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="px-4 py-2.5">Nume</th>
                <th className="px-4 py-2.5">Durată</th>
                <th className="px-4 py-2.5">Preț</th>
                <th className="px-4 py-2.5">Activă</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {therapies.map((t) => (
                <TherapyRow
                  key={t.id}
                  therapy={{
                    id: t.id,
                    name: t.name,
                    description: t.description,
                    durationMinutes: t.duration_minutes,
                    price: t.price,
                    active: t.active,
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium text-zinc-700">Adaugă terapie nouă</h2>
        <TherapyForm />
      </div>
    </div>
  );
}
