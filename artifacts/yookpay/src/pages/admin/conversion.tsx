import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeftRight, Save, Info } from "lucide-react";

const PAIRS: { pair: string; label: string; from: string; to: string }[] = [
  { pair: "XAF:XOF", label: "XAF ↔ XOF", from: "XAF", to: "XOF" },
  { pair: "XAF:CDF", label: "XAF ↔ CDF", from: "XAF", to: "CDF" },
  { pair: "XOF:CDF", label: "XOF ↔ CDF", from: "XOF", to: "CDF" },
];

const CURRENCY_LABELS: Record<string, string> = {
  XAF: "Franc CFA (BEAC)",
  XOF: "Franc CFA (BCEAO)",
  CDF: "Franc Congolais",
};

interface ConversionFee {
  id: number;
  pair: string;
  rate: string;
  min_amount: number;
}

function ConversionCard({
  pairDef,
  initialRate,
  initialMin,
}: {
  pairDef: (typeof PAIRS)[0];
  initialRate: number;
  initialMin: number;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rate, setRate] = useState(String((initialRate * 100).toFixed(4)));
  const [minAmount, setMinAmount] = useState(String(initialMin));
  const [editing, setEditing] = useState(false);

  const mutation = useMutation({
    mutationFn: (body: { rate: number; minAmount: number }) =>
      customFetch(`/api/admin/conversion/${encodeURIComponent(pairDef.pair)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-conversion"] });
      toast({ title: "Sauvegardé", description: `Frais ${pairDef.label} mis à jour.` });
      setEditing(false);
    },
    onError: (err: any) => {
      const msg = String(err?.message ?? "Erreur inconnue").replace(/^HTTP\s+\d+[^:]*:\s*/i, "");
      toast({ variant: "destructive", title: "Erreur", description: msg });
    },
  });

  const handleSave = () => {
    const rateNum = parseFloat(rate);
    const minNum = parseInt(minAmount, 10);
    if (isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
      toast({ variant: "destructive", title: "Valeur invalide", description: "Le taux doit être entre 0 et 100 (%)" });
      return;
    }
    if (isNaN(minNum) || minNum < 0) {
      toast({ variant: "destructive", title: "Valeur invalide", description: "Le montant minimum doit être ≥ 0" });
      return;
    }
    mutation.mutate({ rate: rateNum, minAmount: minNum });
  };

  return (
    <Card className="border border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">{pairDef.label}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {CURRENCY_LABELS[pairDef.from]} / {CURRENCY_LABELS[pairDef.to]}
              </p>
            </div>
          </div>
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Modifier
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {!editing ? (
          <div className="flex gap-8">
            <div>
              <p className="text-xs text-muted-foreground">Frais d'échange</p>
              <p className="text-2xl font-bold text-primary mt-0.5">
                {(initialRate * 100).toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Montant minimum</p>
              <p className="text-2xl font-bold mt-0.5">
                {initialMin.toLocaleString("en-US")}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor={`rate-${pairDef.pair}`}>
                  Frais d'échange (%)
                </Label>
                <div className="relative">
                  <Input
                    id={`rate-${pairDef.pair}`}
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="pr-7"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    %
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ex : 1.90 = 1,90% de frais sur la conversion
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`min-${pairDef.pair}`}>
                  Montant minimum
                </Label>
                <Input
                  id={`min-${pairDef.pair}`}
                  type="number"
                  step="1"
                  min="0"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Montant minimal pour effectuer l'échange
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={mutation.isPending}
                className="gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                {mutation.isPending ? "Sauvegarde…" : "Sauvegarder"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setRate(String((initialRate * 100).toFixed(4)));
                  setMinAmount(String(initialMin));
                  setEditing(false);
                }}
                disabled={mutation.isPending}
              >
                Annuler
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminConversion() {
  const { data, isLoading, isError } = useQuery<{ conversions: ConversionFee[] }>({
    queryKey: ["admin-conversion"],
    queryFn: () => customFetch("/api/admin/conversion"),
  });

  const feeMap: Record<string, ConversionFee> = {};
  for (const row of data?.conversions ?? []) {
    feeMap[row.pair] = row;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Frais de conversion</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Configurez les frais d'échange de devises et le montant minimum par paire.
          Ces paramètres s'appliquent à tous les utilisateurs sauf s'ils ont un taux de transfert personnalisé.
        </p>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-300">
        <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>
          Les frais de conversion sont appliqués dans les deux sens pour chaque paire (XAF→XOF et XOF→XAF partagent le même taux).
          Si un utilisateur a un taux de transfert personnalisé dans sa fiche, ce taux prévaut sur le taux plateforme ci-dessous.
        </span>
      </div>

      {isLoading && (
        <div className="space-y-4">
          {PAIRS.map((p) => (
            <div key={p.pair} className="h-36 rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-destructive text-sm">
          Impossible de charger les frais de conversion.
        </p>
      )}

      {!isLoading && !isError && (
        <div className="space-y-4">
          {PAIRS.map((pairDef) => {
            const row = feeMap[pairDef.pair];
            return (
              <ConversionCard
                key={pairDef.pair}
                pairDef={pairDef}
                initialRate={row ? parseFloat(row.rate) : 0.019}
                initialMin={row ? row.min_amount : 1000}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
