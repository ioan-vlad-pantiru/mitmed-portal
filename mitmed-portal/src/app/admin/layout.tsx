import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";
import { cookies } from "next/headers";
import { AdminShell } from "@/components/AdminShell";
import { SIDEBAR_COOKIE } from "@/lib/uiPrefs";
import { getQuickSearchData } from "@/actions/quickSearch";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(Role.ADMIN, Role.RECEPTIE);
  const [{ clients, todayAppointmentByClient }, cookieStore] = await Promise.all([getQuickSearchData(), cookies()]);

  return (
    <AdminShell
      email={user.email ?? "—"}
      roleLabel={user.role === Role.ADMIN ? "Admin" : "Recepție"}
      isAdmin={user.role === Role.ADMIN}
      clients={clients}
      todayAppointmentByClient={todayAppointmentByClient}
      initialSidebarCollapsed={cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed"}
    >
      {children}
    </AdminShell>
  );
}
