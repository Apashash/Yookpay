import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import {
  AlertTriangle, ArrowDownToLine, ArrowUpFromLine,
  CheckCircle2, Globe2, RefreshCw, ServerCog,
  SlidersHorizontal, Download, Map, AlertCircle, Wallet
} from "lucide-react";
import { COUNTRIES, OPERATOR_LABELS } from "@/lib/countries";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type TransactionType = "DEPOSIT" | "WITHDRAWAL";
type Provider = "PIXPAY" | "MAVIANCE" | "PAWAPAY";

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

type PawaPayWalletBalance = {
  country?: string;
  countryCode?: string;
  currency: string;
  balance: number | string;
  activeProviders?: string[];
  providers?: string[];
};

type PawaPayStatus = {
  environment: string;
  configured: boolean;
  activeServices: number;
  activeCountries: number;
  deposits: number;
  withdrawals: number;
  refunds: number;
  lastSyncAt: string | null;
};

type RoutingCountry = {
  code: string;
  name: string;
  flag: string;
  currency: string;
  operators: string[];
};

const PAWAPAY_COUNTRY_META: Record<string, Omit<RoutingCountry, "operators">> = {
  ET: { code: "ET", name: "Éthiopie", flag: "🇪🇹", currency: "ETB" },
  GH: { code: "GH", name: "Ghana", flag: "🇬🇭", currency: "GHS" },
  KE: { code: "KE", name: "Kenya", flag: "🇰🇪", currency: "KES" },
  LS: { code: "LS", name: "Lesotho", flag: "🇱🇸", currency: "LSL" },
  MW: { code: "MW", name: "Malawi", flag: "🇲🇼", currency: "MWK" },
  MZ: { code: "MZ", name: "Mozambique", flag: "🇲🇿", currency: "MZN" },
  NG: { code: "NG", name: "Nigeria", flag: "🇳🇬", currency: "NGN" },
  RW: { code: "RW", name: "Rwanda", flag: "🇷🇼", currency: "RWF" },
  SL: { code: "SL", name: "Sierra Leone", flag: "🇸🇱", currency: "SLE" },
  TZ: { code: "TZ", name: "Tanzanie", flag: "🇹🇿", currency: "TZS" },
  UG: { code: "UG", name: "Ouganda", flag: "🇺🇬", currency: "UGX" },
  ZM: { code: "ZM", name: "Zambie", flag: "🇿🇲", currency: "ZMW" },
};

