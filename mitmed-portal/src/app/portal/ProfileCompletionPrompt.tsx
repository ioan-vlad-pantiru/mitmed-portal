"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

const SESSION_KEY = "mm-profile-nudge-shown";

/** Popup afișat o singură dată pe sesiune de navigare, când profilul
 * clientului nu are încă niciun câmp opțional completat. */
export function ProfileCompletionPrompt({ incomplete }: { incomplete: boolean }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!incomplete) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // Stocare indisponibilă (mod privat etc.) — arătăm popup-ul oricum.
    }
    setOpen(true);
  }, [incomplete]);

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
