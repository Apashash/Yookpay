import { logger } from "../lib/logger";

export type ProviderResponse = {
  success: boolean;
  providerReference: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  message: string;
};

const SUCCESS_RATE = 0.92; // 92% success rate for mock

export async function initiatePayment(params: {
  phone: string;
  amount: number;
  currency: string;
  operator: string;
  country: string;
  reference: string;
  type: "DEPOSIT" | "WITHDRAWAL";
}): Promise<ProviderResponse> {
  // Simulate network delay (100-500ms)
  await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 400));

  const success = Math.random() < SUCCESS_RATE;
  const providerReference = `${params.operator}-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  logger.info(
    {
      reference: params.reference,
      operator: params.operator,
      country: params.country,
      amount: params.amount,
      currency: params.currency,
      phone: params.phone.replace(/\d(?=\d{4})/g, "*"),
      success,
      providerReference,
    },
    `Provider ${params.type.toLowerCase()} initiated`
  );

  return {
    success,
    providerReference,
    status: success ? "SUCCESS" : "FAILED",
    message: success
      ? `${params.type} initiated successfully via ${params.operator}`
      : `${params.operator} provider rejected the request`,
  };
}
