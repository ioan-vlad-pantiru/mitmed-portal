import { verifySession } from "@/lib/authSession";
import { proxyApiDownload } from "@/lib/apiDownload";

// Pacientul își descarcă propria fișă în PDF — API-ul verifică că fișa e a lui
// și că tipul ei e vizibil pentru pacient.
export async function GET(_request: Request, { params }: { params: Promise<{ sheetId: string }> }) {
  await verifySession();
  const { sheetId } = await params;
  return proxyApiDownload(`/consultation-sheets/me/${encodeURIComponent(sheetId)}/pdf`);
}