const CONFIG_QUERY_KEY = ["admin", "provider-config"];
const MAViance_SERVICES_QUERY_KEY = ["admin", "maviance-services"];
const PIXPAY_SERVICES_QUERY_KEY = ["admin", "pixpay-services"];
const PAWAPAY_SERVICES_QUERY_KEY = ["admin", "pawapay-services"];
const PAWAPAY_BALANCES_QUERY_KEY = ["admin", "pawapay-wallet-balances"];
const PAWAPAY_STATUS_QUERY_KEY = ["admin", "pawapay-status"];

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
    accent: "border-sky-200 bg-sky-50/70 text-sky-800 dark:bg-sky-900/30 dark:border-sky-800 dark:text-sky-300",
    mark: "PP",
  },
  MAVIANCE: {
    label: "Maviance",
    accent: "border-amber-200 bg-amber-50/80 text-amber-900 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-300",
    mark: "MV",
  },
  PAWAPAY: {
    label: "pawaPay",
    accent: "border-violet-200 bg-violet-50/80 text-violet-900 dark:bg-violet-900/30 dark:border-violet-800 dark:text-violet-300",
    mark: "PW",
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

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "date inconnue";
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

export default function ProviderConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCountry, setSelectedCountry] = useState("CM");
  const [selectedOperator, setSelectedOperator] = useState("MTN");
  const [selectedType, setSelectedType] = useState<TransactionType>("DEPOSIT");
  const [selectedProvider, setSelectedProvider] = useState<Provider>("PIXPAY");
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
  const pawapayQuery = useQuery({
    queryKey: PAWAPAY_SERVICES_QUERY_KEY,
    queryFn: () => customFetch<ServiceResponse>("/api/admin/pawapay/services"),
  });
  const pawapayBalancesQuery = useQuery({
    queryKey: PAWAPAY_BALANCES_QUERY_KEY,
    queryFn: () => customFetch<PawaPayWalletBalance[] | { wallets?: PawaPayWalletBalance[]; balances?: PawaPayWalletBalance[] }>("/api/admin/pawapay/wallet-balance"),
  });
  const pawapayStatusQuery = useQuery({
    queryKey: PAWAPAY_STATUS_QUERY_KEY,
    queryFn: () => customFetch<PawaPayStatus>("/api/admin/pawapay/status"),
  });

  const updateProvider = useMutation({
    mutationFn: async ({ country, operator, type, provider }: ProviderConfig) => {
      if (provider === "PAWAPAY" && !hasActiveService(pawapayServices, country, operator, type)) {
        const syncResult = await customFetch<{
          synced?: Array<{ country: string; operator: string; type: TransactionType }>;
        }>("/api/admin/pawapay/sync-services", { method: "POST" });
        const routeAvailable = syncResult.synced?.some(
          (service) => service.country === country && service.operator === operator && service.type === type,
        );
        if (!routeAvailable) {
          throw new Error(`pawaPay ne propose aucun service ${OPERATION_META[type].label.toLowerCase()} actif pour ${OPERATOR_LABELS[operator] ?? operator} (${country}).`);
        }
      }
      const body = JSON.stringify({ country, operator, type, provider });
      if (provider === "PIXPAY") {
        return customFetch(`/api/admin/provider-config`, { method: "DELETE", body });
      }
      return customFetch(`/api/admin/provider-config`, { method: "PUT", body });
    },
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: CONFIG_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PAWAPAY_SERVICES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PAWAPAY_STATUS_QUERY_KEY });
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

  const config = asArray<ProviderConfig>(configQuery.data?.config);
  const mavianceServices = asArray<ProviderService>(mavianceQuery.data?.services);
  const pixpayServices = asArray<ProviderService>(pixpayQuery.data?.services);
  const pawapayServices = asArray<ProviderService>(pawapayQuery.data?.services);
  const pawapayStatus = pawapayStatusQuery.data;
  const pawapayBalanceData = pawapayBalancesQuery.data;
  const pawapayBalances = Array.isArray(pawapayBalanceData)
    ? pawapayBalanceData
    : pawapayBalanceData?.wallets ?? pawapayBalanceData?.balances ?? [];

  const isLoading = configQuery.isLoading || mavianceQuery.isLoading || pixpayQuery.isLoading || pawapayQuery.isLoading || pawapayStatusQuery.isLoading;
  const hasError = configQuery.isError || mavianceQuery.isError || pixpayQuery.isError || pawapayQuery.isError || pawapayStatusQuery.isError;

  const routingCountries = useMemo<RoutingCountry[]>(() => {
    const countries = new Map<string, RoutingCountry>(
      COUNTRIES.map((country) => [
        country.code,
        {
          code: country.code,
          name: country.name,
          flag: country.flag,
          currency: country.currency,
          operators: [...country.operators],
        },
      ]),
    );
    for (const service of pawapayServices) {
      const countryCode = typeof service.country === "string" ? service.country.trim().toUpperCase() : "";
      const operator = typeof service.operator === "string" ? service.operator.trim().toUpperCase() : "";
      if (!service.active || countryCode.length !== 2 || !operator) continue;
      const existing = countries.get(countryCode);
      const meta = PAWAPAY_COUNTRY_META[countryCode];
      const country = existing ?? {
        code: countryCode,
        name: meta?.name ?? countryCode,
        flag: meta?.flag ?? "🌍",
        currency: service.currency || meta?.currency || "—",
        operators: [],
      };
      if (!country.operators.includes(operator)) country.operators.push(operator);
      countries.set(countryCode, country);
    }
    return [...countries.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [pawapayServices]);

  const visibleCountries = useMemo(
    () => routingCountries.filter((country) => country.code === selectedCountry),
    [routingCountries, selectedCountry],
  );
  const currentCountry = visibleCountries[0] ?? routingCountries[0];

  const totalOperators = useMemo(
    () => visibleCountries.reduce<number>((total, country) => total + country.operators.length, 0),
    [visibleCountries],
  );

  const availableProviderCount = useMemo(() => {
    let count = 0;
    for (const country of visibleCountries) {
      for (const operator of country.operators) {
        for (const type of ["DEPOSIT", "WITHDRAWAL"] as TransactionType[]) {
          if (hasActiveService(pixpayServices, country.code, operator, type)) count += 1;
          if (hasActiveService(mavianceServices, country.code, operator, type)) count += 1;
          if (hasActiveService(pawapayServices, country.code, operator, type)) count += 1;
        }
      }
    }
    return count;
  }, [mavianceServices, pawapayServices, pixpayServices, visibleCountries]);

  const providerAvailability: Record<Provider, boolean> = {
    PIXPAY: hasActiveService(pixpayServices, selectedCountry, selectedOperator, selectedType),
    MAVIANCE: hasActiveService(mavianceServices, selectedCountry, selectedOperator, selectedType),
    PAWAPAY: hasActiveService(pawapayServices, selectedCountry, selectedOperator, selectedType),
  };

  useEffect(() => {
    setSelectedProvider(getConfiguredProvider(config, selectedCountry, selectedOperator, selectedType));
  }, [config, selectedCountry, selectedOperator, selectedType]);

  const handleCountryChange = (countryCode: string) => {
    const country = routingCountries.find((item) => item.code === countryCode);
    setSelectedCountry(countryCode);
    setSelectedOperator(country?.operators[0] ?? "");
  };

  const handleProviderChange = (country: string, operator: string, type: TransactionType, provider: Provider) => {
    const key = `${country}-${operator}-${type}`;
    setPendingKey(key);
    updateProvider.mutate({ country, operator, type, provider });
  };

  const saveSelectedRoute = () => {
    handleProviderChange(selectedCountry, selectedOperator, selectedType, selectedProvider);
  };

  const refreshAll = () => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: CONFIG_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: MAViance_SERVICES_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: PIXPAY_SERVICES_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: PAWAPAY_SERVICES_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: PAWAPAY_BALANCES_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: PAWAPAY_STATUS_QUERY_KEY }),
    ]);
  };

  const syncMaviance = useMutation({
    mutationFn: () => customFetch<{ success: boolean; synced: unknown[]; skipped: unknown[]; total: number }>(
      "/api/admin/maviance/sync-services", { method: "POST" }
    ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: MAViance_SERVICES_QUERY_KEY });
      toast({
        title: "Synchronisation Maviance réussie",
        description: `${data.synced.length} service(s) synchronisé(s) sur ${data.total} récupérés depuis l'API Maviance.`,
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Sync Maviance échoué",
        description: getErrorMessage(error, "Impossible de synchroniser les services Maviance. Vérifiez les credentials MAVIANCE_PUBLIC_KEY et MAVIANCE_SECRET."),
      });
    },
  });

  const syncPawaPay = useMutation({
    mutationFn: () => customFetch<{ success: boolean; synced?: unknown[]; total?: number }>("/api/admin/pawapay/sync-services", { method: "POST" }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: PAWAPAY_SERVICES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PAWAPAY_BALANCES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PAWAPAY_STATUS_QUERY_KEY });
      toast({
        title: "Synchronisation pawaPay réussie",
        description: `${data.synced?.length ?? data.total ?? 0} service(s) pawaPay synchronisé(s).`,
      });
    },
    onError: (error) => toast({
      variant: "destructive",
      title: "Sync pawaPay échoué",
      description: getErrorMessage(error, "Impossible de synchroniser les services pawaPay."),
    }),
  });

  return (
    <main className="mx-auto w-full max-w-[1280px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8" data-testid="page-provider-config">
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(120deg,hsl(221_40%_17%),hsl(221_34%_24%))] px-5 py-6 text-slate-50 shadow-xl shadow-slate-900/10 sm:px-8 sm:py-8 dark:border-slate-800">
        <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border-[22px] border-sky-300/10" />
        <div className="pointer-events-none absolute -bottom-28 right-24 h-56 w-56 rounded-full border-[18px] border-amber-300/10" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200">
              <ServerCog className="h-4 w-4" />
              Console Opérations
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Routage des paiements</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300 sm:text-[15px]">
              Gérez la distribution des flux de dépôts et retraits par opérateur et par pays. Une configuration précise est requise pour assurer la disponibilité du service.
            </p>
          </div>
          <div className="grid grid-cols-3 divide-x divide-slate-400/20 rounded-xl border border-slate-400/20 bg-slate-950/30 px-1 py-3 sm:min-w-[390px] shadow-inner backdrop-blur-sm">
            <div className="px-3 text-center">
              <p className="font-mono text-xl font-semibold text-white">{visibleCountries.length}</p>
              <p className="mt-1 text-[9px] uppercase tracking-wider text-slate-400">Marchés</p>
            </div>
            <div className="px-3 text-center">
              <p className="font-mono text-xl font-semibold text-white">{totalOperators}</p>
              <p className="mt-1 text-[9px] uppercase tracking-wider text-slate-400">Opérateurs</p>
            </div>
            <div className="px-3 text-center">
              <p className="font-mono text-xl font-semibold text-sky-200">{availableProviderCount}</p>
              <p className="mt-1 text-[9px] uppercase tracking-wider text-slate-400">Services actifs</p>
            </div>
          </div>
        </div>
      </section>

      <Card className="border-border/70 shadow-sm overflow-hidden">
        <div className="grid divide-y lg:divide-y-0 lg:divide-x grid-cols-1 lg:grid-cols-3 bg-card">
          <div className="p-4 sm:p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" /> Filtre de routage
            </div>
            <p className="text-xs text-muted-foreground mb-1">Choisissez le pays dont vous souhaitez configurer le routage.</p>
            <div className="flex gap-2 mt-auto">
              <Select value={selectedCountry} onValueChange={handleCountryChange}>
                <SelectTrigger className="w-full h-9" data-testid="select-provider-country">
                  <SelectValue placeholder="Sélectionner un pays" />
                </SelectTrigger>
                <SelectContent>
                  {routingCountries.map((country) => (
                    <SelectItem key={country.code} value={country.code}>
                      {country.flag} {country.name} ({country.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={refreshAll} title="Actualiser" className="h-9 w-9 shrink-0">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="p-4 sm:p-5 flex flex-col gap-3 bg-amber-50/10 dark:bg-amber-900/5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-amber-100 text-[9px] text-amber-700 font-bold dark:bg-amber-900/50 dark:text-amber-400">MV</span>
                Sync. Maviance
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-1">Synchronise les services de Cashin et Cashout depuis l'API Maviance.</p>
            <div className="flex items-center justify-between mt-auto">
              <div className="text-xs text-muted-foreground">
                Services : <span className="font-semibold text-foreground">{mavianceServices.length}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncMaviance.mutate()}
                disabled={syncMaviance.isPending}
                className="h-8 gap-1.5 text-xs text-amber-700 border-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-900/30"
              >
                <Download className="h-3 w-3" /> {syncMaviance.isPending ? "Sync..." : "Synchroniser"}
              </Button>
            </div>
          </div>

          <div className="p-4 sm:p-5 flex flex-col gap-3 bg-violet-50/10 dark:bg-violet-900/5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-violet-100 text-[9px] text-violet-700 font-bold dark:bg-violet-900/50 dark:text-violet-400">PW</span>
                Sync. pawaPay
              </div>
              {pawapayStatus?.configured ? (
                <Badge variant="outline" className="h-5 px-1.5 text-[9px] border-emerald-200 bg-emerald-50 text-emerald-700 uppercase tracking-wider dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400">Configuré ({pawapayStatus.environment})</Badge>
              ) : (
                <Badge variant="outline" className="h-5 px-1.5 text-[9px] border-orange-200 bg-orange-50 text-orange-700 uppercase tracking-wider dark:border-orange-900/50 dark:bg-orange-900/20 dark:text-orange-400">Non configuré</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-1">
              {pawapayStatus?.lastSyncAt
                ? `Dernière synchro: ${formatDateTime(pawapayStatus.lastSyncAt)}`
                : "Synchronise les services et balances pawaPay."}
            </p>
            <div className="flex items-center justify-between mt-auto">
              <div className="text-xs text-muted-foreground">
                Services : <span className="font-semibold text-foreground">{pawapayStatus?.activeServices ?? pawapayServices.length}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncPawaPay.mutate()}
                disabled={syncPawaPay.isPending || (pawapayStatus && !pawapayStatus.configured)}
                className="h-8 gap-1.5 text-xs text-violet-700 border-violet-200 hover:bg-violet-50 dark:text-violet-400 dark:border-violet-800 dark:hover:bg-violet-900/30"
                data-testid="button-sync-pawapay"
              >
                <Download className="h-3 w-3" /> {syncPawaPay.isPending ? "Sync..." : "Synchroniser"}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {hasError ? (
        <Card className="border-orange-200 bg-orange-50/45 dark:bg-orange-950/20 dark:border-orange-900/50">
          <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="font-semibold text-orange-950 dark:text-orange-200">Les données n’ont pas pu être chargées</p>
              <p className="mt-1 text-sm text-orange-800/80 dark:text-orange-300/80">
                Vérifiez votre connexion ou vos droits administrateur, puis réessayez.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={refreshAll} data-testid="button-retry-provider-config">
              Réessayer
            </Button>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="space-y-6">
          <Card>
            <CardHeader><Skeleton className="h-6 w-56" /><Skeleton className="h-4 w-80 max-w-full mt-2" /></CardHeader>
            <CardContent className="space-y-4">
              {[1, 2].map((item) => (
                <Skeleton key={item} className="h-20 w-full rounded-xl" />
              ))}
            </CardContent>
          </Card>
        </div>
      ) : visibleCountries.length === 0 || totalOperators === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <Globe2 className="h-10 w-10 text-muted-foreground/45" />
            <h2 className="mt-4 text-base font-semibold">Aucun opérateur à afficher</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">Sélectionnez un autre marché pour consulter le routage fournisseur.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="overflow-hidden border-border/70 shadow-sm" data-testid="card-pawapay-wallet-balances">
            <CardHeader className="border-b bg-violet-50/40 px-4 py-4 sm:px-5 dark:bg-violet-900/10">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-violet-600 text-[9px] font-bold text-white shadow-sm">PW</span>
                    Wallets pawaPay
                  </CardTitle>
                </div>
                <Badge variant="outline" className="bg-background text-[10px] font-mono shadow-sm">{pawapayBalances.length} marchés</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="hidden grid-cols-[1.2fr_1fr_0.8fr_2fr] gap-4 border-b bg-muted/20 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
                <span>Marché</span><span>Solde</span><span>Devise</span><span>Fournisseurs actifs</span>
              </div>
              <div className="divide-y divide-border/50">
                {pawapayBalances.length ? pawapayBalances.map((wallet, index) => {
                  const code = wallet.countryCode ?? wallet.country ?? "";
                  const country = COUNTRIES.find((item) => item.code === code);
                  const providers = wallet.activeProviders ?? wallet.providers ?? [];
                  return (
                    <div key={`${code}-${wallet.currency}-${index}`} className="grid gap-2.5 px-4 py-3 sm:grid-cols-[1.2fr_1fr_0.8fr_2fr] sm:items-center sm:gap-4 sm:px-5 hover:bg-muted/10 transition-colors" data-testid={`row-pawapay-wallet-${code || index}`}>
                      <div className="flex items-center gap-2.5">
                        <Map className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{country?.name ?? (code || "—")}</span>
                      </div>
                      <span className="font-mono text-sm font-medium tabular-nums" data-testid={`text-pawapay-balance-${code || index}`}>{Number(wallet.balance ?? 0).toLocaleString("fr-FR")}</span>
                      <span className="text-xs font-mono text-muted-foreground">{wallet.currency}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {providers.length ? providers.map((provider) => (
                          <Badge key={provider} variant="secondary" className="px-1.5 py-0 text-[10px] leading-4 border-violet-100 bg-violet-50/70 text-violet-700 dark:border-violet-900/50 dark:bg-violet-900/30 dark:text-violet-300">
                            {provider}
                          </Badge>
                        )) : <span className="text-[11px] text-muted-foreground italic flex items-center gap-1"><AlertCircle className="h-3 w-3"/> Aucun</span>}
                      </div>
                    </div>
                  );
                }) : (
                  <div className="px-5 py-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                    <Wallet className="h-6 w-6 opacity-30" />
                    <span>Aucun wallet pawaPay disponible.</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border/70 shadow-sm" data-testid="card-provider-route-selector">
            <CardHeader className="border-b bg-muted/20 px-4 py-5 sm:px-6">
              <CardTitle className="flex items-center gap-2 text-lg">
                <SlidersHorizontal className="h-5 w-5 text-primary" />
                Configurer un fournisseur
              </CardTitle>
              <CardDescription className="mt-1.5">
                Sélectionnez successivement le pays, l’opérateur, l’opération puis le fournisseur.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="mb-6 flex items-center gap-3 rounded-xl border bg-muted/20 p-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background text-2xl shadow-sm">
                  {currentCountry.flag}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{currentCountry.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {currentCountry.currency} · {currentCountry.operators.length} opérateur{currentCountry.operators.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">1. Pays</span>
                  <Select value={selectedCountry} onValueChange={handleCountryChange}>
                    <SelectTrigger className="h-11" data-testid="select-route-country">
                      <SelectValue placeholder="Sélectionner un pays" />
                    </SelectTrigger>
                    <SelectContent>
                      {routingCountries.map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          {country.flag} {country.name} — {country.currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium">2. Opérateur Mobile Money</span>
                  <Select value={selectedOperator} onValueChange={setSelectedOperator}>
                    <SelectTrigger className="h-11" data-testid="select-route-operator">
                      <SelectValue placeholder="Sélectionner un opérateur" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentCountry.operators.map((operator) => (
                        <SelectItem key={operator} value={operator}>
                          {OPERATOR_LABELS[operator] ?? operator}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium">3. Type d’opération</span>
                  <Select value={selectedType} onValueChange={(value) => setSelectedType(value as TransactionType)}>
                    <SelectTrigger className="h-11" data-testid="select-route-operation">
                      <SelectValue placeholder="Sélectionner une opération" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DEPOSIT">Dépôt — Collecte client</SelectItem>
                      <SelectItem value="WITHDRAWAL">Retrait — Envoi au client</SelectItem>
                    </SelectContent>
                  </Select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium">4. Fournisseur</span>
                  <Select value={selectedProvider} onValueChange={(value) => setSelectedProvider(value as Provider)}>
                    <SelectTrigger className="h-11" data-testid="select-route-provider">
                      <SelectValue placeholder="Sélectionner un fournisseur" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PROVIDER_META) as Provider[]).map((provider) => (
                        <SelectItem key={provider} value={provider}>
                          {PROVIDER_META[provider].label}
                          {providerAvailability[provider] ? " — Disponible" : provider === "PAWAPAY" ? " — Synchronisation automatique" : " — Non synchronisé"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>

              <div className={`mt-6 rounded-xl border p-4 ${
                providerAvailability[selectedProvider]
                  ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/20"
                  : selectedProvider === "PAWAPAY"
                    ? "border-violet-200 bg-violet-50/70 dark:border-violet-900/50 dark:bg-violet-950/20"
                    : "border-orange-200 bg-orange-50/70 dark:border-orange-900/50 dark:bg-orange-950/20"
              }`}>
                <div className="flex items-start gap-3">
                  {providerAvailability[selectedProvider] ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className={`mt-0.5 h-5 w-5 shrink-0 ${selectedProvider === "PAWAPAY" ? "text-violet-600" : "text-orange-600"}`} />
                  )}
                  <div>
                    <p className="text-sm font-semibold">
                      {PROVIDER_META[selectedProvider].label}
                      {providerAvailability[selectedProvider] ? " est prêt" : selectedProvider === "PAWAPAY" ? " sera synchronisé automatiquement" : " n’est pas encore synchronisé"}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {selectedProvider === "PAWAPAY" && !providerAvailability.PAWAPAY
                        ? "Vous pouvez maintenant sélectionner pawaPay. Lors de l’enregistrement, YookPay vérifiera automatiquement que ce service est disponible chez pawaPay."
                        : providerAvailability[selectedProvider]
                          ? `Ce fournisseur peut traiter les opérations de ${OPERATION_META[selectedType].label.toLowerCase()} pour ${OPERATOR_LABELS[selectedOperator] ?? selectedOperator}.`
                          : "Synchronisez d’abord ce fournisseur pour garantir que l’opérateur sélectionné est pris en charge."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Configuration actuelle : <span className="font-semibold text-foreground">
                    {PROVIDER_META[getConfiguredProvider(config, selectedCountry, selectedOperator, selectedType)].label}
                  </span>
                </p>
                <Button
                  type="button"
                  onClick={saveSelectedRoute}
                  disabled={updateProvider.isPending || !selectedOperator}
                  className="h-11 w-full sm:w-auto sm:min-w-48"
                  data-testid="button-save-provider-route"
                >
                  {updateProvider.isPending && pendingKey === `${selectedCountry}-${selectedOperator}-${selectedType}`
                    ? "Enregistrement..."
                    : `Utiliser ${PROVIDER_META[selectedProvider].label}`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
