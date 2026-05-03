import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { customFetch } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { COUNTRIES } from "@/lib/countries";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowDownLeft, ArrowUpRight, ArrowLeftRight,
  ChevronLeft, Copy, Check, ExternalLink,
  CheckCircle2, XCircle, Clock, Loader2, ShieldAlert,
} from "lucide-react";
import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface AdminTxDetail {
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

type ActionType = "SUCCESS" | "FAILED" | "PENDING";

interface ActionDialog {
  type: ActionType;
}

function formatAmount(n: number, currency: string) {
  const dec = currency === "USDT" ? 4 : 0;
  return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + " " + currency;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "SUCCESS": return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20">Réussi</Badge>;
    case "PENDING": return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/20">En attente</Badge>;
    case "FAILED":  return <Badge className="bg-red-500/15 text-red-600 border-red-500/20">Échoué</Badge>;
    case "EXPIRED": return <Badge className="bg-gray-500/15 text-gray-600 border-gray-500/20">Expiré</Badge>;
    default:        return <Badge variant="outline">{status}</Badge>;
  }
}

function TypeIcon({ type }: { type: string }) {
  if (type === "DEPOSIT")    return <ArrowDownLeft  className="h-5 w-5 text-emerald-500" />;
  if (type === "WITHDRAWAL") return <ArrowUpRight   className="h-5 w-5 text-rose-500" />;
  return <ArrowLeftRight className="h-5 w-5 text-sky-500" />;
}

function typeLabel(t: string) {
  if (t === "DEPOSIT")    return "Dépôt";
  if (t === "WITHDRAWAL") return "Retrait";
  if (t === "TRANSFER")   return "Transfert";
  return t;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={copy} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="text-sm text-muted-foreground flex-shrink-0 w-36">{label}</span>
      <div className="text-sm font-medium text-right flex-1">{children}</div>
    </div>
  );
}

