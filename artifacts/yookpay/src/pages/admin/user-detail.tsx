import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { COUNTRIES, OPERATOR_LABELS } from "@/lib/countries";
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, ShieldCheck,
  Pencil, RotateCcw, Check, X, Star, Ban, Unlock, Wallet,
} from "lucide-react";

interface RateCell {
  rate: number;
  isCustom: boolean;
  source: "default" | "global" | "specific";
  feeId: number | null;
}

interface OperatorRow {
  name: string;
  deposit: RateCell;
  withdrawal: RateCell;
  transfer: RateCell;
}

interface CountryFeeTable {
  currency: string;
  operators: OperatorRow[];
}

interface EffectiveRate {
  transactionType: "DEPOSIT" | "WITHDRAWAL" | "TRANSFER";
  rate: number;
  isCustom: boolean;
  feeId: number | null;
}

interface UserDetail {
  user: { id: number; email: string; name: string; phone: string | null; country: string | null; role: string; status: string; createdAt: string };
  wallets: Array<{ id: number; currency: string; balance: string }>;
  effectiveRates: EffectiveRate[];
  fullFeeTable: Record<string, CountryFeeTable>;
  fees: Array<{ id: number; country: string; operator: string; transactionType: string; rate: string; minFee: number; maxFee: number | null }>;
  kycDocuments: Array<{ id: number; type: string; status: string; fileName: string | null; notes: string | null; createdAt: string }>;
  recentTransactions: Array<{ id: number; type: string; amount: string; currency: string; status: string; createdAt: string }>;
}

const DOC_LABELS: Record<string, string> = {
  CNI: "CNI", PASSEPORT: "Passeport", RCCM: "RCCM", JUSTIF_DOMICILE: "Justif. Domicile", PHOTO_SELFIE: "Selfie",
};

