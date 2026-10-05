import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";
import { proxyApiDownload } from "@/lib/apiDownload";

// PDF-ul unei fișe (consultație sau fișă construită de admin).
export async function GET(_request: Request, { params }: { params: Promise<{ sheetId: string }> }) {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  const { sheetId } = await params;
  return proxyApiDownload(`/consultation-sheets/${encodeURIComponent(sheetId)}/pdf`);
}