const ACTION_CONFIG: Record<ActionType, {
  label: string;
  description: string;
  confirmLabel: string;
  icon: React.ReactNode;
  btnClass: string;
}> = {
  SUCCESS: {
    label: "Confirmer",
    description: "Marquer cette transaction comme réussie. Le solde du wallet sera crédité si c'est un dépôt.",
    confirmLabel: "Confirmer la transaction",
    icon: <CheckCircle2 className="h-4 w-4" />,
    btnClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
  FAILED: {
    label: "Rejeter",
    description: "Marquer cette transaction comme échouée. Le wallet sera remboursé si c'est un retrait en attente.",
    confirmLabel: "Rejeter la transaction",
    icon: <XCircle className="h-4 w-4" />,
    btnClass: "bg-rose-600 hover:bg-rose-700 text-white",
  },
  PENDING: {
    label: "Mettre en attente",
    description: "Remettre cette transaction en attente pour traitement ultérieur.",
    confirmLabel: "Remettre en attente",
    icon: <Clock className="h-4 w-4" />,
    btnClass: "bg-amber-600 hover:bg-amber-700 text-white",
  },
};

export default function AdminTransactionDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialog, setDialog] = useState<ActionDialog | null>(null);
  const [notes, setNotes]   = useState("");

  const { data: tx, isLoading, error } = useQuery<AdminTxDetail>({
    queryKey: ["admin-transaction", id],
    queryFn: () => customFetch<AdminTxDetail>(`/api/admin/transactions/${id}`),
    enabled: !!id,
  });

  const mutation = useMutation({
    mutationFn: ({ status, notes }: { status: ActionType; notes: string }) =>
      customFetch(`/api/admin/transactions/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, notes: notes || undefined }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-transaction", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
      toast({ title: "Statut mis à jour", description: "La transaction a été mise à jour avec succès." });
      setDialog(null);
      setNotes("");
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erreur", description: err.message || "Impossible de mettre à jour le statut." });
    },
  });

  function handleConfirm() {
    if (!dialog) return;
    mutation.mutate({ status: dialog.type, notes });
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !tx) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 text-muted-foreground">
        <p>Transaction introuvable.</p>
        <Link href="/admin/transactions">
          <Button variant="outline" size="sm" className="mt-4 gap-1.5">
            <ChevronLeft className="h-3.5 w-3.5" /> Retour à l'historique
          </Button>
        </Link>
      </div>
    );
  }

  const country = tx.country ? COUNTRIES.find((c) => c.code === tx.country) : null;
  const canManage = tx.type === "DEPOSIT" || tx.type === "WITHDRAWAL";
  const availableActions = (["SUCCESS", "FAILED", "PENDING"] as ActionType[]).filter((a) => a !== tx.status);

  return (
    <>
      {/* Confirmation dialog */}
      <Dialog open={!!dialog} onOpenChange={(o) => { if (!o) { setDialog(null); setNotes(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {dialog && ACTION_CONFIG[dialog.type].icon}
              {dialog && ACTION_CONFIG[dialog.type].label}
            </DialogTitle>
            <DialogDescription>
              {dialog && ACTION_CONFIG[dialog.type].description}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Transaction :</span>{" "}
              <span className="font-mono font-medium">{tx.reference}</span>
            </div>
            <Textarea
              placeholder="Note optionnelle (visible dans les métadonnées)…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="text-sm resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialog(null); setNotes(""); }} disabled={mutation.isPending}>
              Annuler
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={mutation.isPending}
              className={dialog ? ACTION_CONFIG[dialog.type].btnClass : ""}
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {dialog && ACTION_CONFIG[dialog.type].confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="max-w-2xl mx-auto space-y-5">
        {/* Back */}
        <Link href="/admin/transactions">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="h-4 w-4" /> Retour à l'historique
          </button>
        </Link>

        {/* Hero */}
        <div className="bg-card border rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                <TypeIcon type={tx.type} />
              </div>
              <div>
                <p className="text-lg font-bold">{typeLabel(tx.type)}</p>
                <p className="text-sm text-muted-foreground">#{tx.id}</p>
              </div>
            </div>
            <StatusBadge status={tx.status} />
          </div>

          {/* Big amount */}
          <div className="text-center py-4 border rounded-xl bg-muted/20">
            <p className="text-3xl font-bold tabular-nums">{formatAmount(tx.amount, tx.currency)}</p>
            <p className="text-sm text-muted-foreground mt-1">Montant brut</p>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-xl border p-3 text-center">
              <p className="text-xs text-muted-foreground">Frais</p>
              <p className="font-semibold tabular-nums mt-0.5">{formatAmount(tx.fee, tx.currency)}</p>
              {tx.feeRate != null && <p className="text-xs text-muted-foreground">{(tx.feeRate * 100).toFixed(2)} %</p>}
            </div>
            <div className="rounded-xl border p-3 text-center">
              <p className="text-xs text-muted-foreground">Net perçu</p>
              <p className="font-semibold tabular-nums mt-0.5">{formatAmount(tx.netAmount, tx.currency)}</p>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="bg-card border rounded-2xl p-5 space-y-0 divide-y">
          <Row label="Réf. YookPay">
            <div className="flex items-center justify-end gap-1.5">
              <span className="font-mono text-xs break-all">{tx.reference}</span>
              <CopyButton text={tx.reference} />
            </div>
          </Row>

          {tx.providerReference && (
            <Row label="Réf. PixPay">
              <div className="flex items-center justify-end gap-1.5">
                <span className="font-mono text-xs break-all">{tx.providerReference}</span>
                <CopyButton text={tx.providerReference} />
              </div>
            </Row>
          )}

          {tx.country && country && (
            <Row label="Pays">
              <span className="flex items-center justify-end gap-1.5">
                <span>{country.flag}</span>
                <span>{country.name}</span>
              </span>
            </Row>
          )}

          {tx.operator && <Row label="Opérateur">{tx.operator}</Row>}

          {tx.phone && (
            <Row label="Téléphone">
              <div className="flex items-center justify-end gap-1.5">
                <span className="font-mono">{tx.phone}</span>
                <CopyButton text={tx.phone} />
              </div>
            </Row>
          )}

          <Row label="Devise">{tx.currency}</Row>
          <Row label="Date création">{fmtDate(tx.createdAt)}</Row>
          <Row label="Dernière MAJ">{fmtDate(tx.updatedAt)}</Row>
        </div>

        {/* User info */}
        <div className="bg-card border rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Utilisateur</p>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">{tx.userName || tx.userEmail}</p>
              <p className="text-sm text-muted-foreground">{tx.userEmail}</p>
              <p className="text-xs text-muted-foreground">ID #{tx.userId}</p>
            </div>
            <Link href={`/admin/users/${tx.userId}`}>
              <Button size="sm" variant="outline" className="gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" /> Voir le profil
              </Button>
            </Link>
          </div>
        </div>

        {/* Admin actions */}
        {canManage && (
          <div className="bg-card border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Actions admin</p>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Vous pouvez forcer le statut manuellement. Les ajustements de wallet sont appliqués automatiquement selon la transition.
            </p>
            <div className="flex flex-wrap gap-2">
              {availableActions.map((action) => {
                const cfg = ACTION_CONFIG[action];
                return (
                  <Button
                    key={action}
                    size="sm"
                    variant="outline"
                    className={`gap-1.5 border-0 ${cfg.btnClass}`}
                    onClick={() => setDialog({ type: action })}
                  >
                    {cfg.icon}
                    {cfg.label}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* Metadata */}
        {tx.metadata && (
          <div className="bg-card border rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Métadonnées</p>
            <pre className="text-xs font-mono bg-muted rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(tx.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </>
  );
}
