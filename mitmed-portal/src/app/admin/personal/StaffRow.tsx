"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setStaffActive } from "@/actions/staff";
import { useToast } from "@/components/Toast";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { IconPower } from "@/components/icons";

type Member = { id: string; email: string | null; role: string; active: boolean; createdAt: string };

export function StaffRow({ member, isSelf }: { member: Member; isSelf: boolean }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  return (
    <tr className="transition-colors hover:bg-zinc-50/70">
      <td className="px-4 py-2 text-zinc-900">
        {member.email ?? "—"}
        {isSelf && <span className="ml-2 text-xs text-zinc-400">(tu)</span>}
      </td>
      <td className="px-4 py-2 text-zinc-600">{member.role === "ADMIN" ? "Admin" : "Recepție"}</td>
      <td className="px-4 py-2 text-zinc-600">{new Date(member.createdAt).toLocaleDateString("ro-RO")}</td>
      <td className="px-4 py-2">
        <Badge variant={member.active ? "success" : "neutral"}>{member.active ? "Activ" : "Suspendat"}</Badge>
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center justify-end gap-1">
          {!isSelf && (
            <IconButton
              icon={IconPower}
              label={member.active ? "Suspendă" : "Reactivează"}
              variant={member.active ? "warning" : "primary"}
              disabled={pending}
              onClick={() => {
                if (member.active && !window.confirm(`Suspenzi contul ${member.email}? Va fi delogat imediat.`)) return;
                startTransition(async () => {
                  const result = await setStaffActive(member.id, !member.active);
                  if (result.ok) {
                    toast.success(member.active ? "Cont suspendat." : "Cont reactivat.");
                    router.refresh();
                  } else {
                    toast.error(result.message);
                  }
                });
              }}
            />
          )}
        </div>
      </td>
    </tr>
  );
}
