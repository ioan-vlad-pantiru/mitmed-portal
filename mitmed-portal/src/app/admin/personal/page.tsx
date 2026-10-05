import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";
import { listStaff } from "@/actions/staff";
import { StaffForm } from "./StaffForm";
import { StaffRow } from "./StaffRow";

export default async function StaffPage() {
  const me = await requireRole(Role.ADMIN);
  const staff = await listStaff();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-lg font-semibold text-zinc-900">Conturi de personal</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Cine are acces în admin. Recepția vede programările, clienții și plățile; doar adminul schimbă setările.
        </p>
      </header>

      <div className="overflow-hidden mm-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50/60 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Rol</th>
                <th className="px-4 py-2.5">Creat</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {staff.map((s) => (
                <StaffRow
                  key={s.id}
                  member={{
                    id: s.id,
                    email: s.email,
                    role: s.role,
                    active: s.status === "ACTIVE",
                    createdAt: s.created_at,
                  }}
                  isSelf={s.id === me.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium text-zinc-700">Adaugă cont nou</h2>
        <StaffForm />
      </div>
    </div>
  );
}
