import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { Copy, Plus, Trash2, Key, ShieldCheck, Clock, Check, RefreshCw, Calendar, Eye, EyeOff } from "lucide-react";

interface ApiKey {
  id: number;
  name: string;
  prefix: string;
  active: boolean;
  lastUsedAt: string | null;
  createdAt: string;
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

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function ApiKeys() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyDialog, setNewKeyDialog] = useState(false);
  const [revealedKey, setRevealedKey] = useState<{ id: number; rawKey: string; name: string } | null>(null);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [showKey, setShowKey] = useState(false);

  const { data, isLoading } = useQuery<{ keys: ApiKey[] }>({
    queryKey: ["api-keys"],
    queryFn: () => customFetch<{ keys: ApiKey[] }>("/api/api-keys"),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      customFetch<{ id: number; name: string; prefix: string; rawKey: string; createdAt: string }>("/api/api-keys", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      setNewKeyDialog(false);
      setNewKeyName("");
      setRevealedKey({ id: data.id, rawKey: data.rawKey, name: data.name });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: number) =>
      customFetch(`/api/api-keys/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      setSelectedKey(null);
      toast({ title: "Clé révoquée", description: "La clé API a été désactivée avec succès." });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: (id: number) =>
      customFetch<{ id: number; name: string; prefix: string; rawKey: string; createdAt: string }>(
        `/api/api-keys/${id}/regenerate`,
        { method: "POST" }
      ),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      setSelectedKey(null);
      setRevealedKey({ id: data.id, rawKey: data.rawKey, name: data.name });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const activeKeys = data?.keys.filter((k) => k.active) ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clés API</h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos clés d'accès pour intégrer YookPay dans vos applications.
          </p>
        </div>
        <Button
          onClick={() => setNewKeyDialog(true)}
          disabled={activeKeys.length >= 3}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Générer une clé
        </Button>
      </div>

      {/* Info card */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
              <p className="font-medium">Bonnes pratiques de sécurité</p>
              <ul className="text-xs space-y-0.5 text-blue-700 dark:text-blue-400 list-disc list-inside">
                <li>Ne partagez jamais vos clés dans votre code source public.</li>
                <li>Révoquez immédiatement toute clé compromise.</li>
                <li>Maximum 3 clés actives par compte.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Keys list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : activeKeys.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-12 pb-12 flex flex-col items-center text-center gap-3">
            <Key className="h-10 w-10 text-muted-foreground/40" />
            <div>
              <p className="font-medium text-muted-foreground">Aucune clé API active</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Générez votre première clé pour commencer à utiliser l'API YookPay.
              </p>
            </div>
            <Button onClick={() => setNewKeyDialog(true)} variant="outline" className="mt-2 gap-2">
              <Plus className="h-4 w-4" />
              Générer une clé
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {activeKeys.map((key) => (
            <Card
              key={key.id}
              className="cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all"
              onClick={() => setSelectedKey(key)}
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Key className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold truncate">{key.name}</span>
                      <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 text-xs">
                        Active
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <code className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {key.prefix}••••••••••••••••••••
                      </code>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span>Créée le {fmtDate(key.createdAt)}</span>
                      {key.lastUsedAt && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Dernière utilisation {fmtDate(key.lastUsedAt)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground pr-1">Voir →</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Key detail dialog ── */}
      <Dialog open={!!selectedKey} onOpenChange={(open) => { if (!open) { setSelectedKey(null); setShowKey(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              {selectedKey?.name}
            </DialogTitle>
            <DialogDescription>Détails et actions pour cette clé API.</DialogDescription>
          </DialogHeader>

          {selectedKey && (
            <div className="space-y-4 py-1">
              {/* Status */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Statut</span>
                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
                  Active
                </Badge>
              </div>

              {/* Created */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Date de création
                </span>
                <span className="font-medium">{fmtDate(selectedKey.createdAt)}</span>
              </div>

              {/* Last used */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Dernière utilisation
                </span>
                <span className="font-medium">
                  {selectedKey.lastUsedAt ? fmtDate(selectedKey.lastUsedAt) : "Jamais utilisée"}
                </span>
              </div>

              <Separator />

              {/* Masked key + eye toggle + copy */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Clé API</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono bg-muted border rounded px-3 py-2 text-muted-foreground tracking-wide">
                    {showKey ? selectedKey.prefix : `${selectedKey.prefix.slice(0, 8)}${"•".repeat(28)}`}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 flex-shrink-0"
                    onClick={() => setShowKey((v) => !v)}
                    title={showKey ? "Masquer" : "Afficher le préfixe"}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <CopyButton text={selectedKey.prefix} label="" />
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded p-2">
                  ⚠ La clé complète n'est <strong>jamais stockée</strong> — elle n'est visible qu'une seule fois, à la création ou après régénération. Si vous ne l'avez pas copiée, régénérez la clé pour en obtenir une nouvelle.
                </p>
              </div>

              <Separator />

              {/* Actions */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Actions</Label>

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
                        L'ancienne clé <strong>{selectedKey.name}</strong> (<code>{selectedKey.prefix}…</code>) sera
                        immédiatement révoquée et remplacée par une nouvelle. Toutes vos intégrations utilisant
                        l'ancienne clé cesseront de fonctionner.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-amber-500 text-white hover:bg-amber-600"
                        onClick={() => regenerateMutation.mutate(selectedKey.id)}
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
                        La clé <strong>{selectedKey.name}</strong> (<code>{selectedKey.prefix}…</code>) sera désactivée
                        immédiatement. Toutes les intégrations utilisant cette clé cesseront de fonctionner.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => revokeMutation.mutate(selectedKey.id)}
                      >
                        Révoquer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" className="w-full" onClick={() => setSelectedKey(null)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create key dialog ── */}
      <Dialog open={newKeyDialog} onOpenChange={setNewKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Générer une nouvelle clé API</DialogTitle>
            <DialogDescription>
              Donnez un nom à votre clé pour l'identifier facilement (ex : Production, Site web, App mobile).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="key-name">Nom de la clé</Label>
              <Input
                id="key-name"
                placeholder="ex : Site e-commerce"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newKeyName.trim()) createMutation.mutate(newKeyName.trim());
                }}
                maxLength={100}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewKeyDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => createMutation.mutate(newKeyName.trim() || "Clé principale")}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Génération…" : "Générer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reveal key dialog (shown once after creation / regeneration) ── */}
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
              <CopyButton text={revealedKey.rawKey} label="Copier la clé complète" className="w-full justify-center text-base py-5" />
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
