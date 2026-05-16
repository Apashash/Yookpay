import { useState, useEffect, useRef } from "react";
import {
  useGetTransactions,
  getGetTransactionsQueryKey,
  getGetWalletsQueryKey,
  getGetDashboardSummaryQueryKey,
  customFetch,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  ChevronLeft,
  ChevronRight,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowRightLeft,
  Copy,
  Check,
  RefreshCw,
  Pencil,
  Send,
  Loader2,
} from "lucide-react";
import { COUNTRIES } from "@/lib/countries";
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from "date-fns";
import { fr } from "date-fns/locale";

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
      return <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 border-emerald-500/20 text-[10px] px-1.5 py-0.5">Réussi</Badge>;
    case "PENDING":
      return (
        <Badge className="bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 border-amber-500/20 text-[10px] px-1.5 py-0.5">
          {pulse && <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mr-1 animate-pulse" />}
          En attente
        </Badge>
      );
    case "FAILED":
      return <Badge className="bg-rose-500/15 text-rose-600 hover:bg-rose-500/25 border-rose-500/20 text-[10px] px-1.5 py-0.5">Échoué</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">{status}</Badge>;
  }
}

function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case "DEPOSIT":    return <ArrowDownCircle className="h-5 w-5 text-emerald-500 shrink-0" />;
    case "WITHDRAWAL": return <ArrowUpCircle className="h-5 w-5 text-rose-500 shrink-0" />;
    case "TRANSFER":   return <ArrowRightLeft className="h-5 w-5 text-blue-500 shrink-0" />;
    default:           return null;
  }
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

function isRectified(tx: Tx): boolean {
  const m = tx.metadata as Record<string, unknown> | null;
  return !!m?.isRectification;
}

function RectificationBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-600 border border-violet-500/20">
      <Pencil className="h-2 w-2" />
      Rectification
    </span>
  );
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

function fmtSmart(n: number, currency: string) {
  const dec = currency === "USDT" ? 4 : 0;
  return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + " " + currency;
}

function fmtTime(d: string | Date) {
  return format(new Date(d), "HH:mm");
}

function dateGroupLabel(d: string | Date): string {
  const date = new Date(d);
  if (isToday(date)) return "Aujourd'hui";
  if (isYesterday(date)) return "Hier";
  if (isThisWeek(date, { locale: fr })) return format(date, "EEEE", { locale: fr }).replace(/^\w/, (c) => c.toUpperCase());
  if (isThisMonth(date)) return format(date, "d MMMM", { locale: fr });
  return format(date, "d MMMM yyyy", { locale: fr });
}

