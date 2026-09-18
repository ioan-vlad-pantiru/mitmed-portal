import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Politica de confidențialitate — MitMed",
};

// NOTĂ INTERNĂ (nu se afișează clientului): acest text este un DRAFT generat
// ca punct de plecare, nu o politică de confidențialitate finală. Câmpurile
// marcate cu [...] trebuie completate de clinică, iar textul integral trebuie
// revizuit de un avocat/DPO înainte de a fi publicat cu date reale de clienți.
export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14 text-[var(--mitmed-ink)]">
      <Link href="/login" className="text-sm font-medium text-[var(--mitmed-teal)] hover:underline">
        ← Înapoi
      </Link>

      <h1 className="mt-6 font-serif text-3xl font-semibold text-[var(--mitmed-teal-deep)]">
        Politica de confidențialitate
      </h1>
      <p className="mt-2 text-sm text-zinc-500">Ultima actualizare: [completează data publicării].</p>

      <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-zinc-700">
        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">1. Operatorul de date</h2>
          <p className="mt-2">
            Operatorul datelor cu caracter personal colectate prin acest portal este{" "}
            <strong>Semarvion SRL</strong> (cabinetul MitMed), [completează: sediul social, nr. înregistrare
            Registrul Comerțului, CUI]. Pentru orice întrebare privind protecția datelor, ne poți contacta la
            [completează: adresă email dedicată, ex. gdpr@mitmed.ro] sau la sediul cabinetului.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">2. Ce date colectăm</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Date de identificare și contact: nume, email, telefon, adresă, data nașterii.</li>
            <li>
              Date privind sănătatea (categorie specială de date, Art. 9 GDPR): chestionar medical
              (afecțiuni, alergii, medicamente, leziuni anterioare), fișe clinice (diagnostic, obiective de
              tratament, note de ședință, plan de tratament, diagramă corporală).
            </li>
            <li>Date privind programările, ședințele efectuate și plățile aferente.</li>
            <li>Declarații/consimțăminte semnate digital, cu data și textul exact semnat.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">3. De ce prelucrăm aceste date</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Furnizarea serviciilor medicale de recuperare</strong> — temei legal: necesitatea
              prelucrării pentru scopuri de medicină preventivă, diagnostic medical, furnizare de îngrijiri sau
              tratament (Art. 9(2)(h) GDPR), sub obligația de confidențialitate profesională a personalului
              medical.
            </li>
            <li>
              <strong>Administrarea programărilor, facturarea și plățile</strong> — temei legal: executarea
              contractului de prestări servicii și obligații legale (fiscale/contabile).
            </li>
            <li>
              <strong>Comunicare operațională</strong> (confirmări, remindere de programare) — temei legal:
              interes legitim / executarea contractului.
            </li>
            <li>
              <strong>Consimțământ explicit</strong> — pentru orice prelucrare care nu este strict necesară
              tratamentului (de ex. comunicări opționale), pe care ți-l poți retrage oricând din contul tău,
              din secțiunea Declarații.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">4. Cui transmitem datele</h2>
          <p className="mt-2">
            Nu vindem și nu închiriem datele tale. Le transmitem doar către procesatori strict necesari
            funcționării serviciului, pe bază de contract de prelucrare a datelor (DPA):
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>PayU România</strong> — procesare plăți online (nu stocăm datele cardului tău; acestea sunt
              introduse direct pe pagina securizată PayU).
            </li>
            <li>[completează, dacă e cazul: furnizor SMS/WhatsApp pentru remindere, Google Calendar pentru sincronizarea agendei interne].</li>
          </ul>
          <p className="mt-2">
            Datele nu sunt transferate în afara Spațiului Economic European. Dacă acest lucru se schimbă,
            vom actualiza această politică și vom asigura garanțiile prevăzute de GDPR (ex. clauze contractuale
            standard).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">5. Cât timp păstrăm datele</h2>
          <p className="mt-2">
            Fișele medicale se păstrează conform obligațiilor legale de arhivare a documentației medicale
            [completează: durata exactă conform reglementărilor aplicabile cabinetului]. Documentele
            financiar-contabile se păstrează conform legislației fiscale românești (în general 10 ani). Datele de
            cont care nu fac obiectul unei obligații legale de păstrare pot fi șterse/anonimizate la cererea ta
            (vezi secțiunea 6).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">6. Drepturile tale</h2>
          <p className="mt-2">Conform GDPR, ai dreptul de a:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>solicita <strong>acces</strong> la datele tale — poți descărca o copie oricând din contul tău, secțiunea Profil;</li>
            <li>solicita <strong>rectificarea</strong> datelor incorecte;</li>
            <li>
              solicita <strong>ștergerea</strong> datelor (unde legea nu ne obligă să le păstrăm) — din contul tău,
              secțiunea Profil;
            </li>
            <li><strong>retrage</strong> oricând un consimțământ dat, fără a afecta legalitatea prelucrării anterioare retragerii;</li>
            <li>solicita <strong>restricționarea</strong> prelucrării sau <strong>te opune</strong> prelucrărilor bazate pe interes legitim;</li>
            <li>depune o <strong>plângere</strong> la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP), anspdcp.ro.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">7. Minori</h2>
          <p className="mt-2">
            Portalul permite crearea unui cont propriu de la 16 ani. Pentru pacienți minori sub această vârstă,
            contul și consimțămintele aferente sunt gestionate de recepție, cu implicarea și acordul explicit al
            unui părinte/tutore legal.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">8. Securitate</h2>
          <p className="mt-2">
            Parolele sunt stocate criptat (argon2), conexiunea la portal este criptată (HTTPS), iar accesul la
            fișele medicale este restricționat pe roluri și înregistrat într-un jurnal de audit.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">9. Cookie-uri</h2>
          <p className="mt-2">
            Folosim un singur cookie, strict necesar funcționării contului (sesiunea de autentificare). Nu folosim
            cookie-uri de analiză sau marketing.
          </p>
        </section>
      </div>
    </main>
  );
}
