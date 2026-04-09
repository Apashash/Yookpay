// minAmount: minimum transaction amount per PixPay documentation
// https://docs.pixpay.sn/fr — "Gammes de montants par pays"
export const COUNTRIES = [
  { code: "BJ", name: "Bénin",            flag: "🇧🇯", dialCode: "+229", currency: "XOF", operators: ["MTN", "MOOV"],                           minAmount: 500 },
  { code: "BF", name: "Burkina Faso",      flag: "🇧🇫", dialCode: "+226", currency: "XOF", operators: ["ORANGE", "MOOV"],                         minAmount: 500 },
  { code: "CM", name: "Cameroun",          flag: "🇨🇲", dialCode: "+237", currency: "XAF", operators: ["MTN", "ORANGE"],                          minAmount: 500 },
  { code: "CD", name: "Congo (RDC)",       flag: "🇨🇩", dialCode: "+243", currency: "CDF", operators: ["VODACOM", "AIRTEL", "ORANGE", "AFRICELL"], minAmount: 500 },
  { code: "CG", name: "Congo-Brazzaville", flag: "🇨🇬", dialCode: "+242", currency: "XAF", operators: ["MTN", "AIRTEL"],                          minAmount: 500 },
  { code: "CI", name: "Côte d'Ivoire",     flag: "🇨🇮", dialCode: "+225", currency: "XOF", operators: ["MTN", "ORANGE", "MOOV", "WAVE"],           minAmount: 200 },
  { code: "GA", name: "Gabon",             flag: "🇬🇦", dialCode: "+241", currency: "XAF", operators: ["AIRTEL", "MTN"],                          minAmount: 500 },
  { code: "GM", name: "Gambie",            flag: "🇬🇲", dialCode: "+220", currency: "XOF", operators: ["AFRICELL", "QMONEY"],                     minAmount: 200 },
  { code: "GN", name: "Guinée Conakry",    flag: "🇬🇳", dialCode: "+224", currency: "XOF", operators: ["MTN", "ORANGE", "CELLCOM"],               minAmount: 1000 },
  { code: "ML", name: "Mali",              flag: "🇲🇱", dialCode: "+223", currency: "XOF", operators: ["ORANGE", "MOOV"],                         minAmount: 500 },
  { code: "SN", name: "Sénégal",           flag: "🇸🇳", dialCode: "+221", currency: "XOF", operators: ["ORANGE", "FREE", "WAVE"],                 minAmount: 200 },
  { code: "TG", name: "Togo",              flag: "🇹🇬", dialCode: "+228", currency: "XOF", operators: ["TOGOCEL", "MOOV"],                        minAmount: 500 },
] as const;

export type CountryCode = typeof COUNTRIES[number]["code"];

export const OPERATOR_LABELS: Record<string, string> = {
  MTN:      "MTN Mobile Money",
  ORANGE:   "Orange Money",
  MOOV:     "Moov Money",
  WAVE:     "Wave",
  AIRTEL:   "Airtel Money",
  VODACOM:  "M-Pesa (Vodacom)",
  AFRICELL: "Africell Money",
  QMONEY:   "QMoney",
  CELLCOM:  "Cellcom Money",
  FREE:     "Free Money",
  TOGOCEL:  "T-Money (Togocel)",
};

export function getCountry(code: string) {
  return COUNTRIES.find((c) => c.code === code);
}

/**
 * Normalize a phone number for PixPay:
 * PixPay expects LOCAL format with leading 0 (e.g. "0595857098" for CI)
 * - strips non-digit chars and spaces
 * - if number already starts with 0 → keep as-is
 * - if number was entered without leading 0 (e.g. "595857098") → add it back
 * - if number starts with country dial code digits → strip them and add local 0
 * Example: CI "+225", "0595857098" → "0595857098" (unchanged, correct for PixPay)
 * Example: CI "+225", "225595857098" → "0595857098"
 */
export function normalizePhone(phone: string, countryCode: string): string {
  const country = COUNTRIES.find((c) => c.code === countryCode);
  const dialDigits = country?.dialCode.replace("+", "") ?? "";
  const digits = phone.replace(/\D/g, "");
  // If already has country code prefix, strip it and add leading 0
  if (dialDigits && digits.startsWith(dialDigits)) {
    return "0" + digits.slice(dialDigits.length);
  }
  // If starts with 0 already, return as-is
  if (digits.startsWith("0")) return digits;
  // Otherwise prepend 0
  return "0" + digits;
}
