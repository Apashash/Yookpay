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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Loader2, ShieldCheck, Clock, CheckCircle2, XCircle, Link2,
  AlertTriangle, Copy, Check, Info, ExternalLink,
  Smartphone, CreditCard, Bitcoin, Search, ChevronDown,
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

type PayMode = "mobile" | "card" | "crypto";
type PollStatus  = "PENDING" | "SUCCESS" | "FAILED";

type MobileResult = {
  txId: number;
  flow: string;
  smsLink?: string | null;
  pending?: boolean;
};

function isInsufficientBalance(msg: string): boolean {
  const lower = msg.toLowerCase();
  return lower.includes("insufficient") || lower.includes("solde") ||
         lower.includes("balance") || lower.includes("fonds") || lower.includes("funds");
}

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

type CountryOption = (typeof COUNTRIES)[number];

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function CountryPicker({
  countries,
  value,
  onChange,
}: {
  countries: CountryOption[];
  value: string;
  onChange: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = countries.find((country) => country.code === value);
  const query = normalizeSearch(search.trim());
  const filteredCountries = countries.filter((country) =>
    normalizeSearch(`${country.name} ${country.currency} ${country.code}`).includes(query)
  );

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-expanded={open}
          className="flex h-11 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-left text-sm transition-colors hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {selected ? (
            <span className="flex min-w-0 items-center gap-2">
              <span className="text-lg leading-none">{selected.flag}</span>
              <span className="truncate font-medium">{selected.name}</span>
              <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                {selected.currency}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">Sélectionnez votre pays</span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="w-[var(--radix-popover-trigger-width)] overflow-hidden p-0"
      >
        <div className="sticky top-0 z-10 border-b bg-popover p-2">
          <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-2.5">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un pays"
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto overscroll-contain p-1">
          {filteredCountries.length > 0 ? (
            filteredCountries.map((country) => (
              <button
                key={country.code}
                type="button"
                onClick={() => {
                  onChange(country.code);
                  setOpen(false);
                  setSearch("");
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
              >
                <span className="text-lg leading-none">{country.flag}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{country.name}</span>
                <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                  {country.currency}
                </span>
                {country.code === value && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            ))
          ) : (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Aucun pays trouvé</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

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
  const [email,      setEmail]      = useState("");
  const [operator,   setOperator]   = useState("");
  const [phone,      setPhone]      = useState("");
  const [amount,     setAmount]     = useState("");
  const [omOtp,      setOmOtp]      = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── Mobile result ──
  const [mobileResult, setMobileResult] = useState<MobileResult | null>(null);
  const [pollStatus,   setPollStatus]   = useState<PollStatus>("PENDING");
  const [timeLeft,     setTimeLeft]     = useState(COUNTDOWN_SECONDS);
  const [failureReason, setFailureReason] = useState<string | null>(null);

  // ── Card form (Maviance e-nkap) ──
  const [cardName,    setCardName]    = useState("");
  const [cardAmount,  setCardAmount]  = useState("");
  const [cardLoading, setCardLoading] = useState(false);

  // ── Crypto form ──
  const [cryptoMinUsdt,  setCryptoMinUsdt]  = useState(20);
  const [cryptoAmount,   setCryptoAmount]   = useState("20");
  const [cryptoResult,   setCryptoResult]   = useState<CryptoResult | null>(null);
  const [cryptoLoading,  setCryptoLoading]  = useState(false);
  const [cryptoPoll,     setCryptoPoll]     = useState<"waiting" | "success" | "failed">("waiting");
  const [copied,         setCopied]         = useState(false);

  // ── Active operators from admin config ──
  const [activeOps, setActiveOps] = useState<Record<string, { deposit: string[]; withdrawal: string[] }> | null>(null);
  useEffect(() => {
    fetch("/api/services/available-operators")
      .then((r) => r.json())
      .then((d: { available: Record<string, { deposit: string[]; withdrawal: string[] }> }) => setActiveOps(d.available))
      .catch(() => {});
  }, []);

  // ── Derived ──
  const availableCountries = COUNTRIES.filter(
    (c) => !linkData?.countries?.length || linkData.countries.includes(c.code)
  );
  const selectedCountry   = COUNTRIES.find((c) => c.code === country);
  const allOperators = selectedCountry?.operators ?? [];
  const availableOperators = activeOps && country && activeOps[country]
    ? allOperators.filter((op) => activeOps[country].deposit.includes(op))
    : allOperators;
  const flow = operator ? getOperatorFlow(operator) : null;
  const cardSelectedCountry = selectedCountry;

  const handleCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = linkData?.priceType === "FIXED" && linkData.priceAmount
      ? linkData.priceAmount
      : parseFloat(cardAmount);
    if (!country || !amt || amt < 100) {
      toast({ variant: "destructive", title: "Formulaire incomplet", description: "Sélectionnez un pays et un montant (minimum 100)." });
      return;
    }
    setCardLoading(true);
    try {
      const res = await fetch(`/api/payment-links/public/${token}/pay-card`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          country,
          customerName: cardName || undefined,
          email: email || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ variant: "destructive", title: "Erreur", description: data?.message ?? "Paiement par carte impossible." });
        return;
      }
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        toast({ variant: "destructive", title: "Erreur", description: "Aucune page de paiement retournée." });
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur réseau", description: "Vérifiez votre connexion et réessayez." });
    } finally {
      setCardLoading(false);
    }
  };

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
        const firstCountry = COUNTRIES.find(
          (candidate) => !data.countries.length || data.countries.includes(candidate.code)
        );
        setCountry(firstCountry?.code ?? "");
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
  useEffect(() => { setOperator(""); setOmOtp(""); }, [country]);
  useEffect(() => { setOmOtp(""); }, [operator]);

  // ── Pre-fill amount for fixed-price links ──
  useEffect(() => {
    if (linkData?.priceType === "FIXED" && linkData.priceAmount) setAmount(String(linkData.priceAmount));
  }, [linkData, country]);

  // ── Mobile countdown + poll ──
  useEffect(() => {
    if (!mobileResult?.pending) return;
    setPollStatus("PENDING");
    setTimeLeft(COUNTDOWN_SECONDS);

    const timer = setInterval(() => setTimeLeft((t) => (t <= 1 ? (clearInterval(timer), 0) : t - 1)), 1000);

    const poll = setInterval(async () => {
      try {
        const r = await fetch(`/api/payment-links/public/tx/${mobileResult.txId}`);
        const d = await r.json() as { status: string; failureReason?: string | null };
        if (d.status === "SUCCESS") { setPollStatus("SUCCESS"); clearInterval(poll); clearInterval(timer); }
        else if (d.status === "FAILED") {
          setFailureReason(d.failureReason ?? null);
          setPollStatus("FAILED");
          clearInterval(poll);
          clearInterval(timer);
        }
      } catch { /* silent */ }
    // Maviance recommends at most one verifytx call every 10 seconds per
    // transaction. This endpoint may perform that provider check.
    }, 10_000);

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
          email:     email || undefined,
          feeBearer: "RECIPIENT",
          omOtp:     otpToSend,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        toast({ variant: "destructive", title: "Paiement échoué", description: data.message ?? "Erreur inconnue" });
        return;
      }
      const mr: MobileResult = { txId: data.transaction.id, flow: data.flow, smsLink: data.smsLink, pending: true };
      setMobileResult(mr);
      if (data.smsLink) toast({ title: "Paiement Wave", description: "Cliquez sur le lien Wave pour finaliser votre paiement." });
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
        body: JSON.stringify({ amountUsdt: amt, email: email || undefined }),
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
      const isInsufficient = failureReason ? isInsufficientBalance(failureReason) : false;
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6 text-center">
          <XCircle className="w-16 h-16 text-destructive" />
          <h1 className="text-2xl font-bold">Paiement échoué</h1>
          {isInsufficient ? (
            <p className="text-muted-foreground text-sm max-w-sm">
              Solde insuffisant sur votre compte Mobile Money. Rechargez votre compte et réessayez.
            </p>
          ) : failureReason ? (
            <p className="text-muted-foreground text-sm max-w-sm">
              Transaction refusée par l'opérateur : {failureReason}. Votre téléphone n'a pas été débité.
            </p>
          ) : (
            <p className="text-muted-foreground text-sm max-w-sm">
              La transaction a été refusée par l'opérateur. Votre téléphone n'a pas été débité.
            </p>
          )}
          <Button onClick={() => { setMobileResult(null); setPollStatus("PENDING"); setTimeLeft(COUNTDOWN_SECONDS); setFailureReason(null); }}>
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

  // ─────────────────────────────────────────────────────────────────────────
  // Main form
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link2 className="w-4 h-4 text-cyan-400" />
          <YookPayLogo size="sm" />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* Product card */}
        <div className="relative overflow-hidden rounded-2xl border border-cyan-100 bg-[linear-gradient(135deg,#d8f8f9_0%,#eefcfc_58%,#d9f2ff_100%)] p-5">
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 -right-10 h-40 w-40 rounded-full bg-sky-300/20 blur-sm" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-14 h-32 w-32 rounded-full bg-white/35" />
          <div className={`relative flex gap-4 ${linkData.photoData ? "" : "flex-col"}`}>
            {linkData.photoData && (
              <img src={linkData.photoData} alt={linkData.title}
                className="w-20 h-20 rounded-xl object-cover border border-white/70 shadow-sm flex-shrink-0" />
            )}
            <div className="min-w-0">
              <h1 className="font-bold text-lg leading-tight text-slate-950">{linkData.title}</h1>
              {linkData.description && (
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">{linkData.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Payment form container */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
          <h2 className="font-semibold">Effectuer le paiement</h2>

          {/* Payment method cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3" role="group" aria-label="Modes de paiement">
            <button
              type="button"
              aria-pressed={payMode === "mobile"}
              onClick={() => { setPayMode("mobile"); setCryptoResult(null); setCryptoPoll("waiting"); }}
              className={`relative min-h-[132px] sm:min-h-[154px] md:min-h-[190px] lg:min-h-[230px] rounded-2xl border-2 px-1.5 py-3 sm:px-3 sm:py-4 md:px-5 md:py-6 lg:px-8 lg:py-7 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
                payMode === "mobile"
                  ? "border-emerald-400 bg-emerald-50/70 shadow-sm dark:border-emerald-500 dark:bg-emerald-950/25"
                  : "border-border bg-background hover:border-emerald-300/70 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10"
              }`}
            >
              {payMode === "mobile" && (
                <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={3} />
                </span>
              )}
              <span className="mx-auto flex h-9 w-9 sm:h-12 sm:w-12 md:h-16 md:w-16 lg:h-20 lg:w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-300">
                <Smartphone className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 lg:h-10 lg:w-10" />
              </span>
              <span className="mt-2 block whitespace-nowrap text-[11px] sm:text-base md:text-xl lg:text-3xl font-bold text-foreground">Mobile Money</span>
              <img
                src="/payment-methods/mobile-money-logos.webp"
                alt="MTN, Orange et Moov"
                className="mx-auto mt-2 h-5 w-auto max-w-full object-contain sm:mt-3 sm:h-7 md:mt-5 md:h-10 lg:h-12"
              />
            </button>

            <button
              type="button"
              aria-pressed={payMode === "card"}
              onClick={() => { setPayMode("card"); setCryptoResult(null); setCryptoPoll("waiting"); }}
              className={`relative min-h-[132px] sm:min-h-[154px] md:min-h-[190px] lg:min-h-[230px] rounded-2xl border-2 px-1.5 py-3 sm:px-3 sm:py-4 md:px-5 md:py-6 lg:px-8 lg:py-7 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                payMode === "card"
                  ? "border-blue-400 bg-blue-50/70 shadow-sm dark:border-blue-500 dark:bg-blue-950/25"
                  : "border-border bg-background hover:border-blue-300/70 hover:bg-blue-50/30 dark:hover:bg-blue-950/10"
              }`}
            >
              {payMode === "card" && (
                <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white">
                  <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={3} />
                </span>
              )}
              <span className="mx-auto flex h-9 w-9 sm:h-12 sm:w-12 md:h-16 md:w-16 lg:h-20 lg:w-20 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/60 dark:text-blue-300">
                <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 lg:h-10 lg:w-10" />
              </span>
              <span className="mt-2 block whitespace-nowrap text-[11px] sm:text-base md:text-xl lg:text-3xl font-bold text-foreground">Carte</span>
              <img
                src="/payment-methods/card-logos.webp"
                alt="Visa, Mastercard et Apple Pay"
                className="mx-auto mt-2 h-5 w-auto max-w-full object-contain sm:mt-3 sm:h-7 md:mt-5 md:h-10 lg:h-12"
              />
            </button>

            <button
              type="button"
              aria-pressed={payMode === "crypto"}
              onClick={() => setPayMode("crypto")}
              className={`relative min-h-[132px] sm:min-h-[154px] md:min-h-[190px] lg:min-h-[230px] rounded-2xl border-2 px-1.5 py-3 sm:px-3 sm:py-4 md:px-5 md:py-6 lg:px-8 lg:py-7 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 ${
                payMode === "crypto"
                  ? "border-amber-400 bg-amber-50/70 shadow-sm dark:border-amber-500 dark:bg-amber-950/25"
                  : "border-border bg-background hover:border-amber-300/70 hover:bg-amber-50/30 dark:hover:bg-amber-950/10"
              }`}
            >
              {payMode === "crypto" && (
                <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white">
                  <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={3} />
                </span>
              )}
              <span className="mx-auto flex h-9 w-9 sm:h-12 sm:w-12 md:h-16 md:w-16 lg:h-20 lg:w-20 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/60 dark:text-amber-300">
                <Bitcoin className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 lg:h-10 lg:w-10" />
              </span>
              <span className="mt-2 block whitespace-nowrap text-[11px] sm:text-base md:text-xl lg:text-3xl font-bold text-foreground">Crypto</span>
              <img
                src="/payment-methods/crypto-logos.webp"
                alt="Bitcoin, Ethereum, Tether et USD Coin"
                className="mx-auto mt-2 h-5 w-auto max-w-full object-contain sm:mt-3 sm:h-7 md:mt-5 md:h-10 lg:h-12"
              />
            </button>
          </div>

          {/* ═══════════════════════════════════════════════════════ CARTE ══ */}
          {payMode === "card" && (
            <form onSubmit={handleCardSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label>Pays</Label>
                <CountryPicker countries={availableCountries} value={country} onChange={setCountry} />
              </div>

              <div className="space-y-1.5">
                <Label>Nom (optionnel)</Label>
                <Input type="text" placeholder="Votre nom" value={cardName}
                  onChange={(e) => setCardName(e.target.value)} maxLength={50} />
              </div>

              <div className="space-y-1.5">
                <Label>Email (optionnel — pour le reçu)</Label>
                <Input type="email" placeholder="vous@exemple.com" value={email}
                  onChange={(e) => setEmail(e.target.value)} />
              </div>

              {country && (
                <div className="space-y-1.5">
                  <Label>
                    {`Montant à payer${cardSelectedCountry ? ` (${cardSelectedCountry.currency})` : ""}`}
                    {linkData.priceType === "FIXED" && (
                      <span className="text-xs text-muted-foreground ml-2">(montant fixé par le marchand)</span>
                    )}
                  </Label>
                  <Input type="number" min={100} step={1} placeholder="Minimum 100"
                    value={linkData.priceType === "FIXED" && linkData.priceAmount ? String(linkData.priceAmount) : cardAmount}
                    onChange={(e) => setCardAmount(e.target.value)}
                    readOnly={linkData.priceType === "FIXED"}
                    className={linkData.priceType === "FIXED" ? "bg-muted cursor-not-allowed" : ""}
                  />
                </div>
              )}

              <Button type="submit"
                className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold"
                disabled={cardLoading || !country}>
                {cardLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Redirection...</>
                ) : "Payer par carte"}
              </Button>
            </form>
          )}

          {/* ═══════════════════════════════════════════════ MOBILE MONEY ══ */}
          {payMode === "mobile" && (
            <form onSubmit={handleMobileSubmit} className="space-y-5">

              {/* Country */}
              <div className="space-y-1.5">
                <Label>Pays</Label>
                <CountryPicker countries={availableCountries} value={country} onChange={setCountry} />
              </div>

              <div className="space-y-1.5">
                <Label>Email (optionnel — pour le reçu)</Label>
                <Input type="email" placeholder="vous@exemple.com" value={email}
                  onChange={(e) => setEmail(e.target.value)} />
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
              {flow === "WAVE" && (
                <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-blue-700 dark:text-blue-300">Paiement Wave</AlertTitle>
                  <AlertDescription className="text-blue-600 dark:text-blue-400 text-sm mt-1">
                    Après validation, vous serez redirigé vers un lien de paiement Wave. Assurez-vous que l'application Wave est installée.
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
                    {`Montant à payer${selectedCountry ? ` (${selectedCountry.currency})` : ""}`}
                    {linkData.priceType === "FIXED" && (
                      <span className="text-xs text-muted-foreground ml-2">(montant fixé par le marchand)</span>
                    )}
                  </Label>
                  <Input type="number" min={50} step={1} placeholder="Minimum 50"
                    value={amount} onChange={(e) => setAmount(e.target.value)}
                    readOnly={linkData.priceType === "FIXED"}
                    className={linkData.priceType === "FIXED" ? "bg-muted cursor-not-allowed" : ""}
                  />
                  {selectedCountry && <p className="text-xs text-muted-foreground">Minimum : 50 {selectedCountry.currency}</p>}
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
                  <div className="space-y-1.5">
                    <Label>Pays</Label>
                    <CountryPicker countries={availableCountries} value={country} onChange={setCountry} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Email (optionnel — pour le reçu)</Label>
                    <Input type="email" placeholder="vous@exemple.com" value={email}
                      onChange={(e) => setEmail(e.target.value)} />
                  </div>

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
