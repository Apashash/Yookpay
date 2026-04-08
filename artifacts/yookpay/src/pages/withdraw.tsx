import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateWithdrawal, customFetch, getGetWalletsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { COUNTRIES, OPERATOR_LABELS } from "@/lib/countries";
import { getOperatorFlow } from "@/lib/operator-flow";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExternalLink, Clock, Info, Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type FeeBearer = "SENDER" | "RECIPIENT";

const withdrawSchema = z.object({
  amount:   z.coerce.number().min(100, "Montant minimum : 100"),
  country:  z.string().min(2, "Veuillez sélectionner un pays"),
  operator: z.string().min(2, "Veuillez sélectionner un opérateur"),
  phone:    z.string().min(6, "Numéro de téléphone invalide"),
});

type WithdrawFormValues = z.infer<typeof withdrawSchema>;

type FeePreview = {
  grossAmount: number;
  feeRate: number;
  feeAmount: number;
  netAmount: number;
  currency: string;
};

type WithdrawResult = {
  transaction: { id: number; amount: number; currency: string; status: string };
  flow?: string;
  smsLink?: string | null;
  pending?: boolean;
  message?: string;
};

type PollStatus = "PENDING" | "SUCCESS" | "FAILED";

export default function Withdraw() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const withdrawMutation = useCreateWithdrawal();
  const [feeBearer, setFeeBearer] = useState<FeeBearer>("SENDER");
  const [feePreview, setFeePreview] = useState<FeePreview | null>(null);
  const [pendingResult, setPendingResult] = useState<WithdrawResult | null>(null);
  const [pollStatus, setPollStatus] = useState<PollStatus>("PENDING");

  // ─── Crypto withdraw mode ─────────────────────────────────────────────────
  const [withdrawMode, setWithdrawMode] = useState<"mobile" | "crypto">("mobile");
  const [cryptoAddress, setCryptoAddress] = useState("");
  const [cryptoAmount, setCryptoAmount] = useState("10");
  const [cryptoNetwork, setCryptoNetwork] = useState<"TRC20" | "ERC20">("TRC20");
  const [cryptoLoading, setCryptoLoading] = useState(false);

  const handleCryptoWithdraw = async () => {
    const amt = parseFloat(cryptoAmount);
    if (!amt || amt < 1) { toast({ variant: "destructive", title: "Montant invalide", description: "Minimum 1 USDT" }); return; }
    if (!cryptoAddress || cryptoAddress.length < 20) { toast({ variant: "destructive", title: "Adresse invalide", description: "Veuillez saisir une adresse crypto valide" }); return; }
    setCryptoLoading(true);
    try {
      const res = await customFetch<{ address: string; netAmount: number; fee: number; message: string }>(
        "/api/transactions/crypto-withdraw",
        { method: "POST", body: JSON.stringify({ amountUsdt: amt, address: cryptoAddress, network: cryptoNetwork }) }
      );
      toast({ title: "Retrait initié ✓", description: res.message });
      refreshWallet();
      setLocation("/dashboard");
    } catch (err: any) {
      const raw = err?.error?.message || err?.message || "Erreur";
      toast({ variant: "destructive", title: "Échec du retrait", description: raw.replace(/^HTTP\s+\d+\s+[^:]+:\s*/i, "") });
    } finally {
      setCryptoLoading(false);
    }
  };

  const refreshWallet = useCallback(() => {
    qc.invalidateQueries({ queryKey: getGetWalletsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  }, [qc]);

  // Polling: check status every 3s until resolved
  useEffect(() => {
    if (!pendingResult) return;
    setPollStatus("PENDING");
    const txId = pendingResult.transaction.id;
    const interval = setInterval(async () => {
      try {
        const tx = await customFetch<{ status: string }>(`/api/transactions/${txId}`);
        if (tx.status === "SUCCESS") {
          setPollStatus("SUCCESS");
          refreshWallet();
          clearInterval(interval);
        } else if (tx.status === "FAILED") {
          setPollStatus("FAILED");
          refreshWallet();
          clearInterval(interval);
        }
      } catch { /* silent */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [pendingResult, refreshWallet]);

  const form = useForm<WithdrawFormValues>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: { amount: 1000, country: "", operator: "", phone: "" },
  });

  const amount   = form.watch("amount");
  const country  = form.watch("country");
  const operator = form.watch("operator");

  const selectedCountry = COUNTRIES.find((c) => c.code === country);
  const operators = selectedCountry?.operators ?? [];
  const flow = operator ? getOperatorFlow(operator) : null;

  useEffect(() => {
    form.setValue("operator", "");
    setFeePreview(null);
    setPendingResult(null);
  }, [country]);

  // Instant local recalculation using the cached rate when only amount changes
  useEffect(() => {
    if (!feePreview || !amount || amount < 100) return;
    const amt = Number(amount);
    const feeAmount = Math.max(Math.round(amt * feePreview.feeRate), 1);
    const netAmount = Math.max(amt + feeAmount, 0);
    setFeePreview((prev) =>
      prev ? { ...prev, grossAmount: amt, feeAmount, netAmount } : null
    );
  }, [amount]); // eslint-disable-line react-hooks/exhaustive-deps

  // API call for accurate rate (debounced, fires on operator/country change too)
  useEffect(() => {
    if (!amount || amount < 100 || !country || !operator) return;
    let active = true;
    const id = setTimeout(async () => {
      try {
        const { getFeePreview } = await import("@workspace/api-client-react");
        const res = await getFeePreview({ amount, country, operator, type: "WITHDRAWAL" });
        if (active) setFeePreview(res as FeePreview);
      } catch { /* silent */ }
    }, 200);
    return () => { active = false; clearTimeout(id); };
  }, [amount, country, operator]);

  const onSubmit = (data: WithdrawFormValues) => {
    const currency = selectedCountry?.currency ?? "XAF";
    withdrawMutation.mutate(
      { data: { amount: data.amount, currency, country: data.country, operator: data.operator, phone: data.phone, feeBearer } },
      {
        onSuccess: (res) => {
          const result = res as WithdrawResult;
          if (result.pending) {
            setPendingResult(result);
            toast({
              title: "Retrait initié",
              description: result.smsLink
                ? "Cliquez sur le lien Wave pour finaliser votre retrait."
                : "Transaction en attente — votre opérateur va traiter le retrait.",
            });
          } else {
            toast({
              title: "Retrait soumis",
              description: `Retrait de ${formatCurrency(result.transaction.amount, result.transaction.currency)} soumis.`,
              variant: result.transaction.status === "FAILED" ? "destructive" : "default",
            });
            setLocation("/dashboard");
          }
        },
        onError: (err: unknown) => {
          const raw =
            (err as { error?: { message?: string } })?.error?.message ||
            (err as { message?: string })?.message ||
            "Une erreur s'est produite lors du traitement.";
          const msg = raw.replace(/^HTTP\s+\d+\s+[^:]+:\s*/i, "");
          toast({ variant: "destructive", title: "Échec du retrait", description: msg });
        },
      }
    );
  };

  const currency = feePreview?.currency ?? selectedCountry?.currency ?? "";

  // Show pending / Wave result screen
  if (pendingResult) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {pollStatus === "SUCCESS" ? (
                <span className="text-emerald-500">✓</span>
              ) : pollStatus === "FAILED" ? (
                <span className="text-rose-500">✗</span>
              ) : (
                <Clock className="h-5 w-5 text-amber-500" />
              )}
              {pollStatus === "SUCCESS"
                ? "Retrait confirmé !"
                : pollStatus === "FAILED"
                ? "Retrait échoué"
                : "Retrait en cours de traitement"}
            </CardTitle>
            <CardDescription>
              {pollStatus === "SUCCESS"
                ? "Les fonds ont bien été envoyés sur votre compte Mobile Money."
                : pollStatus === "FAILED"
                ? "Le retrait a échoué. Votre solde wallet a été automatiquement recrédité."
                : "Votre demande a été transmise à l'opérateur. Vérification toutes les 3 secondes."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Spinner while PENDING */}
            {pollStatus === "PENDING" && (
              <div className="flex flex-col items-center gap-2 py-4">
                <div className="relative w-16 h-16">
                  <svg className="w-16 h-16 animate-spin" viewBox="0 0 64 64" fill="none">
                    <circle cx="32" cy="32" r="28" stroke="#e5e7eb" strokeWidth="6" />
                    <path d="M32 4 a28 28 0 0 1 28 28" stroke="#f59e0b" strokeWidth="6" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="text-xs text-muted-foreground">Vérification automatique toutes les 3s</p>
              </div>
            )}

            {/* Wave link */}
            {pollStatus === "PENDING" && pendingResult.smsLink && (
              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                <ExternalLink className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-700 dark:text-blue-300">Confirmation Wave requise</AlertTitle>
                <AlertDescription className="text-blue-600 dark:text-blue-400 mt-2">
                  <p className="mb-3">Ouvrez le lien ci-dessous pour confirmer votre retrait Wave.</p>
                  <a
                    href={pendingResult.smsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Confirmer avec Wave
                  </a>
                </AlertDescription>
              </Alert>
            )}

            {pollStatus === "PENDING" && !pendingResult.smsLink && (
              <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
                <Info className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-700 dark:text-amber-300">Retrait en cours</AlertTitle>
                <AlertDescription className="text-amber-600 dark:text-amber-400">
                  Les fonds seront envoyés sur votre numéro Mobile Money. En cas d'échec, votre solde sera automatiquement recrédité.
                </AlertDescription>
              </Alert>
            )}

            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Statut</span>
                <span className={`font-medium ${
                  pollStatus === "SUCCESS" ? "text-emerald-600"
                  : pollStatus === "FAILED" ? "text-rose-600"
                  : "text-amber-600"
                }`}>
                  {pollStatus === "SUCCESS" ? "Confirmé" : pollStatus === "FAILED" ? "Échoué" : "En attente"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Opérateur</span>
                <span className="font-medium">{OPERATOR_LABELS[operator] ?? operator}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Montant</span>
                <span className="font-medium">{formatCurrency(pendingResult.transaction.amount, pendingResult.transaction.currency)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button variant="outline" className="w-full" onClick={() => setLocation("/dashboard")}>
                Retour au dashboard
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setLocation("/transactions")}>
                Voir mes transactions
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* ── Mode Toggle ── */}
      <div className="flex rounded-xl border border-input overflow-hidden bg-muted/40 p-1 gap-1">
        <button type="button" onClick={() => setWithdrawMode("mobile")}
          className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${withdrawMode === "mobile" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          Mobile Money
        </button>
        <button type="button" onClick={() => setWithdrawMode("crypto")}
          className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${withdrawMode === "crypto" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          <span>Retrait Crypto</span>
          <Badge className="bg-cyan-500/15 text-cyan-600 border-cyan-300/40 text-[10px] px-1.5 py-0">USDT</Badge>
        </button>
      </div>

      {/* ── Crypto Withdraw Form ── */}
      {withdrawMode === "crypto" && (
        <Card>
          <CardHeader>
            <CardTitle>Retrait USDT vers crypto</CardTitle>
            <CardDescription>
              Retirez vos USDT vers une adresse externe. Frais 1%. Disponible sur TRC-20 (Tron) et ERC-20 (Ethereum).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <label className="text-sm font-medium block mb-1.5">Réseau</label>
              <div className="flex gap-2">
                {(["TRC20", "ERC20"] as const).map((n) => (
                  <button key={n} type="button"
                    onClick={() => setCryptoNetwork(n)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-all ${cryptoNetwork === n ? "border-cyan-500 bg-cyan-500/10 text-cyan-700" : "border-input text-muted-foreground hover:bg-muted"}`}>
                    {n === "TRC20" ? "TRC-20 (Tron)" : "ERC-20 (Ethereum)"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Adresse {cryptoNetwork} de destination</label>
              <input
                type="text"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={cryptoAddress}
                onChange={(e) => setCryptoAddress(e.target.value)}
                placeholder={cryptoNetwork === "TRC20" ? "Txxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" : "0x..."}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Montant USDT à retirer</label>
              <input
                type="number"
                min="1"
                step="0.01"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={cryptoAmount}
                onChange={(e) => setCryptoAmount(e.target.value)}
                placeholder="10"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Vous recevrez ≈ {(parseFloat(cryptoAmount || "0") * 0.99).toFixed(4)} USDT après frais (1%).
              </p>
            </div>
            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-700 dark:text-amber-300 text-sm">Vérifiez l'adresse</AlertTitle>
              <AlertDescription className="text-amber-600 dark:text-amber-400 text-xs mt-1">
                Assurez-vous que l'adresse est sur le réseau <strong>{cryptoNetwork === "TRC20" ? "TRC-20 (Tron)" : "ERC-20 (Ethereum)"}</strong>. Les fonds envoyés sur un mauvais réseau sont irrécupérables.
              </AlertDescription>
            </Alert>
            <Button className="w-full bg-cyan-600 hover:bg-cyan-700" onClick={handleCryptoWithdraw} disabled={cryptoLoading}>
              {cryptoLoading ? "Traitement en cours..." : "Retirer les USDT"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Mobile Money Form ── */}
      {withdrawMode === "mobile" && <Card>
        <CardHeader>
          <CardTitle>Retrait de fonds</CardTitle>
          <CardDescription>
            Retirez des fonds de votre portefeuille vers un compte Mobile Money.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              {/* Toggle : Qui paie les frais ? */}
              <div>
                <p className="text-sm font-medium mb-2">Qui paie les frais ?</p>
                <div className="flex rounded-lg border border-input overflow-hidden w-full">
                  <button
                    type="button"
                    onClick={() => setFeeBearer("SENDER")}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${
                      feeBearer === "SENDER"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Moi (envoyeur)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeeBearer("RECIPIENT")}
                    className={`flex-1 py-2 text-sm font-medium transition-colors border-l border-input ${
                      feeBearer === "RECIPIENT"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Destinataire
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {feeBearer === "SENDER"
                    ? "Votre wallet supporte les frais — le destinataire reçoit le montant exact."
                    : "Le destinataire supporte les frais — votre wallet est débité du montant exact saisi."}
                </p>
              </div>

              {/* Pays */}
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pays</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-country">
                          <SelectValue placeholder="Sélectionner un pays" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            <span className="flex items-center gap-2">
                              <span>{c.flag}</span>
                              <span>{c.name}</span>
                              <span className="text-muted-foreground text-xs">{c.currency}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Opérateur */}
              {operators.length > 0 && (
                <FormField
                  control={form.control}
                  name="operator"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Opérateur destinataire</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-operator">
                            <SelectValue placeholder="Sélectionner un opérateur" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {operators.map((op) => (
                            <SelectItem key={op} value={op}>
                              {OPERATOR_LABELS[op] ?? op}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Instructions spécifiques à l'opérateur */}
              {flow === "WAVE" && (
                <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-blue-700 dark:text-blue-300">Retrait Wave</AlertTitle>
                  <AlertDescription className="text-blue-600 dark:text-blue-400 text-sm mt-1">
                    Après validation, un lien Wave vous sera fourni pour confirmer le retrait depuis votre application Wave.
                  </AlertDescription>
                </Alert>
              )}

              {flow === "STANDARD" && operator && (
                <Alert className="border-muted bg-muted/30">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <AlertTitle className="text-sm">Retrait Mobile Money</AlertTitle>
                  <AlertDescription className="text-muted-foreground text-sm mt-1">
                    Les fonds seront envoyés directement sur le numéro {OPERATOR_LABELS[operator] ?? operator} indiqué. En cas d'échec, votre solde sera automatiquement recrédité.
                  </AlertDescription>
                </Alert>
              )}

              {/* Téléphone */}
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Numéro Mobile Money destinataire</FormLabel>
                    <FormControl>
                      <div className="flex">
                        {selectedCountry && (
                          <div className="flex items-center px-3 border border-r-0 border-input rounded-l-md bg-muted text-sm text-muted-foreground font-medium select-none">
                            {selectedCountry.dialCode}
                          </div>
                        )}
                        <Input
                          type="tel"
                          placeholder="600 000 000"
                          className={selectedCountry ? "rounded-l-none" : ""}
                          data-testid="input-phone"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>Le numéro qui recevra les fonds.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Montant */}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {feeBearer === "SENDER"
                        ? `Montant que le destinataire recevra${currency ? ` (${currency})` : ""}`
                        : `Montant total à débiter de votre wallet${currency ? ` (${currency})` : ""}`}
                    </FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="1000" data-testid="input-amount" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Résumé frais */}
              {feePreview && (
                <div className="bg-muted rounded-lg p-4 space-y-2 border border-border">
                  <h4 className="text-sm font-semibold mb-3">Résumé de la transaction</h4>

                  {feeBearer === "SENDER" ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Montant reçu par le destinataire</span>
                        <span>{formatCurrency(feePreview.grossAmount, feePreview.currency)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Frais ({(feePreview.feeRate * 100).toFixed(1)}%) — à votre charge</span>
                        <span className="text-rose-500">+ {formatCurrency(feePreview.feeAmount, feePreview.currency)}</span>
                      </div>
                      <Separator className="my-2" />
                      <div className="flex justify-between font-semibold">
                        <span>Total débité de votre wallet</span>
                        <span className="text-rose-600">{formatCurrency(feePreview.netAmount, feePreview.currency)}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Montant débité de votre wallet</span>
                        <span>{formatCurrency(feePreview.grossAmount, feePreview.currency)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Frais ({(feePreview.feeRate * 100).toFixed(1)}%) — à charge du destinataire</span>
                        <span className="text-rose-500">− {formatCurrency(feePreview.feeAmount, feePreview.currency)}</span>
                      </div>
                      <Separator className="my-2" />
                      <div className="flex justify-between font-semibold">
                        <span>Le destinataire reçoit</span>
                        <span className="text-emerald-600">
                          {formatCurrency(Math.max(feePreview.grossAmount - feePreview.feeAmount, 0), feePreview.currency)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={withdrawMutation.isPending || !country || !operator}
                data-testid="button-submit-withdraw"
              >
                {withdrawMutation.isPending ? "Traitement en cours..." : "Initier le retrait"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>}
    </div>
  );
}
