import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { customFetch } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { COUNTRIES } from "@/lib/countries";
import { formatDate } from "@/lib/format";
import {
  ArrowDownLeft, ArrowUpRight, ArrowLeftRight,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Search, X, Copy, Check,
  ExternalLink, CheckCircle, XCircle, Loader2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AdminTx {
  id: number;
  type: string;
  status: string;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  country: string | null;
  operator: string | null;
  phone: string | null;
  reference: string;
  providerReference: string | null;
  feeRate: number | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  userId: number;
  userEmail: string;
  userName: string;
}

interface TxPage {
  total: number;
  page: number;
  limit: number;
  pages: number;
  transactions: AdminTx[];
}

interface Exchange {
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
}

type ActionDialog = { type: "approve" | "reject"; exchange: Exchange } | null;


function fmt(n: number, currency: string) {
  const dec = currency === "USDT" ? 4 : 0;
  return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + " " + currency;
}

// Extract exchange metadata from a transaction
function getExchangeMeta(tx: AdminTx) {
  const m = tx.metadata as Record<string, string> | null;
  if (!m) return null;
  const from = m.fromCurrency as string | undefined;
  const to = m.toCurrency as string | undefined;
  const type = m.exchangeType as string | undefined;
  if (!from || !to) return null;
  return { from, to, type };
}

function exchangeLabel(tx: AdminTx) {
  const meta = getExchangeMeta(tx);
  if (!meta) return typeLabel(tx.type);
  return `${meta.from} → ${meta.to}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDateFull(d: string) {
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "SUCCESS": return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20 text-[10px] px-1.5 py-0">Réussi</Badge>;
    case "PENDING": return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/20 text-[10px] px-1.5 py-0">Attente</Badge>;
    case "FAILED":  return <Badge className="bg-red-500/15 text-red-600 border-red-500/20 text-[10px] px-1.5 py-0">Échoué</Badge>;
    case "EXPIRED": return <Badge className="bg-gray-400/15 text-gray-500 border-gray-400/20 text-[10px] px-1.5 py-0">Expiré</Badge>;
    default:        return <Badge variant="outline" className="text-[10px] px-1.5 py-0">{status}</Badge>;
  }
}

function TypeDot({ type }: { type: string }) {
  if (type === "DEPOSIT")    return <ArrowDownLeft  className="h-3 w-3 text-emerald-500 flex-shrink-0" />;
  if (type === "WITHDRAWAL") return <ArrowUpRight   className="h-3 w-3 text-rose-500 flex-shrink-0" />;
  return <ArrowLeftRight className="h-3 w-3 text-sky-500 flex-shrink-0" />;
}

function typeLabel(t: string) {
  if (t === "DEPOSIT")    return "Dépôt";
  if (t === "WITHDRAWAL") return "Retrait";
  if (t === "TRANSFER")   return "Transfert";
  return t;
}

/** Full human-readable type label for a transaction */
function richTypeLabel(tx: AdminTx): string {
  const meta = getExchangeMeta(tx);
  if (meta) return `Échange ${meta.from} → ${meta.to}`;
  if (tx.operator === "NOWPAYMENTS" || tx.currency === "USDT" && tx.type === "DEPOSIT") {
    return "Dépôt Crypto (USDT)";
  }
  if (tx.operator === "CRYPTO" || tx.currency === "USDT" && tx.type === "WITHDRAWAL") {
    return "Retrait Crypto (USDT)";
  }
  if (tx.type === "DEPOSIT")    return `Dépôt Mobile Money`;
  if (tx.type === "WITHDRAWAL") return `Retrait Mobile Money`;
  if (tx.type === "TRANSFER")   return "Transfert";
  return tx.type;
}

/** Short sub-label for the row (operator, phone) */
function richSubLabel(tx: AdminTx): string | null {
  if (tx.operator && tx.operator !== "EXCHANGE" && tx.operator !== "CRYPTO" && tx.operator !== "NOWPAYMENTS") {
    return tx.operator;
  }
  return null;
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className="text-muted-foreground hover:text-foreground transition-colors"
    >
      {ok ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2 items-start py-1 border-b border-border/30 last:border-0">
      <span className="text-muted-foreground flex-shrink-0 text-[11px]">{label}</span>
      <span className="text-right text-[11px]">{children}</span>
    </div>
  );
}

function ExpandedDetail({ tx }: { tx: AdminTx }) {
  const country = tx.country ? COUNTRIES.find((c) => c.code === tx.country) : null;
  const exMeta = getExchangeMeta(tx);
  const meta = tx.metadata as Record<string, string> | null;

  const feeCurrency = exMeta ? (exMeta.type === "FIAT_TO_USDT" ? exMeta.from : "USDT") : tx.currency;
  const netCurrency = exMeta ? exMeta.to : tx.currency;
  const netLabel    = exMeta ? (exMeta.type === "FIAT_TO_USDT" ? "USDT reçus" : "Fiat estimé") : "Net reçu";

  const isCrypto    = tx.operator === "NOWPAYMENTS" || tx.operator === "CRYPTO";
  const cryptoAddr  = meta?.address as string | undefined;
  const cryptoTxId  = meta?.paymentId ?? meta?.txId as string | undefined;
  const exchangeRate = meta?.exchangeRate as string | undefined;

  return (
    <div className="bg-muted/20 border-t border-border/60 px-4 py-3 text-xs">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">
        {/* ─── Col 1: Transaction info ─── */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">Détails de la transaction</p>

          <DetailRow label="Type">
            <span className="font-semibold text-foreground">{richTypeLabel(tx)}</span>
          </DetailRow>

          <DetailRow label="Statut">
            <StatusBadge status={tx.status} />
          </DetailRow>

          {exMeta && (
            <DetailRow label="Direction d'échange">
              <span className="font-semibold text-cyan-700 dark:text-cyan-400">{exMeta.from} → {exMeta.to}</span>
            </DetailRow>
          )}

          <DetailRow label="Montant brut">
            <span className="font-semibold tabular-nums font-mono">{fmt(tx.amount, tx.currency)}</span>
          </DetailRow>

          <DetailRow label={`Frais${tx.feeRate != null ? ` (${(tx.feeRate * 100).toFixed(2)}%)` : ""}`}>
            <span className="tabular-nums font-mono text-amber-600">{fmt(tx.fee, feeCurrency)}</span>
          </DetailRow>

          <DetailRow label={netLabel}>
            <span className="font-semibold tabular-nums font-mono">{fmt(tx.netAmount, netCurrency)}</span>
          </DetailRow>

          {exchangeRate && (
            <DetailRow label="Taux de change">
              <span className="font-mono">{parseFloat(exchangeRate).toLocaleString("en-US", { maximumFractionDigits: 4 })} {netCurrency}/{feeCurrency}</span>
            </DetailRow>
          )}

          {tx.phone && (
            <DetailRow label="Numéro de téléphone">
              <span className="font-mono font-semibold">{tx.phone}</span>
            </DetailRow>
          )}

          {tx.operator && tx.operator !== "EXCHANGE" && !isCrypto && (
            <DetailRow label="Opérateur">
              <span className="font-semibold">{tx.operator}</span>
            </DetailRow>
          )}

          {isCrypto && (
            <DetailRow label="Réseau">
              <span className="font-semibold">USDT (TRC20 / NowPayments)</span>
            </DetailRow>
          )}

          {country && (
            <DetailRow label="Pays">
              <span>{country.flag} {country.name}</span>
            </DetailRow>
          )}
        </div>

        {/* ─── Col 2: References & metadata ─── */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5 mt-3 sm:mt-0">Références</p>

          <DetailRow label="ID transaction">
            <span className="flex items-center gap-1">
              <span className="font-mono text-[10px] text-muted-foreground">#{tx.id}</span>
            </span>
          </DetailRow>

          <DetailRow label="Réf. YookPay">
            <span className="flex items-center gap-1">
              <span className="font-mono text-[10px]">{tx.reference}</span>
              <CopyBtn text={tx.reference} />
            </span>
          </DetailRow>

          {tx.providerReference && (
            <DetailRow label="Réf. PixPay">
              <span className="flex items-center gap-1">
                <span className="font-mono text-[10px]">{tx.providerReference}</span>
                <CopyBtn text={tx.providerReference} />
              </span>
            </DetailRow>
          )}

          {cryptoTxId && (
            <DetailRow label="ID paiement crypto">
              <span className="flex items-center gap-1">
                <span className="font-mono text-[10px] truncate max-w-[140px]">{cryptoTxId}</span>
                <CopyBtn text={String(cryptoTxId)} />
              </span>
            </DetailRow>
          )}

          {cryptoAddr && (
            <DetailRow label="Adresse crypto">
              <span className="flex items-center gap-1">
                <span className="font-mono text-[10px] truncate max-w-[140px]">{cryptoAddr}</span>
                <CopyBtn text={cryptoAddr} />
              </span>
            </DetailRow>
          )}

          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5 mt-3">Utilisateur &amp; dates</p>

          <DetailRow label="Utilisateur">
            <Link href={`/admin/users/${tx.userId}`} onClick={(e) => e.stopPropagation()}>
              <span className="flex items-center gap-1 text-primary hover:underline">
                {tx.userName || tx.userEmail}
                <ExternalLink className="h-2.5 w-2.5" />
              </span>
            </Link>
          </DetailRow>

          {tx.userEmail && tx.userName && (
            <DetailRow label="Email">
              <span className="font-mono text-[10px]">{tx.userEmail}</span>
            </DetailRow>
          )}

          <DetailRow label="Créée le">
            <span>{fmtDateFull(tx.createdAt)}</span>
          </DetailRow>

          <DetailRow label="Mise à jour">
            <span>{fmtDateFull(tx.updatedAt)}</span>
          </DetailRow>
        </div>
      </div>
    </div>
  );
}

const STATUS_OPTIONS = ["", "SUCCESS", "PENDING", "FAILED", "EXPIRED"];
const TYPE_OPTIONS   = ["", "DEPOSIT", "WITHDRAWAL", "TRANSFER"];

export default function AdminTransactions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  // Transactions state
  const [page,         setPage]         = useState(1);
  const [status,       setStatus]       = useState("");
  const [type,         setType]         = useState("");
  const [search,       setSearch]       = useState("");
  const [searchInput,  setSearchInput]  = useState("");

  // Exchange management state
  const [dialog,       setDialog]       = useState<ActionDialog>(null);
  const [notes,        setNotes]        = useState("");
  const [exExpandedId, setExExpandedId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<TxPage>({
    queryKey: ["admin-transactions", page, status, type, search],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (status) params.set("status", status);
      if (type)   params.set("type",   type);
      if (search) params.set("search", search);
      return customFetch<TxPage>(`/api/admin/transactions?${params}`);
    },
    placeholderData: (prev: TxPage | undefined) => prev,
  });

  const { data: exchanges = [] } = useQuery<Exchange[]>({
    queryKey: ["admin-exchanges"],
    queryFn: () => customFetch<Exchange[]>("/api/admin/exchanges"),
    refetchInterval: 15000,
  });

  const { data: ratesData } = useQuery<{ rates: Record<string, number> }>({
    queryKey: ["admin-usdt-rates"],
    queryFn: () => customFetch<{ rates: Record<string, number> }>("/api/admin/usdt-rates"),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) =>
      customFetch(`/api/admin/exchanges/${id}/approve`, { method: "PATCH", body: JSON.stringify({ notes }) }),
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
      customFetch(`/api/admin/exchanges/${id}/reject`, { method: "PATCH", body: JSON.stringify({ notes }) }),
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

  const isPendingAction = approveMutation.isPending || rejectMutation.isPending;

  const pendingExchanges = exchanges.filter(e => e.status === "PENDING_ADMIN");

  function handleOpenDialog(type: "approve" | "reject", exchange: Exchange) {
    setNotes("");
    setDialog({ type, exchange });
  }

  function handleConfirm() {
    if (!dialog) return;
    if (dialog.type === "approve") approveMutation.mutate({ id: dialog.exchange.id, notes });
    else rejectMutation.mutate({ id: dialog.exchange.id, notes });
  }

  function applySearch() { setSearch(searchInput.trim()); setPage(1); }
  function clearFilters() { setStatus(""); setType(""); setSearch(""); setSearchInput(""); setPage(1); }
  const hasFilters = status || type || search;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">Historique des transactions</h1>
        <p className="text-muted-foreground text-xs mt-0.5">
          {data ? `${data.total.toLocaleString("en-US")} transaction${data.total > 1 ? "s" : ""}` : "—"}
        </p>
      </div>

      {/* ── Pending Exchanges (USDT→Fiat needing admin confirmation) ── */}
      {pendingExchanges.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-base">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
              Demandes d'échange en attente ({pendingExchanges.length})
            </CardTitle>
            <CardDescription>Ces conversions USDT → Fiat nécessitent votre confirmation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingExchanges.map((ex) => (
              <div key={ex.id} className="border rounded-lg overflow-hidden">
                <div
                  className="p-3 cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => setExExpandedId(exExpandedId === ex.id ? null : ex.id)}
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
                      <Button size="sm" variant="outline"
                        className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 h-7 px-2 text-xs"
                        onClick={(e) => { e.stopPropagation(); handleOpenDialog("approve", ex); }}>
                        <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approuver
                      </Button>
                      <Button size="sm" variant="outline"
                        className="border-rose-300 text-rose-700 hover:bg-rose-50 h-7 px-2 text-xs"
                        onClick={(e) => { e.stopPropagation(); handleOpenDialog("reject", ex); }}>
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Rejeter
                      </Button>
                      {exExpandedId === ex.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </div>
                {exExpandedId === ex.id && (
                  <div className="border-t bg-muted/20 p-3 grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-xs text-muted-foreground block">Montant USDT</span><span className="font-mono font-semibold">{ex.usdtAmount.toFixed(4)} USDT</span></div>
                    <div><span className="text-xs text-muted-foreground block">Devise cible</span><span className="font-bold">{ex.toCurrency}</span></div>
                    <div><span className="text-xs text-muted-foreground block">Taux indicatif</span><span className="font-mono">{ex.exchangeRate.toFixed(2)} {ex.toCurrency}/USDT</span></div>
                    <div><span className="text-xs text-muted-foreground block">Montant estimé</span><span className="font-semibold text-emerald-600">{((ex.usdtAmount - ex.feeAmount) * ex.exchangeRate).toLocaleString("en-US", { maximumFractionDigits: 0 })} {ex.toCurrency}</span></div>
                    <div><span className="text-xs text-muted-foreground block">Frais</span><span className="text-amber-600">{ex.feeAmount.toFixed(4)} USDT</span></div>
                    <div><span className="text-xs text-muted-foreground block">Source</span><span className="font-mono text-xs">{ex.fromCurrency} → USDT</span></div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
                    Taux {currentAdminRate > 0 ? <span className="text-emerald-600">(admin)</span> : "(marché)"}
                  </span>
                  <span className="font-mono">{effectiveRate.toFixed(2)} {ex.toCurrency}/USDT</span>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between font-bold text-base">
                  <span>Wallet crédité</span>
                  <span className="text-emerald-700 dark:text-emerald-400">
                    {finalAmt.toLocaleString("en-US", { maximumFractionDigits: 0 })} {ex.toCurrency}
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

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5 items-center">
        {/* Search */}
        <div className="flex gap-1 flex-1 min-w-40">
          <Input
            placeholder="Référence, email, nom…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applySearch()}
            className="h-7 text-xs"
          />
          <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={applySearch}>
            <Search className="h-3 w-3" />
          </Button>
        </div>

        {/* Status pills */}
        <div className="flex gap-1 flex-wrap">
          {STATUS_OPTIONS.map((s) => (
            <button key={s || "ALL"} onClick={() => { setStatus(s); setPage(1); }}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
                status === s ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}>
              {s === "" ? "Tous" : s === "SUCCESS" ? "Réussi" : s === "PENDING" ? "Attente" : s === "FAILED" ? "Échoué" : "Expiré"}
            </button>
          ))}
        </div>

        {/* Type pills */}
        <div className="flex gap-1 flex-wrap">
          {TYPE_OPTIONS.map((t) => (
            <button key={t || "ALL"} onClick={() => { setType(t); setPage(1); }}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
                type === t ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}>
              {t === "" ? "Tous" : t === "DEPOSIT" ? "Dépôt" : t === "WITHDRAWAL" ? "Retrait" : "Transfert"}
            </button>
          ))}
        </div>

        {hasFilters && (
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-[10px] text-muted-foreground" onClick={clearFilters}>
            <X className="h-2.5 w-2.5" /> Effacer
          </Button>
        )}
      </div>

      {/* List */}
      <div className="bg-card border rounded-xl overflow-hidden">
        {/* Header row */}
        <div className="hidden sm:grid grid-cols-[1fr_90px_100px_80px_70px_16px] gap-2 px-3 py-1.5 bg-muted/40 border-b text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          <span>Utilisateur / Réf.</span>
          <span>Type</span>
          <span className="text-right">Montant</span>
          <span className="text-right">Frais</span>
          <span>Statut</span>
          <span />
        </div>

        {isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="px-3 py-2.5 flex gap-2 items-center">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 flex-1" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
        ) : !data?.transactions.length ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Aucune transaction trouvée</div>
        ) : (
          <div className="divide-y">
            {data.transactions.map((tx) => {
              return (
                <div key={tx.id}>
                  {/* Main row — compact */}
                  <div
                    onClick={() => navigate(`/admin/transactions/${tx.id}`)}
                    className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_90px_100px_80px_70px_16px] gap-2 px-3 py-2 hover:bg-muted/30 cursor-pointer transition-colors items-center"
                  >
                    {/* User + ref */}
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate leading-tight">{tx.userName || tx.userEmail}</p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{tx.reference}</p>
                      <div className="flex items-center gap-1 sm:hidden mt-0.5">
                        <TypeDot type={tx.type} />
                        <span className="text-[10px] text-muted-foreground font-medium truncate">{richTypeLabel(tx)}</span>
                      </div>
                      {tx.phone && <p className="text-[10px] text-muted-foreground/70 sm:hidden font-mono">{tx.phone}</p>}
                    </div>
                    {/* Type */}
                    <div className="hidden sm:flex flex-col gap-0">
                      <div className="flex items-center gap-1">
                        <TypeDot type={tx.type} />
                        <span className="text-[10px] font-medium">{richTypeLabel(tx)}</span>
                      </div>
                      {richSubLabel(tx) && (
                        <span className="text-[9px] text-muted-foreground ml-4">{richSubLabel(tx)}</span>
                      )}
                      {tx.phone && (
                        <span className="text-[9px] text-muted-foreground ml-4 font-mono">{tx.phone}</span>
                      )}
                    </div>
                    {/* Amount */}
                    <div className="hidden sm:block text-right">
                      <p className="text-xs font-semibold tabular-nums">{fmt(tx.amount, tx.currency)}</p>
                      <p className="text-[10px] text-muted-foreground">{fmtDate(tx.createdAt)}</p>
                    </div>
                    {/* Fee — use correct currency for exchanges */}
                    <div className="hidden sm:block text-right">
                      {(() => {
                        const exm = getExchangeMeta(tx);
                        const fc = exm ? (exm.type === "FIAT_TO_USDT" ? exm.from : "USDT") : tx.currency;
                        return <p className="text-[10px] text-muted-foreground tabular-nums">{fmt(tx.fee, fc)}</p>;
                      })()}
                    </div>
                    {/* Status */}
                    <div className="hidden sm:flex items-center">
                      <StatusBadge status={tx.status} />
                    </div>
                    {/* Mobile right */}
                    <div className="sm:hidden flex flex-col items-end gap-0.5">
                      <p className="text-xs font-semibold tabular-nums">{fmt(tx.amount, tx.currency)}</p>
                      <StatusBadge status={tx.status} />
                    </div>
                    {/* Arrow */}
                    <div className="hidden sm:flex justify-end">
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {data.page} / {data.pages} · {data.total} transactions
          </p>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-3 w-3" /> Préc.
            </Button>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={page >= (data.pages ?? 1)} onClick={() => setPage((p) => p + 1)}>
              Suiv. <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
