import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Activity, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, CheckCircle2, CircleHelp, Globe2, MapPin, RefreshCw, ServerCog, SlidersHorizontal, XCircle } from "lucide-react";
import { COUNTRIES, OPERATOR_LABELS } from "@/lib/countries";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type TransactionType = "DEPOSIT" | "WITHDRAWAL";
type Provider = "PIXPAY" | "MAVIANCE";

type ProviderConfig = {
  country: string;
  operator: string;
  type: TransactionType;
  provider: Provider;
};

type ProviderService = {
  operator: string;
  country: string;
  currency: string;
  type: string;
  service_id: number | string;
  active: boolean;
};

type ServiceResponse = {
  services: ProviderService[];
};

const CONFIG_QUERY_KEY = ["admin", "provider-config"];
const MAViance_SERVICES_QUERY_KEY = ["admin", "maviance-services"];
const PIXPAY_SERVICES_QUERY_KEY = ["admin", "pixpay-services"];

const OPERATION_META: Record<TransactionType, {
  label: string;
  shortLabel: string;
  description: string;
  Icon: typeof ArrowDownToLine;
}> = {
  DEPOSIT: {
    label: "Dépôt",
    shortLabel: "Dépôt",
    description: "Collecter les fonds du client",
    Icon: ArrowDownToLine,
  },
  WITHDRAWAL: {
    label: "Retrait",
    shortLabel: "Retrait",
    description: "Envoyer les fonds au client",
    Icon: ArrowUpFromLine,
  },
};

const PROVIDER_META: Record<Provider, { label: string; accent: string; mark: string }> = {
  PIXPAY: {
    label: "PixPay",
    accent: "border-sky-200 bg-sky-50/70 text-sky-800",
    mark: "PP",
  },
  MAVIANCE: {
    label: "Maviance",
    accent: "border-amber-200 bg-amber-50/80 text-amber-900",
    mark: "MV",
  },
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

function hasActiveService(services: ProviderService[], country: string, operator: string, type: TransactionType) {
  return services.some((service) => {
    const countryMatches = service.country === country || !service.country;
    return countryMatches && service.operator === operator && service.type === type && service.active;
  });
}

function getConfiguredProvider(config: ProviderConfig[], country: string, operator: string, type: TransactionType): Provider {
  return config.find((item) => item.country === country && item.operator === operator && item.type === type)?.provider ?? "PIXPAY";
}

function ProviderChoice({
  provider,
  selected,
  available,
  disabled,
  onSelect,
  country,
  operator,
  type,
}: {
  provider: Provider;
  selected: boolean;
  available: boolean;
  disabled: boolean;
  onSelect: () => void;
  country: string;
  operator: string;
  type: TransactionType;
}) {
  const meta = PROVIDER_META[provider];
  const label = `${meta.label} — ${available ? "service actif" : "aucun service actif"}`;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={label}
      data-testid={`button-provider-${provider.toLowerCase()}-${country}-${operator.toLowerCase()}-${type.toLowerCase()}`}
      className={`group relative flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-[border-color,background-color,opacity] ${
        selected
          ? `${meta.accent} border-current/35 shadow-sm`
          : "border-border/80 bg-background text-muted-foreground hover:border-foreground/25 hover:bg-muted/40"
      } ${!available ? "cursor-not-allowed opacity-45" : ""} ${disabled ? "cursor-wait" : ""}`}
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold tracking-tight ${
        selected ? "bg-background/80 text-current" : "bg-muted text-muted-foreground"
      }`}>
        {meta.mark}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold">{meta.label}</span>
        <span className="mt-0.5 flex items-center gap-1 text-[10px] font-medium">
          {available ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          {available ? "Disponible" : "Non configuré"}
        </span>
      </span>
      {selected && available && (
        <CheckCircle2 className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" />
      )}
    </button>
  );
}

function OperationControl({
  country,
  operator,
  type,
  selectedProvider,
  pixpayAvailable,
  mavianceAvailable,
  isPending,
  onChange,
}: {
  country: string;
  operator: string;
  type: TransactionType;
  selectedProvider: Provider;
  pixpayAvailable: boolean;
  mavianceAvailable: boolean;
  isPending: boolean;
  onChange: (provider: Provider) => void;
}) {
  const { label, description, Icon } = OPERATION_META[type];
  const currentProviderAvailable = type === "DEPOSIT"
    ? selectedProvider === "PIXPAY" ? pixpayAvailable : mavianceAvailable
    : selectedProvider === "PIXPAY" ? pixpayAvailable : mavianceAvailable;

  return (
    <div className="rounded-xl border border-border/75 bg-background/75 p-3.5 shadow-[0_1px_2px_hsl(var(--foreground)/.03)]" data-testid={`operation-${country}-${operator.toLowerCase()}-${type.toLowerCase()}`}>
      <div className="mb-3 flex items-start gap-2.5">
        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          type === "DEPOSIT" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
        }`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="truncate text-[11px] text-muted-foreground">{description}</p>
        </div>
        <Badge variant="outline" className={`ml-auto shrink-0 text-[10px] ${
          currentProviderAvailable ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-orange-200 bg-orange-50 text-orange-700"
        }`}>
          {currentProviderAvailable ? "Opérationnelle" : "À configurer"}
        </Badge>
      </div>
      <div className="flex gap-2">
        <ProviderChoice
          provider="PIXPAY"
          selected={selectedProvider === "PIXPAY"}
          available={pixpayAvailable}
          disabled={isPending || !pixpayAvailable}
          onSelect={() => onChange("PIXPAY")}
          country={country}
          operator={operator}
          type={type}
        />
        <ProviderChoice
          provider="MAVIANCE"
          selected={selectedProvider === "MAVIANCE"}
          available={mavianceAvailable}
          disabled={isPending || !mavianceAvailable}
          onSelect={() => onChange("MAVIANCE")}
          country={country}
          operator={operator}
          type={type}
        />
      </div>
      {!pixpayAvailable && !mavianceAvailable && (
        <div className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-4 text-orange-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Aucun service actif. Configurez un service fournisseur avant d’activer cette opération.</span>
        </div>
      )}
    </div>
  );
}

