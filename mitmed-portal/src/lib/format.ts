/** "1.250 RON", "149,5 RON" — Romanian number format, up to `maxDecimals` decimals. */
export function formatRon(value: number, maxDecimals = 2): string {
  return `${value.toLocaleString("ro-RO", { minimumFractionDigits: 0, maximumFractionDigits: maxDecimals })} RON`;
}
