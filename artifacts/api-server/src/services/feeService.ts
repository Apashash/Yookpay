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

export const FEE_TABLE: Record<Country, FeeTable> = {
  CM: {
    MTN:    { DEPOSIT: { rate: 0.015, minFee: 100, maxFee: 5000 }, WITHDRAWAL: { rate: 0.02,  minFee: 150, maxFee: 8000 }, TRANSFER: { rate: 0.01,  minFee: 50, maxFee: 3000 } },
    ORANGE: { DEPOSIT: { rate: 0.018, minFee: 100, maxFee: 5000 }, WITHDRAWAL: { rate: 0.022, minFee: 150, maxFee: 8000 }, TRANSFER: { rate: 0.012, minFee: 50, maxFee: 3000 } },
  },
  SN: {
    ORANGE: { DEPOSIT: { rate: 0.015, minFee: 50, maxFee: 4500 }, WITHDRAWAL: { rate: 0.02,  minFee: 100, maxFee: 7500 }, TRANSFER: { rate: 0.01,  minFee: 25, maxFee: 2500 } },
    FREE:   { DEPOSIT: { rate: 0.012, minFee: 50, maxFee: 4000 }, WITHDRAWAL: { rate: 0.018, minFee: 100, maxFee: 7000 }, TRANSFER: { rate: 0.008, minFee: 25, maxFee: 2000 } },
    WAVE:   { DEPOSIT: { rate: 0.008, minFee: 25, maxFee: 2500 }, WITHDRAWAL: { rate: 0.01,  minFee: 50,  maxFee: 4000 }, TRANSFER: { rate: 0.003, minFee: 10, maxFee: 1500 } },
  },
  CD: {
    VODACOM: { DEPOSIT: { rate: 0.018, minFee: 200, maxFee: 9000  }, WITHDRAWAL: { rate: 0.022, minFee: 300, maxFee: 11000 }, TRANSFER: { rate: 0.012, minFee: 100, maxFee: 4500 } },
    AIRTEL:  { DEPOSIT: { rate: 0.02,  minFee: 200, maxFee: 10000 }, WITHDRAWAL: { rate: 0.025, minFee: 300, maxFee: 12000 }, TRANSFER: { rate: 0.015, minFee: 100, maxFee: 5000 } },
    ORANGE:  { DEPOSIT: { rate: 0.022, minFee: 200, maxFee: 10000 }, WITHDRAWAL: { rate: 0.028, minFee: 300, maxFee: 12000 }, TRANSFER: { rate: 0.018, minFee: 100, maxFee: 5000 } },
  },
  BJ: {
    MTN:  { DEPOSIT: { rate: 0.017, minFee: 50, maxFee: 4500 }, WITHDRAWAL: { rate: 0.022, minFee: 100, maxFee: 7500 }, TRANSFER: { rate: 0.01,  minFee: 25, maxFee: 2500 } },
    MOOV: { DEPOSIT: { rate: 0.02,  minFee: 50, maxFee: 5000 }, WITHDRAWAL: { rate: 0.025, minFee: 100, maxFee: 8000 }, TRANSFER: { rate: 0.012, minFee: 25, maxFee: 3000 } },
  },
  BF: {
    ORANGE: { DEPOSIT: { rate: 0.015, minFee: 50, maxFee: 4500 }, WITHDRAWAL: { rate: 0.02,  minFee: 100, maxFee: 7500 }, TRANSFER: { rate: 0.01,  minFee: 25, maxFee: 2500 } },
    MOOV:   { DEPOSIT: { rate: 0.02,  minFee: 50, maxFee: 5000 }, WITHDRAWAL: { rate: 0.025, minFee: 100, maxFee: 8000 }, TRANSFER: { rate: 0.012, minFee: 25, maxFee: 3000 } },
  },
  CG: {
    MTN:    { DEPOSIT: { rate: 0.018, minFee: 100, maxFee: 5000 }, WITHDRAWAL: { rate: 0.022, minFee: 150, maxFee: 8000 }, TRANSFER: { rate: 0.012, minFee: 50, maxFee: 3000 } },
    AIRTEL: { DEPOSIT: { rate: 0.02,  minFee: 100, maxFee: 5000 }, WITHDRAWAL: { rate: 0.025, minFee: 150, maxFee: 8000 }, TRANSFER: { rate: 0.015, minFee: 50, maxFee: 3000 } },
  },
  CI: {
    MTN:    { DEPOSIT: { rate: 0.015, minFee: 50, maxFee: 4500 }, WITHDRAWAL: { rate: 0.02,  minFee: 100, maxFee: 7500 }, TRANSFER: { rate: 0.01,  minFee: 25, maxFee: 2500 } },
    ORANGE: { DEPOSIT: { rate: 0.017, minFee: 50, maxFee: 5000 }, WITHDRAWAL: { rate: 0.022, minFee: 100, maxFee: 8000 }, TRANSFER: { rate: 0.012, minFee: 25, maxFee: 3000 } },
    MOOV:   { DEPOSIT: { rate: 0.02,  minFee: 50, maxFee: 5000 }, WITHDRAWAL: { rate: 0.025, minFee: 100, maxFee: 8000 }, TRANSFER: { rate: 0.015, minFee: 25, maxFee: 3000 } },
    WAVE:   { DEPOSIT: { rate: 0.008, minFee: 25, maxFee: 2500 }, WITHDRAWAL: { rate: 0.01,  minFee: 50,  maxFee: 4000 }, TRANSFER: { rate: 0.003, minFee: 10, maxFee: 1500 } },
  },
  GA: {
    AIRTEL: { DEPOSIT: { rate: 0.018, minFee: 100, maxFee: 5000 }, WITHDRAWAL: { rate: 0.022, minFee: 150, maxFee: 8000 }, TRANSFER: { rate: 0.012, minFee: 50, maxFee: 3000 } },
    MTN:    { DEPOSIT: { rate: 0.02,  minFee: 100, maxFee: 5000 }, WITHDRAWAL: { rate: 0.025, minFee: 150, maxFee: 8000 }, TRANSFER: { rate: 0.015, minFee: 50, maxFee: 3000 } },
  },
  GM: {
    AFRICELL: { DEPOSIT: { rate: 0.02,  minFee: 50, maxFee: 4000 }, WITHDRAWAL: { rate: 0.025, minFee: 100, maxFee: 7000 }, TRANSFER: { rate: 0.015, minFee: 25, maxFee: 3000 } },
    QMONEY:   { DEPOSIT: { rate: 0.022, minFee: 50, maxFee: 4500 }, WITHDRAWAL: { rate: 0.028, minFee: 100, maxFee: 7500 }, TRANSFER: { rate: 0.018, minFee: 25, maxFee: 3500 } },
  },
  GN: {
    MTN:     { DEPOSIT: { rate: 0.018, minFee: 50, maxFee: 5000 }, WITHDRAWAL: { rate: 0.022, minFee: 100, maxFee: 8000 }, TRANSFER: { rate: 0.012, minFee: 25, maxFee: 3000 } },
    ORANGE:  { DEPOSIT: { rate: 0.02,  minFee: 50, maxFee: 5000 }, WITHDRAWAL: { rate: 0.025, minFee: 100, maxFee: 8000 }, TRANSFER: { rate: 0.015, minFee: 25, maxFee: 3000 } },
    CELLCOM: { DEPOSIT: { rate: 0.022, minFee: 50, maxFee: 5500 }, WITHDRAWAL: { rate: 0.028, minFee: 100, maxFee: 9000 }, TRANSFER: { rate: 0.018, minFee: 25, maxFee: 3500 } },
  },
  ML: {
    ORANGE: { DEPOSIT: { rate: 0.015, minFee: 50, maxFee: 4500 }, WITHDRAWAL: { rate: 0.02,  minFee: 100, maxFee: 7500 }, TRANSFER: { rate: 0.01,  minFee: 25, maxFee: 2500 } },
    MOOV:   { DEPOSIT: { rate: 0.018, minFee: 50, maxFee: 5000 }, WITHDRAWAL: { rate: 0.022, minFee: 100, maxFee: 8000 }, TRANSFER: { rate: 0.012, minFee: 25, maxFee: 3000 } },
  },
  TG: {
    TOGOCEL: { DEPOSIT: { rate: 0.018, minFee: 50, maxFee: 4500 }, WITHDRAWAL: { rate: 0.022, minFee: 100, maxFee: 7500 }, TRANSFER: { rate: 0.012, minFee: 25, maxFee: 3000 } },
    MOOV:    { DEPOSIT: { rate: 0.02,  minFee: 50, maxFee: 5000 }, WITHDRAWAL: { rate: 0.025, minFee: 100, maxFee: 8000 }, TRANSFER: { rate: 0.015, minFee: 25, maxFee: 3000 } },
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

export function generateReference(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `YPY-${timestamp}-${random}`;
}
