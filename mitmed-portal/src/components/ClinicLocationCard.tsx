import { MapPin, Navigation } from "lucide-react";
import { CLINIC_ADDRESS, CLINIC_DIRECTIONS_URL, CLINIC_NAME } from "@/lib/clinic";

export function ClinicLocationCard() {
  return (
    <section className="portal-feature-panel">
      <div className="portal-panel-title">
        <MapPin />
        <h2>Cum ajungi la cabinet</h2>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-[#284747]">
          <strong className="block">{CLINIC_NAME}</strong>
          <span className="text-[#6a8585]">{CLINIC_ADDRESS}</span>
        </div>
        <a
          href={CLINIC_DIRECTIONS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-[var(--mitmed-teal)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          <Navigation size={15} /> Orientare în Google Maps
        </a>
      </div>
    </section>
  );
}
