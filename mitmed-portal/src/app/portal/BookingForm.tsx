"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Banknote, Check, ChevronLeft, ChevronRight, Clock3, CreditCard, MapPin } from "lucide-react";
import { createOwnAppointment, getOwnAppointmentAvailability } from "@/actions/appointments";
import { createPayuCheckout } from "@/actions/payments";
import type { WeekdayHours, Vacation } from "@/actions/clinic";
import { PayOnlineButton } from "@/components/PayOnlineButton";
import { CLINIC_ADDRESS, CLINIC_DIRECTIONS_URL } from "@/lib/clinic";
import { AddToCalendarButton } from "./_components/AddToCalendarButton";
import { CallClinicLink } from "./_components/CallClinicLink";

type Therapy = { id: string; name: string; price: string; durationMinutes: number };
type Booked = { therapy: Therapy; date: string; time: string; paymentId: string | null; payNow: boolean };

function toLocalDateInput(date: Date): string {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 10);
}

function toBackendWeekday(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** Seven bookable days (clinic open, not on vacation), starting tomorrow, paged by week. */
function nextAvailableDays(page: number, openWeekdays: Set<number>, closedDates: Set<string>): Date[] {
  const days: Date[] = [];
  const cursor = new Date();
  let skippedBookableDays = 0;
  cursor.setHours(0, 0, 0, 0);
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

function longDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" });
}

function monthRange(days: Date[]): string {
  if (!days.length) return "";
  const fmt = (d: Date) => d.toLocaleDateString("ro-RO", { day: "numeric", month: "long" });
  return `${fmt(days[0])} – ${fmt(days[days.length - 1])}`;
}

export function BookingForm({
  therapies,
  hours,
  vacations,
  initialTherapyId,
}: {
  therapies: Therapy[];
  hours: WeekdayHours[];
  vacations: Vacation[];
  /** Pre-selects a therapy when the client tapped "Programează din nou". */
  initialTherapyId?: string;
}) {
  const [state, action, pending] = useActionState(createOwnAppointment, undefined);
  // Nothing is chosen for the client: one therapy is the only exception, since there is no choice to make.
  const defaultTherapy =
    therapies.find((t) => t.id === initialTherapyId)?.id ?? (therapies.length === 1 ? therapies[0].id : "");
  const [selectedId, setSelectedId] = useState(defaultTherapy);
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
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(Boolean(defaultTherapy));
  const [payNow, setPayNow] = useState(true);
  const [checkoutError, setCheckoutError] = useState("");
  const startedCheckout = useRef<typeof state>(undefined);
  const selected = therapies.find((therapy) => therapy.id === selectedId);

  function resetAvailability(hasTherapy: boolean) {
    setSelectedTime("");
    setAvailableTimes([]);
    setAvailabilityError("");
    setIsLoadingAvailability(hasTherapy);
  }

  function selectTherapy(therapyId: string) {
    setSelectedId(therapyId);
    resetAvailability(true);
  }

  function selectDate(date: string) {
    setSelectedDate(date);
    resetAvailability(Boolean(selectedId));
  }

  function selectDayPage(nextPage: number) {
    setDayPage(nextPage);
    selectDate(toLocalDateInput(nextAvailableDays(nextPage, openWeekdays, closedDates)[0]));
  }

  // What the client submitted, captured on submit so the confirmation shows
  // exactly what was booked even after the form state changes.
  const [submitted, setSubmitted] = useState<Omit<Booked, "paymentId"> | null>(null);
  const [dismissedState, setDismissedState] = useState<typeof state>(undefined);
  const booked: Booked | null =
    state?.success && submitted && state !== dismissedState ? { ...submitted, paymentId: state.paymentId ?? null } : null;
  const redirecting = Boolean(booked?.paymentId && booked.payNow && !checkoutError);

  // Online payment: go to PayU as soon as the booking is confirmed.
  useEffect(() => {
    if (!state?.success || !state.paymentId || !submitted?.payNow || startedCheckout.current === state) return;
    startedCheckout.current = state;
    createPayuCheckout(state.paymentId).then((result) => {
      if ("redirectUrl" in result) window.location.href = result.redirectUrl;
      else setCheckoutError(result.message);
    });
  }, [state, submitted]);

  useEffect(() => {
    if (!selectedId || !selectedDate) return;
    let cancelled = false;
    getOwnAppointmentAvailability(selectedDate, selectedId)
      .then(({ slots }) => {
        if (cancelled) return;
        setAvailableTimes(slots);
        setSelectedTime((current) => (slots.includes(current) ? current : ""));
      })
      .catch(() => {
        if (!cancelled) {
          setAvailableTimes([]);
          setSelectedTime("");
          setAvailabilityError("Nu am putut încărca orele libere. Încearcă din nou.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingAvailability(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate, selectedId]);

  if (!therapies.length) return <p className="portal-quiet">Nu există terapii disponibile pentru programare acum. Sună-ne și te ajutăm.</p>;

  if (booked) {
    return (
      <div className="booking-done" role="status">
        <span className="booking-done-icon">
          <Check size={28} strokeWidth={3} />
        </span>
        <h3>Te așteptăm!</h3>
        <p className="booking-done-when">
          {longDate(booked.date)}, ora {booked.time}
        </p>
        <p className="booking-done-what">
          {booked.therapy.name} · {booked.therapy.durationMinutes} min · {booked.therapy.price} RON
        </p>
        <a href={CLINIC_DIRECTIONS_URL} target="_blank" rel="noopener noreferrer" className="booking-done-address">
          <MapPin size={16} /> {CLINIC_ADDRESS}
        </a>
        <p className="booking-done-pay">
          {!booked.paymentId
            ? "Ședința se scade din pachetul tău — nu mai ai nimic de plătit."
            : booked.payNow
              ? redirecting
                ? "Te ducem la plata online…"
                : checkoutError || "Pregătim plata online…"
              : "Plătești la recepție, când vii. Îți trimitem și un mesaj de reamintire."}
        </p>
        <div className="booking-done-actions">
          {booked.paymentId && (!booked.payNow || checkoutError) && (
            <PayOnlineButton paymentId={booked.paymentId} className="portal-primary-btn" />
          )}
          <AddToCalendarButton
            title={booked.therapy.name}
            localStart={`${booked.date}T${booked.time}`}
            durationMinutes={booked.therapy.durationMinutes}
          />
          <CallClinicLink />
        </div>
        <div className="booking-done-links">
          <Link href="/portal">Înapoi la pagina principală</Link>
          <button
            type="button"
            onClick={() => {
              setDismissedState(state);
              setSubmitted(null);
              setCheckoutError("");
              setSelectedTime("");
            }}
          >
            Mai fac o programare
          </button>
        </div>
      </div>
    );
  }

  const missing = !selected ? "Alege terapia (pasul 1)" : !selectedTime ? "Alege ora (pasul 2)" : null;

  return (
    <form
      action={action}
      onSubmit={() => {
        if (selected) setSubmitted({ therapy: selected, date: selectedDate, time: selectedTime, payNow });
        setCheckoutError("");
      }}
      className="booking-flow"
    >
      <fieldset>
        <legend>
          <span className="booking-step">1</span> Ce terapie vrei?
        </legend>
        <div className="booking-therapy-grid">
          {therapies.map((therapy) => {
            const isSelected = therapy.id === selectedId;
            return (
              <label key={therapy.id} className={`booking-therapy-choice ${isSelected ? "is-selected" : ""}`}>
                <input type="radio" name="therapyId" value={therapy.id} checked={isSelected} onChange={() => selectTherapy(therapy.id)} />
                <span className="booking-choice-check">
                  <Check size={14} />
                </span>
                <strong>{therapy.name}</strong>
                <span>
                  <Clock3 size={15} /> {therapy.durationMinutes} min
                </span>
                <b>{therapy.price} RON</b>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend>
          <span className="booking-step">2</span> Când?
        </legend>
        <div className="booking-date-field">
          <div className="booking-day-navigation">
            <button type="button" aria-label="Zilele anterioare" disabled={dayPage === 0} onClick={() => selectDayPage(dayPage - 1)}>
              <ChevronLeft size={20} />
            </button>
            <strong>{monthRange(days)}</strong>
            <button type="button" aria-label="Zilele următoare" onClick={() => selectDayPage(dayPage + 1)}>
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="booking-day-picker">
            {days.map((day) => {
              const value = toLocalDateInput(day);
              const selectedDay = value === selectedDate;
              return (
                <button key={value} type="button" aria-pressed={selectedDay} className={selectedDay ? "is-selected" : ""} onClick={() => selectDate(value)}>
                  <small>{day.toLocaleDateString("ro-RO", { weekday: "short" }).replace(".", "")}</small>
                  <strong>{day.getDate()}</strong>
                  <span>{day.toLocaleDateString("ro-RO", { month: "short" }).replace(".", "")}</span>
                </button>
              );
            })}
          </div>
          <p className="booking-time-heading">Ore libere {longDate(selectedDate)}:</p>
          {!selectedId ? (
            <p className="booking-availability-note">Alege mai întâi terapia, ca să vedem orele libere.</p>
          ) : isLoadingAvailability ? (
            <p className="booking-availability-note">Căutăm orele libere…</p>
          ) : availabilityError ? (
            <p className="booking-error" role="alert">
              {availabilityError}
            </p>
          ) : availableTimes.length ? (
            <div className="booking-time-picker">
              {availableTimes.map((time) => (
                <button key={time} type="button" aria-pressed={time === selectedTime} className={time === selectedTime ? "is-selected" : ""} onClick={() => setSelectedTime(time)}>
                  {time}
                </button>
              ))}
            </div>
          ) : (
            <p className="booking-availability-note">Nu mai e nicio oră liberă în această zi. Încearcă altă zi.</p>
          )}
          <input type="hidden" name="startsAt" value={selectedTime ? `${selectedDate}T${selectedTime}` : ""} />
        </div>
      </fieldset>

      <fieldset className="booking-pay-field">
        <legend>
          <span className="booking-step">3</span> Cum plătești?
        </legend>
        <div className="booking-pay-choice">
          <label className={payNow ? "is-selected" : ""}>
            <input type="radio" name="payChoice" checked={payNow} onChange={() => setPayNow(true)} />
            <CreditCard size={20} />
            <span>
              <strong>Online, acum</strong>
              <small>Cu cardul, prin PayU.</small>
            </span>
          </label>
          <label className={!payNow ? "is-selected" : ""}>
            <input type="radio" name="payChoice" checked={!payNow} onChange={() => setPayNow(false)} />
            <Banknote size={20} />
            <span>
              <strong>La recepție</strong>
              <small>Cash sau card, când vii.</small>
            </span>
          </label>
        </div>
      </fieldset>

      <div className={`booking-summary ${missing ? "is-incomplete" : ""}`} aria-live="polite">
        {missing ? (
          <p>{missing}</p>
        ) : (
          <>
            <span>Verifică, apoi confirmă:</span>
            <strong>
              {selected!.name}, {longDate(selectedDate)}, ora {selectedTime}
            </strong>
            <small>
              {selected!.durationMinutes} minute · {selected!.price} RON · {payNow ? "plată online acum" : "plată la recepție"}
            </small>
          </>
        )}
      </div>

      {state?.message && (
        <p className="booking-error" role="alert">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending || Boolean(missing)} className="portal-primary-btn booking-submit">
        {pending ? "Se face programarea…" : missing ? "Programează" : `Confirmă programarea de ${longDate(selectedDate).split(",")[0]}, ${selectedTime}`}
      </button>
    </form>
  );
}