function groupByDate(txs: Tx[]): { label: string; transactions: Tx[] }[] {
  const groups: Map<string, Tx[]> = new Map();
  for (const tx of txs) {
    const label = dateGroupLabel(tx.createdAt);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(tx);
  }
  return Array.from(groups.entries()).map(([label, transactions]) => ({ label, transactions }));
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

function SendNotifButton({ txId }: { txId: number }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);

  const handleSend = async () => {
    setLoading(true);
    try {
      const result = await customFetch(`/api/transactions/${txId}/notify`, { method: "POST" }) as { message?: string };
      setSent(true);
      toast({ title: "Notification envoyée", description: result?.message ?? "Votre serveur a bien été notifié." });
      setTimeout(() => setSent(false), 4000);
    } catch (err: unknown) {
      const raw = (err as { message?: string })?.message ?? "Erreur inconnue";
      const msg = raw.replace(/^HTTP\s+\d+[^:]*:\s*/i, "");
      if (msg.includes("NoWebhookUrl")) {
        toast({ variant: "destructive", title: "URL webhook manquante", description: "Configurez une URL webhook dans vos paramètres de compte." });
      } else {
        toast({ variant: "destructive", title: "Échec de la notification", description: msg });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      className="w-full gap-2 mt-1"
      onClick={handleSend}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : sent ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Send className="h-3.5 w-3.5" />
      )}
      {sent ? "Notification envoyée !" : "Envoyer notification"}
    </Button>
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
          {isRectified(tx) && (
            <div className="mt-4 mb-2 flex items-start gap-2 rounded-xl border border-violet-500/30 bg-violet-500/5 px-3 py-2.5">
              <Pencil className="h-3.5 w-3.5 text-violet-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-violet-700 dark:text-violet-400">Transaction rectifiée</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cette transaction a été modifiée manuellement par l'administration.
                  {(tx.metadata as Record<string, unknown>)?.adminNote
                    ? ` Note : ${(tx.metadata as Record<string, unknown>).adminNote}`
                    : ""}
                </p>
              </div>
            </div>
          )}
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

          <SectionTitle>Informations</SectionTitle>
          <div className="divide-y divide-border/50">
            <DetailRow label="Type" value={<span className="font-semibold">{label}</span>} />
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
              <DetailRow label="Opérateur" value={<span className="font-semibold">{tx.operator}</span>} />
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

          <div className="pt-4 border-t border-border/50 mt-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">Actions</p>
            <SendNotifButton txId={tx.id} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function Transactions() {
  const qc = useQueryClient();
  const [page, setPage]         = useState(1);
  const [status, setStatus]     = useState<string>("ALL");
  const [currency, setCurrency] = useState<string>("ALL");
  const [selectedTx, setSelectedTx] = useState<Tx | null>(null);
  const [sheetOpen, setSheetOpen]   = useState(false);

  const params: Record<string, unknown> = { page, limit: 20 };
  if (status !== "ALL")   params.status   = status;
  if (currency !== "ALL") params.currency = currency;

  const prevStatusMapRef = useRef<Record<number, string>>({});

  const { data, isLoading, isFetching, refetch } = useGetTransactions(params as never, {
    query: {
      queryKey: getGetTransactionsQueryKey(params as never),
      refetchInterval: (query) => {
        const txs = (query.state.data as { transactions?: { status: string }[] } | undefined)?.transactions;
        return txs?.some((tx) => tx.status === "PENDING") ? 3000 : false;
      },
    },
  });

  useEffect(() => {
    if (!data?.transactions) return;
    const current: Record<number, string> = {};
    let changed = false;
    for (const tx of data.transactions) {
      current[tx.id] = tx.status;
      const prev = prevStatusMapRef.current[tx.id];
      if (prev === "PENDING" && tx.status !== "PENDING") changed = true;
    }
    if (changed) {
      qc.invalidateQueries({ queryKey: getGetWalletsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    }
    prevStatusMapRef.current = current;
  }, [data, qc]);

  useEffect(() => {
    if (!selectedTx || !data?.transactions) return;
    const updated = data.transactions.find((tx) => tx.id === selectedTx.id);
    if (updated && updated.status !== selectedTx.status) {
      setSelectedTx(updated as unknown as Tx);
    }
  }, [data, selectedTx]);

  const hasPending = data?.transactions.some((tx) => tx.status === "PENDING") ?? false;
  const groups = groupByDate((data?.transactions ?? []) as unknown as Tx[]);

  const openDetail = (tx: Tx) => {
    setSelectedTx(tx);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
          <div className="flex items-center gap-3">
            <CardTitle>Historique des transactions</CardTitle>
            {hasPending && (
              <span className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Mise à jour auto
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="w-[140px] h-9">
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
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Devise" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Toutes devises</SelectItem>
                <SelectItem value="XAF">XAF</SelectItem>
                <SelectItem value="XOF">XOF</SelectItem>
                <SelectItem value="CDF">CDF</SelectItem>
                <SelectItem value="USDT">USDT</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-1.5 h-9"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3 px-1">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <div className="text-right space-y-1.5">
                    <Skeleton className="h-4 w-24 ml-auto" />
                    <Skeleton className="h-3 w-14 ml-auto" />
                  </div>
                </div>
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Aucune transaction trouvée.
            </div>
          ) : (
            <div className="space-y-1">
              {groups.map((group) => (
                <div key={group.label}>
                  {/* Section header */}
                  <div className="px-1 pt-4 pb-1 first:pt-0">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">
                      {group.label}
                    </span>
                  </div>

                  {/* Transactions in this group */}
                  <div className="rounded-xl border border-border overflow-hidden divide-y divide-border/60">
                    {group.transactions.map((tx) => {
                      const exMeta = getExchangeMeta(tx);
                      const isWithdraw = tx.type === "WITHDRAWAL";
                      const netCur = exMeta ? exMeta.to : tx.currency;
                      const sub = tx.operator && tx.operator !== "EXCHANGE" && tx.operator !== "CRYPTO" && tx.operator !== "NOWPAYMENTS"
                        ? tx.operator
                        : tx.phone ?? null;

                      return (
                        <button
                          key={tx.id}
                          className="w-full flex items-center gap-3 px-4 py-3.5 bg-card hover:bg-muted/50 transition-colors text-left"
                          onClick={() => openDetail(tx)}
                        >
                          {/* Icon */}
                          <div className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 ${
                            isWithdraw ? "bg-rose-500/10" : tx.type === "TRANSFER" ? "bg-blue-500/10" : "bg-emerald-500/10"
                          }`}>
                            <TypeIcon type={tx.type} />
                          </div>

                          {/* Label + sub */}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{richTypeLabel(tx)}</div>
                            {sub && (
                              <div className="text-xs text-muted-foreground font-mono truncate">{sub}</div>
                            )}
                            {isRectified(tx) && (
                              <div className="mt-0.5"><RectificationBadge /></div>
                            )}
                          </div>

                          {/* Amount + status + time */}
                          <div className="text-right shrink-0">
                            <div className={`text-sm font-semibold tabular-nums ${isWithdraw ? "text-rose-600" : "text-emerald-600"}`}>
                              {isWithdraw ? "−" : "+"}{fmtSmart(tx.amount, tx.currency)}
                            </div>
                            <div className="flex items-center justify-end gap-1.5 mt-0.5">
                              <StatusBadge status={tx.status} pulse={tx.status === "PENDING"} />
                              <span className="text-[10px] text-muted-foreground/60">{fmtTime(tx.createdAt)}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
              <div className="text-sm text-muted-foreground">
                Page {data.page} sur {data.totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Précédent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  disabled={page === data.totalPages}
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
