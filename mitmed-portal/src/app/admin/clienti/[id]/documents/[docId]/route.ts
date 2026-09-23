import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8000";

// Proxy server-only pentru descărcarea documentelor unui client — un Server
// Action nu poate trimite un fișier binar direct browserului, așa că folosim
// un Route Handler care oglindește cererea către API, cu cookie-ul de
// sesiune, și transmite răspunsul (bytes + headere) neschimbat.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  await requireRole(Role.ADMIN, Role.RECEPTIE);
  const { id, docId } = await params;

  const store = await cookies();
  const apiRes = await fetch(`${API_BASE_URL}/clients/${id}/documents/${docId}/download`, {
    headers: { Cookie: store.toString() },
    cache: "no-store",
  });

  if (!apiRes.ok) {
    const body = await apiRes.text();
    return new NextResponse(body, { status: apiRes.status });
  }

  const headers = new Headers();
  const contentType = apiRes.headers.get("content-type");
  const contentDisposition = apiRes.headers.get("content-disposition");
  if (contentType) headers.set("Content-Type", contentType);
  if (contentDisposition) headers.set("Content-Disposition", contentDisposition);

  return new NextResponse(apiRes.body, { headers });
}
