import { getSessionUser } from "@/actions/auth";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export default async function AccountPage() {
  const user = await getSessionUser();

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">Contul meu</h1>
        <p className="mt-1 text-sm text-zinc-500">{user.email ?? "—"}</p>
      </header>
      <section>
        <h2 className="text-sm font-semibold text-zinc-800">Schimbă parola</h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
