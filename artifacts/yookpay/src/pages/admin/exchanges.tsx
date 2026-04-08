import React, { useState } from "react";
import { customFetch } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

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

type ActionDialog = {
  type: "approve" | "reject";
  exchange: Exchange;
} | null;

const STATUS_BADGE: Record<string, JSX.Element> = {
  STEP1_DONE:    <Badge className="bg-cyan-500/15 text-cyan-600 border-cyan-300/40">Étape 1 ✓</Badge>,
  PENDING_ADMIN: <Badge className="bg-amber-500/15 text-amber-600 border-amber-300/40">En attente admin</Badge>,
  COMPLETED:     <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-300/40">Complété</Badge>,
  REJECTED:      <Badge className="bg-rose-500/15 text-rose-600 border-rose-300/40">Rejeté</Badge>,
};

export default function AdminExchanges() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<ActionDialog>(null);
  const [notes, setNotes] = useState("");
  const [finalAmount, setFinalAmount] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: exchanges = [], isLoading } = useQuery<Exchange[]>({
    queryKey: ["admin-exchanges"],
    queryFn: () => customFetch<Exchange[]>("/api/admin/exchanges"),
    refetchInterval: 15000,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, notes, finalAmount }: { id: number; notes: string; finalAmount?: number }) =>
      customFetch(`/api/admin/exchanges/${id}/approve`, {
        method: "PATCH",
        body: JSON.stringify({ notes, finalAmount: finalAmount || undefined }),
      }),
    onSuccess: () => {
      toast({ title: "Échange approuvé", description: "Les fonds ont été crédités." });
      queryClient.invalidateQueries({ queryKey: ["admin-exchanges"] });
      setDialog(null);
    },
    onError: (err: any) => {
      const msg = err?.error?.message || err?.message || "Erreur";
      toast({ variant: "destructive", title: "Échec", description: msg.replace(/^HTTP\s+\d+\s+[^:]+:\s*/i, "") });
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
      toast({ variant: "destructive", title: "Échec", description: msg.replace(/^HTTP\s+\d+\s+[^:]+:\s*/i, "") });
    },
  });

  const pending = exchanges.filter(e => e.status === "PENDING_ADMIN");
  const others = exchanges.filter(e => e.status !== "PENDING_ADMIN");

  const handleOpenDialog = (type: "approve" | "reject", exchange: Exchange) => {
    setNotes("");
    setFinalAmount("");
    setDialog({ type, exchange });
  };

  const handleConfirm = () => {
    if (!dialog) return;
    if (dialog.type === "approve") {
      approveMutation.mutate({
        id: dialog.exchange.id,
        notes,
        finalAmount: finalAmount ? parseFloat(finalAmount) : undefined,
      });
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
          Gérez les demandes de conversion USDT → Fiat en attente de confirmation.
        </p>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{pending.length}</p>
            <p className="text-xs text-amber-600 font-medium">En attente</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{exchanges.filter(e => e.status === "COMPLETED").length}</p>
            <p className="text-xs text-emerald-600 font-medium">Complétés</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{exchanges.length}</p>
            <p className="text-xs text-muted-foreground font-medium">Total</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending exchanges */}
      {pending.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
              En attente de votre action ({pending.length})
            </CardTitle>
            <CardDescription>Ces demandes USDT → Fiat nécessitent votre confirmation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.map((ex) => (
              <div key={ex.id} className="border rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => setExpandedId(expandedId === ex.id ? null : ex.id)}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{ex.userName}</span>
                      <span className="text-xs text-muted-foreground">{ex.userEmail}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-mono font-bold text-cyan-600">{ex.usdtAmount.toFixed(4)} USDT</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-semibold">{ex.toCurrency}</span>
                      <span className="text-muted-foreground text-xs">{formatDate(ex.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                      onClick={(e) => { e.stopPropagation(); handleOpenDialog("approve", ex); }}>
                      <CheckCircle className="h-4 w-4 mr-1" /> Approuver
                    </Button>
                    <Button size="sm" variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-50"
                      onClick={(e) => { e.stopPropagation(); handleOpenDialog("reject", ex); }}>
                      <XCircle className="h-4 w-4 mr-1" /> Rejeter
                    </Button>
                    {expandedId === ex.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>

                {expandedId === ex.id && (
                  <div className="border-t bg-muted/20 p-4 grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Montant USDT</span><p className="font-mono font-semibold">{ex.usdtAmount.toFixed(8)} USDT</p></div>
                    <div><span className="text-muted-foreground">Devise cible</span><p className="font-bold">{ex.toCurrency}</p></div>
                    <div><span className="text-muted-foreground">Taux de change</span><p className="font-mono">{ex.exchangeRate.toFixed(2)} {ex.toCurrency}/USDT</p></div>
                    <div><span className="text-muted-foreground">Montant estimé</span><p className="font-semibold text-emerald-600">{(ex.usdtAmount * ex.exchangeRate * 0.98).toLocaleString("fr", { maximumFractionDigits: 0 })} {ex.toCurrency}</p></div>
                    <div><span className="text-muted-foreground">Frais</span><p className="text-amber-600">{ex.feeAmount.toFixed(4)} USDT</p></div>
                    <div><span className="text-muted-foreground">Demande créée</span><p>{formatDate(ex.createdAt)}</p></div>
                    {ex.txStep2Id && <div className="col-span-2"><span className="text-muted-foreground">TX ID</span><p className="font-mono">#{ex.txStep2Id}</p></div>}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* All exchanges history */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des échanges</CardTitle>
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
                <div key={ex.id} className="flex items-center justify-between p-3 border rounded-lg text-sm hover:bg-muted/30 transition-colors">
                  <div>
                    <div className="font-semibold">{ex.userName} <span className="text-muted-foreground text-xs font-normal">{ex.userEmail}</span></div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {ex.fromCurrency} → USDT → {ex.toCurrency} · {formatDate(ex.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-cyan-600">{ex.usdtAmount.toFixed(4)} USDT</span>
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
                ? `Confirmer l'envoi de ${dialog?.exchange.toCurrency} sur le téléphone de ${dialog?.exchange.userName}.`
                : `Le USDT sera déverrouillé et remis à ${dialog?.exchange.userName}.`}
            </DialogDescription>
          </DialogHeader>

          {dialog?.type === "approve" && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Montant final envoyé ({dialog.exchange.toCurrency}) <span className="text-muted-foreground">(optionnel)</span></label>
                <Input
                  type="number"
                  placeholder={`Estimé : ${(dialog.exchange.usdtAmount * dialog.exchange.exchangeRate * 0.98).toFixed(0)}`}
                  value={finalAmount}
                  onChange={(e) => setFinalAmount(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Laissez vide pour utiliser le montant estimé.</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Notes internes <span className="text-muted-foreground">(optionnel)</span></label>
            <Textarea
              placeholder="Référence du virement, opérateur utilisé..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
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
