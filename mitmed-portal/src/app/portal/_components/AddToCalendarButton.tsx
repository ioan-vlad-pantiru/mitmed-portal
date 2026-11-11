"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarPlus, ChevronDown } from "lucide-react";
import { CLINIC_ADDRESS, CLINIC_NAME, CLINIC_PHONE } from "@/lib/clinic";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** "2026-11-14T10:30" (clinic wall-clock) → "20261114T103000". */
function stamp(local: string, addMinutes = 0): string {
  const [date, time] = local.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  // Arithmetic in UTC so the browser's own zone never shifts the clock.
  const t = new Date(Date.UTC(y, m - 1, d, hh, mm + addMinutes));
  return `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}T${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}00`;
}

/** Google Calendar's own "add event" page, pre-filled; times are clinic time via `ctz`. */
function googleCalendarUrl(title: string, localStart: string, durationMinutes: number): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${title} — ${CLINIC_NAME}`,
    dates: `${stamp(localStart)}/${stamp(localStart, durationMinutes)}`,
    ctz: "Europe/Bucharest",
    location: CLINIC_ADDRESS,
    details: `Telefon clinică: ${CLINIC_PHONE}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** .ics file — iPhone opens it straight in Apple Calendar; Outlook and others accept it too. */
function downloadIcs(title: string, localStart: string, durationMinutes: number) {
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MitMed//Portal//RO",
    "BEGIN:VEVENT",
    `UID:${stamp(localStart)}-${Math.random().toString(36).slice(2)}@mitmed`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    `DTSTART;TZID=Europe/Bucharest:${stamp(localStart)}`,
    `DTEND;TZID=Europe/Bucharest:${stamp(localStart, durationMinutes)}`,
    `SUMMARY:${title} — ${CLINIC_NAME}`,
    `LOCATION:${CLINIC_ADDRESS.replace(/,/g, "\\,")}`,
    `DESCRIPTION:Telefon clinică: ${CLINIC_PHONE}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Programare MitMed",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "programare-mitmed.ics";
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * "Adaugă în calendar" with a choice: Google Calendar (Android, Gmail users)
 * or Apple / any other calendar (.ics). `localStart` is clinic wall-clock time.
 */
export function AddToCalendarButton({
  title,
  localStart,
  durationMinutes,
  className = "portal-secondary-btn",
}: {
  title: string;
  localStart: string;
  durationMinutes: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !wrapper.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <span ref={wrapper} className="portal-calendar-menu">
      <button type="button" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((v) => !v)} className={className}>
        <CalendarPlus size={17} /> Adaugă în calendar <ChevronDown size={16} />
      </button>
      {open && (
        <span role="menu" className="portal-calendar-options">
          <a
            role="menuitem"
            href={googleCalendarUrl(title, localStart, durationMinutes)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
          >
            <GoogleMark /> Google Calendar
          </a>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              downloadIcs(title, localStart, durationMinutes);
              setOpen(false);
            }}
          >
            <CalendarPlus size={18} /> Apple Calendar / alt calendar
          </button>
        </span>
      )}
    </span>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="4" width="18" height="17" rx="3" fill="#fff" stroke="#4285F4" strokeWidth="2" />
      <rect x="3" y="4" width="18" height="5" rx="2" fill="#4285F4" />
      <text x="12" y="18.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="#4285F4" fontFamily="Arial, sans-serif">
        31
      </text>
    </svg>
  );
}
