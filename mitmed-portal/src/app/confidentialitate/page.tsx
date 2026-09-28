import type { Metadata } from "next";
import Link from "next/link";
import { CLINIC_EMAIL, CLINIC_PHONE, LEGAL_ADDRESS, LEGAL_CIF, LEGAL_NAME } from "@/lib/clinic";

export const metadata: Metadata = {
  title: "Politica de confidențialitate — MitMed",
};

// NOTĂ INTERNĂ (nu se afișează clientului): textul trebuie revizuit de un
// avocat/DPO — în special lista de destinatari (secțiunea 4), care trebuie
// ținută la zi cu furnizorii folosiți efectiv de portal.
export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14 text-[var(--mitmed-ink)]">
      <Link href="/login" className="text-sm font-medium text-[var(--mitmed-teal)] hover:underline">
        ← Înapoi
      </Link>

      <h1 className="mt-6 font-serif text-3xl font-semibold text-[var(--mitmed-teal-deep)]">
        Politica de confidențialitate
      </h1>
      <p className="mt-2 text-sm text-zinc-500">Ultima actualizare: 28 septembrie 2026.</p>

      <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-zinc-700">
        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">1. Operatorul de date</h2>
          <p className="mt-2">
            Operatorul datelor cu caracter personal colectate prin acest portal este{" "}
            <strong>{LEGAL_NAME}</strong> (cabinetul MitMed), CIF {LEGAL_CIF}, cu sediul în {LEGAL_ADDRESS}.
          </p>
          <p className="mt-2">
            Pentru orice întrebare sau cerere privind protecția datelor, ne poți contacta la{" "}
            <a href={`mailto:${CLINIC_EMAIL}`} className="font-medium text-[var(--mitmed-teal)] hover:underline">
              {CLINIC_EMAIL}
            </a>
            , telefonic la {CLINIC_PHONE} sau în scris la sediul cabinetului.
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
              <strong>PayU S.A.</strong> (Grunwaldzka 186, 60-166 Poznań, Polonia) — procesarea plăților online.
              Îi transmitem adresa de email, suma și descrierea plății. Datele cardului sunt introduse direct pe
              pagina securizată PayU; nu le primim și nu le stocăm.
            </li>
            <li>
              <strong>Meta Platforms (WhatsApp Business)</strong> — trimiterea codurilor de verificare la
              înregistrare și a reminderelor de programare. Îi transmitem numărul de telefon, numele și data/ora
              programării.
            </li>
            <li>
              <strong>Google (Google Calendar)</strong> — sincronizarea agendei interne a cabinetului. Îi
              transmitem numele tău, terapia și data/ora programării.
            </li>
          </ul>
          <p className="mt-2">
            Meta și Google pot prelucra datele și în afara Spațiului Economic European (inclusiv în SUA). În
            aceste cazuri transferul se face pe baza garanțiilor prevăzute de GDPR: Cadrul UE-SUA privind
            confidențialitatea datelor și/sau clauzele contractuale standard aprobate de Comisia Europeană.
            Datele medicale (chestionarul medical și fișele clinice) nu sunt transmise acestor furnizori.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--mitmed-teal-deep)]">5. Cât timp păstrăm datele</h2>
          <p className="mt-2">
            Fișele medicale se păstrează pe durata prevăzută de legislația privind arhivarea documentației
            medicale, după care sunt șterse sau anonimizate. Documentele
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
