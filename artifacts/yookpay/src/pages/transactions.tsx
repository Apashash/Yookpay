import { useState } from "react";
import {
  useGetTransactions,
  getGetTransactionsQueryKey,
} from "@workspace/api-client-react";
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

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "SUCCESS":
      return <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 border-emerald-500/20">Réussi</Badge>;
    case "PENDING":
      return <Badge className="bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 border-amber-500/20">En attente</Badge>;
    case "FAILED":
      return <Badge className="bg-rose-500/15 text-rose-600 hover:bg-rose-500/25 border-rose-500/20">Échoué</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case "DEPOSIT":
      return <ArrowDownCircle className="h-5 w-5 text-emerald-500" />;
    case "WITHDRAWAL":
      return <ArrowUpCircle className="h-5 w-5 text-rose-500" />;
    case "TRANSFER":
      return <ArrowRightLeft className="h-5 w-5 text-blue-500" />;
    default:
      return null;
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

function TransactionDetail({ tx, open, onClose }: { tx: Tx | null; open: boolean; onClose: () => void }) {
  if (!tx) return null;

  const country = tx.country ? COUNTRIES.find((c) => c.code === tx.country) : null;

  const isDeposit  = tx.type === "DEPOSIT";
  const isWithdraw = tx.type === "WITHDRAWAL";

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <TypeIcon type={tx.type} />
            {typeLabel(tx.type)}
          </SheetTitle>
        </SheetHeader>

        {/* Status + Montant principal */}
        <div className="bg-muted rounded-xl p-5 text-center mb-6">
          <div className="mb-2"><StatusBadge status={tx.status} /></div>
          <div className="text-3xl font-bold mt-2">
            <span className={isWithdraw ? "text-rose-600" : "text-emerald-600"}>
              {isWithdraw ? "−" : "+"}{formatCurrency(tx.amount, tx.currency)}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">{formatDate(tx.createdAt)}</div>
        </div>

        {/* Référence */}
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-1">Référence</p>
          <div className="flex items-center bg-muted rounded-lg px-3 py-2">
            <span className="font-mono text-xs flex-1 truncate">{tx.reference}</span>
            <CopyButton text={tx.reference} />
          </div>
        </div>

        <Separator className="my-4" />

        {/* Détails financiers */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Détails financiers</p>
          <DetailRow label="Montant brut" value={formatCurrency(tx.amount, tx.currency)} />
          <DetailRow
            label={`Frais${tx.feeRate ? ` (${(tx.feeRate * 100).toFixed(1)}%)` : ""}`}
            value={<span className="text-rose-500">+ {formatCurrency(tx.fee, tx.currency)}</span>}
          />
          <DetailRow
            label={isDeposit ? "Montant reçu" : isWithdraw ? "Total débité" : "Montant net"}
            value={
              <span className={isDeposit ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
                {formatCurrency(tx.netAmount, tx.currency)}
              </span>
            }
          />
        </div>

        <Separator className="my-4" />

        {/* Informations de transaction */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Informations</p>
          <DetailRow label="Type" value={typeLabel(tx.type)} />
          <DetailRow label="Devise" value={tx.currency} />
          {country && (
            <DetailRow
              label="Pays"
              value={
                <span className="flex items-center gap-1.5">
                  <span>{country.flag}</span>
                  <span>{country.name}</span>
                </span>
              }
            />
          )}
          {tx.operator && <DetailRow label="Opérateur" value={tx.operator} />}
          {tx.phone && (
            <DetailRow
              label="Numéro"
              value={
                <span className="flex items-center font-mono">
                  {tx.phone}
                  <CopyButton text={tx.phone} />
                </span>
              }
            />
          )}
          <DetailRow label="Date de création" value={formatDate(tx.createdAt)} />
          <DetailRow label="Dernière mise à jour" value={formatDate(tx.updatedAt)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function Transactions() {
  const [page, setPage]     = useState(1);
  const [status, setStatus]   = useState<string>("ALL");
  const [currency, setCurrency] = useState<string>("ALL");
  const [selectedTx, setSelectedTx] = useState<Tx | null>(null);
  const [sheetOpen, setSheetOpen]   = useState(false);

  const params: Record<string, unknown> = { page, limit: 10 };
  if (status !== "ALL")   params.status   = status;
  if (currency !== "ALL") params.currency = currency;

  const { data, isLoading } = useGetTransactions(params as never, {
    query: { queryKey: getGetTransactionsQueryKey(params as never) },
  });

  const openDetail = (tx: Tx) => {
    setSelectedTx(tx);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle>Historique des transactions</CardTitle>
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
                            <div className="text-sm">{typeLabel(tx.type)}</div>
                            {tx.operator && <div className="text-xs text-muted-foreground">{tx.operator}</div>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(tx.amount, tx.currency)}</TableCell>
                      <TableCell>{formatCurrency(tx.netAmount, tx.currency)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(tx.createdAt)}</TableCell>
                      <TableCell className="text-right"><StatusBadge status={tx.status} /></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
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