const TX_LABELS: Record<string, string> = {
  DEPOSIT: "Dépôt", WITHDRAWAL: "Retrait", TRANSFER: "Transfert",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function getFlag(code: string | null) {
  return COUNTRIES.find((c) => c.code === code)?.flag ?? "🌍";
}

// Inline editable rate cell for the full table
function EditableCell({
  cell,
  userId,
  country,
  operator,
  txType,
  onSaved,
}: {
  cell: RateCell;
  userId: number;
  country: string;
  operator: string;
  txType: "DEPOSIT" | "WITHDRAWAL" | "TRANSFER";
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState((cell.rate * 100).toFixed(2));
  const { toast } = useToast();

  const saveMutation = useMutation({
    mutationFn: () =>
      customFetch(`/api/admin/users/${userId}/fees`, {
        method: "PUT",
        body: JSON.stringify({
          country,
          operator,
          transactionType: txType,
          rate: parseFloat(value) / 100,
          minFee: 0,
          maxFee: null,
        }),
      }),
    onSuccess: () => {
      toast({ title: "Taux mis à jour" });
      setEditing(false);
      onSaved();
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const resetMutation = useMutation({
    mutationFn: () =>
      customFetch(`/api/admin/users/${userId}/fees/${cell.feeId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Taux réinitialisé" });
      onSaved();
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  if (editing) {
    return (
      <div className="flex items-center gap-1 justify-end">
        <div className="relative">
          <Input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-20 pr-5 text-xs h-7 text-right"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") saveMutation.mutate();
              if (e.key === "Escape") { setEditing(false); setValue((cell.rate * 100).toFixed(2)); }
            }}
          />
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">%</span>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => { setEditing(false); setValue((cell.rate * 100).toFixed(2)); }}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <span className={`text-sm font-semibold tabular-nums ${cell.source === "specific" ? "text-amber-600" : cell.source === "global" ? "text-blue-600" : "text-foreground"}`}>
        {(cell.rate * 100).toFixed(2)}%
      </span>
      {cell.source === "specific" && <Star className="h-2.5 w-2.5 text-amber-500 fill-amber-400 flex-shrink-0" />}
      <div className="flex items-center gap-0.5">
        <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={() => { setValue((cell.rate * 100).toFixed(2)); setEditing(true); }}>
          <Pencil className="h-3 w-3" />
        </Button>
        {cell.source === "specific" && cell.feeId && (
          <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-amber-600"
            onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending}>
            <RotateCcw className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

function WalletBalanceEditor({
  wallet,
  userId,
  onSaved,
}: {
  wallet: { id: number; currency: string; balance: string };
  userId: number;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(parseFloat(wallet.balance).toFixed(2));
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () =>
      customFetch(`/api/admin/users/${userId}/wallets/${wallet.currency}`, {
        method: "PUT",
        body: JSON.stringify({ balance: parseFloat(value), reason: "Ajustement admin" }),
      }),
    onSuccess: () => {
      toast({ title: `Solde ${wallet.currency} mis à jour` });
      setEditing(false);
      onSaved();
    },
    onError: () => toast({ title: "Erreur de mise à jour", variant: "destructive" }),
  });

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="relative">
          <Input
            type="number"
            min="0"
            step="1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-28 pr-8 text-sm h-8 font-mono"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") mutation.mutate();
              if (e.key === "Escape") { setEditing(false); setValue(parseFloat(wallet.balance).toFixed(2)); }
            }}
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{wallet.currency}</span>
        </div>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(false); setValue(parseFloat(wallet.balance).toFixed(2)); }}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-xs font-mono text-muted-foreground">{wallet.currency}</span>
        <span className="ml-2 font-semibold tabular-nums">{parseFloat(wallet.balance).toLocaleString("fr-FR")}</span>
      </div>
      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground"
        onClick={() => { setValue(parseFloat(wallet.balance).toFixed(2)); setEditing(true); }}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default function AdminUserDetail() {
  const params = useParams<{ id: string }>();
  const userId = parseInt(params.id ?? "0");
  const qc = useQueryClient();
  const { toast } = useToast();
  const [openCountries, setOpenCountries] = useState<string[]>(["CM"]);

  const { data, isLoading } = useQuery<UserDetail>({
    queryKey: ["admin-user", userId],
    queryFn: () => customFetch<UserDetail>(`/api/admin/users/${userId}`),
    enabled: !isNaN(userId) && userId > 0,
  });

  const roleMutation = useMutation({
    mutationFn: (role: string) =>
      customFetch(`/api/admin/users/${userId}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-user", userId] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Rôle mis à jour" });
    },
  });

  const banMutation = useMutation({
    mutationFn: (status: "ACTIVE" | "BANNED") =>
      customFetch(`/api/admin/users/${userId}/ban`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: (result: any) => {
      qc.invalidateQueries({ queryKey: ["admin-user", userId] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: result.message ?? "Statut mis à jour" });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (!data) return <div className="text-center py-12 text-muted-foreground">Utilisateur introuvable.</div>;

  const { user, wallets, effectiveRates, fullFeeTable, kycDocuments, recentTransactions } = data;

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-user", userId] });

  const hasAnyCustom = effectiveRates.some((r) => r.isCustom) ||
    Object.values(fullFeeTable ?? {}).some((c) =>
      c.operators.some((o) => o.deposit.source === "specific" || o.withdrawal.source === "specific" || o.transfer.source === "specific")
    );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back + header */}
      <div>
        <Link href="/admin/users">
          <Button variant="ghost" size="sm" className="gap-2 mb-3 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            Retour aux utilisateurs
          </Button>
        </Link>
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold flex-shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{user.name}</h1>
              {user.role === "ADMIN" && (
                <Badge variant="outline" className="text-purple-700 border-purple-200 bg-purple-50">
                  <ShieldCheck className="h-3.5 w-3.5 mr-1" />Admin
                </Badge>
              )}
              {user.status === "BANNED" && (
                <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50 font-semibold">
                  <Ban className="h-3.5 w-3.5 mr-1" />Compte banni
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">{user.email}</p>
            <p className="text-sm text-muted-foreground">
              {getFlag(user.country)} {user.country ?? "—"} · Inscrit le {fmtDate(user.createdAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Wallets + Actions */}
      <div className="grid grid-cols-2 gap-4">
        {/* Wallets with editable balances */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium text-muted-foreground">Portefeuilles</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {wallets.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun portefeuille</p>
            ) : (
              <div className="space-y-2">
                {wallets.map((w) => (
                  <WalletBalanceEditor key={w.currency} wallet={w} userId={userId} onSaved={refresh} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Role + Ban */}
        <Card className={user.status === "BANNED" ? "border-red-200 bg-red-50/50" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gestion du compte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Role */}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Rôle</p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    {user.role === "ADMIN" ? "Rétrograder en utilisateur" : "Promouvoir en admin"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{user.role === "ADMIN" ? "Rétrograder ?" : "Promouvoir en admin ?"}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {user.role === "ADMIN" ? `${user.name} perdra tous les accès admin.` : `${user.name} aura accès au panneau d'administration.`}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => roleMutation.mutate(user.role === "ADMIN" ? "USER" : "ADMIN")}>Confirmer</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Ban */}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Suspension</p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`w-full gap-2 ${user.status === "BANNED" ? "border-green-300 text-green-700 hover:bg-green-50" : "border-red-200 text-red-700 hover:bg-red-50"}`}
                    disabled={banMutation.isPending}
                  >
                    {user.status === "BANNED"
                      ? <><Unlock className="h-3.5 w-3.5" />Réactiver le compte</>
                      : <><Ban className="h-3.5 w-3.5" />Bannir l'utilisateur</>
                    }
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {user.status === "BANNED" ? "Réactiver ce compte ?" : "Bannir cet utilisateur ?"}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {user.status === "BANNED"
                        ? `${user.name} pourra à nouveau accéder à son compte et effectuer des transactions.`
                        : `${user.name} sera immédiatement bloqué et ne pourra plus accéder à son compte. Ses portefeuilles seront conservés.`}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      className={user.status === "BANNED" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
                      onClick={() => banMutation.mutate(user.status === "BANNED" ? "ACTIVE" : "BANNED")}
                    >
                      {user.status === "BANNED" ? "Réactiver" : "Bannir"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      {hasAnyCustom && (
        <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500 flex-shrink-0" />
          <span>
            <span className="text-amber-600 font-semibold">★ Amber</span> = surcharge spécifique ·{" "}
            <span className="text-blue-600 font-semibold">Bleu</span> = taux global personnalisé ·{" "}
            <span className="font-semibold">Noir</span> = taux par défaut
          </span>
        </div>
      )}

      {/* Full fee table by country */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Frais par pays et opérateur</CardTitle>
          <p className="text-xs text-muted-foreground">
            Survolez un taux pour modifier. ↺ réinitialise la surcharge spécifique.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {fullFeeTable && (
            <Accordion
              type="multiple"
              value={openCountries}
              onValueChange={setOpenCountries}
              className="divide-y"
            >
              {COUNTRIES.map((country) => {
                const countryData = fullFeeTable[country.code];
                if (!countryData) return null;

                const hasSpecific = countryData.operators.some(
                  (op) => op.deposit.source === "specific" || op.withdrawal.source === "specific" || op.transfer.source === "specific"
                );

                return (
                  <AccordionItem key={country.code} value={country.code} className="border-0">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/20 [&[data-state=open]]:bg-muted/30">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{country.flag}</span>
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{country.name}</span>
                            {hasSpecific && <Star className="h-3 w-3 text-amber-500 fill-amber-400" />}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-mono text-muted-foreground">{countryData.currency}</span>
                            <span className="text-xs text-muted-foreground">
                              {countryData.operators.length} opérateur{countryData.operators.length > 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="p-0">
                      <div className="border-t">
                        {/* Column headers */}
                        <div className="grid grid-cols-4 px-4 py-2 bg-muted/20 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          <div>Opérateur</div>
                          <div className="text-right">Dépôt</div>
                          <div className="text-right">Retrait</div>
                          <div className="text-right">Transfert</div>
                        </div>
                        {countryData.operators.map((op, idx) => (
                          <div
                            key={op.name}
                            className={`grid grid-cols-4 gap-2 px-4 py-3 items-center hover:bg-muted/10 ${
                              idx !== countryData.operators.length - 1 ? "border-b" : ""
                            }`}
                          >
                            <div>
                              <p className="text-sm font-medium">{op.name}</p>
                              <p className="text-xs text-muted-foreground leading-tight">
                                {OPERATOR_LABELS[op.name] ?? op.name}
                              </p>
                            </div>
                            <EditableCell
                              cell={op.deposit}
                              userId={userId}
                              country={country.code}
                              operator={op.name}
                              txType="DEPOSIT"
                              onSaved={refresh}
                            />
                            <EditableCell
                              cell={op.withdrawal}
                              userId={userId}
                              country={country.code}
                              operator={op.name}
                              txType="WITHDRAWAL"
                              onSaved={refresh}
                            />
                            <EditableCell
                              cell={op.transfer}
                              userId={userId}
                              country={country.code}
                              operator={op.name}
                              txType="TRANSFER"
                              onSaved={refresh}
                            />
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* KYC Documents */}
      <Card>
        <CardHeader><CardTitle className="text-base">Documents KYC</CardTitle></CardHeader>
        <CardContent>
          {kycDocuments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun document soumis.</p>
          ) : (
            <div className="space-y-2">
              {kycDocuments.map((doc) => {
                const StatusIcon = doc.status === "VERIFIED" ? CheckCircle2 : doc.status === "REJECTED" ? XCircle : Clock;
                const statusCls = doc.status === "VERIFIED" ? "text-green-600" : doc.status === "REJECTED" ? "text-red-600" : "text-amber-600";
                return (
                  <div key={doc.id} className="flex items-center gap-3 p-2.5 border rounded-lg">
                    <StatusIcon className={`h-4 w-4 flex-shrink-0 ${statusCls}`} />
                    <div className="flex-1 text-sm">
                      <span className="font-medium">{DOC_LABELS[doc.type] ?? doc.type}</span>
                      {doc.fileName && <span className="text-muted-foreground ml-2 font-mono text-xs">{doc.fileName}</span>}
                    </div>
                    <span className="text-xs text-muted-foreground">{fmtDate(doc.createdAt)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent transactions */}
      {recentTransactions.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Transactions récentes</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentTransactions.slice(0, 5).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{TX_LABELS[tx.type] ?? tx.type}</span>
                  <span className="font-mono font-semibold">{parseFloat(tx.amount).toLocaleString("fr-FR")} {tx.currency}</span>
                  <Badge variant="outline" className="text-xs">{tx.status}</Badge>
                  <span className="text-xs text-muted-foreground">{fmtDate(tx.createdAt)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
