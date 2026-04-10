import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import {
  useGetDashboardSummary,
  useGetVolumeChart,
  getGetDashboardSummaryQueryKey,
  getGetVolumeChartQueryKey,
} from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDownRight,
  ArrowUpRight,
  Activity,
  TrendingUp,
  ArrowRightLeft,
  CalendarIcon,
  X,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, isAfter, isBefore } from "date-fns";
import { fr } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

type Period = "day" | "week" | "month" | "year" | "custom";
type TxType = "ALL" | "DEPOSIT" | "WITHDRAWAL" | "TRANSFER";

function getPeriodRange(period: Period, customRange: DateRange | undefined): { from: Date; to: Date } | null {
  const now = new Date();
  switch (period) {
    case "day":   return { from: startOfDay(now),   to: endOfDay(now) };
    case "week":  return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case "month": return { from: startOfMonth(now), to: endOfMonth(now) };
    case "year":  return { from: startOfYear(now),  to: endOfYear(now) };
    case "custom":
      if (customRange?.from && customRange?.to)   return { from: startOfDay(customRange.from), to: endOfDay(customRange.to) };
      if (customRange?.from)                       return { from: startOfDay(customRange.from), to: endOfDay(customRange.from) };
      return null;
    default: return null;
  }
}

export default function Dashboard() {
  const { user } = useAuth();

  const [period, setPeriod] = useState<Period>("month");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const [txType, setTxType] = useState<TxType>("ALL");

  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() },
  });

  const { data: volumeData, isLoading: isLoadingVolume } = useGetVolumeChart({
    query: { queryKey: getGetVolumeChartQueryKey() },
  });

  const periodRange = useMemo(() => getPeriodRange(period, customRange), [period, customRange]);

  // Sort wallets: the one with the most recent transaction comes first
  const sortedWallets = useMemo(() => {
    if (!summary) return [];
    const lastTxDate: Record<string, number> = {};
    for (const tx of summary.recentTransactions) {
      const t = new Date(tx.createdAt).getTime();
      if (!lastTxDate[tx.currency] || t > lastTxDate[tx.currency]) {
        lastTxDate[tx.currency] = t;
      }
    }
    return [...summary.wallets].sort((a, b) => {
      const da = lastTxDate[a.currency] ?? 0;
      const db = lastTxDate[b.currency] ?? 0;
      return db - da;
    });
  }, [summary]);

  const filteredTransactions = useMemo(() => {
    if (!summary) return [];
    return summary.recentTransactions.filter((tx) => {
      const txDate = new Date(tx.createdAt);
      const inRange = periodRange
        ? !isBefore(txDate, periodRange.from) && !isAfter(txDate, periodRange.to)
        : true;
      const matchType = txType === "ALL" || tx.type === txType;
      return inRange && matchType;
    });
  }, [summary, periodRange, txType]);

  function rangeLabel(): string {
    if (period !== "custom") {
      const labels: Record<Period, string> = {
        day: "Aujourd'hui", week: "Cette semaine", month: "Ce mois", year: "Cette année", custom: "",
      };
      return labels[period];
    }
    if (customRange?.from && customRange?.to) {
      return `${format(customRange.from, "d MMM", { locale: fr })} → ${format(customRange.to, "d MMM yyyy", { locale: fr })}`;
    }
    if (customRange?.from) return format(customRange.from, "d MMM yyyy", { locale: fr });
    return "Choisir période";
  }
  const activeLabel = rangeLabel();

  const PERIODS: { key: Period; label: string }[] = [
    { key: "day",   label: "Jour" },
    { key: "week",  label: "Semaine" },
    { key: "month", label: "Mois" },
    { key: "year",  label: "Année" },
  ];

  if (isLoadingSummary || !summary) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-[120px] mb-2" />
                <Skeleton className="h-3 w-[80px]" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <Skeleton className="h-6 w-[150px] mb-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
          <Card className="col-span-3">
            <CardHeader>
              <Skeleton className="h-6 w-[150px] mb-2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUCCESS":
        return <Badge className="bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 border-emerald-500/20">Succès</Badge>;
      case "PENDING":
        return <Badge className="bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 border-amber-500/20">En attente</Badge>;
      case "FAILED":
        return <Badge className="bg-rose-500/15 text-rose-500 hover:bg-rose-500/25 border-rose-500/20">Échoué</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const walletMeta: Record<string, {
    label: string; gradient: string; border: string; badge: string; dot: string;
  }> = {
    XAF:  { label: "Afrique Centrale",   gradient: "from-violet-600 via-indigo-600 to-indigo-700",  border: "border-indigo-400/30",  badge: "bg-white/15 text-white", dot: "bg-violet-300" },
    XOF:  { label: "Afrique de l'Ouest", gradient: "from-emerald-500 via-teal-600 to-teal-700",     border: "border-emerald-400/30", badge: "bg-white/15 text-white", dot: "bg-emerald-300" },
    CDF:  { label: "Afrique Centrale",   gradient: "from-amber-500 via-orange-500 to-orange-600",   border: "border-amber-400/30",   badge: "bg-white/15 text-white", dot: "bg-amber-300" },
    USDT: { label: "Crypto / USDT",      gradient: "from-cyan-600 via-sky-600 to-blue-700",         border: "border-cyan-400/30",    badge: "bg-white/15 text-white", dot: "bg-cyan-300" },
  };

  return (
    <div className="space-y-6">

      {/* ── Wallet Balance Cards ── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {sortedWallets.map((wallet) => {
          const meta = walletMeta[wallet.currency] ?? {
            label: wallet.currency,
            gradient: "from-slate-600 to-slate-700",
            border: "border-slate-400/30",
            badge: "bg-white/15 text-white",
            dot: "bg-slate-300",
          };
          return (
            <div
              key={wallet.id}
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${meta.gradient} ${meta.border} border p-5 shadow-lg`}
              data-testid={`wallet-card-${wallet.currency}`}
            >
              <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10" />
              <div className="absolute -bottom-8 -right-2 w-20 h-20 rounded-full bg-white/5" />

              <div className="relative flex items-center justify-between mb-4">
                <span className={`text-sm font-bold px-3 py-1 rounded-full ${meta.badge} backdrop-blur-sm tracking-widest`}>
                  {wallet.currency}
                </span>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${meta.dot} animate-pulse`} />
                  <span className="text-xs text-white/70 font-medium">Actif</span>
                </div>
              </div>

              <p className="relative text-xs font-medium text-white/60 uppercase tracking-widest mb-1">
                {meta.label}
              </p>

              <div
                className="relative text-3xl font-extrabold text-white tracking-tight"
                data-testid={`text-balance-${wallet.currency}`}
              >
                {formatCurrency(wallet.balance, wallet.currency)}
              </div>

              {wallet.currency === "USDT" && (wallet as any).lockedBalance > 0 ? (
                <div className="relative mt-3 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/60">Disponible</span>
                    <span className="text-white font-semibold">
                      {formatCurrency(wallet.balance - (wallet as any).lockedBalance, "USDT")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-amber-300/80">Verrouillé (échange)</span>
                    <span className="text-amber-300 font-semibold">
                      {formatCurrency((wallet as any).lockedBalance, "USDT")}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="relative mt-4 flex items-center gap-1 text-white/70 text-xs">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Solde disponible</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Filter Bar ── */}
      <Card className="border-border/60">
        <CardContent className="py-4 px-4">
          <div className="flex flex-wrap items-center gap-2">

            {/* Period quick-select pills */}
            <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
              {PERIODS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { setPeriod(key); setCustomDate(undefined); }}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    period === key && key !== "custom"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Calendar range picker */}
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <button
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                    period === "custom"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <CalendarIcon className="w-4 h-4" />
                  {period === "custom" && customRange?.from
                    ? customRange.to
                      ? `${format(customRange.from, "d MMM", { locale: fr })} → ${format(customRange.to, "d MMM yyyy", { locale: fr })}`
                      : format(customRange.from, "d MMM yyyy", { locale: fr })
                    : "Période"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3 border-b border-border">
                  <p className="text-xs text-muted-foreground font-medium">Sélectionnez une plage de dates</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Cliquez sur le début puis la fin de la période</p>
                </div>
                <Calendar
                  mode="range"
                  selected={customRange}
                  onSelect={(range) => {
                    setCustomRange(range ?? undefined);
                    setPeriod("custom");
                    if (range?.from && range?.to) setCalendarOpen(false);
                  }}
                  disabled={(date) => date > new Date()}
                  numberOfMonths={1}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Clear custom range */}
            {period === "custom" && customRange && (
              <button
                onClick={() => { setPeriod("month"); setCustomRange(undefined); }}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                aria-label="Effacer la période"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Transaction type select */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Type :</span>
              <Select value={txType} onValueChange={(v) => setTxType(v as TxType)}>
                <SelectTrigger className="w-36 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous</SelectItem>
                  <SelectItem value="DEPOSIT">Dépôt</SelectItem>
                  <SelectItem value="WITHDRAWAL">Retrait</SelectItem>
                  <SelectItem value="TRANSFER">Transfert</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active filter label */}
          <p className="text-xs text-muted-foreground mt-2 pl-1">
            Affichage : <span className="font-semibold text-foreground">{activeLabel}</span>
            {txType !== "ALL" && (
              <> · type <span className="font-semibold text-foreground">{txType === "DEPOSIT" ? "Dépôt" : txType === "WITHDRAWAL" ? "Retrait" : "Transfert"}</span></>
            )}
          </p>
        </CardContent>
      </Card>

      {/* ── Stats row ── */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Déposé</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalDeposited, "XAF")}</div>
            <p className="text-xs text-muted-foreground mt-1">+20.1% vs mois dernier</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Retiré</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalWithdrawn, "XAF")}</div>
            <p className="text-xs text-muted-foreground mt-1">+10.1% vs mois dernier</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Taux de succès</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.successRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">Sur {summary.transactionCount} transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Frais payés</CardTitle>
            <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground font-bold">%</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalFeesPaid, "XAF")}</div>
            <p className="text-xs text-muted-foreground mt-1">Frais de traitement</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Chart + Recent Activity ── */}
      <div className="grid gap-6 md:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Volume (7 derniers jours)</CardTitle>
            <CardDescription>
              Volume agrégé toutes devises confondues (équivalent XAF)
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {isLoadingVolume ? (
              <Skeleton className="h-[300px] w-full" />
            ) : volumeData && volumeData.length > 0 ? (
              <div className="h-[300px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={volumeData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorDeposits" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorWithdrawals" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                      itemStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Area type="monotone" dataKey="deposits" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorDeposits)" name="Dépôts" />
                    <Area type="monotone" dataKey="withdrawals" stroke="hsl(var(--chart-3))" fillOpacity={1} fill="url(#colorWithdrawals)" name="Retraits" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Aucune donnée de volume disponible
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle>Activité récente</CardTitle>
              <CardDescription>
                {filteredTransactions.length === 0
                  ? "Aucune transaction pour la période sélectionnée"
                  : `${filteredTransactions.length} transaction${filteredTransactions.length > 1 ? "s" : ""}`}
              </CardDescription>
            </div>
            <Link href="/transactions" className="text-sm font-medium text-primary hover:underline">
              Voir tout
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-5 mt-2">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center">
                    <div className={`mr-4 h-9 w-9 rounded-full flex items-center justify-center border flex-shrink-0 ${
                      tx.type === "DEPOSIT"
                        ? "bg-primary/10 text-primary border-primary/20"
                        : tx.type === "WITHDRAWAL"
                        ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                        : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                    }`}>
                      {tx.type === "DEPOSIT"
                        ? <ArrowDownRight className="h-4 w-4" />
                        : tx.type === "WITHDRAWAL"
                        ? <ArrowUpRight className="h-4 w-4" />
                        : <ArrowRightLeft className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 space-y-0.5 min-w-0">
                      <p className="text-sm font-medium leading-none">
                        {tx.type === "DEPOSIT" ? "Dépôt" : tx.type === "WITHDRAWAL" ? "Retrait" : "Transfert"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {formatDate(tx.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 ml-2">
                      <div className="font-semibold text-sm">
                        {tx.type === "WITHDRAWAL" ? "-" : "+"}{formatCurrency(tx.amount, tx.currency)}
                      </div>
                      {getStatusBadge(tx.status)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  Aucune transaction trouvée pour cette période.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
