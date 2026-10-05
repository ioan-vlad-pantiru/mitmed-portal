import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";
import { proxyApiDownload } from "@/lib/apiDownload";

// Fișa de tratament a pacientului (toate ședințele) în PDF.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  const { id } = await params;
  return proxyApiDownload(`/consultation-sheets/treatment/${encodeURIComponent(id)}/pdf`);
}
