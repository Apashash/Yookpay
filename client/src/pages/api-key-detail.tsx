import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Key, Calendar, Clock, Eye, EyeOff, Copy, Check, RefreshCw, Trash2, ShieldCheck } from "lucide-react";

interface ApiKey {
  id: number;
  name: string;
  prefix: string;
  keyType: "payin" | "payout";
  active: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

const REVEAL_STORAGE_KEY = "yookpay_reveal_key";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function CopyButton({ text, label, className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <Button variant="outline" size="sm" className={`gap-2 ${className ?? ""}`} onClick={copy}>
      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
      {label && <span>{copied ? "Copié !" : label}</span>}
    </Button>
  );
}

export default function ApiKeyDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [showKey, setShowKey] = useState(false);
  const [revealedKey, setRevealedKey] = useState<{ id: number; rawKey: string; name: string } | null>(null);

  // Check sessionStorage for a pending reveal (after regeneration redirect)
  useEffect(() => {
    const stored = sessionStorage.getItem(REVEAL_STORAGE_KEY);
    if (stored) {
      try {
        setRevealedKey(JSON.parse(stored));
      } catch {}
      sessionStorage.removeItem(REVEAL_STORAGE_KEY);
    }
  }, [id]);

  const { data: key, isLoading, isError } = useQuery<ApiKey>({
    queryKey: ["api-keys", id],
    queryFn: () => customFetch<ApiKey>(`/api/api-keys/${id}`),
    enabled: !!id,
  });

  const revokeMutation = useMutation({
    mutationFn: () => customFetch(`/api/api-keys/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      toast({ title: "Clé révoquée", description: "La clé API a été désactivée." });
      navigate("/api-keys");
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: () =>
      customFetch<{ id: number; name: string; prefix: string; rawKey: string; createdAt: string }>(
        `/api/api-keys/${id}/regenerate`,
        { method: "POST" }
      ),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      // Store rawKey in sessionStorage so the new page can show it
      sessionStorage.setItem(REVEAL_STORAGE_KEY, JSON.stringify({ id: data.id, rawKey: data.rawKey, name: data.name }));
      navigate(`/api-keys/${data.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !key) {
    return (
      <div className="max-w-xl mx-auto space-y-4 text-center">
        <p className="text-muted-foreground">Clé introuvable ou accès refusé.</p>
        <Button variant="outline" onClick={() => navigate("/api-keys")}>
          Retour aux clés API
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      {/* Back button + title */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/api-keys")} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold leading-tight">{key.name}</h1>
          <p className="text-sm text-muted-foreground">Détails de la clé API</p>
        </div>
      </div>

      {/* Info card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" />
            Informations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground shrink-0">Statut</span>
            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 shrink-0">
              Active
            </Badge>
          </div>

          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
              <Calendar className="h-3.5 w-3.5" />
              Date de création
            </span>
            <span className="font-medium text-right">{fmtDate(key.createdAt)}</span>
          </div>

          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
              <Clock className="h-3.5 w-3.5" />
              Dernière utilisation
            </span>
            <span className="font-medium text-right">
              {key.lastUsedAt ? fmtDate(key.lastUsedAt) : "Jamais utilisée"}
            </span>
          </div>

          <Separator />

          {/* Key display */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Clé API</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-muted border rounded px-3 py-2 text-muted-foreground tracking-wide overflow-hidden">
                {showKey ? key.prefix : `${key.prefix.slice(0, 8)}${"•".repeat(28)}`}
              </code>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => setShowKey((v) => !v)}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <CopyButton text={key.prefix} label="" />
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded p-2">
              ⚠ La clé complète n'est <strong>jamais stockée</strong> — elle n'est visible qu'une seule fois, à la création ou après régénération. Si vous ne l'avez pas copiée, régénérez la clé.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Actions card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Regenerate */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full gap-2 justify-start">
                <RefreshCw className="h-4 w-4 text-amber-500" />
                Régénérer la clé
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Régénérer cette clé ?</AlertDialogTitle>
                <AlertDialogDescription>
                  L'ancienne clé <strong>{key.name}</strong> (<code>{key.prefix}…</code>) sera immédiatement
                  révoquée et remplacée par une nouvelle. Toutes vos intégrations utilisant l'ancienne clé cesseront
                  de fonctionner.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-amber-500 text-white hover:bg-amber-600"
                  onClick={() => regenerateMutation.mutate()}
                >
                  {regenerateMutation.isPending ? "Régénération…" : "Régénérer"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Revoke */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full gap-2 justify-start text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" />
                Supprimer la clé
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Révoquer cette clé ?</AlertDialogTitle>
                <AlertDialogDescription>
                  La clé <strong>{key.name}</strong> (<code>{key.prefix}…</code>) sera désactivée immédiatement.
                  Toutes les intégrations utilisant cette clé cesseront de fonctionner.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => revokeMutation.mutate()}
                >
                  Révoquer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Reveal dialog — shown once after creation / regeneration */}
      <Dialog open={!!revealedKey} onOpenChange={() => setRevealedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <ShieldCheck className="h-5 w-5" />
              Clé générée — copiez-la maintenant !
            </DialogTitle>
            <DialogDescription>
              Pour des raisons de sécurité, cette clé ne sera <strong>plus jamais affichée</strong> après
              la fermeture de cette fenêtre.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-sm">Votre clé API — {revealedKey?.name}</Label>
            <div
              className="w-full font-mono text-sm bg-muted border rounded-lg px-4 py-4 break-all leading-7 select-all cursor-text"
              onClick={(e) => {
                const sel = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(e.currentTarget);
                sel?.removeAllRanges();
                sel?.addRange(range);
              }}
            >
              {revealedKey?.rawKey}
            </div>
            {revealedKey && (
              <CopyButton text={revealedKey.rawKey} label="Copier la clé complète" className="w-full justify-center py-5" />
            )}
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded p-2">
              ⚠ Stockez cette clé dans un gestionnaire de secrets ou une variable d'environnement sécurisée.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRevealedKey(null)} className="w-full">
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
