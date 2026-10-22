/** Shared Czech decimal-input boundary. Blank and malformed answers never become zero.
 * Keep unrounded values for educational models; this is not a money-accounting parser.
 */
export function parseNumericAnswer(value: string) {
  return value.trim() === "" ? Number.NaN : Number(value.replace(",", "."));
}
