import { useState } from "react";
import { KycGate } from "@/components/kyc-gate";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Copy, Plus, Key, ShieldCheck, Clock, Check, ChevronRight, ArrowDownToLine, ArrowUpFromLine, BookOpen } from "lucide-react";

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
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function KeyTypeBadge({ type }: { type: "payin" | "payout" }) {
  if (type === "payin") {
    return (
      <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 text-xs shrink-0 gap-1">
        <ArrowDownToLine className="h-3 w-3" />
        Payin
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50 dark:bg-purple-950/20 dark:border-purple-800 text-xs shrink-0 gap-1">
      <ArrowUpFromLine className="h-3 w-3" />
      Payout
    </Badge>
  );
}

export default function ApiKeys() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [newKeyName, setNewKeyName] = useState("");
  const [pendingType, setPendingType] = useState<"payin" | "payout" | null>(null);

  const { data, isLoading } = useQuery<{ keys: ApiKey[] }>({
    queryKey: ["api-keys"],
    queryFn: () => customFetch<{ keys: ApiKey[] }>("/api/api-keys"),
  });

  const createMutation = useMutation({
    mutationFn: ({ name, type }: { name: string; type: "payin" | "payout" }) =>
      customFetch<{ id: number; name: string; prefix: string; keyType: string; rawKey: string; createdAt: string }>("/api/api-keys", {
        method: "POST",
        body: JSON.stringify({ name, type }),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      setPendingType(null);
      setNewKeyName("");
      sessionStorage.setItem(REVEAL_STORAGE_KEY, JSON.stringify({ id: data.id, rawKey: data.rawKey, name: data.name, keyType: data.keyType }));
      navigate(`/api-keys/${data.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const activeKeys = data?.keys.filter((k) => k.active) ?? [];
  const payinKey = activeKeys.find((k) => k.keyType === "payin");
  const payoutKey = activeKeys.find((k) => k.keyType === "payout");

  const handleGenerate = () => {
    if (!pendingType) return;
    createMutation.mutate({ name: newKeyName.trim() || (pendingType === "payin" ? "Clé Payin" : "Clé Payout"), type: pendingType });
  };

  return (
    <KycGate level="kyb">
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clés API</h1>
        <p className="text-muted-foreground mt-1">
          Intégrez YookPay dans vos applications avec vos clés Payin et Payout.
        </p>
      </div>

      {/* Docs banner */}
      <a href="/docs" target="_blank" rel="noopener noreferrer"
        className="flex items-center justify-between gap-3 rounded-lg border border-indigo-200 bg-indigo-50/60 dark:border-indigo-800 dark:bg-indigo-950/20 px-4 py-3 hover:bg-indigo-100/60 dark:hover:bg-indigo-950/40 transition-colors group">
        <div className="flex items-center gap-3 text-sm">
          <BookOpen className="h-4 w-4 text-indigo-500 shrink-0" />
          <span className="text-indigo-800 dark:text-indigo-300 font-medium">Documentation API</span>
          <span className="text-indigo-600/70 dark:text-indigo-400/70 hidden sm:inline">— guides d'intégration Payin & Payout</span>
        </div>
        <ChevronRight className="h-4 w-4 text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
      </a>

      {/* Info card */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
              <p className="font-medium">Deux types de clés disponibles</p>
              <ul className="text-xs space-y-0.5 text-blue-700 dark:text-blue-400 list-disc list-inside">
                <li><strong>Payin</strong> — permet d'encaisser des paiements via <code>POST /api/merchant/v1/payin</code>.</li>
                <li><strong>Payout</strong> — permet d'initier des transferts sortants (à venir).</li>
                <li>Ne partagez jamais vos clés dans votre code source public.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payin section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowDownToLine className="h-4 w-4 text-blue-600" />
            <h2 className="font-semibold">Clé Payin</h2>
            <span className="text-xs text-muted-foreground">— encaissement</span>
          </div>
          {!payinKey && (
            <Button size="sm" className="gap-2" onClick={() => { setPendingType("payin"); setNewKeyName(""); }}>
              <Plus className="h-4 w-4" />
              Générer
            </Button>
          )}
        </div>

        {isLoading ? (
          <Skeleton className="h-20 w-full rounded-lg" />
        ) : payinKey ? (
          <KeyCard keyData={payinKey} onClick={() => navigate(`/api-keys/${payinKey.id}`)} />
        ) : (
          <EmptyKeyCard type="payin" onGenerate={() => { setPendingType("payin"); setNewKeyName(""); }} />
        )}
      </div>

      {/* Payout section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowUpFromLine className="h-4 w-4 text-purple-600" />
            <h2 className="font-semibold">Clé Payout</h2>
            <span className="text-xs text-muted-foreground">— versement</span>
          </div>
          {!payoutKey && (
            <Button size="sm" variant="outline" className="gap-2" onClick={() => { setPendingType("payout"); setNewKeyName(""); }}>
              <Plus className="h-4 w-4" />
              Générer
            </Button>
          )}
        </div>

        {isLoading ? (
          <Skeleton className="h-20 w-full rounded-lg" />
        ) : payoutKey ? (
          <KeyCard keyData={payoutKey} onClick={() => navigate(`/api-keys/${payoutKey.id}`)} />
        ) : (
          <EmptyKeyCard type="payout" onGenerate={() => { setPendingType("payout"); setNewKeyName(""); }} />
        )}
      </div>

      {/* Endpoint reference */}
      <Card className="border-dashed">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm text-muted-foreground font-medium">Endpoint Payin</CardTitle>
        </CardHeader>
        <CardContent className="pb-4 space-y-2">
          <code className="block text-xs font-mono bg-muted rounded px-3 py-2">
            POST /api/merchant/v1/payin
          </code>
          <p className="text-xs text-muted-foreground">
            Envoyez votre clé payin dans l'en-tête <code>x-api-key</code>. Les frais configurés par l'admin pour votre compte sont appliqués automatiquement.
          </p>
          <code className="block text-xs font-mono bg-muted rounded px-3 py-2 whitespace-pre">
{`{
  "country": "CM",
  "operator": "MTN",
  "phone": "237XXXXXXXXX",
  "amount": 5000
}`}
          </code>
        </CardContent>
      </Card>

      {/* Generate dialog */}
      <Dialog open={!!pendingType} onOpenChange={(open) => { if (!open) setPendingType(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Générer une clé {pendingType === "payin" ? "Payin" : "Payout"}
            </DialogTitle>
            <DialogDescription>
              Donnez un nom à votre clé pour l'identifier facilement (ex : Production, Site web).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="key-name">Nom de la clé</Label>
              <Input
                id="key-name"
                placeholder={pendingType === "payin" ? "ex : Clé Payin Production" : "ex : Clé Payout Production"}
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleGenerate(); }}
                maxLength={100}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingType(null)}>Annuler</Button>
            <Button onClick={handleGenerate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Génération…" : "Générer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </KycGate>
  );
}

function KeyCard({ keyData, onClick }: { keyData: ApiKey; onClick: () => void }) {
  return (
    <Card className="cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all" onClick={onClick}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Key className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold truncate">{keyData.name}</span>
              <KeyTypeBadge type={keyData.keyType} />
              <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 text-xs shrink-0">
                Active
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <code className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {keyData.prefix}••••••••••••••••••••
              </code>
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
              <span>Créée le {fmtDate(keyData.createdAt)}</span>
              {keyData.lastUsedAt && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {fmtDate(keyData.lastUsedAt)}
                  </span>
                </>
              )}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyKeyCard({ type, onGenerate }: { type: "payin" | "payout"; onGenerate: () => void }) {
  return (
    <Card className="border-dashed">
      <CardContent className="pt-6 pb-6 flex flex-col items-center text-center gap-2">
        <Key className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">
          Aucune clé {type === "payin" ? "payin" : "payout"} active
        </p>
        <Button onClick={onGenerate} variant="ghost" size="sm" className="mt-1 gap-2 text-xs">
          <Plus className="h-3.5 w-3.5" />
          Générer
        </Button>
      </CardContent>
    </Card>
  );
}
