import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { ArrowLeft, Trash2, Plus, CheckCircle2, XCircle, Clock, ShieldCheck, Pencil, RotateCcw, Check, X } from "lucide-react";

interface EffectiveRate {
  transactionType: "DEPOSIT" | "WITHDRAWAL" | "TRANSFER";
  rate: number;
  isCustom: boolean;
  feeId: number | null;
}

interface UserDetail {
  user: { id: number; email: string; name: string; phone: string | null; country: string | null; role: string; createdAt: string };
  wallets: Array<{ currency: string; balance: string }>;
  effectiveRates: EffectiveRate[];
  fees: Array<{ id: number; country: string; operator: string; transactionType: string; rate: string; minFee: number; maxFee: number | null }>;
  kycDocuments: Array<{ id: number; type: string; status: string; fileName: string | null; notes: string | null; createdAt: string }>;
  recentTransactions: Array<{ id: number; type: string; amount: string; currency: string; status: string; createdAt: string }>;
}

const DOC_LABELS: Record<string, string> = {
  CNI: "CNI", PASSEPORT: "Passeport", RCCM: "RCCM", JUSTIF_DOMICILE: "Justif. Domicile", PHOTO_SELFIE: "Selfie",
};

const TX_TYPE_LABELS: Record<string, string> = {
  DEPOSIT: "Dépôt",
  WITHDRAWAL: "Retrait",
  TRANSFER: "Transfert",
};

