import { useState } from "react";
import { KycGate } from "@/components/kyc-gate";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Copy, Plus, Key, ShieldCheck, Clock, Check, ChevronRight,
  ArrowDownToLine, ArrowUpFromLine, BookOpen, Webhook,
  Save, CheckCircle2, Terminal, Zap, Lock,
} from "lucide-react";

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
    <button
      onClick={copy}
      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border transition-all
        ${copied
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
          : "border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
        } ${className ?? ""}`}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {label && <span>{copied ? "Copié" : label}</span>}
    </button>
  );
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ApiKeys() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [newKeyName, setNewKeyName] = useState("");
  const [pendingType, setPendingType] = useState<"payin" | "payout" | null>(null);
  const [webhookUrl, setWebhookUrl] = useState<string>((user as { webhookUrl?: string })?.webhookUrl ?? "");
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);
  const [webhookSaved, setWebhookSaved] = useState(false);

  const onSaveWebhook = async () => {
    setIsSavingWebhook(true);
    try {
      await customFetch("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({ webhookUrl: webhookUrl.trim() }),
      });
      setWebhookSaved(true);
      toast({ title: "Webhook enregistré", description: "Les notifications seront envoyées à cette URL." });
      setTimeout(() => setWebhookSaved(false), 3000);
    } catch (err: unknown) {
      const raw = (err as { message?: string })?.message ?? "Une erreur s'est produite.";
      toast({ variant: "destructive", title: "Échec", description: raw.replace(/^HTTP\s+\d+[^:]*:\s*/i, "") });
    } finally {
      setIsSavingWebhook(false);
    }
  };

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
  const payinKey  = activeKeys.find((k) => k.keyType === "payin");
  const payoutKey = activeKeys.find((k) => k.keyType === "payout");

  const handleGenerate = () => {
    if (!pendingType) return;
    createMutation.mutate({
      name: newKeyName.trim() || (pendingType === "payin" ? "Clé Payin" : "Clé Payout"),
      type: pendingType,
    });
  };

  return (
    <KycGate level="kyb">
    <div className="max-w-3xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clés API</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Intégrez YookPay dans vos applications avec vos clés Payin et Payout.
          </p>
        </div>
        <a
          href="/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs font-medium text-indigo-500 hover:text-indigo-400 transition-colors shrink-0 mt-1"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Documentation
        </a>
      </div>

      {/* ── Security notice ── */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
        <Lock className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
          Ne partagez jamais vos clés dans votre code source public ou côté client. Stockez-les en variables d'environnement serveur uniquement.
        </p>
      </div>

      {/* ── Keys grid ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Payin */}
        <KeySection
          type="payin"
          keyData={payinKey ?? null}
          isLoading={isLoading}
          onGenerate={() => { setPendingType("payin"); setNewKeyName(""); }}
          onClick={() => payinKey && navigate(`/api-keys/${payinKey.id}`)}
        />
        {/* Payout */}
        <KeySection
          type="payout"
          keyData={payoutKey ?? null}
          isLoading={isLoading}
          onGenerate={() => { setPendingType("payout"); setNewKeyName(""); }}
          onClick={() => payoutKey && navigate(`/api-keys/${payoutKey.id}`)}
        />
      </div>

      {/* ── Endpoint reference ── */}
      <div className="rounded-xl border border-border overflow-hidden">
        {/* Terminal bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/60 border-b border-border">
          <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-mono text-muted-foreground">POST /api/merchant/v1/payin</span>
          <div className="ml-auto">
            <CopyButton text="POST /api/merchant/v1/payin" />
          </div>
        </div>

        {/* Code body */}
        <div className="bg-[#0d1117] dark:bg-[#0d1117] p-4 space-y-3 font-mono text-xs">
          {/* Header example */}
          <div className="space-y-1">
            <p className="text-slate-500 uppercase tracking-widest text-[10px]">Headers</p>
            <div className="flex items-center justify-between gap-2 bg-white/5 rounded-md px-3 py-2">
              <span>
                <span className="text-slate-400">x-api-key: </span>
                <span className="text-emerald-400">yk_live_••••••••••••••••••••</span>
              </span>
              <CopyButton text="x-api-key" />
            </div>
          </div>

          {/* Body */}
          <div className="space-y-1">
            <p className="text-slate-500 uppercase tracking-widest text-[10px]">Body (JSON)</p>
            <div className="bg-white/5 rounded-md px-3 py-3 space-y-0.5">
              <div><span className="text-slate-400">{"{"}</span></div>
              <div className="pl-4"><span className="text-blue-400">"country"</span><span className="text-slate-400">: </span><span className="text-amber-300">"CM"</span><span className="text-slate-500">,</span></div>
              <div className="pl-4"><span className="text-blue-400">"operator"</span><span className="text-slate-400">: </span><span className="text-amber-300">"MTN"</span><span className="text-slate-500">,</span></div>
              <div className="pl-4"><span className="text-blue-400">"phone"</span><span className="text-slate-400">: </span><span className="text-amber-300">"237XXXXXXXXX"</span><span className="text-slate-500">,</span></div>
              <div className="pl-4"><span className="text-blue-400">"amount"</span><span className="text-slate-400">: </span><span className="text-purple-400">5000</span></div>
              <div><span className="text-slate-400">{"}"}</span></div>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30 border-t border-border">
          <Zap className="h-3.5 w-3.5 text-indigo-500" />
          <p className="text-xs text-muted-foreground">
            Les frais configurés par l'admin pour votre compte sont appliqués automatiquement.
          </p>
        </div>
      </div>

      {/* ── Webhook ── */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <Webhook className="h-4 w-4 text-indigo-500" />
          </div>
          <div>
            <p className="text-sm font-semibold">Webhook URL</p>
            <p className="text-xs text-muted-foreground">Reçoit un POST à chaque mise à jour de statut de transaction</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            <Input
              type="url"
              placeholder="https://votre-serveur.com/webhook/yookpay"
              value={webhookUrl}
              onChange={(e) => { setWebhookUrl(e.target.value); setWebhookSaved(false); }}
              className="flex-1 font-mono text-sm"
            />
            <Button onClick={onSaveWebhook} disabled={isSavingWebhook} className="shrink-0 gap-2">
              {isSavingWebhook
                ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : webhookSaved
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  : <Save className="h-4 w-4" />}
              {webhookSaved ? "Enregistré" : "Enregistrer"}
            </Button>
          </div>

          {/* Payload preview */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/60 border-b border-border">
              <Terminal className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Payload reçu sur votre serveur</span>
            </div>
            <div className="bg-[#0d1117] p-3 font-mono text-[11px] text-slate-300 space-y-0.5 overflow-x-auto">
              <p className="text-slate-500">POST {webhookUrl || "https://votre-url.com/webhook"}</p>
              <p className="text-slate-600">Content-Type: application/json</p>
              <p><span className="text-blue-400">X-YookPay-Event</span><span className="text-slate-500">: transaction.status_update</span></p>
              <p className="pt-1 text-slate-400">{"{"}</p>
              <p className="pl-4"><span className="text-blue-400">"event"</span><span className="text-slate-500">: </span><span className="text-amber-300">"transaction.status_update"</span><span className="text-slate-600">,</span></p>
              <p className="pl-4"><span className="text-blue-400">"sentAt"</span><span className="text-slate-500">: </span><span className="text-amber-300">"2024-05-16T10:23:47.000Z"</span><span className="text-slate-600">,</span></p>
              <p className="pl-4"><span className="text-blue-400">"data"</span><span className="text-slate-500">: {"{ "}</span><span className="text-emerald-400">"reference"</span><span className="text-slate-500">: </span><span className="text-amber-300">"YPY-..."</span><span className="text-slate-500">, </span><span className="text-emerald-400">"status"</span><span className="text-slate-500">: </span><span className="text-purple-400">"SUCCESS"</span><span className="text-slate-500">{" }"}</span></p>
              <p className="text-slate-400">{"}"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Generate dialog ── */}
      <Dialog open={!!pendingType} onOpenChange={(open) => { if (!open) setPendingType(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-4 w-4" />
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
                placeholder={pendingType === "payin" ? "ex : Payin Production" : "ex : Payout Production"}
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
              {createMutation.isPending ? "Génération…" : "Générer la clé"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </KycGate>
  );
}

function KeySection({
  type, keyData, isLoading, onGenerate, onClick,
}: {
  type: "payin" | "payout";
  keyData: ApiKey | null;
  isLoading: boolean;
  onGenerate: () => void;
  onClick: () => void;
}) {
  const isPayin = type === "payin";
  const accent  = isPayin
    ? "from-blue-500/10 to-blue-600/5 border-blue-500/20"
    : "from-purple-500/10 to-purple-600/5 border-purple-500/20";
  const iconBg  = isPayin ? "bg-blue-500/15 text-blue-500" : "bg-purple-500/15 text-purple-500";
  const Icon    = isPayin ? ArrowDownToLine : ArrowUpFromLine;

  return (
    <div className={`rounded-xl border bg-gradient-to-br ${accent} overflow-hidden`}>
      {/* Top */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/5">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{isPayin ? "Payin" : "Payout"}</p>
          <p className="text-xs text-muted-foreground">{isPayin ? "Encaissement" : "Versement sortant"}</p>
        </div>
        {keyData && (
          <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 bg-emerald-500/10 text-[10px] shrink-0">
            Active
          </Badge>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-4">
        {isLoading ? (
          <Skeleton className="h-14 w-full rounded-lg" />
        ) : keyData ? (
          <button
            onClick={onClick}
            className="w-full text-left group"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-1.5 min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{keyData.name}</p>
                <code className="block text-xs font-mono text-muted-foreground">
                  {keyData.prefix}<span className="opacity-50">••••••••••••••••</span>
                </code>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <ShieldCheck className="h-3 w-3 shrink-0" />
                  <span>Créée le {new Date(keyData.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}</span>
                  {keyData.lastUsedAt && (
                    <>
                      <span className="opacity-40">·</span>
                      <Clock className="h-3 w-3 shrink-0" />
                      <span>{new Date(keyData.lastUsedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</span>
                    </>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
            </div>
          </button>
        ) : (
          <div className="flex flex-col items-center text-center gap-3 py-2">
            <Key className="h-7 w-7 text-muted-foreground/25" />
            <p className="text-xs text-muted-foreground">Aucune clé {isPayin ? "payin" : "payout"} active</p>
            <Button
              size="sm"
              variant={isPayin ? "default" : "outline"}
              className="gap-1.5 text-xs h-8"
              onClick={onGenerate}
            >
              <Plus className="h-3.5 w-3.5" />
              Générer
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
