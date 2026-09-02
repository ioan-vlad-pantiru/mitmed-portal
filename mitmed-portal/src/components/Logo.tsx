import Image from "next/image";

/** Sigla MitMed — are un fundal navy opac ca parte din design (nu transparent
 * complet), deci nu poate sta direct pe un fundal colorat (teal, gradient)
 * fără să pară un dreptunghi rătăcit. Pe orice fundal care nu e alb/deschis,
 * `chip` (implicit) o pune într-o insignă albă rotunjită — se vede ca o
 * plachetă intenționată, nu ca o eroare de decupare. Pe fundal alb/deschis
 * (ex. cardul de autentificare), folosește `chip={false}`. */
export function Logo({
  size = 32,
  chip = true,
  className = "",
}: {
  size?: number;
  chip?: boolean;
  className?: string;
}) {
  const img = (
    <Image src="/logo.png" alt="MitMed" width={size} height={size} className="object-contain" priority />
  );

  if (!chip) return <span className={className}>{img}</span>;

  const chipSize = size + 10;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ${className}`}
      style={{ width: chipSize, height: chipSize }}
    >
      {img}
    </span>
  );
}
