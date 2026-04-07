export const COUNTRIES = [
  { code: "BJ", name: "Bénin",            flag: "🇧🇯", dialCode: "+229", currency: "XOF", operators: ["MTN", "MOOV"] },
  { code: "BF", name: "Burkina Faso",      flag: "🇧🇫", dialCode: "+226", currency: "XOF", operators: ["ORANGE", "MOOV"] },
  { code: "CM", name: "Cameroun",          flag: "🇨🇲", dialCode: "+237", currency: "XAF", operators: ["MTN", "ORANGE"] },
  { code: "CD", name: "Congo (RDC)",       flag: "🇨🇩", dialCode: "+243", currency: "CDF", operators: ["VODACOM", "AIRTEL", "ORANGE"] },
  { code: "CG", name: "Congo-Brazzaville", flag: "🇨🇬", dialCode: "+242", currency: "XAF", operators: ["MTN", "AIRTEL"] },
  { code: "CI", name: "Côte d'Ivoire",     flag: "🇨🇮", dialCode: "+225", currency: "XOF", operators: ["MTN", "ORANGE", "MOOV", "WAVE"] },
  { code: "GA", name: "Gabon",             flag: "🇬🇦", dialCode: "+241", currency: "XAF", operators: ["AIRTEL", "MTN"] },
  { code: "GM", name: "Gambie",            flag: "🇬🇲", dialCode: "+220", currency: "XOF", operators: ["AFRICELL", "QMONEY"] },
  { code: "GN", name: "Guinée Conakry",    flag: "🇬🇳", dialCode: "+224", currency: "XOF", operators: ["MTN", "ORANGE", "CELLCOM"] },
  { code: "ML", name: "Mali",              flag: "🇲🇱", dialCode: "+223", currency: "XOF", operators: ["ORANGE", "MOOV"] },
  { code: "SN", name: "Sénégal",           flag: "🇸🇳", dialCode: "+221", currency: "XOF", operators: ["ORANGE", "FREE", "WAVE"] },
  { code: "TG", name: "Togo",              flag: "🇹🇬", dialCode: "+228", currency: "XOF", operators: ["TOGOCEL", "MOOV"] },
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
