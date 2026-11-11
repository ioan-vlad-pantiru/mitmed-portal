/** Romanian display labels for the coded answers in the client profile survey. */
const PROFILE_LABELS: Record<string, string> = {
  RECOMANDARE: "Recomandare", GOOGLE: "Google", FACEBOOK_INSTAGRAM: "Facebook / Instagram", SITE: "Site",
  MEDIC: "Medic", EVENIMENT: "Eveniment", ALTELE: "Altele", DURERE: "Reducerea durerii", MOBILITATE: "Mobilitate",
  RECUPERARE: "Recuperare", PREVENȚIE: "Prevenție", PERFORMANȚĂ: "Performanță", STARE_DE_BINE: "Stare de bine",
  SCĂZUT: "Scăzut", MODERAT: "Moderat", RIDICAT: "Ridicat", SEDENTAR: "Preponderent sedentară", ACTIV: "Activă",
  MUNCA_FIZICA: "Muncă fizică", PENSIONAR: "Pensionar", ELEV_STUDENT: "Elev / student",
  REDUCERE_DURERE: "Reducere durere", RECUPERARE_POSTOPERATORIE: "Recuperare post-operatorie",
  TERAPIE_SPORTIVA: "Terapie sportivă", WELLNESS_RELAXARE: "Wellness / relaxare", PREVENTIE: "Prevenție",
  NECUNOSCUT: "Nu au spus",
};

export function profileLabel(code: string): string {
  return PROFILE_LABELS[code] ?? code;
}
