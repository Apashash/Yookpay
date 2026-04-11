import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { COUNTRIES } from "@/lib/countries";
import { Button } from "@/components/ui/button";
import { Search, ChevronRight, ShieldCheck, Users, Wallet, TrendingUp, Ban, ChevronLeft } from "lucide-react";

const PAGE_SIZE = 30;

interface AdminUser {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  country: string | null;
  role: string;
  status: string;
  createdAt: string;
  wallets: Array<{ currency: string; balance: string }>;
  kycStatus: "NONE" | "PENDING" | "PARTIAL";
  effectiveRates: { DEPOSIT: number; WITHDRAWAL: number; TRANSFER: number };
  hasCustomFees: boolean;
}

function getCountryFlag(code: string | null) {
  if (!code) return "🌍";
  return COUNTRIES.find((c) => c.code === code)?.flag ?? "🌍";
}

function getCountryName(code: string | null) {
  if (!code) return null;
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function totalBalance(wallets: Array<{ currency: string; balance: string }>) {
  return wallets.filter((w) => parseFloat(w.balance) > 0);
}

const KYC_CONFIG: Record<string, { label: string; dot: string }> = {
  PENDING: { label: "KYC en attente", dot: "bg-amber-400" },
  PARTIAL:  { label: "KYC partiel",    dot: "bg-blue-400" },
  NONE:     { label: "Non vérifié",    dot: "bg-gray-300" },
};

function UserAvatar({ name, isAdmin }: { name: string; isAdmin: boolean }) {
  return (
    <div className="relative flex-shrink-0">
      <div className={`h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold ${isAdmin ? "bg-purple-100 text-purple-700" : "bg-primary/10 text-primary"}`}>
        {name.charAt(0).toUpperCase()}
      </div>
      {isAdmin && (
        <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-purple-600 flex items-center justify-center ring-2 ring-background">
          <ShieldCheck className="h-2.5 w-2.5 text-white" />
        </div>
      )}
    </div>
  );
}

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{ users: AdminUser[] }>({
    queryKey: ["admin-users"],
    queryFn: () => customFetch<{ users: AdminUser[] }>("/api/admin/users"),
  });

  const filtered = (data?.users ?? []).filter((u) => {
    const q = search.toLowerCase();
    return !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.phone ?? "").includes(q);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const totalUsers = data?.users.length ?? 0;
  const adminCount = data?.users.filter((u) => u.role === "ADMIN").length ?? 0;
  const withBalanceCount = data?.users.filter((u) => u.wallets.some((w) => parseFloat(w.balance) > 0)).length ?? 0;
  const customFeeCount = data?.users.filter((u) => u.hasCustomFees).length ?? 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Utilisateurs</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isLoading ? "Chargement…" : `${totalUsers} compte${totalUsers > 1 ? "s" : ""} enregistré${totalUsers > 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* Stats bar */}
      {!isLoading && totalUsers > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center gap-3 bg-card border rounded-xl p-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold leading-tight">{totalUsers}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-card border rounded-xl p-3">
            <div className="h-9 w-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
              <Wallet className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avec solde</p>
              <p className="text-lg font-bold leading-tight">{withBalanceCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-card border rounded-xl p-3">
            <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Frais perso</p>
              <p className="text-lg font-bold leading-tight">{customFeeCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom, email ou téléphone…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-9 bg-card"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-card border rounded-xl">
              <Skeleton className="h-11 w-11 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{search ? "Aucun résultat" : "Aucun utilisateur"}</p>
          {search && <p className="text-sm mt-1">Essayez un autre terme de recherche.</p>}
        </div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden divide-y">
          {paginated.map((user) => {
            const kyc = KYC_CONFIG[user.kycStatus];
            const activeWallets = totalBalance(user.wallets);
            const countryName = getCountryName(user.country);

            return (
              <Link key={user.id} href={`/admin/users/${user.id}`}>
                <div className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted/40 transition-colors cursor-pointer group">
                  {/* Avatar */}
                  <UserAvatar name={user.name} isAdmin={user.role === "ADMIN"} />

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-semibold text-sm leading-tight ${user.status === "BANNED" ? "text-red-600" : ""}`}>{user.name}</span>
                      {user.role === "ADMIN" && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-purple-700 border-purple-200 bg-purple-50 font-medium">
                          Admin
                        </Badge>
                      )}
                      {user.status === "BANNED" && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-red-700 border-red-200 bg-red-50 font-medium gap-0.5">
                          <Ban className="h-2.5 w-2.5" />Banni
                        </Badge>
                      )}
                      {user.hasCustomFees && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-amber-700 border-amber-200 bg-amber-50 font-medium">
                          Frais perso
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{user.email}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {/* KYC dot + label */}
                      <div className="flex items-center gap-1">
                        <span className={`h-1.5 w-1.5 rounded-full ${kyc.dot} flex-shrink-0`} />
                        <span className="text-[10px] text-muted-foreground">{kyc.label}</span>
                      </div>
                      {countryName && (
                        <>
                          <span className="text-muted-foreground/30 text-[10px]">·</span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <span>{getCountryFlag(user.country)}</span>
                            <span>{countryName}</span>
                          </span>
                        </>
                      )}
                      <span className="text-muted-foreground/30 text-[10px]">·</span>
                      <span className="text-[10px] text-muted-foreground">{fmtDate(user.createdAt)}</span>
                    </div>
                  </div>

                  {/* Wallets summary (right side) */}
                  <div className="hidden sm:flex flex-col items-end gap-1 flex-shrink-0 text-right">
                    {activeWallets.length > 0 ? (
                      activeWallets.map((w) => (
                        <span key={w.currency} className="text-xs font-semibold tabular-nums text-foreground">
                          {parseFloat(w.balance).toLocaleString("en-US", { minimumFractionDigits: w.currency === "USDT" ? 4 : 0, maximumFractionDigits: w.currency === "USDT" ? 4 : 0 })} <span className="text-muted-foreground font-normal">{w.currency}</span>
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">Aucun solde</span>
                    )}
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground flex-shrink-0 transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between gap-2 pb-2">
          <p className="text-xs text-muted-foreground">
            {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} sur {filtered.length} utilisateur{filtered.length > 1 ? "s" : ""}
            {search ? ` pour "${search}"` : ""}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline" size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-medium px-2">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline" size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
