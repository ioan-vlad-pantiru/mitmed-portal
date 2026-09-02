"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/Toast";

/** După salvare din ecranul de Consult, fluxul e "următorul pacient": redirect
 * spre bord cu ?consultSaved=1 în loc de-a naviga înapoi la fișa clientului.
 * Acest component afișează toast-ul o singură dată și curăță query string-ul. */
export function ConsultSavedToast() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("consultSaved") === "1") {
      toast.success("Ședință salvată. Gata pentru următorul pacient.");
      router.replace("/admin");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return null;
}
