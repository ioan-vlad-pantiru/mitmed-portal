"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSheetField, moveSheetField, type ConsultationSheetField } from "@/actions/consultationSheets";
import { SheetFieldForm } from "./SheetFieldForm";
import { useToast } from "@/components/Toast";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { ChevronDown, ChevronUp } from "lucide-react";
import { IconClose, IconEdit, IconTrash } from "@/components/icons";

export function SheetFieldRow({ field, isFirst, isLast }: { field: ConsultationSheetField; isFirst: boolean; isLast: boolean }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const move = (direction: "up" | "down") =>
    startTransition(async () => {
      try {
        await moveSheetField(field.id, direction);
        router.refresh();
      } catch {
        toast.error("Nu am putut muta câmpul. Încearcă din nou.");
      }
    });

  return (
    <div className="mm-card p-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-900">{field.label}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge variant="neutral">{field.field_type === "text" ? "Text scurt" : "Text lung"}</Badge>
            {field.section && <Badge variant="neutral">Secțiune: {field.section}</Badge>}
            {field.carry_over && <Badge variant="success">Precompletat</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <IconButton icon={ChevronUp} label="Mută mai sus" disabled={pending || isFirst} onClick={() => move("up")} />
          <IconButton icon={ChevronDown} label="Mută mai jos" disabled={pending || isLast} onClick={() => move("down")} />
          <IconButton icon={editing ? IconClose : IconEdit} label={editing ? "Renunță" : "Editează"} onClick={() => setEditing((v) => !v)} />
          <IconButton
            icon={IconTrash}
            label="Șterge"
            variant="danger"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Ștergi câmpul „${field.label}" din fișă? Valorile deja completate pe fișele vechi se păstrează.`)) return;
              startTransition(async () => {
                const result = await deleteSheetField(field.id);
                if (result.ok) {
                  toast.success("Câmp șters.");
                  router.refresh();
                } else {
                  toast.error(result.message);
                }
              });
            }}
          />
        </div>
      </div>
      {editing && (
        <div className="mt-3 border-t border-zinc-100 pt-3">
          <SheetFieldForm field={field} onDone={() => setEditing(false)} />
        </div>
      )}
    </div>
  );
}