const TX_TYPE_COLORS: Record<string, string> = {
  DEPOSIT: "text-green-700 bg-green-50 border-green-200",
  WITHDRAWAL: "text-red-700 bg-red-50 border-red-200",
  TRANSFER: "text-blue-700 bg-blue-50 border-blue-200",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function getFlag(code: string | null) {
  return COUNTRIES.find((c) => c.code === code)?.flag ?? "🌍";
}

function FeeRow({ rate, userId, onSaved }: { rate: EffectiveRate; userId: number; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState((rate.rate * 100).toFixed(2));
  const { toast } = useToast();

  const saveMutation = useMutation({
    mutationFn: () => customFetch(`/api/admin/users/${userId}/global-fees`, {
      method: "PUT",
      body: JSON.stringify({ transactionType: rate.transactionType, rate: parseFloat(value) }),
    }),
    onSuccess: () => {
      toast({ title: "Taux mis à jour" });
      setEditing(false);
      onSaved();
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de sauvegarder", variant: "destructive" }),
  });

  const resetMutation = useMutation({
    mutationFn: () => customFetch(`/api/admin/users/${userId}/global-fees/${rate.transactionType}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Taux réinitialisé au défaut" });
      onSaved();
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const colorClass = TX_TYPE_COLORS[rate.transactionType] ?? "text-gray-700 bg-gray-50 border-gray-200";

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
      <Badge variant="outline" className={`text-xs font-semibold w-24 justify-center ${colorClass}`}>
        {TX_TYPE_LABELS[rate.transactionType]}
      </Badge>

      {editing ? (
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex items-center">
            <Input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-24 pr-6 text-sm h-8"
              autoFocus
            />
            <span className="absolute right-2 text-muted-foreground text-sm">%</span>
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:bg-green-50"
            onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Check className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground"
            onClick={() => { setEditing(false); setValue((rate.rate * 100).toFixed(2)); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-1">
          <span className={`text-lg font-bold ${rate.isCustom ? "text-amber-600" : "text-foreground"}`}>
            {(rate.rate * 100).toFixed(2)}%
          </span>
          {rate.isCustom ? (
            <Badge variant="outline" className="text-xs text-amber-700 border-amber-200 bg-amber-50">personnalisé</Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">défaut</Badge>
          )}
        </div>
      )}

      {!editing && (
        <div className="flex items-center gap-1 ml-auto">
          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => { setValue((rate.rate * 100).toFixed(2)); setEditing(true); }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {rate.isCustom && (
            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-amber-600"
              onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending}
              title="Réinitialiser au défaut">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminUserDetail() {
  const params = useParams<{ id: string }>();
  const userId = parseInt(params.id ?? "0");
  const qc = useQueryClient();
  const { toast } = useToast();

  const [feeForm, setFeeForm] = useState({ country: "", operator: "", transactionType: "DEPOSIT" as "DEPOSIT" | "WITHDRAWAL" | "TRANSFER", rate: "", minFee: "", maxFee: "" });
  const [showFeeForm, setShowFeeForm] = useState(false);

  const { data, isLoading } = useQuery<UserDetail>({
    queryKey: ["admin-user", userId],
    queryFn: () => customFetch<UserDetail>(`/api/admin/users/${userId}`),
    enabled: !isNaN(userId) && userId > 0,
  });

  const setFeeMutation = useMutation({
    mutationFn: () => customFetch(`/api/admin/users/${userId}/fees`, {
      method: "PUT",
      body: JSON.stringify({
        country: feeForm.country,
        operator: feeForm.operator,
        transactionType: feeForm.transactionType,
        rate: parseFloat(feeForm.rate) / 100,
        minFee: parseInt(feeForm.minFee),
        maxFee: feeForm.maxFee ? parseInt(feeForm.maxFee) : null,
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-user", userId] });
      toast({ title: "Frais spécifique enregistré" });
      setShowFeeForm(false);
      setFeeForm({ country: "", operator: "", transactionType: "DEPOSIT", rate: "", minFee: "", maxFee: "" });
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de sauvegarder les frais", variant: "destructive" }),
  });

  const deleteFeeMutation = useMutation({
    mutationFn: (feeId: number) => customFetch(`/api/admin/users/${userId}/fees/${feeId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-user", userId] });
      toast({ title: "Frais spécifique supprimé" });
    },
  });

  const roleMutation = useMutation({
    mutationFn: (role: string) => customFetch(`/api/admin/users/${userId}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-user", userId] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Rôle mis à jour" });
    },
  });

  const selectedCountry = COUNTRIES.find((c) => c.code === feeForm.country);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  if (!data) return <div className="text-center py-12 text-muted-foreground">Utilisateur introuvable.</div>;

  const { user, wallets, effectiveRates, fees, kycDocuments, recentTransactions } = data;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{user.name}</h1>
              {user.role === "ADMIN" && (
                <Badge variant="outline" className="text-purple-700 border-purple-200 bg-purple-50">
                  <ShieldCheck className="h-3.5 w-3.5 mr-1" />Admin
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">{user.email}</p>
            <p className="text-sm text-muted-foreground">{getFlag(user.country)} {user.country ?? "—"} · Inscrit le {fmtDate(user.createdAt)}</p>
          </div>
        </div>
      </div>

      {/* Wallets + role */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Portefeuilles</CardTitle></CardHeader>
          <CardContent>
            {wallets.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun portefeuille</p>
            ) : (
              <div className="space-y-1">
                {wallets.map((w) => (
                  <div key={w.currency} className="flex items-center justify-between">
                    <span className="text-sm font-mono text-muted-foreground">{w.currency}</span>
                    <span className="font-semibold">{parseFloat(w.balance).toLocaleString("fr-FR")}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Rôle du compte</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">Rôle actuel : <strong>{user.role === "ADMIN" ? "Administrateur" : "Utilisateur"}</strong></p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  {user.role === "ADMIN" ? "Rétrograder en utilisateur" : "Promouvoir en admin"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{user.role === "ADMIN" ? "Rétrograder cet admin ?" : "Promouvoir en administrateur ?"}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {user.role === "ADMIN"
                      ? `${user.name} perdra tous les accès admin.`
                      : `${user.name} aura accès au panneau d'administration complet.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => roleMutation.mutate(user.role === "ADMIN" ? "USER" : "ADMIN")}>
                    Confirmer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>

      {/* Effective global fees */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Frais appliqués à cet utilisateur</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Taux appliqués sur toutes les transactions, tous opérateurs confondus.
                Cliquez sur <Pencil className="h-3 w-3 inline" /> pour modifier.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {(effectiveRates ?? []).map((rate) => (
            <FeeRow
              key={rate.transactionType}
              rate={rate}
              userId={userId}
              onSaved={() => qc.invalidateQueries({ queryKey: ["admin-user", userId] })}
            />
          ))}
        </CardContent>
      </Card>

      {/* Country/operator-specific overrides */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Frais spécifiques par pays / opérateur</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Surcharge les taux ci-dessus pour un pays/opérateur précis.</p>
            </div>
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowFeeForm(!showFeeForm)}>
              <Plus className="h-3.5 w-3.5" />
              Ajouter
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showFeeForm && (
            <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
              <p className="text-sm font-medium">Nouveau frais spécifique</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Pays</Label>
                  <Select value={feeForm.country} onValueChange={(v) => setFeeForm((f) => ({ ...f, country: v, operator: "" }))}>
                    <SelectTrigger><SelectValue placeholder="Pays" /></SelectTrigger>
                    <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.flag} {c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Opérateur</Label>
                  <Select value={feeForm.operator} onValueChange={(v) => setFeeForm((f) => ({ ...f, operator: v }))} disabled={!selectedCountry}>
                    <SelectTrigger><SelectValue placeholder="Opérateur" /></SelectTrigger>
                    <SelectContent>{(selectedCountry?.operators ?? []).map((op) => <SelectItem key={op} value={op}>{OPERATOR_LABELS[op] ?? op}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select value={feeForm.transactionType} onValueChange={(v) => setFeeForm((f) => ({ ...f, transactionType: v as "DEPOSIT" | "WITHDRAWAL" | "TRANSFER" }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DEPOSIT">Dépôt</SelectItem>
                      <SelectItem value="WITHDRAWAL">Retrait</SelectItem>
                      <SelectItem value="TRANSFER">Transfert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Taux (%)</Label>
                  <Input placeholder="ex: 1.5" value={feeForm.rate} onChange={(e) => setFeeForm((f) => ({ ...f, rate: e.target.value }))} type="number" step="0.01" min="0" max="100" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Frais min</Label>
                  <Input placeholder="ex: 100" value={feeForm.minFee} onChange={(e) => setFeeForm((f) => ({ ...f, minFee: e.target.value }))} type="number" min="0" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Frais max (optionnel)</Label>
                  <Input placeholder="ex: 5000" value={feeForm.maxFee} onChange={(e) => setFeeForm((f) => ({ ...f, maxFee: e.target.value }))} type="number" min="0" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowFeeForm(false)}>Annuler</Button>
                <Button size="sm" onClick={() => setFeeMutation.mutate()} disabled={!feeForm.country || !feeForm.operator || !feeForm.rate || !feeForm.minFee || setFeeMutation.isPending}>
                  Enregistrer
                </Button>
              </div>
            </div>
          )}

          {fees.length === 0 && !showFeeForm ? (
            <p className="text-sm text-muted-foreground">Aucun frais spécifique — les taux ci-dessus s'appliquent à tous les opérateurs.</p>
          ) : (
            <div className="space-y-2">
              {fees.map((fee) => (
                <div key={fee.id} className="flex items-center gap-3 p-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex-1 text-sm">
                    <span className="font-medium">{fee.country} · {fee.operator} · {TX_TYPE_LABELS[fee.transactionType] ?? fee.transactionType}</span>
                    <span className="ml-3 text-muted-foreground">
                      {(parseFloat(fee.rate) * 100).toFixed(2)}% · min {fee.minFee.toLocaleString("fr-FR")}
                      {fee.maxFee ? ` · max ${fee.maxFee.toLocaleString("fr-FR")}` : ""}
                    </span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 flex-shrink-0"
                    onClick={() => deleteFeeMutation.mutate(fee.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
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
                  <span className="text-muted-foreground">{TX_TYPE_LABELS[tx.type] ?? tx.type}</span>
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
