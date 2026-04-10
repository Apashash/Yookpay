import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { COUNTRIES, OPERATOR_LABELS } from "@/lib/countries";
import { getOperatorFlow } from "@/lib/operator-flow";
import { formatCurrency } from "@/lib/format";
import { YookPayLogo } from "@/components/yookpay-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, ShieldCheck, Clock, CheckCircle2, XCircle, Link2,
  Image as ImageIcon, AlertTriangle,
} from "lucide-react";

type LinkData = {
  token: string;
  title: string;
  description: string | null;
  photoData: string | null;
  priceType: "FIXED" | "FREE";
  priceAmount: number | null;
  currency: string | null;
  countries: string[];
};

type PollStatus = "PENDING" | "SUCCESS" | "FAILED";
type FeeBearer = "SENDER" | "RECIPIENT";

export default function Pay() {
  const [, params] = useRoute("/pay/:token");
  const token = params?.token ?? "";
  const { toast } = useToast();

  const [linkData, setLinkData] = useState<LinkData | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(true);

  // Form state
  const [country, setCountry] = useState("");
  const [operator, setOperator] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [omOtp, setOmOtp] = useState("");
  const [feeBearer] = useState<FeeBearer>("SENDER");
  const [submitting, setSubmitting] = useState(false);

  // Result state
  const [result, setResult] = useState<{
    txId: number; flow: string; smsLink?: string | null; pending?: boolean; message?: string;
  } | null>(null);
  const [pollStatus, setPollStatus] = useState<PollStatus>("PENDING");
  const [timeLeft, setTimeLeft] = useState(8 * 60);

  // Derived
  const availableCountries = COUNTRIES.filter(
    (c) => linkData?.countries?.length === 0 || linkData?.countries?.includes(c.code)
  );
  const selectedCountry = COUNTRIES.find((c) => c.code === country);
  const availableOperators = selectedCountry?.operators ?? [];
  const flow = operator ? getOperatorFlow(operator) : null;

  // Load link data
  useEffect(() => {
    if (!token) return;
    fetch(`/api/payment-links/public/${token}`)
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.message ?? "Lien introuvable");
        }
        return r.json();
      })
      .then((data: LinkData) => {
        setLinkData(data);
        if (data.priceAmount) setAmount(String(data.priceAmount));
        if (data.countries.length === 1) setCountry(data.countries[0]);
      })
      .catch((e: Error) => setLinkError(e.message))
      .finally(() => setLinkLoading(false));
  }, [token]);

  // Reset operator when country changes
  useEffect(() => { setOperator(""); }, [country]);

  // Pre-fill amount for fixed price when country changes
  useEffect(() => {
    if (linkData?.priceType === "FIXED" && linkData.priceAmount) {
      setAmount(String(linkData.priceAmount));
    }
  }, [linkData, country]);

  // Countdown + poll when result is pending
  useEffect(() => {
    if (!result || !result.pending) return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(interval); return 0; }
        return t - 1;
      });
    }, 1000);
    const poll = setInterval(async () => {
      try {
        const r = await fetch(`/api/transactions/${result.txId}/status`);
        const data = await r.json() as { status: string };
        if (data.status === "SUCCESS") {
          setPollStatus("SUCCESS");
          clearInterval(poll);
          clearInterval(interval);
        } else if (data.status === "FAILED") {
          setPollStatus("FAILED");
          clearInterval(poll);
          clearInterval(interval);
        }
      } catch { /* ignore */ }
    }, 5000);
    return () => { clearInterval(interval); clearInterval(poll); };
  }, [result]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!country || !operator || !phone || !amount) {
      toast({ variant: "destructive", title: "Tous les champs sont requis" });
      return;
    }
    if (flow === "OTP" && !omOtp) {
      toast({ variant: "destructive", title: "Code OTP requis", description: "Composez #144*82# sur votre téléphone Orange." });
      return;
    }

    setSubmitting(true);
    try {
      const r = await fetch(`/api/payment-links/public/${token}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          country,
          operator,
          phone,
          feeBearer,
          omOtp: omOtp || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        toast({ variant: "destructive", title: "Paiement échoué", description: data.message ?? "Erreur inconnue" });
        return;
      }
      setResult({
        txId: data.transaction.id,
        flow: data.flow,
        smsLink: data.smsLink,
        pending: data.pending,
        message: data.message,
      });
      if (!data.pending) setPollStatus("SUCCESS");
    } catch {
      toast({ variant: "destructive", title: "Erreur réseau", description: "Impossible de joindre le serveur." });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ──
  if (linkLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Error ──
  if (linkError || !linkData) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-destructive" />
        <h1 className="text-xl font-bold">Lien introuvable</h1>
        <p className="text-muted-foreground text-sm max-w-sm">
          {linkError ?? "Ce lien de paiement n'existe pas ou a expiré."}
        </p>
        <YookPayLogo size="sm" className="mt-4 opacity-50" />
      </div>
    );
  }

  // ── Success/Poll result ──
  if (result) {
    if (pollStatus === "SUCCESS") {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6 text-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-500" />
          <h1 className="text-2xl font-bold text-emerald-500">Paiement réussi !</h1>
          <p className="text-muted-foreground text-sm max-w-sm">
            Votre paiement pour <strong>{linkData.title}</strong> a bien été reçu. Merci !
          </p>
          <YookPayLogo size="sm" className="mt-6 opacity-60" />
        </div>
      );
    }

    if (pollStatus === "FAILED") {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6 text-center">
          <XCircle className="w-16 h-16 text-destructive" />
          <h1 className="text-2xl font-bold">Paiement échoué</h1>
          <p className="text-muted-foreground text-sm max-w-sm">La transaction a échoué. Veuillez réessayer.</p>
          <Button onClick={() => { setResult(null); setPollStatus("PENDING"); setTimeLeft(8 * 60); }}>
            Réessayer
          </Button>
        </div>
      );
    }

    // Pending
    const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
    const ss = String(timeLeft % 60).padStart(2, "0");
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="relative w-32 h-32">
          <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
            <circle
              cx="60" cy="60" r="52" fill="none"
              stroke="hsl(var(--primary))" strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 52}
              strokeDashoffset={2 * Math.PI * 52 * (1 - timeLeft / (8 * 60))}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-mono font-bold">{mm}:{ss}</span>
          </div>
        </div>
        <h2 className="text-xl font-bold">En attente de confirmation</h2>
        <p className="text-muted-foreground text-sm max-w-sm">
          Veuillez approuver le paiement sur votre téléphone via <strong>{OPERATOR_LABELS[operator] ?? operator}</strong>.
        </p>
        {result.smsLink && (
          <Button asChild className="gap-2">
            <a href={result.smsLink} target="_blank" rel="noopener noreferrer">
              Approuver via SMS
            </a>
          </Button>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          Paiement sécurisé par YookPay
        </div>
      </div>
    );
  }

  // ── Payment form ──
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Link2 className="w-4 h-4 text-cyan-400" />
          <YookPayLogo size="sm" />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Product card */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex gap-4">
            {linkData.photoData ? (
              <img
                src={linkData.photoData}
                alt={linkData.title}
                className="w-20 h-20 rounded-xl object-cover border border-border flex-shrink-0"
              />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center border border-border flex-shrink-0">
                <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-bold text-lg leading-tight">{linkData.title}</h1>
              {linkData.description && (
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{linkData.description}</p>
              )}
              {linkData.priceType === "FIXED" && linkData.priceAmount && (
                <Badge className="mt-2 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  {linkData.priceAmount.toLocaleString("fr-FR")} {linkData.currency}
                </Badge>
              )}
              {linkData.priceType === "FREE" && (
                <Badge variant="outline" className="mt-2">Montant libre</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Payment form */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold mb-4">Effectuer le paiement</h2>
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Country */}
            <div className="space-y-1.5">
              <Label>Pays</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez votre pays" />
                </SelectTrigger>
                <SelectContent modal={false}>
                  {availableCountries.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flag} {c.name} — {c.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Operator */}
            {country && (
              <div className="space-y-1.5">
                <Label>Opérateur Mobile Money</Label>
                <Select value={operator} onValueChange={setOperator}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisissez un opérateur" />
                  </SelectTrigger>
                  <SelectContent modal={false}>
                    {availableOperators.map((op) => (
                      <SelectItem key={op} value={op}>
                        {OPERATOR_LABELS[op] ?? op}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Phone */}
            {operator && (
              <div className="space-y-1.5">
                <Label>Numéro de téléphone</Label>
                <div className="flex gap-2">
                  {selectedCountry && (
                    <div className="flex items-center px-3 bg-muted border border-input rounded-md text-sm text-muted-foreground whitespace-nowrap">
                      {selectedCountry.flag} {selectedCountry.dialCode}
                    </div>
                  )}
                  <Input
                    type="tel"
                    placeholder="Ex: 0595857098"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            )}

            {/* OTP for Orange Money */}
            {flow === "OTP" && (
              <div className="space-y-1.5">
                <Label>Code OTP Orange Money</Label>
                <Input
                  placeholder="Code reçu après #144*82#"
                  value={omOtp}
                  onChange={(e) => setOmOtp(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Composez <code>#144*82#</code> pour recevoir votre OTP.</p>
              </div>
            )}

            {/* Amount */}
            {operator && (
              <div className="space-y-1.5">
                <Label>
                  Montant{selectedCountry ? ` (${selectedCountry.currency})` : ""}
                  {linkData.priceType === "FIXED" && (
                    <span className="text-xs text-muted-foreground ml-2">(montant fixé par le marchand)</span>
                  )}
                </Label>
                <Input
                  type="number"
                  min={selectedCountry?.minAmount ?? 1}
                  step={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  readOnly={linkData.priceType === "FIXED"}
                  className={linkData.priceType === "FIXED" ? "bg-muted cursor-not-allowed" : ""}
                  placeholder={`Min. ${selectedCountry?.minAmount ?? 1}`}
                />
                {selectedCountry && (
                  <p className="text-xs text-muted-foreground">
                    Minimum : {selectedCountry.minAmount.toLocaleString("fr-FR")} {selectedCountry.currency}
                  </p>
                )}
              </div>
            )}

            {operator && amount && (
              <Alert className="bg-muted/50">
                <Clock className="h-4 w-4" />
                <AlertTitle className="text-sm">Délai de traitement</AlertTitle>
                <AlertDescription className="text-xs">
                  Votre paiement sera traité en moins de 5 minutes après validation.
                </AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold"
              disabled={submitting || !country || !operator || !phone || !amount}
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Traitement...</>
              ) : (
                `Payer ${amount && selectedCountry ? formatCurrency(parseFloat(amount), selectedCountry.currency) : ""}`
              )}
            </Button>
          </form>
        </div>

        {/* Trust footer */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pb-4">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Paiement sécurisé par</span>
          <YookPayLogo size="sm" />
        </div>
      </div>
    </div>
  );
}
