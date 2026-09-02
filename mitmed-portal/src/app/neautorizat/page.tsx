import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
      <h1 className="text-xl font-semibold text-zinc-900">Nu ai acces la această pagină</h1>
      <p className="text-sm text-zinc-500">Contul tău nu are permisiunile necesare.</p>
      <Link href="/" className="mt-4 text-sm font-medium text-sky-600 hover:underline">
        Înapoi la pagina principală
      </Link>
    </div>
  );
}
