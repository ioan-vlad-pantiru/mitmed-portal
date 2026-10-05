"use client";

import { useActionState, useEffect, useState } from "react";
import { updateSiteAnnouncement, type SiteAnnouncement } from "@/actions/site";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/Toast";

/** Editorul barei portocalii de pe mitmed.ro, cu previzualizare. */
export function AnnouncementForm({ announcement }: { announcement: SiteAnnouncement }) {
  const [state, action, pending] = useActionState(updateSiteAnnouncement, undefined);
  const [enabled, setEnabled] = useState(announcement.enabled);
  const [text, setText] = useState(announcement.text);
  const [mobileText, setMobileText] = useState(announcement.mobile_text ?? "");
  const toast = useToast();

  useEffect(() => {
    if (state?.success) toast.success(state.message ?? "Salvat.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={action} className="mm-card max-w-3xl space-y-4 p-4">
      <label className="flex items-center gap-2 text-sm font-medium text-zinc-800">
        <input type="checkbox" name="enabled" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Afișează bara pe site
      </label>

      <div>
        <label htmlFor="announcement-text" className="block text-xs font-medium text-zinc-700">Text</label>
        <Textarea
          id="announcement-text"
          name="text"
          rows={2}
          maxLength={300}
          value={text}
          onChange={(e) => setText(e.target.value)}
          required={enabled}
          className="mt-1"
        />
        <p className="mt-1 text-xs text-zinc-400">{text.length}/300 caractere</p>
      </div>

      <div>
        <label htmlFor="announcement-mobile" className="block text-xs font-medium text-zinc-700">
          Text scurt pentru telefon (opțional)
        </label>
        <Input
          id="announcement-mobile"
          name="mobileText"
          maxLength={120}
          value={mobileText}
          onChange={(e) => setMobileText(e.target.value)}
          placeholder="Gol = se folosește textul de mai sus"
          className="mt-1"
        />
        <p className="mt-1 text-xs text-zinc-400">Pe telefon bara are un singur rând — un text scurt se citește întreg.</p>
      </div>

      <div>
        <p className="text-xs font-medium text-zinc-700">Previzualizare</p>
        {enabled && text.trim() ? (
          <div className="mt-1 space-y-2">
            <div className="rounded-2xl bg-[var(--mitmed-orange)] px-4 py-2 text-center text-sm font-semibold text-white">{text}</div>
            <div className="mx-auto max-w-[360px] truncate rounded-2xl bg-[var(--mitmed-orange)] px-4 py-2 text-center text-xs font-semibold text-white">
              {mobileText.trim() || text}
            </div>
          </div>
        ) : (
          <p className="mt-1 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-500">Bara nu apare pe site.</p>
        )}
      </div>

      {state?.message && !state.success && <p className="text-sm text-red-600">{state.message}</p>}
      <Button type="submit" disabled={pending}>{pending ? "Se salvează…" : "Salvează"}</Button>
    </form>
  );
}
