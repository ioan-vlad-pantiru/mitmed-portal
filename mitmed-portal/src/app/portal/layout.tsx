import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";
import { logout } from "@/actions/auth";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  await requireRole(Role.CLIENT);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <header className="flex h-14 shrink-0 items-center justify-between bg-gradient-to-r from-[var(--mitmed-teal)] to-[var(--mitmed-teal-deep)] px-5">
        <span className="text-base font-bold tracking-tight text-[var(--mitmed-mist)]">MitMed</span>
        <form action={logout}>
          <button
            type="submit"
            className="text-sm font-medium text-[var(--mitmed-mist)]/80 hover:text-[var(--mitmed-mist)]"
          >
            Deconectare
          </button>
        </form>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
