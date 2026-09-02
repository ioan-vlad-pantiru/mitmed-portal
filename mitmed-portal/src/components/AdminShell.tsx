"use client";

import { useState } from "react";
import { logout } from "@/actions/auth";
import { AdminSidebar } from "@/components/AdminSidebar";

function IconMenu({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className={className}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function IconClose({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function AdminShell({
  email,
  roleLabel,
  isAdmin,
  children,
}: {
  email: string;
  roleLabel: string;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="relative z-20 flex h-14 shrink-0 items-center justify-between bg-gradient-to-r from-[var(--mitmed-teal)] to-[var(--mitmed-teal-deep)] px-4 shadow-[0_1px_0_rgba(255,255,255,0.06),0_4px_16px_-8px_rgba(0,0,0,0.35)] sm:px-5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="-ml-1 flex h-8 w-8 items-center justify-center rounded-md text-[var(--mitmed-mist)] hover:bg-white/10 sm:hidden"
            aria-label={mobileOpen ? "Închide meniul" : "Deschide meniul"}
          >
            {mobileOpen ? <IconClose className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
          </button>
          <span className="text-base font-bold tracking-tight text-[var(--mitmed-mist)]">
            MitMed <span className="font-normal text-[var(--mitmed-sky)]">portal</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-3 text-xs font-medium text-[var(--mitmed-mist)] sm:flex">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--mitmed-sky)] text-[10px] font-bold text-[var(--mitmed-teal-deep)]">
              {email.charAt(0).toUpperCase()}
            </span>
            {roleLabel}
          </span>
          <form action={logout}>
            <button
              type="submit"
              className="text-sm font-medium text-[var(--mitmed-mist)]/75 transition-colors hover:text-[var(--mitmed-mist)]"
            >
              Deconectare
            </button>
          </form>
        </div>
      </header>

      <div className="relative flex flex-1 bg-[var(--mitmed-wash)]">
        {/* Overlay mobil — închide meniul la click în afara lui */}
        {mobileOpen && (
          <div
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-10 bg-black/30 sm:hidden"
          />
        )}

        <div
          className={`fixed inset-y-0 left-0 z-10 mt-14 transition-transform duration-200 sm:static sm:mt-0 sm:translate-x-0 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <AdminSidebar isAdmin={isAdmin} onNavigate={() => setMobileOpen(false)} />
        </div>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
