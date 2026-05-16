import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { COUNTRIES, OPERATOR_LABELS } from "@/lib/countries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Info, Calculator } from "lucide-react";

interface FeeEntry {
  rate: number;
  pixpay: number;
  margin: number;
  minFee: number;
  maxFee: number | null;
  isCustom: boolean;
}

interface OperatorFee {
  name: string;
  deposit: FeeEntry;
  withdrawal: FeeEntry;
  transfer: FeeEntry;
}

interface CountryFees {
  currency: string;
  operators: OperatorFee[];
}

interface ServicesData {
  fees: Record<string, CountryFees>;
  hasCustomFees: boolean;
}

function pct(rate: number) {
  return `${(rate * 100).toFixed(1)} %`;
}

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + " " + currency;
}

function calcFee(amount: number, entry: FeeEntry): number {
  const raw = amount * entry.rate;
  if (entry.minFee && raw < entry.minFee) return entry.minFee;
  if (entry.maxFee && raw > entry.maxFee) return entry.maxFee;
  return raw;
}

function FeeCell({ entry }: { entry: FeeEntry }) {
  return (
    <div className="text-right">
      <div className="font-semibold text-foreground">{pct(entry.rate)}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
        {pct(entry.pixpay)} + {pct(entry.margin)}
      </div>
      {entry.isCustom && (
        <Badge variant="secondary" className="text-[9px] mt-0.5 px-1 py-0">Personnalisé</Badge>
      )}
    </div>
  );
}

export default function Services() {
  const [openItems, setOpenItems] = useState<string[]>(["CM"]);
  const [calcAmount, setCalcAmount] = useState<string>("");
  const [calcCountry, setCalcCountry] = useState<string>("CM");
  const [calcOperator, setCalcOperator] = useState<string>("");
  const [calcType, setCalcType] = useState<"deposit" | "withdrawal" | "transfer">("deposit");

  const { data, isLoading, error } = useQuery<ServicesData>({
    queryKey: ["services-fees"],
    queryFn: () => customFetch<ServicesData>("/api/services/fees"),
    staleTime: 60_000,
  });

  const selectedCountryFees = data?.fees[calcCountry];
  const selectedOperator = selectedCountryFees?.operators.find(o => o.name === calcOperator)
    ?? selectedCountryFees?.operators[0];
  const selectedEntry = selectedOperator?.[calcType];
  const amount = parseFloat(calcAmount.replace(/\s/g, "")) || 0;
  const fee = selectedEntry && amount > 0 ? calcFee(amount, selectedEntry) : null;
  const net = fee !== null ? amount - fee : null;

  const typeLabels: Record<string, string> = {
    deposit: "Dépôt",
    withdrawal: "Retrait",
    transfer: "Transfert",
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mes Services</h1>
        <p className="text-muted-foreground mt-1">
          Frais appliqués par pays et par opérateur pour chaque type de transaction.
        </p>
      </div>

      {/* Summary stats */}
      {data && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5">
              <p className="text-3xl font-bold text-primary">12</p>
              <p className="text-sm text-muted-foreground mt-1">Pays couverts</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-3xl font-bold text-primary">
                {Object.values(data.fees).reduce((sum, c) => sum + c.operators.length, 0)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Opérateurs supportés</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-3xl font-bold text-primary">3</p>
              <p className="text-sm text-muted-foreground mt-1">Devises disponibles</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          Impossible de charger les frais. Veuillez réessayer.
        </div>
      )}

      {/* Fee table by country */}
      {data && (
        <Accordion
          type="multiple"
          value={openItems}
          onValueChange={setOpenItems}
          className="space-y-2"
        >
          {COUNTRIES.map((country) => {
            const fees = data.fees[country.code];
            if (!fees) return null;
            const hasCountryCustom = fees.operators.some(o => o.deposit.isCustom);
            return (
              <AccordionItem
                key={country.code}
                value={country.code}
                className="border rounded-lg px-0 overflow-hidden"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 transition-colors [&[data-state=open]]:bg-muted/40">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl">{country.flag}</span>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-base">{country.name}</span>
                        {hasCountryCustom && (
                          <Badge variant="secondary" className="text-[10px]">Personnalisé</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-xs font-mono">
                          {country.currency}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {fees.operators.length} opérateur{fees.operators.length > 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="px-0 pb-0">
                  <div className="border-t">
                    {/* Column headers */}
                    <div className="grid grid-cols-4 gap-2 px-4 py-2 bg-muted/20 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      <div>Opérateur</div>
                      <div className="text-right">Dépôt</div>
                      <div className="text-right">Retrait</div>
                      <div className="text-right">Transfert</div>
                    </div>

                    {fees.operators.map((op, idx) => (
                      <div
                        key={op.name}
                        className={`grid grid-cols-4 gap-2 px-4 py-3 items-center ${idx !== fees.operators.length - 1 ? "border-b" : ""}`}
                      >
                        <div>
                          <div className="font-medium text-sm">{op.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5 leading-tight">
                            {OPERATOR_LABELS[op.name] ?? op.name}
                          </div>
                        </div>
                        <FeeCell entry={op.deposit} />
                        <FeeCell entry={op.withdrawal} />
                        <FeeCell entry={op.transfer} />
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Fee Calculator */}
      {data && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" />
              Simulateur de frais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {/* Amount */}
              <div className="col-span-2 sm:col-span-1">
                <label className="text-xs text-muted-foreground mb-1 block">Montant</label>
                <Input
                  type="number"
                  placeholder="Ex: 10000"
                  value={calcAmount}
                  onChange={(e) => setCalcAmount(e.target.value)}
                />
              </div>

              {/* Country */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Pays</label>
                <Select
                  value={calcCountry}
                  onValueChange={(v) => { setCalcCountry(v); setCalcOperator(""); }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.filter(c => data.fees[c.code]).map(c => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.flag} {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Operator */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Opérateur</label>
                <Select
                  value={calcOperator || (selectedCountryFees?.operators[0]?.name ?? "")}
                  onValueChange={setCalcOperator}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Opérateur" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedCountryFees?.operators.map(op => (
                      <SelectItem key={op.name} value={op.name}>
                        {op.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Type */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                <Select value={calcType} onValueChange={(v) => setCalcType(v as typeof calcType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deposit">Dépôt</SelectItem>
                    <SelectItem value="withdrawal">Retrait</SelectItem>
                    <SelectItem value="transfer">Transfert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Result */}
            {amount > 0 && fee !== null && net !== null && selectedEntry ? (
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Montant brut</p>
                  <p className="font-bold text-foreground">
                    {formatAmount(amount, selectedCountryFees?.currency ?? "")}
                  </p>
                </div>
                <div className="bg-destructive/10 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">
                    Frais ({typeLabels[calcType]}) — {pct(selectedEntry.rate)}
                  </p>
                  <p className="font-bold text-destructive">
                    − {formatAmount(Math.round(fee), selectedCountryFees?.currency ?? "")}
                  </p>
                </div>
                <div className="bg-primary/10 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Montant net reçu</p>
                  <p className="font-bold text-primary">
                    {formatAmount(Math.round(net), selectedCountryFees?.currency ?? "")}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-3 text-sm text-muted-foreground">
                Saisis un montant pour voir le calcul des frais
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
        <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>
          Les frais indiqués (frais fournisseur + marge YookPay) sont calculés sur le montant brut de la transaction.
          Le badge <strong>Personnalisé</strong> indique des frais spécifiquement négociés pour votre compte.
        </span>
      </div>
    </div>
  );
}
