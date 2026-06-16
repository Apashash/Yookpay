import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";

interface FeeRow {
  country: string;
  currency: string;
  flag: string;
  operator: string;
  deposit: number;
  withdrawal: number;
}

const FEE_DATA: FeeRow[] = [
  // XAF — 1.5%
  { country: "Cameroun", currency: "XAF", flag: "🇨🇲", operator: "MTN",      deposit: 1.5, withdrawal: 1.5 },
  { country: "Cameroun", currency: "XAF", flag: "🇨🇲", operator: "Orange",   deposit: 1.5, withdrawal: 1.5 },
  { country: "Congo",    currency: "XAF", flag: "🇨🇬", operator: "MTN",      deposit: 1.5, withdrawal: 1.5 },
  { country: "Congo",    currency: "XAF", flag: "🇨🇬", operator: "Airtel",   deposit: 1.5, withdrawal: 1.5 },
  { country: "Gabon",    currency: "XAF", flag: "🇬🇦", operator: "Airtel",   deposit: 1.5, withdrawal: 1.5 },
  { country: "Gabon",    currency: "XAF", flag: "🇬🇦", operator: "MTN",      deposit: 1.5, withdrawal: 1.5 },
  // XOF — 1.9%
  { country: "Côte d'Ivoire", currency: "XOF", flag: "🇨🇮", operator: "MTN",      deposit: 1.9, withdrawal: 1.9 },
  { country: "Côte d'Ivoire", currency: "XOF", flag: "🇨🇮", operator: "Orange",   deposit: 1.9, withdrawal: 1.9 },
  { country: "Côte d'Ivoire", currency: "XOF", flag: "🇨🇮", operator: "Moov",     deposit: 1.9, withdrawal: 1.9 },
  { country: "Côte d'Ivoire", currency: "XOF", flag: "🇨🇮", operator: "Wave",     deposit: 1.9, withdrawal: 1.9 },
  { country: "Sénégal",  currency: "XOF", flag: "🇸🇳", operator: "Orange",   deposit: 1.9, withdrawal: 1.9 },
  { country: "Sénégal",  currency: "XOF", flag: "🇸🇳", operator: "Free",     deposit: 1.9, withdrawal: 1.9 },
  { country: "Sénégal",  currency: "XOF", flag: "🇸🇳", operator: "Wave",     deposit: 1.9, withdrawal: 1.9 },
  { country: "Burkina",  currency: "XOF", flag: "🇧🇫", operator: "Orange",   deposit: 1.9, withdrawal: 1.9 },
  { country: "Burkina",  currency: "XOF", flag: "🇧🇫", operator: "Moov",     deposit: 1.9, withdrawal: 1.9 },
  { country: "Bénin",    currency: "XOF", flag: "🇧🇯", operator: "MTN",      deposit: 1.9, withdrawal: 1.9 },
  { country: "Bénin",    currency: "XOF", flag: "🇧🇯", operator: "Moov",     deposit: 1.9, withdrawal: 1.9 },
  { country: "Gambie",   currency: "XOF", flag: "🇬🇲", operator: "Africell", deposit: 1.9, withdrawal: 1.9 },
  { country: "Gambie",   currency: "XOF", flag: "🇬🇲", operator: "QMoney",   deposit: 1.9, withdrawal: 1.9 },
  { country: "Guinée",   currency: "XOF", flag: "🇬🇳", operator: "MTN",      deposit: 1.9, withdrawal: 1.9 },
  { country: "Guinée",   currency: "XOF", flag: "🇬🇳", operator: "Orange",   deposit: 1.9, withdrawal: 1.9 },
  { country: "Guinée",   currency: "XOF", flag: "🇬🇳", operator: "Cellcom",  deposit: 1.9, withdrawal: 1.9 },
  { country: "Mali",     currency: "XOF", flag: "🇲🇱", operator: "Orange",   deposit: 1.9, withdrawal: 1.9 },
  { country: "Mali",     currency: "XOF", flag: "🇲🇱", operator: "Moov",     deposit: 1.9, withdrawal: 1.9 },
  { country: "Togo",     currency: "XOF", flag: "🇹🇬", operator: "Togocel",  deposit: 1.9, withdrawal: 1.9 },
  { country: "Togo",     currency: "XOF", flag: "🇹🇬", operator: "Moov",     deposit: 1.9, withdrawal: 1.9 },
  // CDF — 3.0% dépôt / 3.5% retrait
  { country: "RD Congo", currency: "CDF", flag: "🇨🇩", operator: "Vodacom",  deposit: 3.0, withdrawal: 3.5 },
  { country: "RD Congo", currency: "CDF", flag: "🇨🇩", operator: "Airtel",   deposit: 3.0, withdrawal: 3.5 },
  { country: "RD Congo", currency: "CDF", flag: "🇨🇩", operator: "Orange",   deposit: 3.0, withdrawal: 3.5 },
  { country: "RD Congo", currency: "CDF", flag: "🇨🇩", operator: "Africell", deposit: 3.0, withdrawal: 3.5 },
];

