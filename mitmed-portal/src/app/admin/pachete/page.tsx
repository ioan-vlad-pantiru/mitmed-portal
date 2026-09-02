import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";
import { listPackages } from "@/actions/packages";
import { listTherapies } from "@/actions/therapies";
import { PackageForm } from "./PackageForm";
import { PackageRow } from "./PackageRow";

export default async function PackagesPage() {
  await requireRole(Role.ADMIN);
  const [packages, therapiesRaw] = await Promise.all([listPackages(), listTherapies()]);
  const therapies = therapiesRaw.filter((t) => t.active).map((t) => ({ id: t.id, name: t.name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Pachete de terapii</h1>
        <p className="text-sm text-zinc-500">
          Combină mai multe terapii într-un singur pachet, cu preț fix (ex. „Pachet Recuperare” = 3× Kinetoterapie +
          2× Masaj).
        </p>
      </div>

      <div className="overflow-hidden mm-card">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50/60 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
            <tr>
              <th className="px-4 py-2.5">Nume</th>
              <th className="px-4 py-2.5">Terapii incluse</th>
              <th className="px-4 py-2.5">Preț</th>
              <th className="px-4 py-2.5">Activ</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {packages.map((p) => (
              <PackageRow key={p.id} pkg={p} therapies={therapies} />
            ))}
            {packages.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-400">
                  Niciun pachet încă.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="text-sm font-medium text-zinc-700">Adaugă pachet nou</h2>
        <PackageForm therapies={therapies} />
      </div>
    </div>
  );
}
