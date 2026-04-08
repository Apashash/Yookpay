import React, { useState, useEffect } from "react";
import { customFetch } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";

const PAIRS = [
  { key: "USDT_XAF", label: "1 USDT = ? XAF", hint: "ex: 620" },
  { key: "XAF_USDT", label: "1 XAF = ? USDT", hint: "ex: 0.001667" },
  { key: "USDT_XOF", label: "1 USDT = ? XOF", hint: "ex: 620" },
  { key: "XOF_USDT", label: "1 XOF = ? USDT", hint: "ex: 0.001667" },
  { key: "USDT_CDF", label: "1 USDT = ? CDF", hint: "ex: 2850" },
  { key: "CDF_USDT", label: "1 CDF = ? USDT", hint: "ex: 0.000351" },
];

const FEE_KEY = "EXCHANGE_FEE";

export default function AdminExchanges() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});
  const [savingPair, setSavingPair] = useState<string | null>(null);

  const { data: ratesData } = useQuery<{ rates: Record<string, number> }>({
    queryKey: ["admin-usdt-rates"],
    queryFn: () => customFetch<{ rates: Record<string, number> }>("/api/admin/usdt-rates"),
  });

  useEffect(() => {
    if (!ratesData?.rates) return;
    const inputs: Record<string, string> = {};
    for (const [k, v] of Object.entries(ratesData.rates)) {
      if (v > 0) {
        inputs[k] = k === FEE_KEY ? String(parseFloat((v * 100).toFixed(4))) : String(v);
      } else {
        inputs[k] = "";
      }
    }
    setRateInputs(prev => {
      const hasValues = Object.values(prev).some(v => v !== "");
      return hasValues ? prev : inputs;
    });
  }, [ratesData]);

  const saveRate = async (pair: string, overrideValue?: number) => {
    const val = overrideValue !== undefined ? overrideValue : (parseFloat(rateInputs[pair] ?? "0") || 0);
    setSavingPair(pair);
    try {
      await customFetch(`/api/admin/usdt-rates/${pair}`, {
        method: "PUT",
        body: JSON.stringify({ rate: val }),
      });
      toast({ title: "Taux mis à jour", description: `${pair}: ${val > 0 ? val : "taux marché"}` });
      queryClient.invalidateQueries({ queryKey: ["admin-usdt-rates"] });
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || "Erreur";
      toast({ variant: "destructive", title: "Échec", description: msg.replace(/^HTTP\s+\d+[^:]*:\s*/i, "") });
    } finally {
      setSavingPair(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuration des échanges USDT</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Définissez les taux et frais appliqués lors des conversions USDT ↔ Fiat.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Taux de change USDT</CardTitle>
          <CardDescription>
            Laissez 0 pour utiliser le taux marché en temps réel. Les demandes d'échange sont gérées depuis la page <strong>Historique</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Exchange fee */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-3">
            <Label className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2 block">
              Frais d'échange (%) — actuellement {ratesData?.rates?.[FEE_KEY] ? `${(ratesData.rates[FEE_KEY] * 100).toFixed(2)}%` : "2% (défaut)"}
            </Label>
            <div className="flex items-end gap-2">
              <div className="flex-1 min-w-0">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="ex: 2 (pour 2%)"
                  value={rateInputs[FEE_KEY] ?? ""}
                  onChange={(e) => setRateInputs(prev => ({ ...prev, [FEE_KEY]: e.target.value }))}
                  className="text-sm"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 border-amber-300"
                onClick={async () => {
                  const val = parseFloat(rateInputs[FEE_KEY] ?? "0") || 0;
                  await saveRate(FEE_KEY, val / 100);
                }}
                disabled={savingPair === FEE_KEY}
              >
                {savingPair === FEE_KEY ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">Entrez 2 pour 2%, 1.5 pour 1.5%, etc. S'applique à tous les échanges USDT.</p>
          </div>

          {/* Taux de change */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PAIRS.map(({ key, label, hint }) => (
              <div key={key} className="flex items-end gap-2">
                <div className="flex-1 min-w-0">
                  <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder={hint}
                    value={rateInputs[key] ?? ""}
                    onChange={(e) => setRateInputs(prev => ({ ...prev, [key]: e.target.value }))}
                    className="text-sm"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => saveRate(key)}
                  disabled={savingPair === key}
                >
                  {savingPair === key
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Save className="h-3.5 w-3.5" />}
                </Button>
              </div>
            ))}
          </div>

          {/* Current rates summary */}
          <div className="flex flex-wrap gap-2 mt-1">
            {PAIRS.map(p => {
              const r = ratesData?.rates?.[p.key] ?? 0;
              return (
                <span key={p.key} className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                  {p.key}: <span className={r > 0 ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>{r > 0 ? r : "auto"}</span>
                </span>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
