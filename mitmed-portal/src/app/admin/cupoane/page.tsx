import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";
import { listCoupons } from "@/actions/coupons";
import { listTherapies } from "@/actions/therapies";
import { CouponForm } from "./CouponForm";
import { CouponRow } from "./CouponRow";

export default async function CouponsPage() {
  await requireRole(Role.ADMIN);
  const [coupons, therapiesRaw] = await Promise.all([listCoupons(), listTherapies()]);
  const therapies = therapiesRaw.map((t) => ({ id: t.id, name: t.name }));

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-zinc-900">Cupoane de reducere</h1>

      <div className="overflow-hidden mm-card">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50/60 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
            <tr>
              <th className="px-4 py-2.5">Cod</th>
              <th className="px-4 py-2.5">Reducere</th>
              <th className="px-4 py-2.5">Valabilitate</th>
              <th className="px-4 py-2.5">Utilizări</th>
              <th className="px-4 py-2.5">Terapii</th>
              <th className="px-4 py-2.5">Activ</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {coupons.map((c) => (
              <CouponRow
                key={c.id}
                allTherapies={therapies}
                coupon={{
                  id: c.id,
                  code: c.code,
                  type: c.type,
                  value: c.value,
                  validFrom: c.valid_from,
                  validUntil: c.valid_until,
                  maxUses: c.max_uses,
                  usesCount: c.uses_count,
                  active: c.active,
                  therapies: c.therapies,
                }}
              />
            ))}
            {coupons.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-400">
                  Niciun cupon încă.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="text-sm font-medium text-zinc-700">Adaugă cupon nou</h2>
        <CouponForm therapies={therapies} />
      </div>
    </div>
  );
}
