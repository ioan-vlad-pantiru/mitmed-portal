import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Termeni și condiții — MitMed",
};

// NOTĂ INTERNĂ (nu se afișează clientului): draft de pornire, de revizuit de
// un avocat înainte de publicare — în special secțiunile de plată online
// (OUG 34/2014 privind contractele la distanță) și politica de anulare/
// rambursare, care trebuie să reflecte exact practica reală a cabinetului.
export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14 text-[var(--mitmed-ink)]">
      <Link href="/login" className="text-sm font-medium text-[var(--mitmed-teal)] hover:underline">
        ← Înapoi
      </Link>

      <h1 className="mt-6 font-serif text-3xl font-semibold text-[var(--mitmed-teal-deep)]">
        Termeni și condiții
      </h1>
      <p className="mt-2 text-sm text-zinc-500">Ultima actualizare: [completează data publicării].</p>

      <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-zinc-700">
        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">1. Furnizorul serviciilor</h2>
          <p className="mt-2">
            Portalul este operat de <strong>Semarvion SRL</strong> (cabinetul MitMed), [completează: sediu, CUI,
            nr. Registrul Comerțului], denumit în continuare &bdquo;Cabinetul&rdquo;.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">2. Contul de client</h2>
          <p className="mt-2">
            Crearea unui cont necesită aprobarea recepției. Ești responsabil de confidențialitatea parolei tale.
            Auto-înregistrarea este disponibilă de la 16 ani; pentru minori sub această vârstă, contul se creează
            de recepție cu acordul unui părinte/tutore.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">3. Programări și anulări</h2>
          <p className="mt-2">
            Programările pot fi anulate din portal cu cel puțin 48 de ore înainte de ora programată. Sub acest
            interval, anularea nu mai este posibilă din portal — contactează recepția telefonic.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">4. Plăți online</h2>
          <p className="mt-2">
            Plata online se procesează prin PayU România, procesator de plăți autorizat. Cabinetul nu stochează
            datele cardului tău. Prețurile afișate sunt în lei (RON) și includ [completează: TVA/nu se aplică
            TVA, conform regimului fiscal al cabinetului].
          </p>
          <p className="mt-2">
            <strong>Politica de rambursare:</strong> sumele achitate pentru ședințe sau pachete de ședințe nu se
            restituie odată ce ședința a avut loc sau pachetul a fost activat, conform declarației semnate la
            prima consultație. [Completează: excepțiile aplicabile, ex. anulare din motive medicale, conform
            deciziei cabinetului.]
          </p>
          <p className="mt-2">
            Conform OUG nr. 34/2014, în cazul contractelor încheiate la distanță pentru servicii de agrement/
            programare la o dată fixă (Art. 16 lit. l), dreptul de retragere de 14 zile nu se aplică unei
            programări deja confirmate la o dată/oră specifică.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">5. Declarații și consimțăminte</h2>
          <p className="mt-2">
            Anumite servicii necesită semnarea digitală a unor declarații (consimțământ informat, acord GDPR).
            Textul exact semnat de tine rămâne înregistrat, cu data semnării, în contul tău.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">6. Limitarea răspunderii</h2>
          <p className="mt-2">
            [Completează cu clauzele de limitare a răspunderii specifice practicii cabinetului, revizuite de un
            avocat — acestea nu pot exclude răspunderea pentru neglijență medicală sau pentru drepturile
            consumatorului prevăzute de lege.]
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">7. Legea aplicabilă</h2>
          <p className="mt-2">
            Acești termeni sunt guvernați de legea română. Orice diferend se soluționează pe cale amiabilă sau,
            în lipsa unui acord, de instanțele competente din România. Pentru litigii de consum, poți apela și la
            platforma SOL (ec.europa.eu/consumers/odr) sau la ANPC.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">8. Confidențialitate</h2>
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
