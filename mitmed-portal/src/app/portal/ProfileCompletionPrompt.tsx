"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

const SESSION_KEY = "mm-profile-nudge-shown";

/** Popup afișat o singură dată pe sesiune de navigare, când profilul
 * clientului nu are încă niciun câmp opțional completat. Deschiderea inițială
 * se calculează direct în useState (nu într-un efect) — `incomplete` nu se
 * schimbă după montare, deci nu e nevoie de o sincronizare continuă. */
export function ProfileCompletionPrompt({ incomplete }: { incomplete: boolean }) {
  const [open, setOpen] = useState(() => {
    if (!incomplete) return false;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return false;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // Stocare indisponibilă (mod privat etc.) — arătăm popup-ul oricum.
    }
    return true;
  });
  const router = useRouter();

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title="Completează-ți profilul"
      description="Câteva detalii despre tine ne ajută să îți oferim o experiență mai bună și o comunicare potrivită. Toate câmpurile sunt opționale."
    >
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setOpen(false)}>Mai târziu</Button>
        <Button onClick={() => router.push("/portal/profil")}>Completează profilul</Button>
      </div>
    </Dialog>
  );
}
