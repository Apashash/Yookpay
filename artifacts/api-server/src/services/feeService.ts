export type Country = "CM" | "SN" | "CD";
export type Operator = "MTN" | "ORANGE" | "MOOV" | "WAVE";
export type TransactionType = "DEPOSIT" | "WITHDRAWAL" | "TRANSFER";

interface FeeConfig {
  rate: number; // percentage e.g. 0.015 = 1.5%
  minFee: number;
  maxFee: number | null;
}

const FEE_TABLE: Record<Country, Record<Operator, Record<TransactionType, FeeConfig>>> = {
  CM: {
    MTN: {
      DEPOSIT: { rate: 0.015, minFee: 100, maxFee: 5000 },
      WITHDRAWAL: { rate: 0.02, minFee: 150, maxFee: 8000 },
      TRANSFER: { rate: 0.01, minFee: 50, maxFee: 3000 },
    },
    ORANGE: {
      DEPOSIT: { rate: 0.018, minFee: 100, maxFee: 5000 },
      WITHDRAWAL: { rate: 0.022, minFee: 150, maxFee: 8000 },
      TRANSFER: { rate: 0.012, minFee: 50, maxFee: 3000 },
    },
    MOOV: {
      DEPOSIT: { rate: 0.02, minFee: 100, maxFee: 4000 },
      WITHDRAWAL: { rate: 0.025, minFee: 150, maxFee: 7000 },
      TRANSFER: { rate: 0.015, minFee: 50, maxFee: 3000 },
    },
    WAVE: {
      DEPOSIT: { rate: 0.01, minFee: 50, maxFee: 3000 },
      WITHDRAWAL: { rate: 0.015, minFee: 100, maxFee: 5000 },
      TRANSFER: { rate: 0.005, minFee: 25, maxFee: 2000 },
    },
  },
  SN: {
    MTN: {
      DEPOSIT: { rate: 0.017, minFee: 50, maxFee: 5000 },
      WITHDRAWAL: { rate: 0.022, minFee: 100, maxFee: 8000 },
      TRANSFER: { rate: 0.01, minFee: 25, maxFee: 3000 },
    },
    ORANGE: {
      DEPOSIT: { rate: 0.015, minFee: 50, maxFee: 4500 },
      WITHDRAWAL: { rate: 0.02, minFee: 100, maxFee: 7500 },
      TRANSFER: { rate: 0.01, minFee: 25, maxFee: 2500 },
    },
    MOOV: {
      DEPOSIT: { rate: 0.02, minFee: 50, maxFee: 5000 },
      WITHDRAWAL: { rate: 0.025, minFee: 100, maxFee: 8000 },
      TRANSFER: { rate: 0.012, minFee: 25, maxFee: 3000 },
    },
    WAVE: {
      DEPOSIT: { rate: 0.008, minFee: 25, maxFee: 2500 },
      WITHDRAWAL: { rate: 0.01, minFee: 50, maxFee: 4000 },
      TRANSFER: { rate: 0.003, minFee: 10, maxFee: 1500 },
    },
  },
  CD: {
    MTN: {
      DEPOSIT: { rate: 0.02, minFee: 200, maxFee: 10000 },
      WITHDRAWAL: { rate: 0.025, minFee: 300, maxFee: 12000 },
      TRANSFER: { rate: 0.015, minFee: 100, maxFee: 5000 },
    },
    ORANGE: {
      DEPOSIT: { rate: 0.022, minFee: 200, maxFee: 10000 },
      WITHDRAWAL: { rate: 0.028, minFee: 300, maxFee: 12000 },
      TRANSFER: { rate: 0.018, minFee: 100, maxFee: 5000 },
    },
    MOOV: {
      DEPOSIT: { rate: 0.025, minFee: 200, maxFee: 9000 },
      WITHDRAWAL: { rate: 0.03, minFee: 300, maxFee: 11000 },
      TRANSFER: { rate: 0.02, minFee: 100, maxFee: 5000 },
    },
    WAVE: {
      DEPOSIT: { rate: 0.015, minFee: 100, maxFee: 7000 },
      WITHDRAWAL: { rate: 0.018, minFee: 200, maxFee: 9000 },
      TRANSFER: { rate: 0.01, minFee: 50, maxFee: 4000 },
    },
  },
};

export const CURRENCY_MAP: Record<Country, string> = {
  CM: "XAF",
  SN: "XOF",
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
