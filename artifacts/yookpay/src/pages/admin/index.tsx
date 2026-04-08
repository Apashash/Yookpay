import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, FileCheck, ArrowRightLeft, ShieldCheck,
  ChevronRight, TrendingUp, BadgeDollarSign, CheckCircle2, History, Coins,
  ArrowDownCircle, ArrowUpCircle,
} from "lucide-react";

interface AdminStats {
  totalUsers: number;
  pendingKyc: number;
  totalTx: number;
  customFees: number;
  successTx: number;
  totalVolume: number;
  totalMargin: number;
  totalFees: number;
  depositMargin: number;
  withdrawalMargin: number;
  verifiedUsers: number;
  byCurrency: Array<{
    currency: string;
    volume: number;
    margin: number;
    fees: number;
    depositMargin: number;
    withdrawalMargin: number;
    count: number;
  }>;
}

function fmtAmount(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 }) + " M";
  if (n >= 1_000) return (n / 1_000).toLocaleString("en-US", { maximumFractionDigits: 1 }) + " K";
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  colorClass,
  isLoading,
  href,
}: {
  label: string;
  value: string | number | undefined;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  isLoading: boolean;
  href?: string;
}) {
  const inner = (
    <div className={`relative bg-card border rounded-2xl p-5 ${href ? "hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group" : ""}`}>
      <div className="flex items-start justify-between">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${colorClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        {href && <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors mt-1" />}
      </div>
      <div className="mt-4">
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-28 mb-1" />
            <Skeleton className="h-3 w-20" />
          </>
        ) : (
          <>
            <p className="text-2xl font-bold tracking-tight">{value ?? 0}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
            {sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
          </>
        )}
      </div>
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function AdminDashboard() {
  const { data, isLoading } = useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    queryFn: () => customFetch<AdminStats>("/api/admin/stats"),
  });

  const marginRate = data && data.totalVolume > 0
    ? ((data.totalMargin / data.totalVolume) * 100).toFixed(2)
    : "—";

  return (
    <div className="max-w-5xl mx-auto space-y-7">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vue d'ensemble</h1>
          <p className="text-muted-foreground text-sm">Tableau de bord YookPay</p>
        </div>
      </div>

      {/* Section — Activité financière */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Activité financière</p>
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Volume traité"
            value={data ? fmtAmount(data.totalVolume) + " F" : undefined}
            sub={`${data?.successTx ?? 0} transaction${(data?.successTx ?? 0) > 1 ? "s" : ""} réussies`}
            icon={TrendingUp}
            colorClass="bg-green-50 text-green-600"
            isLoading={isLoading}
          />
          <StatCard
            label="Marge YookPay nette"
            value={data ? fmtAmount(data.totalMargin) + " F" : undefined}
            sub={`Taux moyen ${marginRate}%`}
            icon={BadgeDollarSign}
            colorClass="bg-emerald-50 text-emerald-600"
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Marge YookPay détaillée — Dépôts vs Retraits */}
      <div className="bg-card border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b bg-muted/30 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Marge YookPay — Détail</p>
          {isLoading ? (
            <Skeleton className="h-4 w-24" />
          ) : (
            <span className="text-xs text-muted-foreground">Total brut : {fmtAmount(data?.totalFees ?? 0)} F</span>
          )}
        </div>
        <div className="grid grid-cols-2 divide-x">
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownCircle className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dépôts</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-28 mt-1" />
            ) : (
              <p className="text-xl font-bold text-blue-700 tabular-nums">
                +{fmtAmount(data?.depositMargin ?? 0)} F
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">Marge perçue sur dépôts</p>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpCircle className="h-4 w-4 text-violet-500" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Retraits</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-28 mt-1" />
            ) : (
              <p className="text-xl font-bold text-violet-700 tabular-nums">
                +{fmtAmount(data?.withdrawalMargin ?? 0)} F
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">Marge perçue sur retraits</p>
          </div>
        </div>
      </div>

      {/* Détail par devise */}
      {!isLoading && (data?.byCurrency?.length ?? 0) > 0 && (
        <div className="bg-card border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b bg-muted/30">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Marge par devise</p>
          </div>
          <div className="divide-y">
            {(data?.byCurrency ?? []).map((row) => (
              <div key={row.currency} className="px-5 py-3.5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary">{row.currency}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{row.currency}</p>
                    <p className="text-xs text-muted-foreground">{row.count} tx — Volume : {fmtAmount(row.volume)} {row.currency}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-700 tabular-nums">+{fmtAmount(row.margin)} {row.currency}</p>
                    <p className="text-xs text-muted-foreground">Marge nette</p>
                  </div>
                </div>
                {/* Dépôt / Retrait breakdown */}
                <div className="grid grid-cols-2 gap-2 mt-1 pl-11">
                  <div className="flex items-center gap-1.5">
                    <ArrowDownCircle className="h-3 w-3 text-blue-400 flex-shrink-0" />
                    <span className="text-xs text-muted-foreground">Dép. : </span>
                    <span className="text-xs font-semibold text-blue-700 tabular-nums">{fmtAmount(row.depositMargin)} {row.currency}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ArrowUpCircle className="h-3 w-3 text-violet-400 flex-shrink-0" />
                    <span className="text-xs text-muted-foreground">Ret. : </span>
                    <span className="text-xs font-semibold text-violet-700 tabular-nums">{fmtAmount(row.withdrawalMargin)} {row.currency}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section — Utilisateurs */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Utilisateurs</p>
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Comptes inscrits"
            value={data?.totalUsers}
            sub={`dont ${data?.customFees ?? 0} avec frais perso`}
            icon={Users}
            colorClass="bg-blue-50 text-blue-600"
            isLoading={isLoading}
            href="/admin/users"
          />
          <StatCard
            label="KYC/KYB vérifiés"
            value={data?.verifiedUsers}
            sub={`${data?.pendingKyc ?? 0} en attente de validation`}
            icon={CheckCircle2}
            colorClass="bg-violet-50 text-violet-600"
            isLoading={isLoading}
            href="/admin/kyc"
          />
        </div>
      </div>

      {/* Section — Transactions */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Transactions</p>
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Transactions totales"
            value={data?.totalTx}
            sub={`${data?.successTx ?? 0} réussies`}
            icon={ArrowRightLeft}
            colorClass="bg-sky-50 text-sky-600"
            isLoading={isLoading}
            href="/admin/transactions"
          />
          <StatCard
            label="Documents KYC en attente"
            value={data?.pendingKyc}
            icon={FileCheck}
            colorClass="bg-amber-50 text-amber-600"
            isLoading={isLoading}
            href="/admin/kyc"
          />
        </div>
      </div>

      {/* Quick access */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Accès rapide</p>
        <div className="bg-card border rounded-2xl overflow-hidden divide-y">
          {[
            { href: "/admin/users",        label: "Gérer les utilisateurs",     desc: "Voir, modifier les frais et les rôles",    icon: Users },
            { href: "/admin/kyc",          label: "File KYC / KYB",             desc: "Valider ou rejeter les documents soumis",  icon: FileCheck },
            { href: "/admin/transactions", label: "Historique des transactions", desc: "Consulter et filtrer toutes les transactions", icon: History },
            { href: "/admin/exchanges",    label: "Échanges USDT",              desc: "Gérer les demandes de conversion USDT → Fiat", icon: Coins },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <div className="flex items-center gap-4 px-5 py-4 hover:bg-muted/40 cursor-pointer transition-colors group">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <item.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
