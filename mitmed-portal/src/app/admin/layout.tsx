import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";
import { AdminShell } from "@/components/AdminShell";
import { getQuickSearchData } from "@/actions/quickSearch";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(Role.ADMIN, Role.RECEPTIE);
  const { clients, todayAppointmentByClient } = await getQuickSearchData();

  return (
    <AdminShell
      email={user.email}
      roleLabel={user.role === Role.ADMIN ? "Admin" : "Recepție"}
      isAdmin={user.role === Role.ADMIN}
      clients={clients}
      todayAppointmentByClient={todayAppointmentByClient}
    >
      {children}
    </AdminShell>
  );
}
