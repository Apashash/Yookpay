import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { COUNTRIES } from "@/lib/countries";
import { Search, ChevronRight, FileCheck, Star, ShieldCheck, User } from "lucide-react";

interface AdminUser {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  country: string | null;
  role: string;
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

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

const KYC_BADGE: Record<string, { label: string; className: string }> = {
  PENDING: { label: "KYC en attente", className: "text-amber-700 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400" },
  PARTIAL: { label: "KYC partiel", className: "text-blue-700 border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:text-blue-400" },
  NONE:    { label: "Pas de KYC", className: "text-muted-foreground border-muted-foreground/30 bg-muted/30" },
};

export default function AdminUsers() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<{ users: AdminUser[] }>({
    queryKey: ["admin-users"],
    queryFn: () => customFetch<{ users: AdminUser[] }>("/api/admin/users"),
  });

  const filtered = (data?.users ?? []).filter((u) => {
    const q = search.toLowerCase();
    return !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.phone ?? "").includes(q);
  });

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Utilisateurs</h1>
        <p className="text-muted-foreground mt-1">
          {data ? `${data.users.length} compte${data.users.length > 1 ? "s" : ""} enregistré${data.users.length > 1 ? "s" : ""}` : "Chargement…"}
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom, email ou téléphone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Users list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {search ? "Aucun résultat pour cette recherche." : "Aucun utilisateur."}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((user) => (
            <Link key={user.id} href={`/admin/users/${user.id}`}>
              <Card className="cursor-pointer hover:shadow-md transition-shadow hover:bg-muted/20">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold flex-shrink-0">
                      {user.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{user.name}</span>
                        {user.role === "ADMIN" && (
                          <Badge variant="outline" className="text-xs text-purple-700 border-purple-200 bg-purple-50 dark:bg-purple-950/20 dark:text-purple-400">
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            Admin
                          </Badge>
                        )}
                        <Badge variant="outline" className={`text-xs ${KYC_BADGE[user.kycStatus].className}`}>
                          {KYC_BADGE[user.kycStatus].label}
                        </Badge>
                        {user.hasCustomFees && (
                          <Badge variant="outline" className="text-xs text-amber-700 border-amber-200 bg-amber-50">
                            Frais personnalisés
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span>{getCountryFlag(user.country)} {user.country ?? "—"}</span>
                        <span>·</span>
                        <span>Inscrit le {fmtDate(user.createdAt)}</span>
                        {user.wallets.length > 0 && (
                          <>
                            <span>·</span>
                            {user.wallets.map((w) => (
                              <span key={w.currency} className="font-mono">
                                {parseFloat(w.balance).toLocaleString("fr-FR")} {w.currency}
                              </span>
                            ))}
                          </>
                        )}
                      </div>
                      {/* Fee rates row */}
                      {user.effectiveRates && (
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${user.hasCustomFees ? "bg-green-50 text-green-700" : "bg-muted text-muted-foreground"}`}>
                            Dépôt {(user.effectiveRates.DEPOSIT * 100).toFixed(2)}%
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${user.hasCustomFees ? "bg-red-50 text-red-700" : "bg-muted text-muted-foreground"}`}>
                            Retrait {(user.effectiveRates.WITHDRAWAL * 100).toFixed(2)}%
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${user.hasCustomFees ? "bg-blue-50 text-blue-700" : "bg-muted text-muted-foreground"}`}>
                            Transfert {(user.effectiveRates.TRANSFER * 100).toFixed(2)}%
                          </span>
                        </div>
                      )}
                    </div>

                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
