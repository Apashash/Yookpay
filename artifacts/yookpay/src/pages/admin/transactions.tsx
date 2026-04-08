import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { customFetch } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { COUNTRIES } from "@/lib/countries";
import {
  ArrowDownLeft, ArrowUpRight, ArrowLeftRight,
  ChevronLeft, ChevronRight, Search, X, Copy, Check,
  ChevronDown, ChevronUp, ExternalLink,
} from "lucide-react";

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

function fmt(n: number, currency: string) {
  const dec = currency === "USDT" ? 4 : 0;
  return n.toLocaleString("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + " " + currency;
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

function ExpandedDetail({ tx }: { tx: AdminTx }) {
  const country = tx.country ? COUNTRIES.find((c) => c.code === tx.country) : null;
  const exMeta = getExchangeMeta(tx);

  // For exchange transactions the currencies are mixed:
  // Step1 (FIAT→USDT): amount=XAF, fee=XAF, netAmount=USDT
  // Step2 (USDT→FIAT): amount=USDT, fee=USDT, netAmount=XAF
  const feeCurrency   = exMeta ? (exMeta.type === "FIAT_TO_USDT" ? exMeta.from : "USDT") : tx.currency;
  const netCurrency   = exMeta ? exMeta.to : tx.currency;
  const netLabel      = exMeta ? (exMeta.type === "FIAT_TO_USDT" ? "USDT reçus" : "Fiat estimé") : "Net perçu";

  return (
    <div className="bg-muted/30 border-t px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-xs">
      {/* Col 1 */}
      <div className="space-y-1.5">
        {exMeta && (
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Type d'échange</span>
            <span className="font-semibold text-cyan-700 dark:text-cyan-400">{exMeta.from} → {exMeta.to}</span>
          </div>
        )}
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Montant brut</span>
          <span className="font-semibold tabular-nums">{fmt(tx.amount, tx.currency)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Frais{tx.feeRate != null ? ` (${(tx.feeRate * 100).toFixed(2)}%)` : ""}</span>
          <span className="tabular-nums text-amber-600">{fmt(tx.fee, feeCurrency)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">{netLabel}</span>
          <span className="font-semibold tabular-nums">{fmt(tx.netAmount, netCurrency)}</span>
        </div>
        {tx.phone && (
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Téléphone</span>
            <span className="font-mono">{tx.phone}</span>
          </div>
        )}
        {country && (
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Pays</span>
            <span>{country.flag} {country.name}</span>
          </div>
        )}
        {tx.operator && tx.operator !== "EXCHANGE" && (
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Opérateur</span>
            <span>{tx.operator}</span>
          </div>
        )}
      </div>
      {/* Col 2 */}
      <div className="space-y-1.5">
        <div className="flex justify-between gap-2 min-w-0">
          <span className="text-muted-foreground flex-shrink-0">Réf. YookPay</span>
          <span className="flex items-center gap-1 min-w-0">
            <span className="font-mono truncate max-w-[180px]">{tx.reference}</span>
            <CopyBtn text={tx.reference} />
          </span>
        </div>
        {tx.providerReference && (
          <div className="flex justify-between gap-2 min-w-0">
            <span className="text-muted-foreground flex-shrink-0">Réf. PixPay</span>
            <span className="flex items-center gap-1 min-w-0">
              <span className="font-mono truncate max-w-[180px]">{tx.providerReference}</span>
              <CopyBtn text={tx.providerReference} />
            </span>
          </div>
        )}
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Créée le</span>
          <span>{fmtDateFull(tx.createdAt)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">MAJ</span>
          <span>{fmtDateFull(tx.updatedAt)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Utilisateur</span>
          <Link href={`/admin/users/${tx.userId}`} onClick={(e) => e.stopPropagation()}>
            <span className="flex items-center gap-1 text-primary hover:underline">
              {tx.userName || tx.userEmail}
              <ExternalLink className="h-2.5 w-2.5" />
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}

const STATUS_OPTIONS = ["", "SUCCESS", "PENDING", "FAILED", "EXPIRED"];
const TYPE_OPTIONS   = ["", "DEPOSIT", "WITHDRAWAL", "TRANSFER"];

export default function AdminTransactions() {
  const [page,         setPage]         = useState(1);
  const [status,       setStatus]       = useState("");
  const [type,         setType]         = useState("");
  const [search,       setSearch]       = useState("");
  const [searchInput,  setSearchInput]  = useState("");
  const [expandedId,   setExpandedId]   = useState<number | null>(null);

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

  function applySearch() { setSearch(searchInput.trim()); setPage(1); }
  function clearFilters() { setStatus(""); setType(""); setSearch(""); setSearchInput(""); setPage(1); }
  const hasFilters = status || type || search;

  function toggleRow(id: number) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">Historique des transactions</h1>
        <p className="text-muted-foreground text-xs mt-0.5">
          {data ? `${data.total.toLocaleString("fr-FR")} transaction${data.total > 1 ? "s" : ""}` : "—"}
        </p>
      </div>

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
              const isOpen = expandedId === tx.id;
              return (
                <div key={tx.id}>
                  {/* Main row — compact */}
                  <div
                    onClick={() => toggleRow(tx.id)}
                    className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_90px_100px_80px_70px_16px] gap-2 px-3 py-2 hover:bg-muted/30 cursor-pointer transition-colors items-center"
                  >
                    {/* User + ref */}
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate leading-tight">{tx.userName || tx.userEmail}</p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{tx.reference}</p>
                      <p className="text-[10px] text-muted-foreground/60 sm:hidden">{fmtDate(tx.createdAt)}</p>
                    </div>
                    {/* Type */}
                    <div className="hidden sm:flex items-center gap-1">
                      <TypeDot type={tx.type} />
                      <span className="text-[10px] font-medium">{exchangeLabel(tx)}</span>
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
                    {/* Chevron */}
                    <div className="hidden sm:flex justify-end">
                      {isOpen
                        ? <ChevronUp   className="h-3 w-3 text-muted-foreground" />
                        : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isOpen && <ExpandedDetail tx={tx} />}
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
