import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateWithdrawal } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { COUNTRIES, OPERATOR_LABELS } from "@/lib/countries";

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

export default function Withdraw() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const withdrawMutation = useCreateWithdrawal();
  const [feeBearer, setFeeBearer] = useState<FeeBearer>("SENDER");
  const [feePreview, setFeePreview] = useState<FeePreview | null>(null);

  const form = useForm<WithdrawFormValues>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: { amount: 1000, country: "", operator: "", phone: "" },
  });

  const amount   = form.watch("amount");
  const country  = form.watch("country");
  const operator = form.watch("operator");

  const selectedCountry = COUNTRIES.find((c) => c.code === country);
  const operators = selectedCountry?.operators ?? [];

  useEffect(() => {
    form.setValue("operator", "");
    setFeePreview(null);
  }, [country]);

  useEffect(() => {
    if (!amount || amount < 100 || !country || !operator) return;
    let active = true;
    const id = setTimeout(async () => {
      try {
        const { getFeePreview } = await import("@workspace/api-client-react");
        const res = await getFeePreview({ amount, country, operator, type: "WITHDRAWAL" });
        if (active) setFeePreview(res as FeePreview);
      } catch { /* silent */ }
    }, 500);
    return () => { active = false; clearTimeout(id); };
  }, [amount, country, operator]);

  const onSubmit = (data: WithdrawFormValues) => {
    const currency = selectedCountry?.currency ?? "XAF";
    withdrawMutation.mutate(
      { data: { amount: data.amount, currency, country: data.country, operator: data.operator, phone: data.phone, feeBearer } },
      {
        onSuccess: (res) => {
          toast({
            title: "Retrait initié",
            description: `Votre retrait de ${formatCurrency(res.transaction.amount, res.transaction.currency)} est en cours.`,
          });
          setLocation("/dashboard");
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

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
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
      </Card>
    </div>
  );
}
