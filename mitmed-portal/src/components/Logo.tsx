import Image from "next/image";

/** Sigla MitMed — fundal complet transparent, inclusiv decupajul de coloană
 * vertebrală din mijloc (nu alb — se vede fundalul de dedesubt, indiferent
 * unde stă sigla). */
export function Logo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="MitMed"
      width={size}
      height={size}
      className={`object-contain ${className}`}
      priority
    />
  );
}
