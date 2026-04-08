import React, { useState, useEffect } from "react";
import { customFetch } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, XCircle, ChevronDown, ChevronUp, Save } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

type Exchange = {
  id: number;
  userId: number;
  userEmail: string;
  userName: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: number;
  usdtAmount: number;
  toAmount: number | null;
  exchangeRate: number;
  feeAmount: number;
  status: string;
  txStep1Id: number | null;
  txStep2Id: number | null;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

type ActionDialog = { type: "approve" | "reject"; exchange: Exchange } | null;

const PAIRS = [
  { key: "USDT_XAF", label: "1 USDT = ? XAF", hint: "ex: 620" },
  { key: "XAF_USDT", label: "1 XAF = ? USDT", hint: "ex: 0.001667" },
  { key: "USDT_XOF", label: "1 USDT = ? XOF", hint: "ex: 620" },
  { key: "XOF_USDT", label: "1 XOF = ? USDT", hint: "ex: 0.001667" },
  { key: "USDT_CDF", label: "1 USDT = ? CDF", hint: "ex: 2850" },
  { key: "CDF_USDT", label: "1 CDF = ? USDT", hint: "ex: 0.000351" },
];

const FEE_KEY = "EXCHANGE_FEE";

const STATUS_BADGE: Record<string, React.ReactElement> = {
  STEP1_DONE:    <Badge className="bg-cyan-500/15 text-cyan-600 border-cyan-300/40 whitespace-nowrap">Étape 1 ✓</Badge>,
  PENDING_ADMIN: <Badge className="bg-amber-500/15 text-amber-600 border-amber-300/40 whitespace-nowrap">En attente</Badge>,
  COMPLETED:     <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-300/40 whitespace-nowrap">Complété</Badge>,
  REJECTED:      <Badge className="bg-rose-500/15 text-rose-600 border-rose-300/40 whitespace-nowrap">Rejeté</Badge>,
};

export default function AdminExchanges() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<ActionDialog>(null);
  const [notes, setNotes] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});
  const [savingPair, setSavingPair] = useState<string | null>(null);

  const { data: exchanges = [], isLoading } = useQuery<Exchange[]>({
    queryKey: ["admin-exchanges"],
    queryFn: () => customFetch<Exchange[]>("/api/admin/exchanges"),
    refetchInterval: 15000,
  });

  const { data: ratesData } = useQuery<{ rates: Record<string, number> }>({
    queryKey: ["admin-usdt-rates"],
    queryFn: () => customFetch<{ rates: Record<string, number> }>("/api/admin/usdt-rates"),
  });

  useEffect(() => {
    if (!ratesData?.rates) return;
    const inputs: Record<string, string> = {};
    for (const [k, v] of Object.entries(ratesData.rates)) {
      inputs[k] = v > 0 ? String(v) : "";
    }
    setRateInputs(prev => {
      const hasValues = Object.values(prev).some(v => v !== "");
      return hasValues ? prev : inputs;
    });
  }, [ratesData]);

  const approveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) =>
      customFetch(`/api/admin/exchanges/${id}/approve`, {
        method: "PATCH",
        body: JSON.stringify({ notes }),
      }),
    onSuccess: () => {
      toast({ title: "Échange approuvé", description: "Le wallet fiat a été crédité." });
      queryClient.invalidateQueries({ queryKey: ["admin-exchanges"] });
      setDialog(null);
    },
    onError: (err: any) => {
      const msg = err?.error?.message || err?.message || "Erreur";
      toast({ variant: "destructive", title: "Échec", description: msg.replace(/^HTTP\s+\d+[^:]*:\s*/i, "") });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) =>
      customFetch(`/api/admin/exchanges/${id}/reject`, {
        method: "PATCH",
        body: JSON.stringify({ notes }),
      }),
    onSuccess: () => {
      toast({ title: "Échange rejeté", description: "Le USDT a été déverrouillé." });
      queryClient.invalidateQueries({ queryKey: ["admin-exchanges"] });
      setDialog(null);
    },
    onError: (err: any) => {
      const msg = err?.error?.message || err?.message || "Erreur";
      toast({ variant: "destructive", title: "Échec", description: msg.replace(/^HTTP\s+\d+[^:]*:\s*/i, "") });
    },
  });

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

  const pending = exchanges.filter(e => e.status === "PENDING_ADMIN");
  const others = exchanges.filter(e => e.status !== "PENDING_ADMIN");

  const handleOpenDialog = (type: "approve" | "reject", exchange: Exchange) => {
    setNotes("");
    setDialog({ type, exchange });
  };

  const handleConfirm = () => {
    if (!dialog) return;
    if (dialog.type === "approve") {
      approveMutation.mutate({ id: dialog.exchange.id, notes });
    } else {
      rejectMutation.mutate({ id: dialog.exchange.id, notes });
    }
  };

  const isPendingAction = approveMutation.isPending || rejectMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Demandes d'échange USDT</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gérez les conversions USDT ↔ Fiat et définissez les taux appliqués.
        </p>
      </div>

      {/* ── USDT Rates Management ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Taux de change USDT</CardTitle>
          <CardDescription>
            Définissez les taux et frais appliqués lors des échanges. Laissez 0 pour utiliser le taux marché en temps réel.
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
                  await saveRate(FEE_KEY, val / 100); // convert % to decimal
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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-2xl font-bold text-amber-600">{pending.length}</p>
          <p className="text-xs text-muted-foreground font-medium">En attente</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-2xl font-bold text-emerald-600">{exchanges.filter(e => e.status === "COMPLETED").length}</p>
          <p className="text-xs text-muted-foreground font-medium">Complétés</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-2xl font-bold">{exchanges.length}</p>
          <p className="text-xs text-muted-foreground font-medium">Total</p>
        </CardContent></Card>
      </div>

      {/* Pending exchanges */}
      {pending.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-base">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
              En attente ({pending.length})
            </CardTitle>
            <CardDescription>Ces demandes USDT → Fiat nécessitent votre confirmation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.map((ex) => (
              <div key={ex.id} className="border rounded-lg overflow-hidden">
                <div
                  className="p-3 cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => setExpandedId(expandedId === ex.id ? null : ex.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{ex.userName}</p>
                      <p className="text-xs text-muted-foreground truncate">{ex.userEmail}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {ex.usdtAmount.toFixed(4)} USDT → {ex.toCurrency} · {formatDate(ex.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 h-7 px-2 text-xs"
                        onClick={(e) => { e.stopPropagation(); handleOpenDialog("approve", ex); }}>
                        <CheckCircle className="h-3.5 w-3.5 mr-1" /> OK
                      </Button>
                      <Button size="sm" variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-50 h-7 px-2 text-xs"
                        onClick={(e) => { e.stopPropagation(); handleOpenDialog("reject", ex); }}>
                        <XCircle className="h-3.5 w-3.5 mr-1" /> KO
                      </Button>
                      {expandedId === ex.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </div>

                {expandedId === ex.id && (
                  <div className="border-t bg-muted/20 p-3 grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-xs text-muted-foreground block">Montant USDT</span><span className="font-mono font-semibold">{ex.usdtAmount.toFixed(8)}</span></div>
                    <div><span className="text-xs text-muted-foreground block">Devise cible</span><span className="font-bold">{ex.toCurrency}</span></div>
                    <div><span className="text-xs text-muted-foreground block">Taux appliqué</span><span className="font-mono">{ex.exchangeRate.toFixed(2)} {ex.toCurrency}/USDT</span></div>
                    <div><span className="text-xs text-muted-foreground block">Montant estimé</span><span className="font-semibold text-emerald-600">{((ex.usdtAmount - ex.feeAmount) * ex.exchangeRate).toLocaleString("fr", { maximumFractionDigits: 0 })} {ex.toCurrency}</span></div>
                    <div><span className="text-xs text-muted-foreground block">Frais ({((ratesData?.rates?.["EXCHANGE_FEE"] ?? 0.02) * 100).toFixed(1)}%)</span><span className="text-amber-600">{ex.feeAmount.toFixed(4)} USDT</span></div>
                    <div><span className="text-xs text-muted-foreground block">TX ID</span><span className="font-mono text-xs">#{ex.txStep2Id}</span></div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique des échanges</CardTitle>
          <CardDescription>Toutes les demandes d'échange USDT.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement...
            </div>
          ) : exchanges.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Aucun échange enregistré.</p>
          ) : (
            <div className="space-y-2">
              {others.map((ex) => (
                <div key={ex.id} className="flex items-center gap-3 p-3 border rounded-lg text-sm hover:bg-muted/30 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{ex.userName}</p>
                    <p className="text-xs text-muted-foreground truncate">{ex.userEmail}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ex.fromCurrency} → USDT → {ex.toCurrency} · {formatDate(ex.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="font-mono text-xs text-cyan-600">{ex.usdtAmount.toFixed(4)} USDT</span>
                    {STATUS_BADGE[ex.status] ?? <Badge variant="outline">{ex.status}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={!!dialog} onOpenChange={(open) => { if (!open) setDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.type === "approve" ? "✅ Approuver l'échange" : "❌ Rejeter l'échange"}
            </DialogTitle>
            <DialogDescription>
              {dialog?.type === "approve"
                ? `Le wallet ${dialog?.exchange.toCurrency} de ${dialog?.exchange.userName} sera crédité du montant estimé.`
                : `Le USDT sera déverrouillé et rendu à ${dialog?.exchange.userName}.`}
            </DialogDescription>
          </DialogHeader>

          {dialog?.type === "approve" && dialog.exchange && (() => {
            const ex = dialog.exchange;
            const feeRate = ratesData?.rates?.["EXCHANGE_FEE"] ?? 0.02;
            const netUsdt = ex.usdtAmount - ex.feeAmount;
            const currentAdminRate = ratesData?.rates?.[`USDT_${ex.toCurrency}`] ?? 0;
            const effectiveRate = currentAdminRate > 0 ? currentAdminRate : ex.exchangeRate;
            const finalAmt = netUsdt * effectiveRate;
            return (
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">USDT brut</span>
                  <span className="font-mono font-semibold">{ex.usdtAmount.toFixed(4)} USDT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Frais ({(feeRate * 100).toFixed(1)}%)</span>
                  <span className="text-amber-600 font-mono">−{ex.feeAmount.toFixed(4)} USDT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">USDT net</span>
                  <span className="font-mono">{netUsdt.toFixed(4)} USDT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Taux actuel {currentAdminRate > 0 ? <span className="text-emerald-600">(admin)</span> : "(marché)"}
                  </span>
                  <span className="font-mono">{effectiveRate.toFixed(2)} {ex.toCurrency}/USDT</span>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between font-bold text-base">
                  <span>Wallet crédité</span>
                  <span className="text-emerald-700 dark:text-emerald-400">
                    {finalAmt.toLocaleString("fr", { maximumFractionDigits: 0 })} {ex.toCurrency}
                  </span>
                </div>
              </div>
            );
          })()}

          <div className="space-y-2">
            <Label className="text-sm font-medium">Notes internes <span className="text-muted-foreground">(optionnel)</span></Label>
            <Textarea
              placeholder="Référence, commentaire..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Annuler</Button>
            <Button
              onClick={handleConfirm}
              disabled={isPendingAction}
              className={dialog?.type === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}
            >
              {isPendingAction ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {dialog?.type === "approve" ? "Confirmer l'approbation" : "Confirmer le rejet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
