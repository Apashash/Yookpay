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
  ChevronLeft, ChevronRight, Search, X,
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
  feeRate: number | null;
  createdAt: string;
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

function formatAmount(n: number, currency: string) {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " " + currency;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "SUCCESS":  return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20 text-xs">Réussi</Badge>;
    case "PENDING":  return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/20 text-xs">En attente</Badge>;
    case "FAILED":   return <Badge className="bg-red-500/15 text-red-600 border-red-500/20 text-xs">Échoué</Badge>;
    case "EXPIRED":  return <Badge className="bg-gray-500/15 text-gray-600 border-gray-500/20 text-xs">Expiré</Badge>;
    default:         return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
}

function TypeIcon({ type }: { type: string }) {
  if (type === "DEPOSIT")    return <ArrowDownLeft  className="h-3.5 w-3.5 text-emerald-500" />;
  if (type === "WITHDRAWAL") return <ArrowUpRight   className="h-3.5 w-3.5 text-rose-500" />;
  return <ArrowLeftRight className="h-3.5 w-3.5 text-sky-500" />;
}

function typeLabel(t: string) {
  if (t === "DEPOSIT")    return "Dépôt";
  if (t === "WITHDRAWAL") return "Retrait";
  if (t === "TRANSFER")   return "Transfert";
  return t;
}

const STATUS_OPTIONS = ["", "SUCCESS", "PENDING", "FAILED", "EXPIRED"];
const TYPE_OPTIONS   = ["", "DEPOSIT", "WITHDRAWAL", "TRANSFER"];

export default function AdminTransactions() {
  const [page,   setPage]   = useState(1);
  const [status, setStatus] = useState("");
  const [type,   setType]   = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const { data, isLoading } = useQuery<TxPage>({
    queryKey: ["admin-transactions", page, status, type, search],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (status) params.set("status", status);
      if (type)   params.set("type",   type);
      if (search) params.set("search", search);
      return customFetch<TxPage>(`/api/admin/transactions?${params}`);
    },
    placeholderData: (prev: TxPage | undefined) => prev,
  });

  function applySearch() {
    setSearch(searchInput.trim());
    setPage(1);
  }

  function clearFilters() {
    setStatus(""); setType(""); setSearch(""); setSearchInput(""); setPage(1);
  }

  const hasFilters = status || type || search;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Historique des transactions</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {data ? `${data.total.toLocaleString("fr-FR")} transaction${data.total > 1 ? "s" : ""}` : "—"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="flex gap-1.5 flex-1 min-w-48">
          <Input
            placeholder="Référence, email ou nom…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applySearch()}
            className="h-8 text-sm"
          />
          <Button size="sm" variant="outline" className="h-8 px-2.5" onClick={applySearch}>
            <Search className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Status filter */}
        <div className="flex gap-1 flex-wrap">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s || "ALL"}
              onClick={() => { setStatus(s); setPage(1); }}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                status === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {s === ""           ? "Tous statuts"
               : s === "SUCCESS" ? "Réussi"
               : s === "PENDING" ? "En attente"
               : s === "FAILED"  ? "Échoué"
               :                   "Expiré"}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <div className="flex gap-1 flex-wrap">
          {TYPE_OPTIONS.map((t) => (
            <button
              key={t || "ALL"}
              onClick={() => { setType(t); setPage(1); }}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                type === t
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {t === ""             ? "Tous types"
               : t === "DEPOSIT"    ? "Dépôt"
               : t === "WITHDRAWAL" ? "Retrait"
               :                     "Transfert"}
            </button>
          ))}
        </div>

        {hasFilters && (
          <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs text-muted-foreground" onClick={clearFilters}>
            <X className="h-3 w-3" /> Effacer
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border rounded-2xl overflow-hidden">
        {/* Table header */}
        <div className="hidden md:grid grid-cols-[1fr_1fr_90px_130px_90px_90px] gap-3 px-4 py-2.5 bg-muted/40 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <span>Utilisateur</span>
          <span>Référence</span>
          <span>Type</span>
          <span className="text-right">Montant</span>
          <span className="text-right">Frais</span>
          <span>Statut</span>
        </div>

        {isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="px-4 py-3.5 flex gap-3 items-center">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : !data?.transactions.length ? (
          <div className="py-16 text-center text-muted-foreground text-sm">Aucune transaction trouvée</div>
        ) : (
          <div className="divide-y">
            {data.transactions.map((tx) => {
              const country = tx.country ? COUNTRIES.find((c) => c.code === tx.country) : null;
              return (
                <Link key={tx.id} href={`/admin/transactions/${tx.id}`}>
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_90px_130px_90px_90px] gap-1 md:gap-3 px-4 py-3.5 hover:bg-muted/30 cursor-pointer transition-colors group">
                    {/* User */}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{tx.userName || tx.userEmail}</p>
                      <p className="text-xs text-muted-foreground truncate">{tx.userEmail}</p>
                    </div>
                    {/* Reference */}
                    <div className="min-w-0 flex flex-col justify-center">
                      <p className="text-xs font-mono text-muted-foreground truncate">{tx.reference}</p>
                      <p className="text-xs text-muted-foreground/60">{fmtDate(tx.createdAt)}</p>
                    </div>
                    {/* Type */}
                    <div className="flex items-center gap-1.5">
                      <TypeIcon type={tx.type} />
                      <span className="text-xs font-medium">{typeLabel(tx.type)}</span>
                      {country && <span className="text-sm">{country.flag}</span>}
                    </div>
                    {/* Amount */}
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{formatAmount(tx.amount, tx.currency)}</p>
                      {tx.operator && <p className="text-xs text-muted-foreground">{tx.operator}</p>}
                    </div>
                    {/* Fee */}
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground tabular-nums">{formatAmount(tx.fee, tx.currency)}</p>
                    </div>
                    {/* Status */}
                    <div className="flex items-center">
                      <StatusBadge status={tx.status} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {data.page} / {data.pages}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm" variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="gap-1.5"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Précédent
            </Button>
            <Button
              size="sm" variant="outline"
              disabled={page >= (data.pages ?? 1)}
              onClick={() => setPage((p) => p + 1)}
              className="gap-1.5"
            >
              Suivant <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
