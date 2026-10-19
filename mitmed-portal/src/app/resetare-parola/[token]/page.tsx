import Link from "next/link";
import { isResetTokenValid } from "@/actions/auth";
import { AuthShell } from "@/components/AuthShell";
import { ResetPasswordForm } from "./ResetPasswordForm";

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = await isResetTokenValid(token);

  if (!valid) {
    return (
      <AuthShell
        heading="Link expirat."
        subheading="Link-ul de resetare a fost deja folosit sau a expirat (e valabil o oră)."
      >
        <Link
          href="/resetare-parola"
          className="block w-full rounded-lg bg-[var(--mitmed-teal)] px-4 py-2.5 text-center text-sm font-semibold text-[var(--mitmed-mist)] transition-colors hover:bg-[var(--mitmed-teal-deep)]"
        >
          Cere un link nou
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell heading="Alege o parolă nouă." subheading="Minim 8 caractere. După salvare te poți autentifica cu ea.">
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
