import { useEffect, useState, useCallback } from "react";
import { useRoute } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { COUNTRIES, OPERATOR_LABELS, normalizePhone } from "@/lib/countries";
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
  Loader2, ShieldCheck, Clock, CheckCircle2, XCircle, Link2,
  AlertTriangle, Copy, Check, Info, ExternalLink,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

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

type FeeBearer   = "SENDER" | "RECIPIENT";
type PayMode     = "mobile" | "crypto";
type PollStatus  = "PENDING" | "SUCCESS" | "FAILED";

type FeePreview = {
  grossAmount: number;
  feeRate:     number;
  feeAmount:   number;
  netAmount:   number;
  currency:    string;
};

type MobileResult = {
  txId: number;
  flow: string;
  smsLink?: string | null;
  pending?: boolean;
};

type CryptoResult = {
  txId:       number;
  payAddress: string;
  payAmount:  number;
  payCurrency: string;
  network:    string;
  npPaymentId: string;
  message:    string;
};

const COUNTDOWN_SECONDS = 8 * 60;
const CIRCLE_R          = 52;
const CIRCLE_C          = 2 * Math.PI * CIRCLE_R;

function pad2(n: number) { return String(n).padStart(2, "0"); }
function formatMMSS(s: number) { return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`; }

// ─── Component ────────────────────────────────────────────────────────────────

export default function Pay() {
  const [, params] = useRoute("/pay/:token");
  const token = params?.token ?? "";
  const { toast } = useToast();

  // Link loading
  const [linkData,    setLinkData]    = useState<LinkData | null>(null);
  const [linkError,   setLinkError]   = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(true);

  // Mode
  const [payMode, setPayMode] = useState<PayMode>("mobile");

  // ── Mobile form ──
  const [country,    setCountry]    = useState("");
  const [operator,   setOperator]   = useState("");
  const [phone,      setPhone]      = useState("");
  const [amount,     setAmount]     = useState("");
  const [omOtp,      setOmOtp]      = useState("");
  const [feeBearer,  setFeeBearer]  = useState<FeeBearer>("SENDER");
  const [feePreview, setFeePreview] = useState<FeePreview | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── Mobile result ──
  const [mobileResult, setMobileResult] = useState<MobileResult | null>(null);
  const [pollStatus,   setPollStatus]   = useState<PollStatus>("PENDING");
  const [timeLeft,     setTimeLeft]     = useState(COUNTDOWN_SECONDS);

  // ── Crypto form ──
  const [cryptoMinUsdt,  setCryptoMinUsdt]  = useState(20);
  const [cryptoAmount,   setCryptoAmount]   = useState("20");
  const [cryptoResult,   setCryptoResult]   = useState<CryptoResult | null>(null);
  const [cryptoLoading,  setCryptoLoading]  = useState(false);
  const [cryptoPoll,     setCryptoPoll]     = useState<"waiting" | "success" | "failed">("waiting");
  const [copied,         setCopied]         = useState(false);

  // ── Derived ──
  const availableCountries = COUNTRIES.filter(
    (c) => !linkData?.countries?.length || linkData.countries.includes(c.code)
  );
  const selectedCountry   = COUNTRIES.find((c) => c.code === country);
  const availableOperators = selectedCountry?.operators ?? [];
  const flow = operator ? getOperatorFlow(operator) : null;

  // ── Load link ──
  useEffect(() => {
    if (!token) return;
    fetch(`/api/payment-links/public/${token}`)
      .then(async (r) => {
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message ?? "Lien introuvable"); }
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

  // ── Fetch NowPayments minimum ──
  useEffect(() => {
    fetch("/api/transactions/crypto-min-amount")
      .then((r) => r.json())
      .then((d: { minAmount: number }) => {
        if (d.minAmount) { const m = Math.ceil(d.minAmount); setCryptoMinUsdt(m); setCryptoAmount(String(m)); }
      })
      .catch(() => {});
  }, []);

  // ── Reset operator on country change ──
  useEffect(() => { setOperator(""); setOmOtp(""); setFeePreview(null); }, [country]);
  useEffect(() => { setOmOtp(""); setFeePreview(null); }, [operator]);

  // ── Pre-fill amount for fixed-price links ──
  useEffect(() => {
    if (linkData?.priceType === "FIXED" && linkData.priceAmount) setAmount(String(linkData.priceAmount));
  }, [linkData, country]);

  // ── Fee preview (debounced) ──
  useEffect(() => {
    const amt = parseFloat(amount);
    if (!amt || !country || !operator) { setFeePreview(null); return; }
    const id = setTimeout(async () => {
      try {
        const r = await fetch("/api/payment-links/public/fee-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: amt, country, operator }),
        });
        if (r.ok) setFeePreview(await r.json());
      } catch { /* silent */ }
    }, 250);
    return () => clearTimeout(id);
  }, [amount, country, operator]);

  // ── Mobile countdown + poll ──
  useEffect(() => {
    if (!mobileResult?.pending) return;
    setPollStatus("PENDING");
    setTimeLeft(COUNTDOWN_SECONDS);

    const timer = setInterval(() => setTimeLeft((t) => (t <= 1 ? (clearInterval(timer), 0) : t - 1)), 1000);

    const poll = setInterval(async () => {
      try {
        const r = await fetch(`/api/payment-links/public/tx/${mobileResult.txId}`);
        const d = await r.json() as { status: string };
        if (d.status === "SUCCESS") { setPollStatus("SUCCESS"); clearInterval(poll); clearInterval(timer); }
        else if (d.status === "FAILED") { setPollStatus("FAILED"); clearInterval(poll); clearInterval(timer); }
      } catch { /* silent */ }
    }, 3000);

    return () => { clearInterval(timer); clearInterval(poll); };
  }, [mobileResult]);

  // ── Crypto poll ──
  useEffect(() => {
    if (!cryptoResult) return;
    const poll = setInterval(async () => {
      try {
        const r = await fetch(`/api/payment-links/public/tx/${cryptoResult.txId}`);
        const d = await r.json() as { status: string };
        if (d.status === "SUCCESS") { setCryptoPoll("success"); clearInterval(poll); }
        else if (d.status === "FAILED") { setCryptoPoll("failed"); clearInterval(poll); }
      } catch { /* silent */ }
    }, 10_000);
    return () => clearInterval(poll);
  }, [cryptoResult]);

  const handleCopyAddress = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  // ── Submit mobile ──
  const handleMobileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!country || !operator || !phone || !amount) {
      toast({ variant: "destructive", title: "Tous les champs sont requis" });
      return;
    }
    const isCmOtp = flow === "OTP" && country === "CM";
    if (flow === "OTP" && !isCmOtp && !omOtp) {
      toast({ variant: "destructive", title: "Code OTP requis", description: "Composez #144*82# sur votre téléphone Orange." });
      return;
    }
    setSubmitting(true);
    try {
      const otpToSend = isCmOtp ? "0000" : omOtp || undefined;
      const r = await fetch(`/api/payment-links/public/${token}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount:    parseFloat(amount),
          country,
          operator,
          phone:     normalizePhone(phone, country),
          feeBearer,
          omOtp:     otpToSend,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        toast({ variant: "destructive", title: "Paiement échoué", description: data.message ?? "Erreur inconnue" });
        return;
      }
      const mr: MobileResult = { txId: data.transaction.id, flow: data.flow, smsLink: data.smsLink, pending: data.pending };
      setMobileResult(mr);
      if (!data.pending) setPollStatus("SUCCESS");
      if (data.smsLink) {
        toast({ title: "Paiement Wave", description: "Cliquez sur le lien Wave pour finaliser votre paiement." });
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur réseau", description: "Impossible de joindre le serveur." });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Submit crypto ──
  const handleCryptoSubmit = async () => {
    const amt = parseFloat(cryptoAmount);
    if (!amt || amt < cryptoMinUsdt) {
      toast({ variant: "destructive", title: "Montant invalide", description: `Minimum ${cryptoMinUsdt} USDT` });
      return;
    }
    setCryptoLoading(true);
    try {
      const r = await fetch(`/api/payment-links/public/${token}/pay-crypto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsdt: amt }),
      });
      const data = await r.json();
      if (!r.ok) {
        const msg = (data.message ?? "Erreur inconnue").replace(/^NowPayments API error \d+:\s*/i, "");
        toast({ variant: "destructive", title: "Erreur", description: msg });
        return;
      }
      setCryptoResult(data as CryptoResult);
      setCryptoPoll("waiting");
    } catch {
      toast({ variant: "destructive", title: "Erreur réseau", description: "Impossible de joindre le serveur." });
    } finally {
      setCryptoLoading(false);
    }
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Render states
  // ────────────────────────────────────────────────────────────────────────────

  if (linkLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (linkError || !linkData) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-destructive" />
        <h1 className="text-xl font-bold">Lien introuvable</h1>
        <p className="text-muted-foreground text-sm max-w-sm">{linkError ?? "Ce lien de paiement n'existe pas ou a expiré."}</p>
        <YookPayLogo size="sm" className="mt-4 opacity-50" />
      </div>
    );
  }

  // ── Mobile pending / result ──
  if (mobileResult) {
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
          <p className="text-muted-foreground text-sm max-w-sm">Le paiement n'a pas été validé. Votre téléphone n'a pas été débité.</p>
          <Button onClick={() => { setMobileResult(null); setPollStatus("PENDING"); setTimeLeft(COUNTDOWN_SECONDS); }}>
            Réessayer
          </Button>
        </div>
      );
    }

    // Pending countdown
    const dashOffset = CIRCLE_C * (1 - timeLeft / COUNTDOWN_SECONDS);
    const circleColor =
      pollStatus === "FAILED" ? "#ef4444"
      : timeLeft > 240 ? "#22c55e"
      : timeLeft > 60  ? "#f59e0b"
      : "#ef4444";

    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-5 p-6 text-center max-w-sm mx-auto">
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={CIRCLE_R} fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
          <circle cx="70" cy="70" r={CIRCLE_R} fill="none"
            stroke={circleColor} strokeWidth="8"
            strokeDasharray={CIRCLE_C}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform="rotate(-90 70 70)"
            style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s ease" }}
          />
          <text x="70" y="66" textAnchor="middle" fontSize="22" fontWeight="bold" fill="currentColor">
            {formatMMSS(timeLeft)}
          </text>
          <text x="70" y="84" textAnchor="middle" fontSize="10" fill="#9ca3af">restantes</text>
        </svg>

        <h2 className="text-xl font-bold">Confirmation en attente</h2>
        <p className="text-muted-foreground text-sm">
          Vérification automatique toutes les 3s.
        </p>

        <Alert className="border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 text-left w-full">
          <Info className="h-4 w-4 text-emerald-600" />
          <AlertTitle className="text-emerald-700 dark:text-emerald-300 text-sm">Vous pouvez quitter cette page</AlertTitle>
          <AlertDescription className="text-emerald-600 dark:text-emerald-400 text-xs mt-0.5">
            Votre paiement continuera d'être traité en arrière-plan.
          </AlertDescription>
        </Alert>

        {mobileResult.smsLink && (
          <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20 text-left w-full">
            <ExternalLink className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-700 dark:text-blue-300">Paiement Wave requis</AlertTitle>
            <AlertDescription className="text-blue-600 dark:text-blue-400 mt-2">
              <a href={mobileResult.smsLink} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">
                <ExternalLink className="h-4 w-4" />
                Payer avec Wave
              </a>
            </AlertDescription>
          </Alert>
        )}

        {!mobileResult.smsLink && mobileResult.flow === "STANDARD" && (
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/20 text-left w-full">
            <Info className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-700 dark:text-amber-300">Confirmation Mobile Money requise</AlertTitle>
            <AlertDescription className="text-amber-600 dark:text-amber-400 text-xs">
              Vous allez recevoir une invitation SMS ou USSD de votre opérateur. Confirmez pour finaliser.
            </AlertDescription>
          </Alert>
        )}

        {!mobileResult.smsLink && mobileResult.flow === "OTP" && (
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/20 text-left w-full">
            <Info className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-700 dark:text-amber-300">Transaction Orange Money en attente</AlertTitle>
            <AlertDescription className="text-amber-600 dark:text-amber-400 text-xs">
              Vous recevrez une notification sur votre téléphone — entrez votre PIN pour confirmer.
            </AlertDescription>
          </Alert>
        )}

        <div className="bg-muted rounded-lg p-4 space-y-2 w-full text-left">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Opérateur</span>
            <span className="font-medium">{OPERATOR_LABELS[operator] ?? operator}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Montant</span>
            <span className="font-medium">{formatCurrency(parseFloat(amount), selectedCountry?.currency ?? "")}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          Paiement sécurisé par YookPay
        </div>
      </div>
    );
  }

  // ── Crypto success ──
  if (cryptoResult && cryptoPoll === "success") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6 text-center">
        <CheckCircle2 className="w-16 h-16 text-emerald-500" />
        <h1 className="text-2xl font-bold text-emerald-500">Paiement USDT confirmé !</h1>
        <p className="text-muted-foreground text-sm max-w-sm">
          Votre paiement USDT pour <strong>{linkData.title}</strong> a été confirmé. Merci !
        </p>
        <YookPayLogo size="sm" className="mt-6 opacity-60" />
      </div>
    );
  }

  // ── Fee summary ──
  const feeAmt = feePreview ? Math.max(Math.round(parseFloat(amount || "0") * feePreview.feeRate), 1) : 0;
  const phoneCharged = feeBearer === "SENDER" ? parseFloat(amount || "0") + feeAmt : parseFloat(amount || "0");
  const merchantReceives = feeBearer === "SENDER" ? parseFloat(amount || "0") : Math.max(parseFloat(amount || "0") - feeAmt, 0);

  // ─────────────────────────────────────────────────────────────────────────
  // Main form
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Link2 className="w-4 h-4 text-cyan-400" />
          <YookPayLogo size="sm" />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* Product card */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className={`flex gap-4 ${linkData.photoData ? "" : "flex-col"}`}>
            {linkData.photoData && (
              <img src={linkData.photoData} alt={linkData.title}
                className="w-20 h-20 rounded-xl object-cover border border-border flex-shrink-0" />
            )}
            <div className="min-w-0">
              <h1 className="font-bold text-lg leading-tight">{linkData.title}</h1>
              {linkData.description && (
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{linkData.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Payment form container */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
          <h2 className="font-semibold">Effectuer le paiement</h2>

          {/* Mode toggle */}
          <div className="flex rounded-xl border border-input overflow-hidden bg-muted/40 p-1 gap-1">
            <button type="button"
              onClick={() => { setPayMode("mobile"); setCryptoResult(null); setCryptoPoll("waiting"); }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                payMode === "mobile" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}>
              Mobile Money
            </button>
            <button type="button"
              onClick={() => setPayMode("crypto")}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                payMode === "crypto" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}>
              <span>Paiement Crypto</span>
              <Badge className="bg-cyan-500/15 text-cyan-600 border-cyan-300/40 text-[10px] px-1.5 py-0">USDT</Badge>
            </button>
          </div>

          {/* ═══════════════════════════════════════════════ MOBILE MONEY ══ */}
          {payMode === "mobile" && (
            <form onSubmit={handleMobileSubmit} className="space-y-5">

              {/* Fee bearer toggle */}
              <div>
                <p className="text-sm font-medium mb-2">Qui paie les frais ?</p>
                <div className="flex rounded-lg border border-input overflow-hidden w-full">
                  {(["SENDER", "RECIPIENT"] as FeeBearer[]).map((v) => (
                    <button key={v} type="button" onClick={() => setFeeBearer(v)}
                      className={`flex-1 py-2 text-sm font-medium transition-colors ${v === "RECIPIENT" ? "border-l border-input" : ""} ${
                        feeBearer === v
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground hover:bg-muted"
                      }`}>
                      {v === "SENDER" ? "Envoyeur" : "Destinataire (moi)"}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {feeBearer === "SENDER"
                    ? "L'envoyeur supporte les frais — le marchand reçoit le montant net."
                    : "Le marchand supporte les frais — l'envoyeur envoie le montant exact saisi."}
                </p>
              </div>

              {/* Country */}
              <div className="space-y-1.5">
                <Label>Pays</Label>
                <select value={country} onChange={(e) => setCountry(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="" disabled>Sélectionnez votre pays</option>
                  {availableCountries.map((c) => (
                    <option key={c.code} value={c.code}>{c.flag} {c.name} — {c.currency}</option>
                  ))}
                </select>
              </div>

              {/* Operator */}
              {country && (
                <div className="space-y-1.5">
                  <Label>Opérateur Mobile Money</Label>
                  <select value={operator} onChange={(e) => setOperator(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="" disabled>Choisissez un opérateur</option>
                    {availableOperators.map((op) => (
                      <option key={op} value={op}>{OPERATOR_LABELS[op] ?? op}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Operator alerts */}
              {flow === "OTP" && country !== "CM" && (
                <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
                  <Info className="h-4 w-4 text-orange-600" />
                  <AlertTitle className="text-orange-700 dark:text-orange-300">Code OTP Orange Money requis</AlertTitle>
                  <AlertDescription className="text-orange-600 dark:text-orange-400 text-sm mt-1">
                    Composez <strong>#144*82#</strong> depuis votre téléphone Orange pour générer un code OTP à 6 chiffres.
                  </AlertDescription>
                </Alert>
              )}
              {flow === "WAVE" && (
                <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-blue-700 dark:text-blue-300">Paiement Wave</AlertTitle>
                  <AlertDescription className="text-blue-600 dark:text-blue-400 text-sm mt-1">
                    Après validation, vous serez redirigé vers un lien de paiement Wave. Assurez-vous que l'application Wave est installée.
                  </AlertDescription>
                </Alert>
              )}
              {flow === "STANDARD" && operator && (
                <Alert className="border-muted bg-muted/30">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <AlertTitle className="text-sm">Confirmation par SMS / USSD</AlertTitle>
                  <AlertDescription className="text-muted-foreground text-sm mt-1">
                    Vous recevrez une invitation de {OPERATOR_LABELS[operator] ?? operator} pour confirmer le paiement.
                  </AlertDescription>
                </Alert>
              )}

              {/* Phone */}
              {operator && (
                <div className="space-y-1.5">
                  <Label>Numéro Mobile Money</Label>
                  <div className="flex">
                    {selectedCountry && (
                      <div className="flex items-center px-3 border border-r-0 border-input rounded-l-md bg-muted text-sm text-muted-foreground font-medium select-none">
                        {selectedCountry.dialCode}
                      </div>
                    )}
                    <Input type="tel" placeholder="600 000 000"
                      className={selectedCountry ? "rounded-l-none" : ""}
                      value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <p className="text-xs text-muted-foreground">Le numéro à débiter.</p>
                </div>
              )}

              {/* OTP — hidden for CM Orange Money */}
              {flow === "OTP" && country !== "CM" && (
                <div className="space-y-1.5">
                  <Label>Code OTP Orange Money</Label>
                  <Input type="text" inputMode="numeric" maxLength={6} placeholder="123456"
                    value={omOtp} onChange={(e) => setOmOtp(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Code à 6 chiffres obtenu en composant <strong>#144*82#</strong>.</p>
                </div>
              )}

              {/* Amount */}
              {operator && (
                <div className="space-y-1.5">
                  <Label>
                    {feeBearer === "SENDER"
                      ? `Montant à créditer au marchand${selectedCountry ? ` (${selectedCountry.currency})` : ""}`
                      : `Montant prélevé sur le téléphone${selectedCountry ? ` (${selectedCountry.currency})` : ""}`}
                    {linkData.priceType === "FIXED" && (
                      <span className="text-xs text-muted-foreground ml-2">(montant fixé par le marchand)</span>
                    )}
                  </Label>
                  <Input type="number" min={100} step={1} placeholder="Minimum 100"
                    value={amount} onChange={(e) => setAmount(e.target.value)}
                    readOnly={linkData.priceType === "FIXED"}
                    className={linkData.priceType === "FIXED" ? "bg-muted cursor-not-allowed" : ""}
                  />
                  {selectedCountry && <p className="text-xs text-muted-foreground">Minimum : 100 {selectedCountry.currency}</p>}
                </div>
              )}

              {/* Fee preview */}
              {feePreview && amount && operator && (
                <div className="bg-muted rounded-lg p-4 space-y-2 border border-border">
                  <h4 className="text-sm font-semibold mb-3">Résumé de la transaction</h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Montant prélevé sur le téléphone</span>
                    <span>{formatCurrency(phoneCharged, feePreview.currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Frais YookPay ({(feePreview.feeRate * 100).toFixed(1)}%)
                      {feeBearer === "SENDER" ? " — à charge de l'envoyeur" : " — à charge du marchand"}
                    </span>
                    <span className="text-rose-500">− {formatCurrency(feeAmt, feePreview.currency)}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between font-semibold">
                    <span>Marchand reçoit</span>
                    <span className="text-emerald-600">{formatCurrency(merchantReceives, feePreview.currency)}</span>
                  </div>
                </div>
              )}

              <Button type="submit"
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold"
                disabled={submitting || !country || !operator || !phone || !amount || (flow === "OTP" && country !== "CM" && !omOtp)}>
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Traitement...</>
                ) : (
                  `Payer ${amount && selectedCountry ? formatCurrency(parseFloat(amount), selectedCountry.currency) : ""}`
                )}
              </Button>
            </form>
          )}

          {/* ═══════════════════════════════════════════════════════ CRYPTO ══ */}
          {payMode === "crypto" && (
            <div className="space-y-4">
              {!cryptoResult ? (
                <>
                  <div>
                    <Label className="block mb-1">Montant USDT à envoyer</Label>
                    <p className="text-xs text-muted-foreground mb-1.5">
                      Minimum : <span className="font-semibold text-amber-600">{cryptoMinUsdt} USDT</span>
                    </p>
                    <Input type="number" min={cryptoMinUsdt} step="0.5"
                      value={cryptoAmount} onChange={(e) => setCryptoAmount(e.target.value)}
                      placeholder={String(cryptoMinUsdt)} />
                  </div>

                  <Alert className="border-cyan-200 bg-cyan-50 dark:bg-cyan-900/20">
                    <Info className="h-4 w-4 text-cyan-600" />
                    <AlertTitle className="text-cyan-700 dark:text-cyan-300 text-sm">Réseau TRC-20 (Tron)</AlertTitle>
                    <AlertDescription className="text-cyan-600 dark:text-cyan-400 text-xs mt-1">
                      Envoyez uniquement des USDT sur le réseau <strong>TRC-20 (Tron)</strong>. Les envois sur d'autres réseaux seront perdus.
                    </AlertDescription>
                  </Alert>

                  <Button className="w-full bg-cyan-600 hover:bg-cyan-700 font-bold"
                    onClick={handleCryptoSubmit} disabled={cryptoLoading}>
                    {cryptoLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" />Génération en cours...</>
                    ) : "Générer une adresse de dépôt"}
                  </Button>
                </>

              ) : cryptoPoll === "failed" ? (
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                    <XCircle className="h-9 w-9 text-red-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-red-700 dark:text-red-400">Paiement expiré</p>
                    <p className="text-sm text-muted-foreground mt-1">La transaction n'a pas été confirmée. Contactez le support si des fonds ont été envoyés.</p>
                  </div>
                  <Button variant="outline" onClick={() => { setCryptoResult(null); setCryptoPoll("waiting"); }}>
                    Réessayer
                  </Button>
                </div>

              ) : (
                <div className="space-y-4">
                  {/* Address card */}
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 p-4">
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold uppercase mb-3">
                      Adresse de paiement USDT TRC-20
                    </p>
                    {cryptoResult.payAddress ? (
                      <>
                        <div className="flex items-center gap-2 mb-3">
                          <code className="flex-1 text-xs font-mono bg-background border rounded px-3 py-2 break-all">
                            {cryptoResult.payAddress}
                          </code>
                          <Button size="sm" variant="outline" onClick={() => handleCopyAddress(cryptoResult.payAddress)}>
                            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Montant exact à envoyer</span>
                          <span className="font-bold font-mono">{cryptoResult.payAmount} USDT</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Réseau</span>
                          <span className="font-medium">{cryptoResult.network}</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">{cryptoResult.message}</p>
                    )}
                  </div>

                  {/* Spinner */}
                  <div className="flex items-center gap-3 rounded-lg border border-cyan-200 bg-cyan-50 dark:bg-cyan-900/20 p-4">
                    <svg className="h-5 w-5 text-cyan-600 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-cyan-700 dark:text-cyan-300">Vérification du paiement en cours…</p>
                      <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-0.5">
                        La confirmation blockchain peut prendre 5 à 20 minutes. Cette page se met à jour automatiquement.
                      </p>
                    </div>
                  </div>

                  <Button variant="outline" className="w-full"
                    onClick={() => { setCryptoResult(null); setCryptoPoll("waiting"); setCryptoAmount(String(cryptoMinUsdt)); }}>
                    Nouveau paiement
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Trust footer */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pb-4">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Paiement sécurisé par</span>
          <a href="/" className="hover:opacity-80 transition-opacity"><YookPayLogo size="sm" /></a>
        </div>
      </div>
    </div>
  );
}
