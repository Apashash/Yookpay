export type Country = "CM" | "SN" | "CD" | "BJ" | "BF" | "CG" | "CI" | "GA" | "GM" | "GN" | "ML" | "TG";
export type Operator =
  | "MTN" | "ORANGE" | "MOOV" | "WAVE"
  | "AIRTEL" | "VODACOM" | "AFRICELL" | "QMONEY"
  | "CELLCOM" | "FREE" | "TOGOCEL";
export type TransactionType = "DEPOSIT" | "WITHDRAWAL" | "TRANSFER";

interface FeeConfig {
  rate: number;
  minFee: number;
  maxFee: number | null;
}

type FeeTable = Partial<Record<Operator, Record<TransactionType, FeeConfig>>>;

// minFee = 1 (safety net only — never block small amounts with high minimums)
// maxFee = null (no cap — PixPay charges percentage only)
export const FEE_TABLE: Record<Country, FeeTable> = {
  // ─── XAF — commission PixPay 1.5% ─────────────────────────────────────────
  CM: {
    MTN:    { DEPOSIT: { rate: 0.015, minFee: 1, maxFee: null }, WITHDRAWAL: { rate: 0.015, minFee: 1, maxFee: null }, TRANSFER: { rate: 0.015, minFee: 1, maxFee: null } },
    ORANGE: { DEPOSIT: { rate: 0.015, minFee: 1, maxFee: null }, WITHDRAWAL: { rate: 0.015, minFee: 1, maxFee: null }, TRANSFER: { rate: 0.015, minFee: 1, maxFee: null } },
  },
  CG: {
    MTN:    { DEPOSIT: { rate: 0.015, minFee: 1, maxFee: null }, WITHDRAWAL: { rate: 0.015, minFee: 1, maxFee: null }, TRANSFER: { rate: 0.015, minFee: 1, maxFee: null } },
    AIRTEL: { DEPOSIT: { rate: 0.015, minFee: 1, maxFee: null }, WITHDRAWAL: { rate: 0.015, minFee: 1, maxFee: null }, TRANSFER: { rate: 0.015, minFee: 1, maxFee: null } },
  },
  GA: {
    AIRTEL: { DEPOSIT: { rate: 0.015, minFee: 1, maxFee: null }, WITHDRAWAL: { rate: 0.015, minFee: 1, maxFee: null }, TRANSFER: { rate: 0.015, minFee: 1, maxFee: null } },
    MTN:    { DEPOSIT: { rate: 0.015, minFee: 1, maxFee: null }, WITHDRAWAL: { rate: 0.015, minFee: 1, maxFee: null }, TRANSFER: { rate: 0.015, minFee: 1, maxFee: null } },
  },

  // ─── XOF — commission PixPay 1.9% ─────────────────────────────────────────
  CI: {
    MTN:    { DEPOSIT: { rate: 0.019, minFee: 1, maxFee: null }, WITHDRAWAL: { rate: 0.019, minFee: 1, maxFee: null }, TRANSFER: { rate: 0.019, minFee: 1, maxFee: null } },
    ORANGE: { DEPOSIT: { rate: 0.019, minFee: 1, maxFee: null }, WITHDRAWAL: { rate: 0.019, minFee: 1, maxFee: null }, TRANSFER: { rate: 0.019, minFee: 1, maxFee: null } },
    MOOV:   { DEPOSIT: { rate: 0.019, minFee: 1, maxFee: null }, WITHDRAWAL: { rate: 0.019, minFee: 1, maxFee: null }, TRANSFER: { rate: 0.019, minFee: 1, maxFee: null } },
    WAVE:   { DEPOSIT: { rate: 0.019, minFee: 1, maxFee: null }, WITHDRAWAL: { rate: 0.019, minFee: 1, maxFee: null }, TRANSFER: { rate: 0.019, minFee: 1, maxFee: null } },
  },
  SN: {
    ORANGE: { DEPOSIT: { rate: 0.019, minFee: 1, maxFee: null }, WITHDRAWAL: { rate: 0.019, minFee: 1, maxFee: null }, TRANSFER: { rate: 0.019, minFee: 1, maxFee: null } },
    FREE:   { DEPOSIT: { rate: 0.019, minFee: 1, maxFee: null }, WITHDRAWAL: { rate: 0.019, minFee: 1, maxFee: null }, TRANSFER: { rate: 0.019, minFee: 1, maxFee: null } },
    WAVE:   { DEPOSIT: { rate: 0.019, minFee: 1, maxFee: null }, WITHDRAWAL: { rate: 0.019, minFee: 1, maxFee: null }, TRANSFER: { rate: 0.019, minFee: 1, maxFee: null } },
  },
  BF: {
    ORANGE: { DEPOSIT: { rate: 0.019, minFee: 1, maxFee: null }, WITHDRAWAL: { rate: 0.019, minFee: 1, maxFee: null }, TRANSFER: { rate: 0.019, minFee: 1, maxFee: null } },
    MOOV:   { DEPOSIT: { rate: 0.019, minFee: 1, maxFee: null }, WITHDRAWAL: { rate: 0.019, minFee: 1, maxFee: null }, TRANSFER: { rate: 0.019, minFee: 1, maxFee: null } },
  },
  BJ: {
    MTN:  { DEPOSIT: { rate: 0.019, minFee: 1, maxFee: null }, WITHDRAWAL: { rate: 0.019, minFee: 1, maxFee: null }, TRANSFER: { rate: 0.019, minFee: 1, maxFee: null } },
    MOOV: { DEPOSIT: { rate: 0.019, minFee: 1, maxFee: null }, WITHDRAWAL: { rate: 0.019, minFee: 1, maxFee: null }, TRANSFER: { rate: 0.019, minFee: 1, maxFee: null } },
  },
  GM: {
    AFRICELL: { DEPOSIT: { rate: 0.019, minFee: 1, maxFee: null }, WITHDRAWAL: { rate: 0.019, minFee: 1, maxFee: null }, TRANSFER: { rate: 0.019, minFee: 1, maxFee: null } },
    QMONEY:   { DEPOSIT: { rate: 0.019, minFee: 1, maxFee: null }, WITHDRAWAL: { rate: 0.019, minFee: 1, maxFee: null }, TRANSFER: { rate: 0.019, minFee: 1, maxFee: null } },
  },
  GN: {
    MTN:     { DEPOSIT: { rate: 0.019, minFee: 1, maxFee: null }, WITHDRAWAL: { rate: 0.019, minFee: 1, maxFee: null }, TRANSFER: { rate: 0.019, minFee: 1, maxFee: null } },
    ORANGE:  { DEPOSIT: { rate: 0.019, minFee: 1, maxFee: null }, WITHDRAWAL: { rate: 0.019, minFee: 1, maxFee: null }, TRANSFER: { rate: 0.019, minFee: 1, maxFee: null } },
    CELLCOM: { DEPOSIT: { rate: 0.019, minFee: 1, maxFee: null }, WITHDRAWAL: { rate: 0.019, minFee: 1, maxFee: null }, TRANSFER: { rate: 0.019, minFee: 1, maxFee: null } },
  },
  ML: {
    ORANGE: { DEPOSIT: { rate: 0.019, minFee: 1, maxFee: null }, WITHDRAWAL: { rate: 0.019, minFee: 1, maxFee: null }, TRANSFER: { rate: 0.019, minFee: 1, maxFee: null } },
    MOOV:   { DEPOSIT: { rate: 0.019, minFee: 1, maxFee: null }, WITHDRAWAL: { rate: 0.019, minFee: 1, maxFee: null }, TRANSFER: { rate: 0.019, minFee: 1, maxFee: null } },
  },
  TG: {
    TOGOCEL: { DEPOSIT: { rate: 0.019, minFee: 1, maxFee: null }, WITHDRAWAL: { rate: 0.019, minFee: 1, maxFee: null }, TRANSFER: { rate: 0.019, minFee: 1, maxFee: null } },
    MOOV:    { DEPOSIT: { rate: 0.019, minFee: 1, maxFee: null }, WITHDRAWAL: { rate: 0.019, minFee: 1, maxFee: null }, TRANSFER: { rate: 0.019, minFee: 1, maxFee: null } },
  },

  // ─── CDF — commission PixPay 3.0% dépôt / 3.5% retrait ───────────────────
  CD: {
    VODACOM:  { DEPOSIT: { rate: 0.030, minFee: 1, maxFee: null }, WITHDRAWAL: { rate: 0.035, minFee: 1, maxFee: null }, TRANSFER: { rate: 0.019, minFee: 1, maxFee: null } },
    AIRTEL:   { DEPOSIT: { rate: 0.030, minFee: 1, maxFee: null }, WITHDRAWAL: { rate: 0.035, minFee: 1, maxFee: null }, TRANSFER: { rate: 0.019, minFee: 1, maxFee: null } },
    ORANGE:   { DEPOSIT: { rate: 0.030, minFee: 1, maxFee: null }, WITHDRAWAL: { rate: 0.035, minFee: 1, maxFee: null }, TRANSFER: { rate: 0.019, minFee: 1, maxFee: null } },
    AFRICELL: { DEPOSIT: { rate: 0.030, minFee: 1, maxFee: null }, WITHDRAWAL: { rate: 0.035, minFee: 1, maxFee: null }, TRANSFER: { rate: 0.019, minFee: 1, maxFee: null } },
  },
};

