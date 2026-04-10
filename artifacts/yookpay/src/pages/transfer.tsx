import { useState, useEffect, useCallback } from "react";
import { KycGate } from "@/components/kyc-gate";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useGetWallets,
  customFetch,
} from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getGetWalletsQueryKey } from "@workspace/api-client-react";

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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, Info, Loader2, Lock } from "lucide-react";

// ─── Exchange Step 1 Form (fiat → USDT) ──────────────────────────────────────
const step1Schema = z.object({
  fromCurrency: z.enum(["XAF", "XOF", "CDF"]),
  amount: z.coerce.number().positive("Montant requis"),
});
type Step1Values = z.infer<typeof step1Schema>;

// ─── Exchange Step 2 Form (USDT → fiat) ──────────────────────────────────────
const step2Schema = z.object({
  amountUsdt: z.coerce.number().min(1, "Minimum 1 USDT"),
  toCurrency: z.enum(["XAF", "XOF", "CDF"]),
});
type Step2Values = z.infer<typeof step2Schema>;

type FxInfo = { rate: number; converted: number; minAmount: number; feeRate: number } | null;

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Transfer() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: wallets } = useGetWallets();

  const [exchangeStep, setExchangeStep] = useState<1 | 2>(1);
  const [step1Loading, setStep1Loading] = useState(false);
  const [step2Loading, setStep2Loading] = useState(false);
  const [fxInfo, setFxInfo] = useState<FxInfo>(null);
  const [fxLoading, setFxLoading] = useState(false);

  const refreshWallets = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetWalletsQueryKey() });
  }, [queryClient]);

  // ─── Exchange Step 1 form ───────────────────────────────────────────────────
  const step1Form = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: { fromCurrency: "XAF", amount: 16000 },
  });
  const fromCurrency = step1Form.watch("fromCurrency");
  const step1Amount = step1Form.watch("amount");

  // Reset fxInfo when currency changes so stale data from another currency never shows
  useEffect(() => {
    setFxInfo(null);
  }, [fromCurrency]);

  // Fetch FX rate for step 1 (debounced 500ms)
  useEffect(() => {
    if (!fromCurrency || !step1Amount || step1Amount <= 0) return;
    let active = true;
    setFxLoading(true);
    const id = setTimeout(async () => {
      try {
        const data = await customFetch<{ rate: number; converted: number; minAmount: number; feeRate: number }>(
          `/api/transactions/fx-rate?from=${fromCurrency}&to=USDT&amount=${step1Amount}`
        );
        if (active) setFxInfo(data);
      } catch { if (active) setFxLoading(false); return; } finally {
        if (active) setFxLoading(false);
      }
    }, 500);
    return () => { active = false; clearTimeout(id); };
  }, [fromCurrency, step1Amount]);

  const onSubmitStep1 = async (data: Step1Values) => {
    if (fxInfo && data.amount < fxInfo.minAmount) {
      step1Form.setError("amount", { message: `Montant minimum : ${fxInfo.minAmount.toLocaleString("en-US")} ${data.fromCurrency}` });
      return;
    }
    setStep1Loading(true);
    try {
      const res = await customFetch<{ usdtAmount: number; fromAmount: number; rate: number; fee: number; message: string }>(
        "/api/transactions/exchange-step1",
        { method: "POST", body: JSON.stringify({ fromCurrency: data.fromCurrency, amount: data.amount }) }
      );
      toast({ title: "Échange Step 1 ✓", description: res.message });
      refreshWallets();
      setExchangeStep(2);
    } catch (err: any) {
      const raw = err?.error?.message || err?.message || "Erreur lors de l'échange";
      toast({ variant: "destructive", title: "Échec de l'échange", description: raw.replace(/^HTTP\s+\d+[^:]*:\s*/i, "") });
    } finally {
      setStep1Loading(false);
    }
  };

  // ─── Exchange Step 2 form ───────────────────────────────────────────────────
  const step2Form = useForm<Step2Values>({
    resolver: zodResolver(step2Schema),
    defaultValues: { amountUsdt: 1, toCurrency: "XAF" },
  });
  const step2Usdt = step2Form.watch("amountUsdt");
  const toCurrency = step2Form.watch("toCurrency");

  const [fxInfo2, setFxInfo2] = useState<FxInfo>(null);
  useEffect(() => {
    if (!step2Usdt || step2Usdt <= 0) return;
    let active = true;
    const id = setTimeout(async () => {
      try {
        const data = await customFetch<{ rate: number; converted: number; minAmount: number }>(
          `/api/transactions/fx-rate?from=USDT&to=${toCurrency}&amount=${step2Usdt}`
        );
        if (active) setFxInfo2(data);
      } catch { /* silent */ }
    }, 400);
    return () => { active = false; clearTimeout(id); };
  }, [step2Usdt, toCurrency]);

  const onSubmitStep2 = async (data: Step2Values) => {
    setStep2Loading(true);
    try {
      const res = await customFetch<{ estimatedFiat: number; amountUsdt: number; toCurrency: string; message: string }>(
        "/api/transactions/exchange-step2",
        { method: "POST", body: JSON.stringify(data) }
      );
      toast({ title: "Demande envoyée ✓", description: res.message });
      refreshWallets();
      setLocation("/dashboard");
    } catch (err: any) {
      const raw = err?.error?.message || err?.message || "Erreur";
      toast({ variant: "destructive", title: "Échec", description: raw.replace(/^HTTP\s+\d+[^:]*:\s*/i, "") });
    } finally {
      setStep2Loading(false);
    }
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const getBalance = (currency: string) => {
    const w = wallets?.find(w => w.currency === currency);
    return w ? parseFloat(w.balance as unknown as string) : 0;
  };

  const usdtBalance = getBalance("USDT");

  const FIAT_CURRENCIES = [
    { value: "XAF", label: "XAF — Franc CFA (CEMAC)" },
    { value: "XOF", label: "XOF — Franc CFA (UEMOA)" },
    { value: "CDF", label: "CDF — Franc Congolais" },
  ];

  return (
    <KycGate level="kyc">
    <div className="max-w-2xl mx-auto space-y-4">

      {/* Page header */}
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold">Échange USDT</h1>
        <Badge className="bg-cyan-500/15 text-cyan-600 border-cyan-300/40 text-[10px] px-1.5 py-0">CRYPTO</Badge>
      </div>

      {/* Progress stepper */}
      <div className="flex items-center gap-2 px-1">
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
              exchangeStep === s
                ? "bg-cyan-600 text-white"
                : s < exchangeStep
                ? "bg-emerald-500 text-white"
                : "bg-muted text-muted-foreground"
            }`}>
              {s < exchangeStep ? "✓" : s}
            </div>
            <div className="flex-1">
              <p className={`text-xs font-semibold ${exchangeStep >= s ? "text-foreground" : "text-muted-foreground"}`}>
                {s === 1 ? "Fiat → USDT" : "USDT → Fiat"}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {s === 1 ? "Automatique" : "Confirmation admin 24-48h"}
              </p>
            </div>
            {s < 2 && <ArrowRight className="w-4 h-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* USDT wallet balance display */}
      <div className="rounded-xl bg-gradient-to-br from-cyan-600 via-sky-600 to-blue-700 p-4 text-white flex items-center justify-between">
        <div>
          <p className="text-xs text-white/70 font-medium mb-0.5">Wallet USDT</p>
          <p className="text-2xl font-extrabold">{formatCurrency(usdtBalance, "USDT")}</p>
        </div>
        <div className="text-right">
          <Badge className="bg-white/15 text-white border-white/20">TRC-20</Badge>
        </div>
      </div>

      {/* ─── Step 1: Fiat → USDT ─── */}
      {exchangeStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-cyan-600 text-white text-xs flex items-center justify-center font-bold">1</span>
              Convertir Fiat → USDT
            </CardTitle>
            <CardDescription>
              Vos fonds XAF/XOF/CDF seront immédiatement convertis en USDT au taux du marché.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...step1Form}>
              <form onSubmit={step1Form.handleSubmit(onSubmitStep1)} className="space-y-5">
                <FormField
                  control={step1Form.control}
                  name="fromCurrency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Devise source</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent modal={false}>
                          {FIAT_CURRENCIES.map(c => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.value} — Solde : {formatCurrency(getBalance(c.value), c.value)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={step1Form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Montant à convertir ({fromCurrency})</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="16000" {...field} />
                      </FormControl>
                      {fxInfo && (
                        <FormDescription className="text-xs">
                          Minimum : {fxInfo.minAmount.toLocaleString("en-US")} {fromCurrency} (≈ {(fxInfo.minAmount * fxInfo.rate).toFixed(2)} USDT)
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* FX Rate Preview — always visible when amount > 0 */}
                {step1Amount > 0 && (
                  <div className="rounded-lg border border-cyan-200 bg-cyan-50 dark:bg-cyan-900/20 dark:border-cyan-700/30 p-4 space-y-2">
                    <p className="text-xs font-semibold text-cyan-700 dark:text-cyan-300 uppercase tracking-wide">Aperçu de l'échange</p>
                    {(fxLoading || !fxInfo) ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Calcul en cours...
                      </div>
                    ) : fxInfo && (() => {
                        const feeRate = fxInfo.feeRate ?? 0.02;
                        const grossUsdt = fxInfo.converted;
                        const feeUsdt = grossUsdt * feeRate;
                        const netUsdt = grossUsdt - feeUsdt;
                        return (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Taux</span>
                              <span className="font-mono font-medium">1 USDT = {(1 / fxInfo.rate).toLocaleString("en-US", { maximumFractionDigits: 0 })} {fromCurrency}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Montant brut</span>
                              <span className="font-mono">{grossUsdt.toFixed(4)} USDT</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Frais ({(feeRate * 100).toFixed(1)}%)</span>
                              <span className="font-mono text-amber-600">− {feeUsdt.toFixed(4)} USDT</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between text-sm font-bold">
                              <span>Reçu dans wallet USDT</span>
                              <span className="text-cyan-700 dark:text-cyan-300">≈ {netUsdt.toFixed(4)} USDT</span>
                            </div>
                          </>
                        );
                      })()}
                  </div>
                )}

                <Button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-700" disabled={step1Loading}>
                  {step1Loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Conversion en cours...</> : `Convertir en USDT →`}
                </Button>

                <button
                  type="button"
                  onClick={() => setExchangeStep(2)}
                  className="w-full text-xs text-muted-foreground hover:text-foreground text-center underline underline-offset-2"
                >
                  J'ai déjà des USDT → aller directement à l'étape 2
                </button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* ─── Step 2: USDT → Fiat ─── */}
      {exchangeStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-cyan-600 text-white text-xs flex items-center justify-center font-bold">2</span>
              Convertir USDT → Fiat
            </CardTitle>
            <CardDescription>
              Votre USDT sera verrouillé. L'admin créditera directement votre wallet fiat sous 24-48h.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...step2Form}>
              <form onSubmit={step2Form.handleSubmit(onSubmitStep2)} className="space-y-5">

                <div className="rounded-lg bg-muted/50 border p-3 flex items-center gap-3">
                  <Lock className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <div className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">USDT disponible : {usdtBalance.toFixed(4)} USDT</span><br />
                    Le montant demandé sera bloqué jusqu'à la confirmation de l'admin.
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={step2Form.control}
                    name="amountUsdt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Montant USDT</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="10" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={step2Form.control}
                    name="toCurrency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Devise cible</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent modal={false}>
                            {FIAT_CURRENCIES.map(c => (
                              <SelectItem key={c.value} value={c.value}>{c.value}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {fxInfo2 && step2Usdt > 0 && (
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estimation</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Taux indicatif</span>
                      <span className="font-mono">1 USDT ≈ {(fxInfo2.rate).toLocaleString("en-US", { maximumFractionDigits: 0 })} {toCurrency}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Frais ({((fxInfo2.feeRate ?? 0.02) * 100).toFixed(1)}%)</span>
                      <span className="text-amber-600">− {(step2Usdt * (fxInfo2.feeRate ?? 0.02)).toFixed(4)} USDT</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-sm">
                      <span>Estimation reçue</span>
                      <span className="text-emerald-600">≈ {(fxInfo2.converted * (1 - (fxInfo2.feeRate ?? 0.02))).toLocaleString("en-US", { maximumFractionDigits: 0 })} {toCurrency}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Le montant final peut varier légèrement selon le taux au moment de la confirmation.</p>
                  </div>
                )}

                <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
                  <Info className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-700 dark:text-amber-300 text-sm">Confirmation admin requise</AlertTitle>
                  <AlertDescription className="text-amber-600 dark:text-amber-400 text-xs mt-1">
                    Votre USDT sera verrouillé immédiatement. L'admin créditera votre wallet {toCurrency} sous 24-48h. Aucune autre transaction USDT ne sera possible pendant ce délai.
                  </AlertDescription>
                </Alert>

                <div className="flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setExchangeStep(1)}>
                    ← Retour
                  </Button>
                  <Button type="submit" className="flex-1 bg-cyan-600 hover:bg-cyan-700" disabled={step2Loading}>
                    {step2Loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Envoi...</> : "Envoyer la demande"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
    </KycGate>
  );
}