const CURRENCY_BADGE: Record<string, string> = {
  XAF: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  XOF: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  CDF: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
};

function pct(v: number) {
  return `${v.toFixed(1)}%`;
}

function TotalCell({ pixpay, margin, type }: { pixpay: number; margin: number; type: "deposit" | "withdrawal" }) {
  const total = pixpay + margin;
  return (
    <td className="px-3 py-2.5 text-right">
      <div className={`font-mono font-semibold text-sm ${type === "deposit" ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
        {pct(total)}
      </div>
      <div className="text-[10px] text-muted-foreground">
        {pct(pixpay)} + {pct(margin)}
      </div>
    </td>
  );
}

export default function AdminFees() {
  const { toast } = useToast();
  const [margin, setMargin] = useState<number>(2.5);
  const [editValue, setEditValue] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    customFetch("/api/admin/margin")
      .then((data: { margin: number }) => {
        setMargin(data.margin * 100);
      })
      .catch(() => setMargin(2.5))
      .finally(() => setLoading(false));
  }, []);

  function startEdit() {
    setEditValue(margin.toFixed(2));
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setEditValue("");
  }

  async function saveMargin() {
    const parsed = parseFloat(editValue.replace(",", "."));
    if (isNaN(parsed) || parsed < 0 || parsed > 50) {
      toast({ title: "Valeur invalide", description: "La marge doit être entre 0% et 50%.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await customFetch("/api/admin/margin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ margin: parsed / 100 }),
      });
      setMargin(parsed);
      setEditing(false);
      toast({ title: "Marge mise à jour", description: `Marge par défaut : ${parsed.toFixed(2)}% — s'applique à tous les utilisateurs sans frais personnalisés.` });
    } catch {
      toast({ title: "Erreur", description: "Impossible de mettre à jour la marge.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const groups = FEE_DATA.reduce<Record<string, FeeRow[]>>((acc, row) => {
    const key = `${row.currency}-${row.country}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  return (
    <div className="space-y-6 p-1">
      <div>
        <h1 className="text-2xl font-bold">Grille des frais</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Frais PixPay Innov + marge YookPay par défaut par opérateur.
        </p>
      </div>

      {/* Default margin editor */}
      <Card className="border-indigo-200 dark:border-indigo-800">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Marge YookPay par défaut</CardTitle>
            <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">Global</Badge>
          </div>
          <CardDescription>
            S'applique à tous les utilisateurs sans frais personnalisés. Les utilisateurs avec des frais personnalisés gardent leur marge dédiée.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : editing ? (
              <>
                <div className="flex items-center gap-1.5">
                  <Input
                    className="w-24 text-right font-mono"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveMargin(); if (e.key === "Escape") cancelEdit(); }}
                    autoFocus
                  />
                  <span className="text-sm font-medium text-muted-foreground">%</span>
                </div>
                <Button size="sm" onClick={saveMargin} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Enregistrer
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={saving}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <span className="text-3xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
                  {margin.toFixed(2)}%
                </span>
                <Button size="sm" variant="outline" onClick={startEdit}>
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Modifier
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* USDT crypto fees */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">💎</span>
            <CardTitle className="text-base">USDT (Crypto TRC-20)</CardTitle>
            <Badge className="bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300 ml-auto">NowPayments</Badge>
          </div>
          <CardDescription>Via NowPayments — frais réseau Tron inclus</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full min-w-[320px] text-sm">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground text-xs uppercase">
                  <th className="text-left px-4 py-2 font-medium">Opération</th>
                  <th className="text-right px-4 py-2 font-medium">Frais</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="px-4 py-3 font-medium">Dépôt USDT (blockchain)</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">Frais réseau Tron</td>
                </tr>
                <tr className="border-t bg-muted/20">
                  <td className="px-4 py-3 font-medium">Échange USDT → Mobile Money</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">Taux admin configurable</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Le taux de conversion USDT est configuré dans la page Échanges USDT.</p>
        </CardContent>
      </Card>

      {/* Mobile Money fees */}
      {Object.entries(groups).map(([key, rows]) => {
        const { country, currency, flag } = rows[0];
        return (
          <Card key={key}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{flag}</span>
                <CardTitle className="text-base">{country}</CardTitle>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${CURRENCY_BADGE[currency] ?? ""}`}>
                  {currency}
                </span>
              </div>
              <CardDescription>Mobile Money via PixPay Innov</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full min-w-[340px] text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-muted-foreground text-xs uppercase">
                      <th className="text-left px-3 py-2 font-medium">Opérateur</th>
                      <th className="text-right px-3 py-2 font-medium">Dépôt</th>
                      <th className="text-right px-3 py-2 font-medium">Retrait</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className={`border-t ${i % 2 === 1 ? "bg-muted/20" : ""}`}>
                        <td className="px-3 py-2.5 font-medium">{row.operator}</td>
                        <TotalCell pixpay={row.deposit}    margin={margin} type="deposit"    />
                        <TotalCell pixpay={row.withdrawal} margin={margin} type="withdrawal" />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
