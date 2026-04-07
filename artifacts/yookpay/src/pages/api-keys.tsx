import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Copy, Plus, Trash2, Key, ShieldCheck, Clock, Check } from "lucide-react";

interface ApiKey {
  id: number;
  name: string;
  prefix: string;
  active: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copy}>
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ApiKeys() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyDialog, setNewKeyDialog] = useState(false);
  const [revealedKey, setRevealedKey] = useState<{ id: number; rawKey: string; name: string } | null>(null);

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
      toast({ title: "Clé révoquée", description: "La clé API a été désactivée avec succès." });
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
            <Card key={key.id}>
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
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Révoquer cette clé ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          La clé <strong>{key.name}</strong> (<code>{key.prefix}…</code>) sera désactivée
                          immédiatement. Toutes les intégrations utilisant cette clé cesseront de fonctionner.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => revokeMutation.mutate(key.id)}
                        >
                          Révoquer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create key dialog */}
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

      {/* Reveal key dialog (shown once after creation) */}
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
            <Label>Votre clé API — {revealedKey?.name}</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-muted border rounded px-3 py-3 break-all leading-relaxed">
                {revealedKey?.rawKey}
              </code>
              {revealedKey && <CopyButton text={revealedKey.rawKey} />}
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded p-2">
              ⚠ Stockez cette clé dans un gestionnaire de secrets ou une variable d'environnement sécurisée.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setRevealedKey(null)} className="w-full">
              J'ai copié ma clé
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
