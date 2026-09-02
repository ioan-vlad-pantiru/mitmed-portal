import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";
import { AdminShell } from "@/components/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(Role.ADMIN, Role.RECEPTIE);

  return (
    <AdminShell
      email={user.email}
      roleLabel={user.role === Role.ADMIN ? "Admin" : "Recepție"}
      isAdmin={user.role === Role.ADMIN}
    >
      {children}
    </AdminShell>
  );
}
