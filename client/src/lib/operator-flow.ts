export type OperatorFlow = "STANDARD" | "OTP" | "WAVE" | "QMONEY";

export function getOperatorFlow(operator: string): OperatorFlow {
  const op = operator.toUpperCase();
  if (op === "WAVE") return "WAVE";
  if (op === "QMONEY") return "QMONEY";
  if (op === "ORANGE") return "OTP";
  return "STANDARD";
}
