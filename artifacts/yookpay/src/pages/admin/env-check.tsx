import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";

type EnvKey = {
  name: string;
  set: boolean;
  hint: string;
  required: boolean;
  warnings: string[];
};

type EnvCheckResult = {
  timestamp: string;
  nodeEnv: string;
  pixpayEnv: string;
  mavianceEnv: string;
  pawapayEnv?: string;
  providers: {
    maviance: {
      ready: boolean;
      publicKeySet: boolean;
      secretSet: boolean;
      baseUrl: string;
      callbackUrl: string | null;
    };
    pixpay: {
      callbackUrl: string | null;
    };
    pawapay?: {
      ready: boolean;
      apiTokenSet?: boolean;
      baseUrl?: string;
      callbackUrl?: string | null;
    };
  };
  keys: EnvKey[];
};

export default function EnvCheck() {
  const { data, isLoading, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["admin", "env-check"],
    queryFn: () => customFetch("/api/admin/env-check") as Promise<EnvCheckResult>,
    refetchOnWindowFocus: false,
  });

  const keys = data?.keys ?? [];
  const missing = keys.filter((k) => k.required && !k.set);
  const withWarnings = keys.filter((k) => k.warnings.length > 0);
  const allOk = missing.length === 0 && withWarnings.length === 0;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Diagnostic — Variables d'environnement</h1>
          <p className="text-muted-foreground mt-1">
            Vérifiez quelles clés API sont lues par le serveur. Les valeurs sont masquées.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      {/* Status global */}
      {!isLoading && data && (
        <Card className={allOk ? "border-green-500/40 bg-green-500/5" : "border-destructive/40 bg-destructive/5"}>
          <CardContent className="flex items-center gap-3 py-4">
            {allOk ? (
              <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" />
            ) : (
              <XCircle className="h-6 w-6 text-destructive shrink-0" />
            )}
            <div>
              <p className="font-semibold">
                {allOk
                  ? "Toutes les clés requises sont détectées"
                  : `${missing.length} clé(s) manquante(s) · ${withWarnings.length} avertissement(s)`}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                 NODE_ENV : <strong>{data.nodeEnv}</strong> · PixPay env : <strong>{data.pixpayEnv}</strong> · Maviance env : <strong>{data.mavianceEnv}</strong>{data.pawapayEnv ? <> · pawaPay env : <strong>{data.pawapayEnv}</strong></> : ""}
                {dataUpdatedAt ? ` · vérifié à ${new Date(dataUpdatedAt).toLocaleTimeString("fr-FR")}` : ""}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && data && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card className={data.providers.maviance.ready ? "border-green-500/40 bg-green-500/5" : "border-amber-500/40 bg-amber-500/5"}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                {data.providers.maviance.ready ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                )}
                Maviance / SmobilPay
              </CardTitle>
              <CardDescription>
                État des variables reçues par le processus Node actuel.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Identifiants S3P</span>
                <Badge variant={data.providers.maviance.ready ? "default" : "outline"}>
                  {data.providers.maviance.ready ? "Détectés" : "Manquants"}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Environnement</span>
                <code className="text-xs">{data.mavianceEnv}</code>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">API utilisée</span>
                <code className="block break-all rounded bg-muted px-2 py-1 text-[11px]">{data.providers.maviance.baseUrl}</code>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Callback</span>
                <code className="block break-all rounded bg-muted px-2 py-1 text-[11px]">
                  {data.providers.maviance.callbackUrl ?? "MAVIANCE_IPN_BASE_URL non défini"}
                </code>
              </div>
              {!data.providers.maviance.ready && (
                <p className="rounded-md border border-amber-300/70 bg-amber-100/60 p-2 text-xs leading-5 text-amber-900">
                  Les secrets ajoutés dans Plesk doivent être définis comme variables d’environnement de cette application Node,
                  puis l’application doit être redémarrée. Cette page vérifie uniquement ce que le processus reçoit dans <code>process.env</code>.
                </p>
              )}
            </CardContent>
          </Card>
          <Card className={data.providers.pawapay?.ready ? "border-violet-500/40 bg-violet-500/5" : "border-amber-500/40 bg-amber-500/5"}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                {data.providers.pawapay?.ready ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}
                pawaPay
              </CardTitle>
              <CardDescription>État de la configuration pawaPay reçue par le serveur.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Clé API</span>
                <Badge variant={data.providers.pawapay?.ready ? "default" : "outline"}>{data.providers.pawapay?.ready ? "Détectée" : "Manquante"}</Badge>
              </div>
              <div className="space-y-1"><span className="text-xs text-muted-foreground">API utilisée</span><code className="block break-all rounded bg-muted px-2 py-1 text-[11px]">{data.providers.pawapay?.baseUrl ?? "Non configurée"}</code></div>
              <div className="space-y-1"><span className="text-xs text-muted-foreground">Callback</span><code className="block break-all rounded bg-muted px-2 py-1 text-[11px]">{data.providers.pawapay?.callbackUrl ?? "Non configuré"}</code></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Callbacks fournisseurs</CardTitle>
              <CardDescription>URLs calculées à partir des variables runtime.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Maviance</span>
                <code className="block break-all rounded bg-muted px-2 py-1 text-[11px]">
                  {data.providers.maviance.callbackUrl ?? "Non configuré"}
                </code>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">pawaPay</span>
                <code className="block break-all rounded bg-muted px-2 py-1 text-[11px]">{data.providers.pawapay?.callbackUrl ?? "Non configuré"}</code>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">PixPay</span>
                <code className="block break-all rounded bg-muted px-2 py-1 text-[11px]">
                  {data.providers.pixpay.callbackUrl ?? "Non configuré"}
                </code>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                Les valeurs secrètes ne sont jamais affichées. Seuls leur présence et les paramètres non sensibles sont vérifiés.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table des clés */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5" />
            Clés détectées par le serveur
          </CardTitle>
          <CardDescription>
             Les secrets sont masqués. Les valeurs non sensibles servent uniquement à confirmer la configuration runtime.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-6 py-3 animate-pulse">
                    <div className="h-4 w-4 rounded-full bg-muted" />
                    <div className="h-4 w-48 bg-muted rounded" />
                    <div className="ml-auto h-4 w-32 bg-muted rounded" />
                  </div>
                ))
              : keys.map((key) => (
                  <div key={key.name} className="flex flex-wrap items-center gap-2 px-6 py-3">
                    {/* Icône statut */}
                    {key.set ? (
                      key.warnings.length > 0 ? (
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      )
                    ) : (
                      <XCircle className={`h-4 w-4 shrink-0 ${key.required ? "text-destructive" : "text-muted-foreground"}`} />
                    )}

                    {/* Nom de la variable */}
                    <code className="text-sm font-mono font-medium">{key.name}</code>

                    {key.required && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">requis</Badge>
                    )}

                    {/* Valeur masquée */}
                    <span className="ml-auto font-mono text-xs text-muted-foreground">
                      {key.set ? key.hint : "non défini"}
                    </span>

                    {/* Avertissements */}
                    {key.warnings.map((w, i) => (
                      <span key={i} className="w-full pl-6 text-xs text-amber-600 dark:text-amber-400">
                        ⚠ {w}
                      </span>
                    ))}
                  </div>
                ))}
          </div>
        </CardContent>
      </Card>

      {/* Instructions si problème */}
      {!isLoading && missing.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Comment corriger
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Créez un fichier <code className="bg-muted px-1 rounded">.env</code> à la racine de
              votre application sur Plesk (même dossier que <code className="bg-muted px-1 rounded">startup.js</code>) :
            </p>
            <pre className="bg-muted rounded-md p-4 text-xs overflow-x-auto">
{missing.map((k) => `${k.name}=VOTRE_VALEUR_ICI`).join("\n")}
            </pre>
            <p>
              Puis redémarrez l'application dans Plesk. Le serveur lira ce fichier au démarrage.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
