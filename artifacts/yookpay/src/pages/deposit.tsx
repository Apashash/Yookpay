import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateDeposit, customFetch, getGetWalletsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
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
import { ExternalLink, Clock, Info } from "lucide-react";

type FeeBearer = "SENDER" | "RECIPIENT";

const depositSchema = z.object({
  amount:   z.coerce.number().min(100, "Montant minimum : 100"),
  country:  z.string().min(2, "Veuillez sélectionner un pays"),
  operator: z.string().min(2, "Veuillez sélectionner un opérateur"),
  phone:    z.string().min(6, "Numéro de téléphone invalide"),
  omOtp:    z.string().optional(),
});

type DepositFormValues = z.infer<typeof depositSchema>;

type FeePreview = {
  grossAmount: number;
  feeRate: number;
  feeAmount: number;
  netAmount: number;
  currency: string;
};

type DepositResult = {
  transaction: { id: number; amount: number; currency: string; status: string };
  flow?: string;
  smsLink?: string | null;
  pending?: boolean;
  message?: string;
};

type PollStatus = "PENDING" | "SUCCESS" | "FAILED";

const COUNTDOWN_SECONDS = 8 * 60; // 8 minutes
const CIRCLE_RADIUS = 52;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

function formatMMSS(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function Deposit() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const depositMutation = useCreateDeposit();
  const [feeBearer, setFeeBearer] = useState<FeeBearer>("SENDER");
  const [feePreview, setFeePreview] = useState<FeePreview | null>(null);
  const [pendingResult, setPendingResult] = useState<DepositResult | null>(null);
  const [pollStatus, setPollStatus] = useState<PollStatus>("PENDING");
  const [timeLeft, setTimeLeft] = useState(COUNTDOWN_SECONDS);

  const refreshWallet = useCallback(() => {
    qc.invalidateQueries({ queryKey: getGetWalletsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  }, [qc]);

  // Countdown: 8-minute visual timer (server handles actual expiry via background worker)
  useEffect(() => {
    if (!pendingResult) return;
    setPollStatus("PENDING");
    setTimeLeft(COUNTDOWN_SECONDS);
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [pendingResult]);

  // Polling: check status every 3s until resolved
  useEffect(() => {
    if (!pendingResult) return;
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
          clearInterval(interval);
        }
      } catch { /* silent — network hiccup, retry next tick */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [pendingResult, refreshWallet]);

  const form = useForm<DepositFormValues>({
    resolver: zodResolver(depositSchema),
    defaultValues: { amount: 1000, country: "", operator: "", phone: "", omOtp: "" },
  });

  const amount   = form.watch("amount");
  const country  = form.watch("country");
  const operator = form.watch("operator");

  const selectedCountry = COUNTRIES.find((c) => c.code === country);
  const operators = selectedCountry?.operators ?? [];
  const flow = operator ? getOperatorFlow(operator) : null;

  useEffect(() => {
    form.setValue("operator", "");
    form.setValue("omOtp", "");
    setFeePreview(null);
    setPendingResult(null);
  }, [country]);

  useEffect(() => {
    form.setValue("omOtp", "");
  }, [operator]);

  // Instant local recalculation using the cached rate when only amount changes
  useEffect(() => {
    if (!feePreview || !amount || amount < 100) return;
    const feeAmount = Math.max(Math.round(amount * feePreview.feeRate), 1);
    const netAmount = Math.max(amount - feeAmount, 0);
    setFeePreview((prev) =>
      prev ? { ...prev, grossAmount: Number(amount), feeAmount: Number(feeAmount), netAmount: Number(netAmount) } : null
    );
  }, [amount]); // eslint-disable-line react-hooks/exhaustive-deps

  // API call for accurate rate (debounced, fires on operator/country change too)
  useEffect(() => {
    if (!amount || amount < 100 || !country || !operator) return;
    let active = true;
    const id = setTimeout(async () => {
      try {
        const { getFeePreview } = await import("@workspace/api-client-react");
        const res = await getFeePreview({ amount, country, operator, type: "DEPOSIT" });
        if (active) setFeePreview(res as FeePreview);
      } catch { /* silent */ }
    }, 200);
    return () => { active = false; clearTimeout(id); };
  }, [amount, country, operator]);

  const onSubmit = (data: DepositFormValues) => {
    const body: Record<string, unknown> = {
      amount: data.amount,
      country: data.country,
      operator: data.operator,
      phone: data.phone,
      feeBearer,
    };
    // Cameroon: OTP silently sent as "0000" — user doesn't need to enter it
    const isCmOtp = flow === "OTP" && data.country === "CM";
    const otpToSend = isCmOtp ? "0000" : data.omOtp;
    if (otpToSend) body["omOtp"] = otpToSend;

    depositMutation.mutate(
      { data: body as Parameters<typeof depositMutation.mutate>[0]["data"] },
      {
        onSuccess: (res) => {
          const result = res as DepositResult;
          if (result.pending) {
            setPendingResult(result);
            toast({
              title: "Dépôt initié",
              description: result.smsLink
                ? "Cliquez sur le lien Wave pour finaliser votre paiement."
                : "Transaction en attente — vous recevrez une confirmation par SMS.",
            });
          } else {
            toast({
              title: "Dépôt envoyé",
              description: `Dépôt de ${formatCurrency(result.transaction.amount, result.transaction.currency)} soumis.`,
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
          toast({ variant: "destructive", title: "Échec du dépôt", description: msg });
        },
      }
    );
  };

  const currency = feePreview?.currency ?? selectedCountry?.currency ?? "";

  // Show pending / Wave result screen
  if (pendingResult) {
    const dashOffset = CIRCLE_CIRCUMFERENCE * (1 - timeLeft / COUNTDOWN_SECONDS);
    const circleColor =
      pollStatus === "SUCCESS" ? "#22c55e"
      : pollStatus === "FAILED" ? "#ef4444"
      : timeLeft > 240 ? "#22c55e"   // > 4 min → vert
      : timeLeft > 60  ? "#f59e0b"   // > 1 min → orange
      : "#ef4444";                    // ≤ 1 min → rouge

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
                ? "Dépôt confirmé !"
                : pollStatus === "FAILED"
                ? "Dépôt échoué"
                : "Confirmation en attente"}
            </CardTitle>
            <CardDescription>
              {pollStatus === "SUCCESS"
                ? "Votre wallet a été crédité avec succès."
                : pollStatus === "FAILED"
                ? "Le paiement n'a pas été validé dans le délai imparti. Votre wallet n'a pas été débité."
                : "Confirmez le paiement sur votre téléphone. Le statut se met à jour automatiquement."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* SVG Countdown Circle — visible only while PENDING */}
            {pollStatus === "PENDING" && (
              <div className="flex flex-col items-center gap-1 my-2">
                <svg width="140" height="140" viewBox="0 0 140 140">
                  <circle cx="70" cy="70" r={CIRCLE_RADIUS} fill="none" stroke="#e5e7eb" strokeWidth="8" />
                  <circle
                    cx="70" cy="70" r={CIRCLE_RADIUS}
                    fill="none"
                    stroke={circleColor}
                    strokeWidth="8"
                    strokeDasharray={CIRCLE_CIRCUMFERENCE}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    transform="rotate(-90 70 70)"
                    style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s ease" }}
                  />
                  <text x="70" y="66" textAnchor="middle" fontSize="22" fontWeight="bold" fill="currentColor">
                    {formatMMSS(timeLeft)}
                  </text>
                  <text x="70" y="84" textAnchor="middle" fontSize="10" fill="#9ca3af">restantes</text>
                </svg>
                <p className="text-xs text-muted-foreground text-center">Vérification automatique toutes les 3s</p>
              </div>
            )}

            {/* Safe navigation notice */}
            {pollStatus === "PENDING" && (
              <Alert className="border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20">
                <Info className="h-4 w-4 text-emerald-600" />
                <AlertTitle className="text-emerald-700 dark:text-emerald-300 text-sm">Vous pouvez quitter cette page</AlertTitle>
                <AlertDescription className="text-emerald-600 dark:text-emerald-400 text-xs mt-0.5">
                  Votre paiement continuera d'être traité en arrière-plan. Consultez vos transactions pour suivre l'état.
                </AlertDescription>
              </Alert>
            )}

            {/* Wave SMS link */}
            {pollStatus === "PENDING" && pendingResult.smsLink && (
              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                <ExternalLink className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-700 dark:text-blue-300">Paiement Wave requis</AlertTitle>
                <AlertDescription className="text-blue-600 dark:text-blue-400 mt-2">
                  <p className="mb-3">Ouvrez le lien ci-dessous pour finaliser votre paiement Wave.</p>
                  <a
                    href={pendingResult.smsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Payer avec Wave
                  </a>
                </AlertDescription>
              </Alert>
            )}

            {/* Standard / OTP instructions */}
            {pollStatus === "PENDING" && !pendingResult.smsLink && pendingResult.flow === "STANDARD" && (
              <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
                <Info className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-700 dark:text-amber-300">Confirmation Mobile Money requise</AlertTitle>
                <AlertDescription className="text-amber-600 dark:text-amber-400">
                  Vous allez recevoir une invitation SMS ou USSD de votre opérateur. Confirmez pour finaliser le dépôt.
                </AlertDescription>
              </Alert>
            )}

            {pollStatus === "PENDING" && !pendingResult.smsLink && pendingResult.flow === "OTP" && (
              <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
                <Info className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-700 dark:text-amber-300">Transaction Orange Money en attente</AlertTitle>
                <AlertDescription className="text-amber-600 dark:text-amber-400 space-y-1">
                  <p>Vous recevrez une notification sur votre téléphone — entrez votre PIN pour confirmer la transaction.</p>
                  <p className="text-xs opacity-80">Si vous ne recevez pas la notification, composez le code USSD de votre opérateur pour confirmer manuellement.</p>
                </AlertDescription>
              </Alert>
            )}

            {/* Transaction summary */}
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
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Dépôt de fonds</CardTitle>
          <CardDescription>
            Alimentez votre portefeuille via Mobile Money. Les fonds seront crédités dans la devise correspondante.
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
                    Envoyeur
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
                    Destinataire (moi)
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {feeBearer === "SENDER"
                    ? "L'envoyeur supporte les frais — vous recevez le montant net."
                    : "Vous supportez les frais — l'envoyeur envoie le montant exact que vous saisissez."}
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
                      <FormLabel>Opérateur Mobile Money</FormLabel>
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

              {/* Instructions spécifiques à l'opérateur — OTP masqué pour le Cameroun */}
              {flow === "OTP" && country !== "CM" && (
                <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
                  <Info className="h-4 w-4 text-orange-600" />
                  <AlertTitle className="text-orange-700 dark:text-orange-300">Code OTP Orange Money requis</AlertTitle>
                  <AlertDescription className="text-orange-600 dark:text-orange-400 text-sm mt-1">
                    Composez <strong>#144*82#</strong> depuis votre téléphone Orange pour générer un code OTP à 6 chiffres. Saisissez-le ci-dessous.
                  </AlertDescription>
                </Alert>
              )}

              {flow === "WAVE" && (
                <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-blue-700 dark:text-blue-300">Paiement Wave</AlertTitle>
                  <AlertDescription className="text-blue-600 dark:text-blue-400 text-sm mt-1">
                    Après validation, vous serez redirigé vers un lien de paiement Wave. Assurez-vous que l'application Wave est installée sur votre téléphone.
                  </AlertDescription>
                </Alert>
              )}

              {flow === "STANDARD" && operator && (
                <Alert className="border-muted bg-muted/30">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <AlertTitle className="text-sm">Confirmation par SMS</AlertTitle>
                  <AlertDescription className="text-muted-foreground text-sm mt-1">
                    Après validation, vous recevrez une invitation SMS ou USSD de {OPERATOR_LABELS[operator] ?? operator} pour confirmer le paiement.
                  </AlertDescription>
                </Alert>
              )}

              {flow === "QMONEY" && (
                <Alert className="border-muted bg-muted/30">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <AlertTitle className="text-sm">Paiement QMoney</AlertTitle>
                  <AlertDescription className="text-muted-foreground text-sm mt-1">
                    Vous recevrez un OTP de QMoney pour confirmer votre transaction.
                  </AlertDescription>
                </Alert>
              )}

              {/* Téléphone */}
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Numéro Mobile Money</FormLabel>
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
                    <FormDescription>Le numéro à débiter.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* OTP Orange Money — masqué pour le Cameroun (envoyé en arrière-plan) */}
              {flow === "OTP" && country !== "CM" && (
                <FormField
                  control={form.control}
                  name="omOtp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code OTP Orange Money</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="123456"
                          data-testid="input-otp"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Code à 6 chiffres obtenu en composant <strong>#144*82#</strong>.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Montant */}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {feeBearer === "SENDER"
                        ? `Montant à créditer dans votre wallet${currency ? ` (${currency})` : ""}`
                        : `Montant prélevé sur le téléphone${currency ? ` (${currency})` : ""}`}
                    </FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="1000" data-testid="input-amount" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Résumé frais — calcul correct selon feeBearer */}
              {feePreview && (() => {
                const amt = Number(amount) || 0;
                const fee = Math.max(Math.round(amt * feePreview.feeRate), 1);
                // SENDER pays: phone charged amt+fee, wallet gets amt (entered)
                // RECIPIENT pays: phone charged amt (entered), wallet gets amt-fee
                const phoneCharged  = feeBearer === "SENDER" ? amt + fee : amt;
                const walletCredit  = feeBearer === "SENDER" ? amt        : Math.max(amt - fee, 0);
                return (
                  <div className="bg-muted rounded-lg p-4 space-y-2 border border-border">
                    <h4 className="text-sm font-semibold mb-3">Résumé de la transaction</h4>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Montant prélevé sur le téléphone</span>
                      <span>{formatCurrency(phoneCharged, feePreview.currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Frais YookPay ({(feePreview.feeRate * 100).toFixed(1)}%)
                        {feeBearer === "SENDER" ? " — à charge de l'envoyeur" : " — à votre charge"}
                      </span>
                      <span className="text-rose-500">− {formatCurrency(fee, feePreview.currency)}</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between font-semibold">
                      <span>Vous recevrez dans le wallet</span>
                      <span className="text-emerald-600">{formatCurrency(walletCredit, feePreview.currency)}</span>
                    </div>
                  </div>
                );
              })()}

              <Button
                type="submit"
                className="w-full"
                disabled={depositMutation.isPending || !country || !operator || (flow === "OTP" && country !== "CM" && !form.watch("omOtp"))}
                data-testid="button-submit-deposit"
              >
                {depositMutation.isPending ? "Traitement en cours..." : "Initier le dépôt"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