export default function ProviderConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCountry, setSelectedCountry] = useState("ALL");
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const configQuery = useQuery({
    queryKey: CONFIG_QUERY_KEY,
    queryFn: () => customFetch<{ config: ProviderConfig[] }>("/api/admin/provider-config"),
  });
  const mavianceQuery = useQuery({
    queryKey: MAViance_SERVICES_QUERY_KEY,
    queryFn: () => customFetch<ServiceResponse>("/api/admin/maviance/services"),
  });
  const pixpayQuery = useQuery({
    queryKey: PIXPAY_SERVICES_QUERY_KEY,
    queryFn: () => customFetch<ServiceResponse>("/api/admin/pixpay/services"),
  });

  const updateProvider = useMutation({
    mutationFn: async ({ country, operator, type, provider }: ProviderConfig) => {
      const body = JSON.stringify({ country, operator, type, provider });
      if (provider === "PIXPAY") {
        return customFetch(`/api/admin/provider-config`, { method: "DELETE", body });
      }
      return customFetch(`/api/admin/provider-config`, { method: "PUT", body });
    },
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: CONFIG_QUERY_KEY });
      setPendingKey(null);
      toast({
        title: "Configuration enregistrée",
        description: `${OPERATOR_LABELS[variables.operator] ?? variables.operator} — ${OPERATION_META[variables.type].label} utilise désormais ${PROVIDER_META[variables.provider].label}.`,
      });
    },
    onError: (error, variables) => {
      setPendingKey(null);
      toast({
        variant: "destructive",
        title: "Enregistrement impossible",
        description: getErrorMessage(error, `La configuration ${variables.operator} n'a pas pu être mise à jour.`),
      });
    },
  });

  const config = configQuery.data?.config ?? [];
  const mavianceServices = mavianceQuery.data?.services ?? [];
  const pixpayServices = pixpayQuery.data?.services ?? [];
  const isLoading = configQuery.isLoading || mavianceQuery.isLoading || pixpayQuery.isLoading;
  const hasError = configQuery.isError || mavianceQuery.isError || pixpayQuery.isError;

  const visibleCountries = useMemo(
    () => selectedCountry === "ALL" ? [...COUNTRIES] : COUNTRIES.filter((country) => country.code === selectedCountry),
    [selectedCountry],
  );

  const totalOperators = useMemo(
    () => visibleCountries.reduce<number>((total, country) => total + country.operators.length, 0),
    [visibleCountries],
  );

  const configuredCount = useMemo(
    () => config.filter((item: ProviderConfig) => visibleCountries.some((country) => country.code === item.country)).length,
    [config, visibleCountries],
  );

  const availableProviderCount = useMemo(() => {
    let count = 0;
    for (const country of visibleCountries) {
      for (const operator of country.operators) {
        for (const type of ["DEPOSIT", "WITHDRAWAL"] as TransactionType[]) {
          if (hasActiveService(pixpayServices, country.code, operator, type)) count += 1;
          if (hasActiveService(mavianceServices, country.code, operator, type)) count += 1;
        }
      }
    }
    return count;
  }, [mavianceServices, pixpayServices, visibleCountries]);

  const handleProviderChange = (country: string, operator: string, type: TransactionType, provider: Provider) => {
    const key = `${country}-${operator}-${type}`;
    setPendingKey(key);
    updateProvider.mutate({ country, operator, type, provider });
  };

  const refreshAll = () => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: CONFIG_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: MAViance_SERVICES_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: PIXPAY_SERVICES_QUERY_KEY }),
    ]);
  };

  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8" data-testid="page-provider-config">
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(120deg,hsl(221_40%_17%),hsl(221_34%_24%))] px-5 py-6 text-slate-50 shadow-xl shadow-slate-900/10 sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border-[22px] border-sky-300/10" />
        <div className="pointer-events-none absolute -bottom-28 right-24 h-56 w-56 rounded-full border-[18px] border-amber-300/10" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200">
              <ServerCog className="h-4 w-4" />
              Routage des paiements
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Fournisseurs par opérateur</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300 sm:text-[15px]">
              Choisissez le fournisseur utilisé pour chaque dépôt et retrait. PixPay reste le choix par défaut lorsqu’aucune configuration n’est enregistrée.
            </p>
          </div>
          <div className="grid grid-cols-3 divide-x divide-slate-400/20 rounded-xl border border-slate-400/20 bg-slate-950/20 px-1 py-3 sm:min-w-[390px]">
            <div className="px-3 text-center">
              <p className="font-mono text-xl font-semibold text-white">{visibleCountries.length}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-400">Pays affichés</p>
            </div>
            <div className="px-3 text-center">
              <p className="font-mono text-xl font-semibold text-white">{totalOperators}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-400">Opérateurs</p>
            </div>
            <div className="px-3 text-center">
              <p className="font-mono text-xl font-semibold text-sky-200">{availableProviderCount}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-400">Services actifs</p>
            </div>
          </div>
        </div>
      </section>

      <Card className="border-border/70 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <SlidersHorizontal className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">Périmètre de configuration</p>
              <p className="text-xs text-muted-foreground">Affichez tous les pays ou concentrez-vous sur un marché.</p>
            </div>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
              <SelectTrigger className="w-full min-w-0 sm:w-[245px]" data-testid="select-provider-country">
                <SelectValue placeholder="Sélectionner un pays" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les pays</SelectItem>
                {COUNTRIES.map((country) => (
                  <SelectItem key={country.code} value={country.code}>{country.name} ({country.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={refreshAll}
              aria-label="Actualiser les données"
              data-testid="button-refresh-provider-config"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {hasError ? (
        <Card className="border-orange-200 bg-orange-50/45">
          <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="font-semibold text-orange-950">Les données n’ont pas pu être chargées</p>
              <p className="mt-1 text-sm text-orange-800/80">
                Vérifiez votre connexion ou vos droits administrateur, puis réessayez.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={refreshAll} data-testid="button-retry-provider-config">
              Réessayer
            </Button>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="grid gap-3 rounded-xl border p-4 lg:grid-cols-[minmax(190px,0.8fr)_1fr_1fr]">
                <div className="space-y-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-3 w-24" /></div>
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : visibleCountries.length === 0 || totalOperators === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <Globe2 className="h-10 w-10 text-muted-foreground/45" />
            <h2 className="mt-4 text-base font-semibold">Aucun opérateur à afficher</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">Sélectionnez un autre pays pour consulter son routage fournisseur.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden border-border/70 shadow-sm">
          <CardHeader className="border-b bg-muted/25 px-4 py-5 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Activity className="h-5 w-5 text-primary" />
                  Routage actif
                </CardTitle>
                <CardDescription className="mt-1.5">
                  {configuredCount > 0
                    ? `${configuredCount} configuration${configuredCount > 1 ? "s" : ""} explicite${configuredCount > 1 ? "s" : ""}. Les autres lignes utilisent PixPay par défaut.`
                    : "Aucune configuration explicite. Toutes les lignes utilisent PixPay par défaut."}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <CircleHelp className="h-3.5 w-3.5" />
                <span>Un fournisseur doit avoir un service actif pour être sélectionnable.</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4">
            <div className="mb-3 hidden grid-cols-[minmax(190px,0.8fr)_1fr_1fr] gap-3 px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground lg:grid">
              <div>Opérateur</div>
              <div>Dépôt</div>
              <div>Retrait</div>
            </div>
            <div className="space-y-3">
              {visibleCountries.map((country) => (
                <section key={country.code} className="overflow-hidden rounded-xl border border-border/70" data-testid={`section-country-${country.code}`}>
                  <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-xs font-bold text-background">{country.code}</span>
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-semibold">{country.name}</h2>
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {country.currency} · {country.operators.length} opérateur{country.operators.length > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">{country.code}</Badge>
                  </div>
                  <div className="divide-y divide-border/60">
                    {country.operators.map((operator) => {
                      const depositKey = `${country.code}-${operator}-DEPOSIT`;
                      const withdrawalKey = `${country.code}-${operator}-WITHDRAWAL`;
                      return (
                        <div key={operator} className="grid gap-3 p-3 sm:p-4 lg:grid-cols-[minmax(190px,0.8fr)_1fr_1fr] lg:items-center" data-testid={`row-provider-${country.code}-${operator}`}>
                          <div className="flex items-center gap-3 px-1 lg:px-2">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background font-mono text-[11px] font-semibold text-muted-foreground">{operator.slice(0, 3)}</span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{OPERATOR_LABELS[operator] ?? operator}</p>
                              <p className="mt-0.5 font-mono text-[10px] tracking-wide text-muted-foreground">{operator}</p>
                            </div>
                          </div>
                          {(["DEPOSIT", "WITHDRAWAL"] as TransactionType[]).map((type) => {
                            const isPending = pendingKey === `${country.code}-${operator}-${type}` && updateProvider.isPending;
                            return (
                              <OperationControl
                                key={type}
                                country={country.code}
                                operator={operator}
                                type={type}
                                selectedProvider={getConfiguredProvider(config, country.code, operator, type)}
                                pixpayAvailable={hasActiveService(pixpayServices, country.code, operator, type)}
                                mavianceAvailable={hasActiveService(mavianceServices, country.code, operator, type)}
                                isPending={isPending}
                                onChange={(provider) => handleProviderChange(country.code, operator, type, provider)}
                              />
                            );
                          })}
                          {pendingKey && pendingKey !== depositKey && pendingKey !== withdrawalKey ? null : null}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-start gap-3 rounded-xl border border-sky-200/80 bg-sky-50/55 px-4 py-3.5 text-sm text-sky-950">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
        <p className="leading-5">
          <span className="font-semibold">PixPay par défaut :</span> retirer une configuration rétablit PixPay pour l’opération concernée. Le choix ne sera effectif que si un service PixPay actif est disponible.
        </p>
      </div>
    </main>
  );
}