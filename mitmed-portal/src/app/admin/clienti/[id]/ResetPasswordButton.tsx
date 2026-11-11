"use client";

import { useState, useTransition } from "react";
import { resetClientPassword } from "@/actions/clients";

export function ResetPasswordButton({ userId }: { userId: string }) {
  const [pending, startTransition] = useTransition();
  const [newPassword, setNewPassword] = useState<string | null>(null);

  if (newPassword) {
    return (
      <div data-variant="warning" className="mm-alert block text-xs">
        Parolă nouă (comunic-o clientului acum, nu se mai poate revedea):{" "}
        <strong className="font-mono">{newPassword}</strong>
      </div>
    );
  }

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const pwd = await resetClientPassword(userId);
          setNewPassword(pwd);
        })
      }
      className="text-sm text-sky-600 hover:underline disabled:opacity-60"
    >
      Resetează parola
    </button>
  );
}
