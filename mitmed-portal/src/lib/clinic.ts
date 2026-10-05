export const CLINIC_NAME = "Centrul Medical MitMed";
export const CLINIC_ADDRESS = "Bulevardul Oituz 18, Parter, Ap 58, Onești";
export const CLINIC_PHONE = "0728 249 949";
const DESTINATION = "Centrul+Medical+MitMed+Bulevardul+Oituz+18+Onesti";
export const CLINIC_DIRECTIONS_URL = `https://www.google.com/maps/dir/?api=1&destination=${DESTINATION}`;

// Entitatea juridică (certificatul de înregistrare fiscală ANAF) — folosită
// în Termeni și Politica de confidențialitate, cerute de PayU.
export const LEGAL_NAME = "MITU M. SEBASTIAN-MIHAI – Cabinet Individual de Liberă Practică pentru Fizioterapie";
export const LEGAL_CIF = "46877269";
export const LEGAL_ADDRESS = "Bld. Oituz nr. 18, Bl. 18, Sc. C, Et. Parter, Ap. 58, Mun. Onești, Jud. Bacău";
export const CLINIC_EMAIL = "contact@mitmed.ro";

export const CLINIC_TIME_ZONE = "Europe/Bucharest";

/** Momentul în care a fost făcută o programare, în ora clinicii — ex.
 * "5 oct., 14:32 · online, de client". */
export function formatBooking(bookedAt: string, bookedByClient: boolean): string {
  const when = new Date(bookedAt).toLocaleString("ro-RO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: CLINIC_TIME_ZONE,
  });
  return `${when} · ${bookedByClient ? "online, de client" : "de personal"}`;
}
