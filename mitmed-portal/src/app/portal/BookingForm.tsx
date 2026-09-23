"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Banknote, CalendarClock, Check, ChevronLeft, ChevronRight, Clock3, CreditCard, WalletCards } from "lucide-react";
import { createOwnAppointment, getOwnAppointmentAvailability } from "@/actions/appointments";
import { createPayuCheckout } from "@/actions/payments";
import type { WeekdayHours, Vacation } from "@/actions/clinic";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";
import { PayOnlineButton } from "@/components/PayOnlineButton";

type Therapy = { id: string; name: string; price: string; durationMinutes: number };

function toLocalDateInput(date: Date): string {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 10);
}

// date.getDay() (0=duminică…6=sâmbătă) -> convenția backend-ului
// (0=luni…6=duminică, ca Python date.weekday()).
function toBackendWeekday(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function nextAvailableDays(page: number, openWeekdays: Set<number>, closedDates: Set<string>): Date[] {
  const days: Date[] = [];
  const cursor = new Date();
  let skippedBookableDays = 0;
  cursor.setHours(0, 0, 0, 0);
  // Dacă nu s-a încărcat încă programul, nu ascundem nimic — mai bine
  // arătăm toate zilele (backend-ul tot validează la rezervare) decât un
  // calendar gol pentru o clipă.
  while (days.length < 7) {
    cursor.setDate(cursor.getDate() + 1);
    if (openWeekdays.size && !openWeekdays.has(toBackendWeekday(cursor))) continue;
    if (closedDates.has(toLocalDateInput(cursor))) continue;
    if (skippedBookableDays < page * 7) {
      skippedBookableDays += 1;
      continue;
    }
    days.push(new Date(cursor));
  }
  return days;
}

function formatDayRange(days: Date[]): string {
  if (!days.length) return "";
  const first = days[0].toLocaleDateString("ro-RO", { day: "numeric", month: "long" });
  const last = days[days.length - 1].toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" });
  return `${first} – ${last}`;
}

export function BookingForm({ therapies, hours, vacations }: { therapies: Therapy[]; hours: WeekdayHours[]; vacations: Vacation[] }) {
  const [state, action, pending] = useActionState(createOwnAppointment, undefined);
  const toast = useToast();
  const toastRef = useRef(toast);
  const [selectedId, setSelectedId] = useState(therapies[0]?.id ?? "");
  const [dayPage, setDayPage] = useState(0);
  const openWeekdays = useMemo(() => new Set(hours.filter((h) => h.is_open).map((h) => h.weekday)), [hours]);
  const closedDates = useMemo(() => {
    const dates = new Set<string>();
    for (const vacation of vacations) {
      const cursor = new Date(`${vacation.starts_on}T12:00:00`);
      const end = new Date(`${vacation.ends_on}T12:00:00`);
      while (cursor <= end) {
        dates.add(toLocalDateInput(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return dates;
  }, [vacations]);
  const days = useMemo(() => nextAvailableDays(dayPage, openWeekdays, closedDates), [dayPage, openWeekdays, closedDates]);
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateInput(days[0] ?? new Date()));
  const [selectedTime, setSelectedTime] = useState("");
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [availabilityError, setAvailabilityError] = useState("");
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(true);
  const [payNow, setPayNow] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const selected = therapies.find((therapy) => therapy.id === selectedId);

  function resetAvailability() {
    setSelectedTime("");
    setAvailableTimes([]);
    setAvailabilityError("");
    setIsLoadingAvailability(true);
  }

  function selectTherapy(therapyId: string) {
    setSelectedId(therapyId);
    resetAvailability();
  }

  function selectDate(date: string) {
    setSelectedDate(date);
    resetAvailability();
  }

  function selectDayPage(nextPage: number) {
    setDayPage(nextPage);
    selectDate(toLocalDateInput(nextAvailableDays(nextPage, openWeekdays, closedDates)[0]));
  }

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  useEffect(() => {
    if (state?.success) toastRef.current.success(state.success);
  }, [state]);

  // Dacă a ales "plătesc acum online", trece direct la checkout PayU — nu-l
  // mai pune să caute a doua oară butonul de plată. La "plătesc la recepție"
  // nu facem nimic aici — plata rămâne disponibilă mai târziu din Programări.
  useEffect(() => {
    if (!state?.success || !state.paymentId || !payNow) return;
    let cancelled = false;
    // Pornim redirect-ul spre PayU chiar în acest efect (nu într-un handler),
    // fiindcă declanșatorul e rezultatul unui Server Action (state), nu un
    // eveniment de UI — nu există alt loc unde să setăm acest flag.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRedirecting(true);
    setCheckoutError("");
    createPayuCheckout(state.paymentId).then((result) => {
      if (cancelled) return;
      if ("redirectUrl" in result) {
        window.location.href = result.redirectUrl;
      } else {
        setRedirecting(false);
        setCheckoutError(result.message);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    if (!selectedId || !selectedDate) return;
    let cancelled = false;

    getOwnAppointmentAvailability(selectedDate, selectedId)
      .then(({ slots }) => {
        if (cancelled) return;
        setAvailableTimes(slots);
        setSelectedTime((current) => (slots.includes(current) ? current : slots[0] ?? ""));
      })
      .catch(() => {
        if (!cancelled) {
          setAvailableTimes([]);
          setSelectedTime("");
          setAvailabilityError("Nu am putut încărca orele disponibile. Încearcă din nou.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingAvailability(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDate, selectedId]);

  if (!therapies.length) return <p className="portal-quiet">Nu există terapii disponibile pentru programare acum.</p>;

  return <form action={action} className="booking-flow">
    <fieldset><legend>Alege terapia</legend><div className="booking-therapy-grid">{therapies.map((therapy) => { const isSelected = therapy.id === selectedId; return <label key={therapy.id} className={`booking-therapy-choice ${isSelected ? "is-selected" : ""}`}><input type="radio" name="therapyId" value={therapy.id} checked={isSelected} onChange={() => selectTherapy(therapy.id)} /><span className="booking-choice-check"><Check size={14} /></span><strong>{therapy.name}</strong><span><Clock3 size={14} /> {therapy.durationMinutes} min</span><b>{therapy.price} RON</b></label>; })}</div></fieldset>
    <fieldset><legend>Spune-ne când ți-ar fi bine</legend><div className="booking-date-field"><div className="booking-date-heading"><CalendarClock size={18} /><span>Alege o zi</span></div><div className="booking-day-navigation"><button type="button" aria-label="Săptămâna anterioară" disabled={dayPage === 0} onClick={() => selectDayPage(dayPage - 1)}><ChevronLeft size={18} /></button><strong>{formatDayRange(days)}</strong><button type="button" aria-label="Următoarea săptămână" onClick={() => selectDayPage(dayPage + 1)}><ChevronRight size={18} /></button></div><div className="booking-day-picker">{days.map((day) => { const value = toLocalDateInput(day); const selectedDay = value === selectedDate; return <button key={value} type="button" aria-pressed={selectedDay} className={selectedDay ? "is-selected" : ""} onClick={() => selectDate(value)}><small>{day.toLocaleDateString("ro-RO", { weekday: "short" }).replace(".", "")}</small><strong>{day.getDate()}</strong><span>{day.toLocaleDateString("ro-RO", { month: "short" }).replace(".", "")}</span></button>; })}</div><div className="booking-date-heading booking-time-heading"><Clock3 size={18} /><span>Alege o oră</span></div>{isLoadingAvailability ? <p className="booking-availability-note">Calculăm orele libere…</p> : availabilityError ? <p className="booking-error" role="alert">{availabilityError}</p> : availableTimes.length ? <div className="booking-time-picker">{availableTimes.map((time) => <button key={time} type="button" aria-pressed={time === selectedTime} className={time === selectedTime ? "is-selected" : ""} onClick={() => setSelectedTime(time)}>{time}</button>)}</div> : <p className="booking-availability-note">Nu mai există un interval complet liber în această zi.</p>}<input type="hidden" name="startsAt" value={selectedTime ? `${selectedDate}T${selectedTime}` : ""} /><p>Folosește săgețile pentru a vedea zilele din lunile următoare. Orele se calculează din durata terapiei și agenda zilei.</p></div></fieldset>
    <fieldset className="booking-pay-field">
      <legend>Cum vrei să plătești?</legend>
      <div className="booking-pay-choice">
        <label className={payNow ? "is-selected" : ""}>
          <input type="radio" name="payChoice" checked={payNow} onChange={() => setPayNow(true)} />
          <CreditCard size={17} />
          <span>
            <strong>Online, acum</strong>
            <small>Plătești pe loc, cu cardul, prin PayU.</small>
          </span>
        </label>
        <label className={!payNow ? "is-selected" : ""}>
          <input type="radio" name="payChoice" checked={!payNow} onChange={() => setPayNow(false)} />
          <Banknote size={17} />
          <span>
            <strong>La recepție</strong>
            <small>Plătești cash sau cu cardul, când vii.</small>
          </span>
        </label>
      </div>
    </fieldset>
    <div className="booking-confirmation"><div><span>Ai ales</span><strong>{selected?.name}</strong><small><Clock3 size={14} /> {selected?.durationMinutes} minute</small></div><b><WalletCards size={16} /> {selected?.price} RON</b></div>
    {state?.message && <p className="booking-error" role="alert">{state.message}</p>}
    {state?.success && (
      <div className="booking-paid-cta">
        <Check size={18} />
        <div>
          <strong>{state.success}</strong>
          {!state.paymentId ? (
            <span>Ședința se scade dintr-un pachet activ — nu mai trebuie să plătești acum.</span>
          ) : payNow ? (
            <span>{redirecting ? "Te redirecționăm către plata online…" : checkoutError || "Pregătim plata…"}</span>
          ) : (
            <span>Ai ales să plătești la recepție, când vii la ședință.</span>
          )}
        </div>
        {state.paymentId && (!payNow || checkoutError) && <PayOnlineButton paymentId={state.paymentId} className="portal-pay-btn" />}
      </div>
    )}
    <Button type="submit" disabled={pending || redirecting || isLoadingAvailability || !selectedTime} className="booking-submit">{pending ? "Se rezervă ședința…" : redirecting ? "Te redirecționăm către plată…" : "Programează ședința"}</Button>
  </form>;
}