export const CURRENCY_MAP: Record<Country, string> = {
  CM: "XAF", CG: "XAF", GA: "XAF",
  SN: "XOF", BJ: "XOF", BF: "XOF", CI: "XOF", GM: "XOF", GN: "XOF", ML: "XOF", TG: "XOF",
  CD: "CDF",
};

export function calculateFee(
  amount: number,
  country: Country,
  operator: Operator,
  type: TransactionType
): {
  grossAmount: number;
  feeRate: number;
  feeAmount: number;
  netAmount: number;
  currency: string;
  operator: string;
  country: string;
} {
  const config = FEE_TABLE[country]?.[operator]?.[type];
  if (!config) {
    throw new Error(`No fee config for ${country}/${operator}/${type}`);
  }

  let feeAmount = Math.round(amount * config.rate);
  feeAmount = Math.max(feeAmount, config.minFee);
  if (config.maxFee !== null) {
    feeAmount = Math.min(feeAmount, config.maxFee);
  }

  const netAmount = type === "DEPOSIT" ? amount - feeAmount : amount + feeAmount;

  return {
    grossAmount: amount,
    feeRate: config.rate,
    feeAmount,
    netAmount: Math.max(netAmount, 0),
    currency: CURRENCY_MAP[country],
    operator,
    country,
  };
}

