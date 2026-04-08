import { useState, useEffect, useRef } from "react";
import {
  useGetTransactions,
  getGetTransactionsQueryKey,
  getGetWalletsQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  ChevronLeft,
  ChevronRight,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowRightLeft,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";
import { COUNTRIES } from "@/lib/countries";

type Tx = {
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
  feeRate: number | null;
  metadata: unknown;
  createdAt: string | Date;
  updatedAt: string | Date;
};

function StatusBadge({ status, pulse }: { status: string; pulse?: boolean }) {
  switch (status) {
    case "SUCCESS":
      return <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 border-emerald-500/20">Réussi</Badge>;
    case "PENDING":
      return (
        <Badge className="bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 border-amber-500/20">
          {pulse && <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse" />}
          En attente
        </Badge>
      );
    case "FAILED":
      return <Badge className="bg-rose-500/15 text-rose-600 hover:bg-rose-500/25 border-rose-500/20">Échoué</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case "DEPOSIT":    return <ArrowDownCircle className="h-5 w-5 text-emerald-500" />;
    case "WITHDRAWAL": return <ArrowUpCircle className="h-5 w-5 text-rose-500" />;
    case "TRANSFER":   return <ArrowRightLeft className="h-5 w-5 text-blue-500" />;
    default:           return null;
  }
}

function typeLabel(type: string) {
  switch (type) {
    case "DEPOSIT":    return "Dépôt";
    case "WITHDRAWAL": return "Retrait";
    case "TRANSFER":   return "Transfert";
    default:           return type;
  }
}

function fmtSmart(n: number, currency: string) {
  const dec = currency === "USDT" ? 4 : 0;
  return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + " " + currency;
}

function getExchangeMeta(tx: Tx) {
  const m = tx.metadata as Record<string, string> | null;
  if (!m) return null;
  const from = m.fromCurrency as string | undefined;
  const to = m.toCurrency as string | undefined;
  const type = m.exchangeType as string | undefined;
  if (!from || !to) return null;
  return { from, to, type };
}

function exchangeTypeLabel(tx: Tx) {
  const meta = getExchangeMeta(tx);
  if (!meta) return typeLabel(tx.type);
  return `${meta.from} → ${meta.to}`;
}

function richTypeLabel(tx: Tx): string {
  const meta = getExchangeMeta(tx);
  if (meta) return `Échange ${meta.from} → ${meta.to}`;
  if (tx.operator === "NOWPAYMENTS" || (tx.currency === "USDT" && tx.type === "DEPOSIT")) {
    return "Dépôt Crypto (USDT)";
  }
  if (tx.operator === "CRYPTO" || (tx.currency === "USDT" && tx.type === "WITHDRAWAL")) {
    return "Retrait Crypto (USDT)";
  }
  if (tx.type === "DEPOSIT")    return "Dépôt Mobile Money";
  if (tx.type === "WITHDRAWAL") return "Retrait Mobile Money";
  if (tx.type === "TRANSFER")   return "Transfert";
  return tx.type;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="ml-2 text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2.5">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1 mt-4 first:mt-0">
      {children}
    </p>
  );
}

function TransactionDetail({ tx, open, onClose }: { tx: Tx | null; open: boolean; onClose: () => void }) {
  if (!tx) return null;

  const country = tx.country ? COUNTRIES.find((c) => c.code === tx.country) : null;
  const isWithdraw = tx.type === "WITHDRAWAL";
  const exMeta = getExchangeMeta(tx);
  const meta = tx.metadata as Record<string, string> | null;

  const feeCurrency  = exMeta ? (exMeta.type === "FIAT_TO_USDT" ? exMeta.from : "USDT") : tx.currency;
  const netCurrency  = exMeta ? exMeta.to : tx.currency;
  const netLabel     = exMeta
    ? (exMeta.type === "FIAT_TO_USDT" ? "USDT reçus" : "Fiat estimé")
    : (isWithdraw ? "Total débité" : "Montant reçu");

  const isCrypto    = tx.operator === "NOWPAYMENTS" || tx.operator === "CRYPTO";
  const cryptoAddr  = meta?.address as string | undefined;
  const cryptoTxId  = meta?.paymentId ?? meta?.txId as string | undefined;
  const exchRate    = meta?.exchangeRate as string | undefined;

  const label = richTypeLabel(tx);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[420px] overflow-y-auto p-0">
        {/* Header gradient */}
        <div className={`px-5 pt-6 pb-5 ${isWithdraw ? "bg-rose-50 dark:bg-rose-900/20" : "bg-emerald-50 dark:bg-emerald-900/20"}`}>
          <SheetHeader className="mb-0">
            <SheetTitle className="flex items-center gap-2 text-base">
              <TypeIcon type={tx.type} />
              <span>{label}</span>
            </SheetTitle>
          </SheetHeader>
          <div className="text-center mt-4">
            <div className="mb-2"><StatusBadge status={tx.status} pulse={tx.status === "PENDING"} /></div>
            <div className={`text-4xl font-extrabold tabular-nums ${isWithdraw ? "text-rose-600" : "text-emerald-600"}`}>
              {isWithdraw ? "−" : "+"}{fmtSmart(tx.amount, tx.currency)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{formatDate(tx.createdAt)}</div>
          </div>
        </div>

        <div className="px-5 pb-8">
          {/* ── Références ── */}
          <SectionTitle>Références</SectionTitle>

          <div className="space-y-1">
            <div className="flex justify-between items-center py-2.5 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Réf. YookPay</span>
              <span className="flex items-center gap-1">
                <span className="font-mono text-xs font-semibold">{tx.reference}</span>
                <CopyButton text={tx.reference} />
              </span>
            </div>

            {cryptoTxId && (
              <div className="flex justify-between items-center py-2.5 border-b border-border/50">
                <span className="text-sm text-muted-foreground">ID paiement crypto</span>
                <span className="flex items-center gap-1">
                  <span className="font-mono text-xs max-w-[160px] truncate">{cryptoTxId}</span>
                  <CopyButton text={String(cryptoTxId)} />
                </span>
              </div>
            )}

            {cryptoAddr && (
              <div className="flex justify-between items-start py-2.5 border-b border-border/50">
                <span className="text-sm text-muted-foreground shrink-0 mr-4">Adresse crypto</span>
                <span className="flex items-center gap-1">
                  <span className="font-mono text-xs max-w-[160px] truncate">{cryptoAddr}</span>
                  <CopyButton text={cryptoAddr} />
                </span>
              </div>
            )}
          </div>

          {/* ── Détails financiers ── */}
          <SectionTitle>Détails financiers</SectionTitle>
          <div className="divide-y divide-border/50">
            {exMeta && (
              <DetailRow label="Direction d'échange" value={
                <span className="font-semibold text-cyan-700 dark:text-cyan-400">{exMeta.from} → {exMeta.to}</span>
              } />
            )}
            <DetailRow label="Montant brut" value={
              <span className="font-mono font-semibold">{fmtSmart(tx.amount, tx.currency)}</span>
            } />
            <DetailRow
              label={`Frais${tx.feeRate ? ` (${(tx.feeRate * 100).toFixed(2)}%)` : ""}`}
              value={<span className="text-amber-600 font-mono">{fmtSmart(tx.fee, feeCurrency)}</span>}
            />
            <DetailRow
              label={netLabel}
              value={
                <span className={`font-semibold font-mono ${isWithdraw ? "text-rose-600" : "text-emerald-600"}`}>
                  {fmtSmart(tx.netAmount, netCurrency)}
                </span>
              }
            />
            {exchRate && (
              <DetailRow label="Taux de change" value={
                <span className="font-mono text-xs">
                  {parseFloat(exchRate).toLocaleString("en-US", { maximumFractionDigits: 4 })} {netCurrency}/{feeCurrency}
                </span>
              } />
            )}
          </div>

          {/* ── Informations ── */}
          <SectionTitle>Informations</SectionTitle>
          <div className="divide-y divide-border/50">
            <DetailRow label="Type" value={
              <span className="font-semibold">{label}</span>
            } />

            {!exMeta && <DetailRow label="Devise" value={tx.currency} />}

            {tx.phone && (
              <DetailRow label="Numéro de téléphone" value={
                <span className="flex items-center font-mono font-semibold">
                  {tx.phone}
                  <CopyButton text={tx.phone} />
                </span>
              } />
            )}

            {tx.operator && tx.operator !== "EXCHANGE" && !isCrypto && (
              <DetailRow label="Opérateur" value={
                <span className="font-semibold">{tx.operator}</span>
              } />
            )}

            {isCrypto && (
              <DetailRow label="Réseau" value="USDT (TRC20 / NowPayments)" />
            )}

            {country && (
              <DetailRow label="Pays" value={
                <span className="flex items-center gap-1.5">
                  <span>{country.flag}</span>
                  <span>{country.name}</span>
                </span>
              } />
            )}

            <DetailRow label="ID transaction" value={
              <span className="font-mono text-xs text-muted-foreground">#{tx.id}</span>
            } />

            <DetailRow label="Date de création" value={
              <span className="text-xs">{formatDate(tx.createdAt)}</span>
            } />
            <DetailRow label="Dernière mise à jour" value={
              <span className="text-xs">{formatDate(tx.updatedAt)}</span>
            } />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function Transactions() {
  const qc = useQueryClient();
  const [page, setPage]       = useState(1);
  const [status, setStatus]   = useState<string>("ALL");
  const [currency, setCurrency] = useState<string>("ALL");
  const [selectedTx, setSelectedTx] = useState<Tx | null>(null);
  const [sheetOpen, setSheetOpen]   = useState(false);

  const params: Record<string, unknown> = { page, limit: 10 };
  if (status !== "ALL")   params.status   = status;
  if (currency !== "ALL") params.currency = currency;

  // Track previous statuses to detect changes from PENDING → something else
  const prevStatusMapRef = useRef<Record<number, string>>({});

  const { data, isLoading, isFetching, refetch } = useGetTransactions(params as never, {
    query: {
      queryKey: getGetTransactionsQueryKey(params as never),
      // Poll every 3s while there are PENDING transactions on the current page
      refetchInterval: (query) => {
        const txs = (query.state.data as { transactions?: { status: string }[] } | undefined)?.transactions;
        return txs?.some((tx) => tx.status === "PENDING") ? 3000 : false;
      },
    },
  });

  // When statuses change (PENDING → SUCCESS/FAILED), refresh wallet balance
  useEffect(() => {
    if (!data?.transactions) return;
    const current: Record<number, string> = {};
    let changed = false;
    for (const tx of data.transactions) {
      current[tx.id] = tx.status;
      const prev = prevStatusMapRef.current[tx.id];
      if (prev === "PENDING" && tx.status !== "PENDING") {
        changed = true;
      }
    }
    if (changed) {
      qc.invalidateQueries({ queryKey: getGetWalletsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    }
    prevStatusMapRef.current = current;
  }, [data, qc]);

  // Keep selectedTx in sync with latest data from polling
  useEffect(() => {
    if (!selectedTx || !data?.transactions) return;
    const updated = data.transactions.find((tx) => tx.id === selectedTx.id);
    if (updated && updated.status !== selectedTx.status) {
      setSelectedTx(updated as unknown as Tx);
    }
  }, [data, selectedTx]);

  const hasPending = data?.transactions.some((tx) => tx.status === "PENDING") ?? false;

  const openDetail = (tx: Tx) => {
    setSelectedTx(tx);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CardTitle>Historique des transactions</CardTitle>
            {hasPending && (
              <span className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Mise à jour auto
              </span>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="w-[150px]" data-testid="filter-status">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les statuts</SelectItem>
                <SelectItem value="SUCCESS">Réussi</SelectItem>
                <SelectItem value="PENDING">En attente</SelectItem>
                <SelectItem value="FAILED">Échoué</SelectItem>
              </SelectContent>
            </Select>

            <Select value={currency} onValueChange={(v) => { setCurrency(v); setPage(1); }}>
              <SelectTrigger className="w-[150px]" data-testid="filter-currency">
                <SelectValue placeholder="Devise" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Toutes devises</SelectItem>
                <SelectItem value="XAF">XAF</SelectItem>
                <SelectItem value="XOF">XOF</SelectItem>
                <SelectItem value="CDF">CDF</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : data?.transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Aucune transaction trouvée.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.transactions.map((tx) => (
                    <TableRow
                      key={tx.id}
                      className="cursor-pointer hover:bg-muted/60 transition-colors"
                      onClick={() => openDetail(tx as unknown as Tx)}
                    >
                      <TableCell className="font-medium text-xs font-mono">{tx.reference}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <TypeIcon type={tx.type} />
                          <div>
                            <div className="text-sm font-medium">{richTypeLabel(tx as unknown as Tx)}</div>
                            {tx.operator && tx.operator !== "EXCHANGE" && tx.operator !== "CRYPTO" && tx.operator !== "NOWPAYMENTS" && (
                              <div className="text-xs text-muted-foreground">{tx.operator}</div>
                            )}
                            {tx.phone && (
                              <div className="text-xs text-muted-foreground font-mono">{tx.phone}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{fmtSmart(tx.amount, tx.currency)}</TableCell>
                      <TableCell>{(() => {
                        const meta = getExchangeMeta(tx as unknown as Tx);
                        return fmtSmart(tx.netAmount, meta ? meta.to : tx.currency);
                      })()}</TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(tx.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <StatusBadge status={tx.status} pulse={tx.status === "PENDING"} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Page {data.page} sur {data.totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Précédent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  disabled={page === data.totalPages}
                  data-testid="button-next-page"
                >
                  Suivant
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <TransactionDetail
        tx={selectedTx}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
}
