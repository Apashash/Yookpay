import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { COUNTRIES, OPERATOR_LABELS } from "@/lib/countries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Info } from "lucide-react";

interface FeeEntry {
  rate: number;
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

function fmtFee(entry: FeeEntry, currency: string) {
  const max = entry.maxFee !== null ? ` – max ${entry.maxFee.toLocaleString("fr-FR")} ${currency}` : "";
  return `min ${entry.minFee.toLocaleString("fr-FR")} ${currency}${max}`;
}

function FeeCell({ entry, currency }: { entry: FeeEntry; currency: string }) {
  return (
    <div className="text-right">
      <div className="flex items-center justify-end gap-1.5">
        <span className="font-semibold text-foreground">{pct(entry.rate)}</span>
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">{fmtFee(entry, currency)}</div>
    </div>
  );
}

export default function Services() {
  const [openItems, setOpenItems] = useState<string[]>(["CM"]);

  const { data, isLoading, error } = useQuery<ServicesData>({
    queryKey: ["services-fees"],
    queryFn: () => customFetch<ServicesData>("/api/services/fees"),
    staleTime: 60_000,
  });

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

      {/* Fee table by country */}
      {isLoading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      )}

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          Impossible de charger les frais. Veuillez réessayer.
        </div>
      )}

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
                        {/* Operator */}
                        <div>
                          <div className="font-medium text-sm">{op.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5 leading-tight">
                            {OPERATOR_LABELS[op.name] ?? op.name}
                          </div>
                        </div>

                        {/* Deposit */}
                        <FeeCell entry={op.deposit} currency={fees.currency} />

                        {/* Withdrawal */}
                        <FeeCell entry={op.withdrawal} currency={fees.currency} />

                        {/* Transfer */}
                        <FeeCell entry={op.transfer} currency={fees.currency} />
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Info note */}
      <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
        <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>
          Les frais indiqués sont calculés sur le montant brut de la transaction. Le minimum garanti
          s'applique même si le taux calculé est inférieur.
        </span>
      </div>
    </div>
  );
}