/**
 * Calculate fee with optional rate override (from admin-set user fees).
 * If overrideRate is provided, it replaces the FEE_TABLE rate.
 */
export function calculateFeeWithRate(
  amount: number,
  country: Country,
  operator: Operator,
  type: TransactionType,
  overrideRate?: number,
): ReturnType<typeof calculateFee> {
  const config = FEE_TABLE[country]?.[operator]?.[type];
  if (!config) {
    throw new Error(`No fee config for ${country}/${operator}/${type}`);
  }

  const rate = overrideRate ?? config.rate;
  let feeAmount = Math.round(amount * rate);
  feeAmount = Math.max(feeAmount, config.minFee);
  if (config.maxFee !== null) {
    feeAmount = Math.min(feeAmount, config.maxFee);
  }

  const netAmount = type === "DEPOSIT" ? amount - feeAmount : amount + feeAmount;

  return {
    grossAmount: amount,
    feeRate: rate,
    feeAmount,
    netAmount: Math.max(netAmount, 0),
    currency: CURRENCY_MAP[country],
    operator,
    country,
  };
}

/** Default YookPay margin applied on top of PixPay base rate when no custom override exists. */
export const DEFAULT_MARGIN = 0.025;

export function generateReference(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `YPY-${timestamp}-${random}`;
}
