import crypto from "crypto";

const baseUrl = () => process.env["PAWAPAY_ENV"] === "production"
  ? "https://api.pawapay.io" : "https://api.sandbox.pawapay.io";

export class PawaPayError extends Error {
  constructor(message: string, public readonly status?: number) { super(message); }
}
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = process.env["PAWAPAY_API_TOKEN"];
  if (!token) throw new PawaPayError("pawaPay is not configured");
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init, headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new PawaPayError(String(body?.failureReason?.failureMessage ?? "pawaPay request failed"), response.status);
  return body as T;
}
export function normalizePawaPayPhone(phone: string, country: string): string {
  const dials: Record<string, string> = { CM:"237", CG:"242", GA:"241", CD:"243", CI:"225", SN:"221", BF:"226", BJ:"229", GN:"224", ML:"223", TG:"228", GM:"220" };
  const digits = phone.replace(/\D/g, "").replace(/^00/, "");
  const dial = dials[country.toUpperCase()];
  if (!dial) throw new PawaPayError("Unsupported pawaPay country");
  return digits.startsWith(dial) ? digits : `${dial}${digits.replace(/^0/, "")}`;
}
export type PawaPayResult = { depositId?: string; payoutId?: string; status: string; data?: PawaPayResult; failureReason?: { failureCode?: string; failureMessage?: string } };
export function pawaResultStatus(result: PawaPayResult): PawaPayResult {
  return result.data ?? result;
}
export async function initiateDeposit(input: { amount: number; currency: string; phone: string; provider: string; depositId?: string }) {
  const depositId = input.depositId ?? crypto.randomUUID();
  return request<PawaPayResult>("/v2/deposits", { method: "POST", body: JSON.stringify({ depositId, amount: String(input.amount), currency: input.currency, payer: { type: "MMO", accountDetails: { provider: input.provider, phoneNumber: input.phone } } }) });
}
export async function initiatePayout(input: { amount: number; currency: string; phone: string; provider: string; payoutId?: string }) {
  const payoutId = input.payoutId ?? crypto.randomUUID();
  return request<PawaPayResult>("/v2/payouts", { method: "POST", body: JSON.stringify({ payoutId, amount: String(input.amount), currency: input.currency, recipient: { type: "MMO", accountDetails: { provider: input.provider, phoneNumber: input.phone } } }) });
}
export const getDepositStatus = (id: string) => request<PawaPayResult>(`/v2/deposits/${encodeURIComponent(id)}`);
export const getPayoutStatus = (id: string) => request<PawaPayResult>(`/v2/payouts/${encodeURIComponent(id)}`);
export const getWalletBalances = () => request<unknown>("/v2/wallet-balances");
export const getActiveConfiguration = () => request<unknown>("/v2/active-conf");
export function pawaFinalStatus(status?: string): "SUCCESS" | "FAILED" | null {
  const s = status?.toUpperCase();
  if (s === "COMPLETED") return "SUCCESS";
  if (s === "FAILED") return "FAILED";
  return null;
}