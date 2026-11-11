import { Phone } from "lucide-react";
import { CLINIC_PHONE_HREF } from "@/lib/clinic";

export function CallClinicLink({ className = "portal-secondary-btn", label = "Sună la clinică" }: { className?: string; label?: string }) {
  return (
    <a href={CLINIC_PHONE_HREF} className={className}>
      <Phone size={17} /> {label}
    </a>
  );
}
