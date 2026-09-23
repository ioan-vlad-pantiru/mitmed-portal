import { requireRole } from "@/lib/authSession";
import { Role } from "@/lib/enums";
import { listWeekdayHours, listVacations } from "@/actions/clinic";
import { WeekdayHoursForm } from "./WeekdayHoursForm";
import { VacationsPanel } from "./VacationsPanel";

export default async function ClinicSchedulePage() {
  await requireRole(Role.ADMIN);
  const [hours, vacations] = await Promise.all([listWeekdayHours(), listVacations()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Program cabinet</h1>
        <p className="text-sm text-zinc-500">
          Orele în care se pot face programări, pe fiecare zi a săptămânii, plus pauza zilnică (opțională). Clienții
          din portal și recepția văd imediat noul program.
        </p>
      </div>

      <WeekdayHoursForm initial={hours} />
      <VacationsPanel vacations={vacations} />
    </div>
  );
}
