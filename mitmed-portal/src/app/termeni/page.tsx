import type { Metadata } from "next";
import Link from "next/link";
import { CLINIC_EMAIL, CLINIC_NAME, CLINIC_PHONE, LEGAL_ADDRESS, LEGAL_CIF, LEGAL_NAME } from "@/lib/clinic";

export const metadata: Metadata = {
  title: "Termeni și condiții — MitMed",
};

// NOTĂ INTERNĂ (nu se afișează clientului): text de revizuit de un avocat —
// în special politica de rambursare și dreptul de retragere pentru pachete
// (OUG 34/2014), care trebuie să reflecte exact practica reală a cabinetului.
export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14 text-[var(--mitmed-ink)]">
      <Link href="/login" className="text-sm font-medium text-[var(--mitmed-teal)] hover:underline">
        ← Înapoi
      </Link>

      <h1 className="mt-6 font-serif text-3xl font-semibold text-[var(--mitmed-teal-deep)]">
        Termeni și condiții
      </h1>
      <p className="mt-2 text-sm text-zinc-500">Ultima actualizare: 28 septembrie 2026.</p>

      <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-zinc-700">
        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">1. Furnizorul serviciilor</h2>
          <p className="mt-2">
            Portalul și serviciile {CLINIC_NAME} sunt furnizate de <strong>{LEGAL_NAME}</strong>, denumit în
            continuare &bdquo;Cabinetul&rdquo;.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Cod de identificare fiscală (CIF): {LEGAL_CIF}</li>
            <li>Sediu: {LEGAL_ADDRESS}</li>
            <li>Telefon: {CLINIC_PHONE}</li>
            <li>
              Email:{" "}
              <a href={`mailto:${CLINIC_EMAIL}`} className="font-medium text-[var(--mitmed-teal)] hover:underline">
                {CLINIC_EMAIL}
              </a>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">2. Serviciile oferite și prețuri</h2>
          <p className="mt-2">
            Cabinetul oferă servicii de fizioterapie și recuperare medicală (ședințe individuale și pachete de
            ședințe), prestate exclusiv la sediul cabinetului. Denumirea, durata și prețul fiecărei terapii sunt
            afișate în portal înainte de programare și plată.
          </p>
          <p className="mt-2">
            Prețurile sunt exprimate în lei (RON) și sunt prețuri finale. Cabinetul nu este înregistrat în
            scopuri de TVA, deci prețurile nu conțin TVA. Nu se percep costuri de livrare sau alte taxe
            suplimentare.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">3. Contul de client</h2>
          <p className="mt-2">
            Crearea unui cont necesită aprobarea recepției. Ești responsabil de confidențialitatea parolei tale.
            Auto-înregistrarea este disponibilă de la 16 ani; pentru minori sub această vârstă, contul se creează
            de recepție cu acordul unui părinte/tutore.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">
            4. Comanda și prestarea serviciului
          </h2>
          <p className="mt-2">
            Comanda constă în alegerea terapiei și a unui interval liber în portal. Programarea este confirmată
            imediat în portal, iar serviciul se prestează la sediul cabinetului, la data și ora programate.
            Pachetele de ședințe se activează la plată, iar ședințele incluse se programează ulterior, la date convenite
            cu cabinetul.
          </p>
          <p className="mt-2">
            Plata se poate face online, cu cardul, sau la recepție. Serviciile nu presupun livrarea unor
            bunuri, deci nu există costuri sau termene de expediere.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">5. Anularea programărilor</h2>
          <p className="mt-2">
            Programările pot fi anulate din portal cu cel puțin 48 de ore înainte de ora programată. Sub acest
            interval, anularea nu mai este posibilă din portal — contactează recepția telefonic la{" "}
            {CLINIC_PHONE}.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">6. Plăți online</h2>
          <p className="mt-2">
            Plata online se procesează prin PayU S.A., instituție de plată autorizată. Datele cardului sunt
            introduse direct pe pagina securizată PayU; Cabinetul nu are acces la ele și nu le stochează.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">
            7. Politica de rambursare și dreptul de retragere
          </h2>
          <p className="mt-2">
            Sumele achitate pentru ședințe sau pachete de ședințe <strong>nu se restituie</strong>. Singura
            excepție este situația în care ședința nu a putut avea loc din motive care țin de Cabinet (de ex.
            terapeutul nu a fost disponibil). În acest caz poți alege reprogramarea ședinței sau restituirea
            integrală a sumei achitate pentru ea. Rambursarea se face în cel mult 14 zile, prin aceeași metodă
            de plată folosită (pentru plățile online, înapoi pe card, prin PayU).
          </p>
          <p className="mt-2">
            <strong>Ședințe individuale:</strong> conform OUG nr. 34/2014, art. 16 lit. l), dreptul de retragere
            de 14 zile nu se aplică serviciilor prestate la o dată sau într-o perioadă determinată, cum este o
            programare confirmată la o dată și oră anume.
          </p>
          <p className="mt-2">
            <strong>Pachete de ședințe cumpărate online:</strong> ai dreptul să te retragi din contract în termen
            de 14 zile de la cumpărare, fără a indica un motiv, trimițând o solicitare la{" "}
            {CLINIC_EMAIL} sau la sediul Cabinetului. Dacă ai cerut începerea ședințelor în acest interval, ți se
            restituie contravaloarea ședințelor neefectuate (art. 13 alin. (3) din OUG nr. 34/2014). După
            expirarea celor 14 zile se aplică regula generală de mai sus.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">8. Reclamații</h2>
          <p className="mt-2">
            Orice reclamație privind serviciile sau plățile se poate trimite la {CLINIC_EMAIL}, telefonic la{" "}
            {CLINIC_PHONE} sau în scris la sediul Cabinetului ({LEGAL_ADDRESS}). Include numele tău, data
            programării sau a plății și descrierea problemei. Răspundem în cel mult 14 zile calendaristice de la
            primire.
          </p>
          <p className="mt-2">
            Dacă nu ești mulțumit de răspuns, te poți adresa Autorității Naționale pentru Protecția
            Consumatorilor (ANPC, anpc.ro) sau platformei europene de soluționare online a litigiilor (SOL,
            ec.europa.eu/consumers/odr).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">9. Restricții</h2>
          <p className="mt-2">
            Serviciile se prestează exclusiv la sediul Cabinetului din Onești, România. Înainte de prima ședință
            este necesară completarea chestionarului medical și semnarea declarațiilor de consimțământ din
            portal. Terapeutul poate refuza sau amâna o ședință dacă, din motive medicale, tratamentul este
            contraindicat; în acest caz, ședința achitată se reprogramează sau se rambursează conform secțiunii
            7.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">10. Garanție și servicii post-tratament</h2>
          <p className="mt-2">
            Serviciile sunt prestate de personal calificat, conform standardelor profesionale ale fizioterapiei.
            Rezultatele tratamentului depind de afecțiune și de particularitățile fiecărui pacient, deci nu pot fi
            garantate. După ședințe ai acces în portal la planul de tratament și la istoricul ședințelor, și poți
            contacta Cabinetul pentru întrebări legate de recuperare.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">11. Declarații și consimțăminte</h2>
          <p className="mt-2">
            Anumite servicii necesită semnarea digitală a unor declarații (consimțământ informat, acord GDPR).
            Textul exact semnat de tine rămâne înregistrat, cu data semnării, în contul tău.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">12. Răspundere</h2>
          <p className="mt-2">
            Cabinetul răspunde pentru prestarea serviciilor conform legii. Nu răspunde pentru întreruperi
            temporare ale portalului cauzate de factori din afara controlului său (de ex. furnizori de
            internet). Nimic din acești termeni nu limitează drepturile pe care ți le acordă legislația privind
            protecția consumatorilor sau răspunderea pentru prejudicii cauzate prin culpă.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">13. Legea aplicabilă</h2>
          <p className="mt-2">
            Acești termeni sunt guvernați de legea română. Orice diferend se soluționează pe cale amiabilă sau,
            în lipsa unui acord, de instanțele competente din România.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">14. Confidențialitate</h2>
          <p className="mt-2">
            Prelucrarea datelor tale cu caracter personal este descrisă separat în{" "}
            <Link href="/confidentialitate" className="font-medium text-[var(--mitmed-teal)] hover:underline">
              Politica de confidențialitate
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
