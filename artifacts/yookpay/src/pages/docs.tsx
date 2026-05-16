import { Link } from "wouter";
import { YookPayLogo } from "@/components/yookpay-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  ArrowLeft, ArrowDownToLine, ArrowUpFromLine, Copy, Check,
  Key, Shield, Zap, Globe, AlertTriangle, CheckCircle2,
  Clock, Info, ChevronRight, Terminal, HelpCircle,
  BookOpen, Lock, CircleDot, ArrowRight,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   PRIMITIVES
═══════════════════════════════════════════════════════════ */

function useCopy(text: string) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return { copied, copy };
}

function CopyButton({ text, className = "" }: { text: string; className?: string }) {
  const { copied, copy } = useCopy(text);
  return (
    <button onClick={copy} className={`p-1.5 rounded transition-colors ${copied ? "text-green-400" : "text-white/40 hover:text-white/80"} ${className}`}>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function CodeBlock({ code, lang = "bash", title }: { code: string; lang?: string; title?: string }) {
  return (
    <div className="rounded-lg bg-[#0d1117] border border-white/10 overflow-hidden text-[13px] font-mono">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/[0.03]">
        <div className="flex items-center gap-2">
          <div className="flex gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500/60" /><span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" /><span className="w-2.5 h-2.5 rounded-full bg-green-500/60" /></div>
          {title && <span className="text-white/40 text-xs ml-1">{title}</span>}
        </div>
        <CopyButton text={code} />
      </div>
      <pre className="p-4 overflow-x-auto leading-relaxed text-white/80 whitespace-pre"><code>{code}</code></pre>
    </div>
  );
}

/* Inline code badge */
function IC({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded text-[12px]">{children}</code>;
}

function Callout({ type, children }: { type: "info" | "warn" | "ok" | "err"; children: React.ReactNode }) {
  const m = {
    info: { border: "border-blue-500/30",   bg: "bg-blue-500/5",   icon: <Info        className="h-4 w-4 shrink-0 mt-0.5 text-blue-400" />   },
    warn: { border: "border-amber-500/30",  bg: "bg-amber-500/5",  icon: <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" /> },
    ok:   { border: "border-green-500/30",  bg: "bg-green-500/5",  icon: <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-green-400" />  },
    err:  { border: "border-red-500/30",    bg: "bg-red-500/5",    icon: <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />   },
  }[type];
  return (
    <div className={`flex gap-3 rounded-lg border p-4 text-sm leading-relaxed text-white/70 ${m.border} ${m.bg}`}>
      {m.icon}<div>{children}</div>
    </div>
  );
}

/* ─── Postman-style endpoint header ─────────────────────── */
function EndpointHeader({ method, path, title, color }: { method: string; path: string; title: string; color: "blue" | "purple" }) {
  const colors = {
    blue:   { badge: "bg-blue-600",   glow: "from-blue-600/20 to-transparent", border: "border-blue-500/30" },
    purple: { badge: "bg-purple-600", glow: "from-purple-600/20 to-transparent", border: "border-purple-500/30" },
  }[color];
  return (
    <div className={`rounded-xl border ${colors.border} overflow-hidden`}>
      <div className={`bg-gradient-to-r ${colors.glow} px-5 py-4 border-b ${colors.border} flex flex-wrap items-center gap-3`}>
        <Badge className={`${colors.badge} text-white font-bold text-xs tracking-wide px-2.5 shrink-0`}>{method}</Badge>
        <code className="font-mono text-white/80 text-sm flex-1 min-w-0 break-all">/api/merchant/v1/{path}</code>
      </div>
      <div className="px-5 py-3 bg-white/[0.01]">
        <p className="text-white/50 text-sm">{title}</p>
      </div>
    </div>
  );
}

/* ─── Two-column request/response layout ─── */
function ReqRes({ request, response }: { request: React.ReactNode; response: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-white/30 uppercase tracking-widest">Corps de la requête</p>
        {request}
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-white/30 uppercase tracking-widest">Réponse — 201 Created</p>
        {response}
      </div>
    </div>
  );
}

/* ─── Parameter / field tables ─── */
function ParamTable({ rows }: { rows: { name: string; type: string; req?: boolean; desc: string; ex?: string }[] }) {
  return (
    <div className="rounded-lg border border-white/10 overflow-hidden overflow-x-auto">
      <table className="w-full text-xs min-w-[500px]">
        <thead className="bg-white/[0.04] border-b border-white/10">
          <tr>
            {["Champ", "Type", "", "Description / Valeurs acceptées"].map(h => (
              <th key={h} className="text-left px-4 py-2.5 text-white/40 font-semibold tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.name} className="border-b border-white/5 hover:bg-white/[0.015] align-top">
              <td className="px-4 py-3"><IC>{r.name}</IC></td>
              <td className="px-4 py-3 text-white/40 whitespace-nowrap font-mono">{r.type}</td>
              <td className="px-4 py-3 whitespace-nowrap">{r.req ? <span className="text-red-400 font-medium">requis</span> : <span className="text-white/25">optionnel</span>}</td>
              <td className="px-4 py-3 text-white/55 leading-relaxed">
                {r.desc}
                {r.ex && <> — ex&nbsp;: <span className="font-mono text-emerald-400">{r.ex}</span></>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RespTable({ rows }: { rows: { name: string; type: string; desc: string }[] }) {
  return (
    <div className="rounded-lg border border-white/10 overflow-hidden overflow-x-auto">
      <table className="w-full text-xs min-w-[440px]">
        <thead className="bg-white/[0.04] border-b border-white/10">
          <tr>
            {["Champ retourné", "Type", "Description"].map(h => (
              <th key={h} className="text-left px-4 py-2.5 text-white/40 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.name} className="border-b border-white/5 hover:bg-white/[0.015] align-top">
              <td className="px-4 py-3"><code className="font-mono text-emerald-300 text-[11px]">{r.name}</code></td>
              <td className="px-4 py-3 font-mono text-white/35 text-[11px] whitespace-nowrap">{r.type}</td>
              <td className="px-4 py-3 text-white/55 leading-relaxed">{r.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Section wrapper ─── */
function Section({ id, children }: { id: string; children: React.ReactNode }) {
  return <section id={id} className="scroll-mt-24 space-y-6">{children}</section>;
}
function SectionHeading({ icon: Icon, label, color = "text-white" }: { icon: React.ComponentType<{ className?: string }>; label: string; color?: string }) {
  return (
    <div className="flex items-center gap-3 mb-1">
      <Icon className={`h-5 w-5 shrink-0 ${color}`} />
      <h2 className="text-2xl font-extrabold">{label}</h2>
    </div>
  );
}
function SubHeading({ id, label }: { id: string; label: string }) {
  return <h3 id={id} className="text-base font-bold text-white/80 mt-10 mb-3 scroll-mt-24 border-b border-white/5 pb-2">{label}</h3>;
}

/* ─── Nav item ─── */
function NavItem({ href, label, indent = false }: { href: string; label: string; indent?: boolean }) {
  return (
    <a href={href}
      className={`block py-1 text-[13px] transition-colors border-l pl-3 text-white/45 hover:text-white hover:border-indigo-400 border-white/10 ${indent ? "ml-3 text-[12px] text-white/30 hover:text-white/70" : ""}`}>
      {label}
    </a>
  );
}

/* ─── Language tabs ─── */
function LangTabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-all border ${active === t.id ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40" : "border-white/10 text-white/40 hover:text-white/70 hover:border-white/20"}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Divider with label ─── */
function Divider({ label, icon: Icon, color }: { label: string; icon: React.ComponentType<{ className?: string }>; color: string }) {
  return (
    <div className="flex items-center gap-4 py-2">
      <div className={`flex-1 h-px ${color.replace("text-", "bg-").replace("400", "400/20")}`} />
      <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold ${color} border-current/30 bg-current/5`}
        style={{ background: "rgba(99,102,241,0.07)" }}>
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className={`flex-1 h-px ${color.replace("text-", "bg-").replace("400", "400/20")}`} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CODE SAMPLES (exact data from feeService.ts)
═══════════════════════════════════════════════════════════ */

const BASE = "https://yookpay.partner.ashtechpay.top";

const PAYIN_BODY = `{
  "country":  "CM",
  "operator": "MTN",
  "phone":    "237687194830",
  "amount":   5000,
  "metadata": { "orderId": "CMD-42" }  // optionnel
}`;

const PAYIN_RESP = `// HTTP 201 Created
{
  "success":           true,
  "reference":         "YPY-M9X1A2-K7TQ",  // ← à stocker
  "providerReference": "TXN-20240516-001",
  "status":            "PENDING",
  "amount":            5000,
  "netAmount":         4925,   // amount − feeAmount
  "feeAmount":         75,
  "feeRate":           0.015,
  "currency":          "XAF",
  "transactionId":     412
}`;

const PAYOUT_BODY = `{
  "country":   "CM",
  "operator":  "MTN",
  "phone":     "237687194830",
  "amount":    5000,
  "feeBearer": "SENDER",       // "SENDER" (défaut) | "RECIPIENT"
  "metadata":  { "userId": 99 } // optionnel
}`;

const PAYOUT_RESP = `// HTTP 201 Created  (feeBearer: "SENDER")
{
  "success":           true,
  "reference":         "YPY-M9X1A2-K8PL",
  "providerReference": "TXN-20240516-002",
  "status":            "PENDING",
  "amount":            5075,   // débité wallet (amount + feeAmount)
  "phoneReceives":     5000,   // reçu sur le téléphone
  "feeAmount":         75,
  "feeRate":           0.015,
  "currency":          "XAF",
  "transactionId":     413
}`;

const ERROR_BODY = `// Toutes les erreurs ont ce format
{
  "error":   "InsufficientFunds",       // code machine
  "message": "Solde insuffisant (...)"  // message lisible
}`;

const CURL_PAYIN = `curl -X POST ${BASE}/api/merchant/v1/payin \\
  -H "x-api-key: YKP_IN_votre_cle" \\
  -H "Content-Type: application/json" \\
  -d '{
    "country": "CM", "operator": "MTN",
    "phone": "237687194830", "amount": 5000
  }'`;

const NODE_PAYIN = `// npm install node-fetch  (ou fetch natif Node 18+)
const res = await fetch("${BASE}/api/merchant/v1/payin", {
  method: "POST",
  headers: {
    "x-api-key":    process.env.YOOKPAY_PAYIN_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    country: "CM", operator: "MTN",
    phone: "237687194830", amount: 5000,
    metadata: { orderId: "CMD-42" },
  }),
});

if (!res.ok) {
  const { error, message } = await res.json();
  throw new Error(\`[\${error}] \${message}\`);
}

const { reference, status, netAmount } = await res.json();
// ⚠ Stockez "reference" en base de données immédiatement
console.log(reference, status, netAmount);`;

const PYTHON_PAYIN = `import os, requests

r = requests.post(
    "${BASE}/api/merchant/v1/payin",
    headers={
        "x-api-key":    os.environ["YOOKPAY_PAYIN_KEY"],
        "Content-Type": "application/json",
    },
    json={
        "country": "CM", "operator": "MTN",
        "phone": "237687194830", "amount": 5000,
    },
)
r.raise_for_status()
data = r.json()
print(data["reference"], data["status"], data["netAmount"])`;

const PHP_PAYIN = `<?php
$ch = curl_init("${BASE}/api/merchant/v1/payin");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_HTTPHEADER     => [
        "x-api-key: " . getenv("YOOKPAY_PAYIN_KEY"),
        "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS => json_encode([
        "country" => "CM", "operator" => "MTN",
        "phone"   => "237687194830", "amount" => 5000,
    ]),
]);
$body = json_decode(curl_exec($ch), true);
curl_close($ch);
echo $body["reference"] . " — " . $body["status"];`;

const CURL_PAYOUT = `curl -X POST ${BASE}/api/merchant/v1/payout \\
  -H "x-api-key: YKP_OUT_votre_cle" \\
  -H "Content-Type: application/json" \\
  -d '{
    "country": "CM", "operator": "MTN",
    "phone": "237687194830", "amount": 5000,
    "feeBearer": "SENDER"
  }'`;

const NODE_PAYOUT = `const res = await fetch("${BASE}/api/merchant/v1/payout", {
  method: "POST",
  headers: {
    "x-api-key":    process.env.YOOKPAY_PAYOUT_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    country: "CM", operator: "MTN",
    phone: "237687194830", amount: 5000,
    feeBearer: "SENDER",
    metadata: { userId: 99 },
  }),
});

if (!res.ok) {
  const { error, message } = await res.json();
  // Cas clé : "InsufficientFunds" → rechargez votre wallet
  throw new Error(\`[\${error}] \${message}\`);
}

const { reference, phoneReceives, amount } = await res.json();
console.log(\`Envoyé: \${phoneReceives} XAF | Débité wallet: \${amount} XAF\`);`;

/* ═══════════════════════════════════════════════════════════
   COUNTRIES DATA (exact from feeService.ts)
═══════════════════════════════════════════════════════════ */

const COUNTRIES = [
  // XAF
  { flag: "🇨🇲", name: "Cameroun",          code: "CM", zone: "XAF", currency: "Franc CFA (BEAC)",  dial: "+237", operators: ["MTN", "ORANGE"] },
  { flag: "🇨🇬", name: "Congo-Brazzaville", code: "CG", zone: "XAF", currency: "Franc CFA (BEAC)",  dial: "+242", operators: ["MTN", "AIRTEL"] },
  { flag: "🇬🇦", name: "Gabon",             code: "GA", zone: "XAF", currency: "Franc CFA (BEAC)",  dial: "+241", operators: ["AIRTEL", "MTN"] },
  // XOF
  { flag: "🇨🇮", name: "Côte d'Ivoire",     code: "CI", zone: "XOF", currency: "Franc CFA (BCEAO)", dial: "+225", operators: ["MTN", "ORANGE", "MOOV", "WAVE"] },
  { flag: "🇸🇳", name: "Sénégal",           code: "SN", zone: "XOF", currency: "Franc CFA (BCEAO)", dial: "+221", operators: ["ORANGE", "FREE", "WAVE"] },
  { flag: "🇧🇫", name: "Burkina Faso",      code: "BF", zone: "XOF", currency: "Franc CFA (BCEAO)", dial: "+226", operators: ["ORANGE", "MOOV"] },
  { flag: "🇧🇯", name: "Bénin",             code: "BJ", zone: "XOF", currency: "Franc CFA (BCEAO)", dial: "+229", operators: ["MTN", "MOOV"] },
  { flag: "🇬🇲", name: "Gambie",            code: "GM", zone: "XOF", currency: "Dalasi (GMD)*",     dial: "+220", operators: ["AFRICELL", "QMONEY"] },
  { flag: "🇬🇳", name: "Guinée-Conakry",   code: "GN", zone: "XOF", currency: "Franc guinéen*",    dial: "+224", operators: ["MTN", "ORANGE", "CELLCOM"] },
  { flag: "🇲🇱", name: "Mali",              code: "ML", zone: "XOF", currency: "Franc CFA (BCEAO)", dial: "+223", operators: ["ORANGE", "MOOV"] },
  { flag: "🇹🇬", name: "Togo",              code: "TG", zone: "XOF", currency: "Franc CFA (BCEAO)", dial: "+228", operators: ["TOGOCEL", "MOOV"] },
  // CDF
  { flag: "🇨🇩", name: "Congo RDC",         code: "CD", zone: "CDF", currency: "Franc congolais",   dial: "+243", operators: ["VODACOM", "AIRTEL", "ORANGE", "AFRICELL"] },
];

/* ═══════════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════════ */

export default function Docs() {
  const [payinLang, setPayinLang]   = useState("curl");
  const [payoutLang, setPayoutLang] = useState("curl");

  const payinCode: Record<string, string>  = { curl: CURL_PAYIN, node: NODE_PAYIN, python: PYTHON_PAYIN, php: PHP_PAYIN };
  const payoutCode: Record<string, string> = { curl: CURL_PAYOUT, node: NODE_PAYOUT };

  const xafCountries = COUNTRIES.filter(c => c.zone === "XAF");
  const xofCountries = COUNTRIES.filter(c => c.zone === "XOF");
  const cdfCountries = COUNTRIES.filter(c => c.zone === "CDF");

  return (
    <div className="min-h-screen bg-[#060b18] text-white font-sans">

      {/* ── TOP NAV ── */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#060b18]/95 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/">
              <button className="text-white/50 hover:text-white transition-colors p-1.5 rounded hover:bg-white/5">
                <ArrowLeft className="h-4 w-4" />
              </button>
            </Link>
            <div className="flex items-center gap-3">
              <YookPayLogo className="h-7" />
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded text-xs font-semibold text-indigo-300">
                <BookOpen className="h-3 w-3" /> API Docs v1
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login"><Button variant="ghost" size="sm" className="text-white/60 hover:text-white text-xs h-8">Connexion</Button></Link>
            <Link href="/register"><Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white h-8 text-xs px-3">Créer un compte</Button></Link>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 flex gap-8 py-10">

        {/* ── LEFT NAV ── */}
        <nav className="hidden xl:block w-52 shrink-0 sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto pr-2 space-y-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/20 mb-2">Démarrage</p>
            <NavItem href="#intro" label="Introduction" />
            <NavItem href="#quickstart" label="Démarrage rapide" />
            <NavItem href="#auth" label="Authentification" />
            <NavItem href="#format" label="Format & Règles" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/20 mb-2">Endpoints</p>
            <NavItem href="#payin" label="POST /payin" />
            <NavItem href="#payin-params" label="Paramètres" indent />
            <NavItem href="#payin-response" label="Réponse" indent />
            <NavItem href="#payin-code" label="Exemples" indent />
            <NavItem href="#payout" label="POST /payout" />
            <NavItem href="#payout-fearbearer" label="feeBearer" indent />
            <NavItem href="#payout-params" label="Paramètres" indent />
            <NavItem href="#payout-response" label="Réponse" indent />
            <NavItem href="#payout-code" label="Exemples" indent />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/20 mb-2">Référence</p>
            <NavItem href="#statuses" label="Statuts" />
            <NavItem href="#errors" label="Codes d'erreur" />
            <NavItem href="#countries" label="Pays & Opérateurs" />
            <NavItem href="#security" label="Sécurité" />
            <NavItem href="#faq" label="FAQ" />
          </div>
        </nav>

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 min-w-0 space-y-16">

          {/* ═══ INTRODUCTION ═══ */}
          <Section id="intro">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full">
                <BookOpen className="h-3.5 w-3.5" /> Documentation API Marchands — YookPay v1
              </div>
              <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight">Guide d'intégration</h1>
              <p className="text-lg text-white/55 leading-relaxed max-w-2xl">
                Intégrez l'encaissement et la distribution d'argent Mobile Money en Afrique depuis n'importe quel langage ou plateforme, en quelques lignes de code.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: Zap,    c: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20", title: "Initiation en < 2 s",    desc: "Réponse immédiate avec référence + statut PENDING" },
                { icon: Globe,  c: "text-emerald-400",bg: "bg-emerald-400/10 border-emerald-400/20",title: "12 pays, 3 devises",     desc: "XAF · XOF · CDF — 11 opérateurs Mobile Money" },
                { icon: Shield, c: "text-blue-400",   bg: "bg-blue-400/10 border-blue-400/20",     title: "HTTPS · SHA-256",         desc: "Clés hachées, jamais stockées en clair" },
              ].map(f => (
                <div key={f.title} className={`rounded-xl border p-4 space-y-2 ${f.bg}`}>
                  <f.icon className={`h-5 w-5 ${f.c}`} />
                  <p className="font-bold text-sm">{f.title}</p>
                  <p className="text-xs text-white/45 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 flex items-center gap-3 flex-1 min-w-[280px]">
                <Terminal className="h-4 w-4 text-white/30 shrink-0" />
                <div className="text-sm">
                  <span className="text-white/35">Base URL</span>
                  <div className="font-mono text-indigo-300 text-xs mt-0.5 break-all">{BASE}</div>
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 flex items-center gap-3">
                <Lock className="h-4 w-4 text-white/30 shrink-0" />
                <div className="text-sm">
                  <span className="text-white/35">Authentification</span>
                  <div className="font-mono text-yellow-300 text-xs mt-0.5">x-api-key</div>
                </div>
              </div>
            </div>
          </Section>

          {/* ═══ QUICKSTART ═══ */}
          <Section id="quickstart">
            <SectionHeading icon={Zap} label="Démarrage rapide" color="text-yellow-400" />
            <p className="text-white/50 text-sm">Effectuez votre premier paiement en 4 étapes.</p>
            <div className="relative space-y-0">
              {[
                {
                  n: "1", title: "Créer un compte",
                  body: "Inscrivez-vous sur YookPay. C'est gratuit.",
                  cta: <Link href="/register"><Button size="sm" variant="outline" className="border-white/20 text-white/70 hover:text-white hover:bg-white/5 h-7 text-xs gap-1.5 mt-2">S'inscrire <ChevronRight className="h-3 w-3" /></Button></Link>,
                },
                {
                  n: "2", title: "Valider votre identité (KYB)",
                  body: "Tableau de bord → KYC/KYB. Soumettez vos documents. Validation sous 24–48 h. Le KYB est obligatoire pour activer l'API.",
                },
                {
                  n: "3", title: "Générer vos clés API",
                  body: "Tableau de bord → Clés API. Générez une clé Payin (YKP_IN_…) pour encaisser et/ou une clé Payout (YKP_OUT_…) pour distribuer. Copiez-la immédiatement — elle ne sera plus affichée.",
                  cta: <Link href="/api-keys"><Button size="sm" variant="outline" className="border-white/20 text-white/70 hover:text-white hover:bg-white/5 h-7 text-xs gap-1.5 mt-2">Mes clés API <ChevronRight className="h-3 w-3" /></Button></Link>,
                },
                {
                  n: "4", title: "Appeler l'API depuis votre serveur",
                  body: "Stockez la clé dans une variable d'environnement et appelez l'endpoint souhaité (voir ci-dessous). Ne mettez jamais de clé dans du code frontend ou mobile.",
                },
              ].map((s, i, arr) => (
                <div key={s.n} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="h-8 w-8 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold text-sm shrink-0">{s.n}</div>
                    {i < arr.length - 1 && <div className="flex-1 w-px bg-white/10 my-1" />}
                  </div>
                  <div className={`flex-1 ${i < arr.length - 1 ? "pb-6" : ""}`}>
                    <p className="font-semibold text-sm mt-1">{s.title}</p>
                    <p className="text-sm text-white/45 mt-1 leading-relaxed">{s.body}</p>
                    {s.cta}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* ═══ AUTH ═══ */}
          <Section id="auth">
            <SectionHeading icon={Key} label="Authentification" color="text-indigo-400" />
            <p className="text-white/55 text-sm leading-relaxed">
              Chaque requête doit inclure votre clé API dans l'en-tête HTTP <IC>x-api-key</IC>. Pas de session, pas de cookie, pas de token JWT — uniquement cet en-tête.
            </p>
            <CodeBlock lang="http" title="En-tête requis" code={`POST /api/merchant/v1/payin HTTP/1.1\nHost: yookpay.partner.ashtechpay.top\nx-api-key: YKP_IN_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\nContent-Type: application/json`} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ArrowDownToLine className="h-4 w-4 text-blue-400" />
                    <span className="font-bold text-blue-200 text-sm">Clé Payin</span>
                  </div>
                  <code className="text-[11px] font-mono text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">YKP_IN_…</code>
                </div>
                <ul className="text-xs text-white/50 space-y-1.5 list-none">
                  <li className="flex gap-2"><ArrowRight className="h-3 w-3 text-blue-500 mt-0.5 shrink-0" />Autorise <strong className="text-white/70">uniquement</strong> POST /v1/payin</li>
                  <li className="flex gap-2"><ArrowRight className="h-3 w-3 text-blue-500 mt-0.5 shrink-0" />Reçoit des paiements — crédite votre wallet</li>
                  <li className="flex gap-2"><ArrowRight className="h-3 w-3 text-blue-500 mt-0.5 shrink-0" />1 seule clé active par compte</li>
                </ul>
              </div>
              <div className="rounded-xl border border-purple-500/25 bg-purple-500/5 p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ArrowUpFromLine className="h-4 w-4 text-purple-400" />
                    <span className="font-bold text-purple-200 text-sm">Clé Payout</span>
                  </div>
                  <code className="text-[11px] font-mono text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded">YKP_OUT_…</code>
                </div>
                <ul className="text-xs text-white/50 space-y-1.5 list-none">
                  <li className="flex gap-2"><ArrowRight className="h-3 w-3 text-purple-500 mt-0.5 shrink-0" />Autorise <strong className="text-white/70">uniquement</strong> POST /v1/payout</li>
                  <li className="flex gap-2"><ArrowRight className="h-3 w-3 text-purple-500 mt-0.5 shrink-0" />Envoie de l'argent — débite votre wallet</li>
                  <li className="flex gap-2"><ArrowRight className="h-3 w-3 text-purple-500 mt-0.5 shrink-0" />1 seule clé active par compte</li>
                </ul>
              </div>
            </div>
            <Callout type="err">
              <strong>Ne jamais exposer vos clés côté client.</strong> Une clé API dans du JavaScript frontend, une application mobile ou un dépôt Git public peut être volée et utilisée pour vider votre wallet. Stockez-la exclusivement dans des <strong>variables d'environnement serveur</strong> (<IC>process.env.YOOKPAY_PAYIN_KEY</IC> en Node.js, <IC>os.environ</IC> en Python, <IC>getenv()</IC> en PHP).
            </Callout>
          </Section>

          {/* ═══ FORMAT ═══ */}
          <Section id="format">
            <SectionHeading icon={Terminal} label="Format & Règles générales" color="text-white/70" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { t: "JSON uniquement",         d: "Corps de requête et réponses sont toujours JSON. En-tête Content-Type: application/json obligatoire." },
                { t: "Montants entiers",         d: "Pas de décimales. Envoyez 5000 (XAF), jamais 5000.00. Les centimes ne sont pas supportés." },
                { t: "Pays en majuscules",       d: 'Code ISO-3166 sur 2 lettres. "CM" pas "cm" ni "Cameroun".' },
                { t: "Opérateurs en majuscules", d: '"MTN" pas "mtn". Doit correspondre exactement aux valeurs du tableau Pays & Opérateurs.' },
                { t: "Téléphone avec indicatif", d: 'Incluez le code pays sans le "+". "237687194830" pour le Cameroun (+237).' },
                { t: "HTTPS obligatoire",        d: "Les requêtes HTTP non chiffrées sont rejetées. Utilisez toujours HTTPS." },
              ].map(i => (
                <div key={i.t} className="rounded-lg border border-white/10 bg-white/[0.02] p-4 space-y-1">
                  <p className="text-sm font-semibold flex items-center gap-2"><CircleDot className="h-3 w-3 text-indigo-400" />{i.t}</p>
                  <p className="text-xs text-white/45 pl-5 leading-relaxed">{i.d}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* ═══ PAYIN ═══ */}
          <Divider label="POST /payin — Encaisser un paiement" icon={ArrowDownToLine} color="text-blue-400" />

          <Section id="payin">
            <p className="text-white/55 text-sm leading-relaxed">
              Initie un encaissement depuis le téléphone du client vers votre wallet YookPay. Le client reçoit une notification USSD/SMS pour confirmer sur son téléphone.
            </p>

            {/* Flux */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-white/25 mb-4">Flux de la transaction</p>
              {[
                { n: "1", from: "Votre serveur",     arrow: "→", to: "YookPay API",      detail: "POST /payin — clé validée, statut PENDING retourné immédiatement" },
                { n: "2", from: "YookPay API",       arrow: "→", to: "Opérateur MoMo",  detail: "Requête de paiement transmise au réseau Mobile Money" },
                { n: "3", from: "Opérateur MoMo",    arrow: "→", to: "Téléphone client", detail: "Notification USSD ou SMS envoyée au client" },
                { n: "4", from: "Client",            arrow: "→", to: "Téléphone",       detail: "Le client confirme le paiement sur son téléphone" },
                { n: "5", from: "Opérateur (IPN)",   arrow: "→", to: "YookPay API",    detail: "Confirmation reçue → status → SUCCESS, wallet crédité" },
              ].map(s => (
                <div key={s.n} className="flex items-start gap-3 text-sm">
                  <div className="h-5 w-5 rounded bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-300 text-[11px] font-bold shrink-0 mt-0.5">{s.n}</div>
                  <div className="flex flex-wrap items-baseline gap-1.5 min-w-0">
                    <span className="font-semibold text-white/80 text-xs whitespace-nowrap">{s.from}</span>
                    <span className="text-indigo-400 text-xs">{s.arrow}</span>
                    <span className="font-semibold text-white/80 text-xs whitespace-nowrap">{s.to}</span>
                    <span className="text-white/35 text-xs leading-relaxed">— {s.detail}</span>
                  </div>
                </div>
              ))}
            </div>

            <Callout type="info">
              La réponse est <strong>immédiate</strong> avec <IC>status: "PENDING"</IC>. La confirmation est asynchrone : en général 30 s à 2 min selon le pays et l'opérateur.
            </Callout>

            <EndpointHeader method="POST" path="payin" title="Initier un encaissement Mobile Money depuis votre marchand" color="blue" />

            <SubHeading id="payin-params" label="Paramètres de la requête (Body JSON)" />
            <ParamTable rows={[
              { name: "country",  type: "string",  req: true,  desc: "Code pays ISO-3166 en 2 lettres MAJUSCULES.",                                        ex: "CM" },
              { name: "operator", type: "string",  req: true,  desc: "Opérateur Mobile Money en MAJUSCULES. Voir tableau Pays & Opérateurs.",               ex: "MTN" },
              { name: "phone",    type: "string",  req: true,  desc: "Numéro du payeur avec indicatif pays, sans le +. Min 6 chiffres, max 20.",             ex: "237687194830" },
              { name: "amount",   type: "integer", req: true,  desc: "Montant entier en devise locale. Pas de décimales.",                                   ex: "5000" },
              { name: "metadata", type: "object",  req: false, desc: "Objet JSON libre pour vos références internes. Renvoyé dans les réponses.",            ex: '{"orderId":"CMD-42"}' },
            ]} />

            <SubHeading id="payin-response" label="Réponse de succès" />
            <ReqRes
              request={<CodeBlock lang="json" title="Corps envoyé" code={PAYIN_BODY} />}
              response={<CodeBlock lang="json" title="Réponse reçue" code={PAYIN_RESP} />}
            />
            <RespTable rows={[
              { name: "reference",         type: "string",  desc: "Référence unique YookPay (ex: YPY-M9X1A2-K7TQ). Stockez-la en base de données pour le suivi." },
              { name: "providerReference", type: "string",  desc: "Référence opérateur. Transmettez-la au support en cas de litige." },
              { name: "status",            type: "string",  desc: 'Toujours "PENDING" à la réponse initiale. Évolue en SUCCESS ou FAILED de manière asynchrone.' },
              { name: "amount",            type: "integer", desc: "Montant brut envoyé (= votre champ amount)." },
              { name: "netAmount",         type: "integer", desc: "Montant crédité dans votre wallet après frais. netAmount = amount − feeAmount." },
              { name: "feeAmount",         type: "integer", desc: "Frais prélevés sur cette transaction (selon votre configuration)." },
              { name: "feeRate",           type: "number",  desc: "Taux de frais appliqué, en proportion décimale." },
              { name: "currency",          type: "string",  desc: "Devise déduite du pays : XAF (CM/CG/GA), XOF (autres), CDF (CD)." },
              { name: "transactionId",     type: "integer", desc: "Identifiant interne YookPay de la transaction." },
            ]} />

            <SubHeading id="payin-code" label="Exemples de code" />
            <LangTabs
              tabs={[{ id: "curl", label: "cURL" }, { id: "node", label: "Node.js" }, { id: "python", label: "Python" }, { id: "php", label: "PHP" }]}
              active={payinLang} onChange={setPayinLang}
            />
            <CodeBlock lang={payinLang} title={payinLang === "curl" ? "cURL" : payinLang === "node" ? "Node.js / JS" : payinLang === "python" ? "Python" : "PHP"} code={payinCode[payinLang]!} />
          </Section>

          {/* ═══ PAYOUT ═══ */}
          <Divider label="POST /payout — Distribuer de l'argent" icon={ArrowUpFromLine} color="text-purple-400" />

          <Section id="payout">
            <p className="text-white/55 text-sm leading-relaxed">
              Envoie de l'argent depuis votre wallet YookPay vers un numéro Mobile Money. Utilisé pour : remboursements, salaires, commissions, cashback, transferts.
            </p>

            {/* Flux */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-white/25 mb-4">Flux de la transaction</p>
              {[
                { n: "1", from: "Votre serveur",      to: "YookPay API",   detail: "POST /payout — clé validée, solde vérifié, wallet débité, status: PENDING retourné" },
                { n: "2", from: "YookPay API",      to: "Opérateur MoMo", detail: "Ordre de virement transmis au réseau Mobile Money" },
                { n: "3", from: "Opérateur MoMo",   to: "Destinataire",  detail: "L'argent arrive sur le compte Mobile Money du destinataire" },
                { n: "4", from: "Opérateur (IPN)",  to: "YookPay API",   detail: "Confirmation reçue → status → SUCCESS" },
              ].map(s => (
                <div key={s.n} className="flex items-start gap-3 text-sm">
                  <div className="h-5 w-5 rounded bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 text-[11px] font-bold shrink-0 mt-0.5">{s.n}</div>
                  <div className="flex flex-wrap items-baseline gap-1.5 min-w-0">
                    <span className="font-semibold text-white/80 text-xs whitespace-nowrap">{s.from}</span>
                    <span className="text-purple-400 text-xs">→</span>
                    <span className="font-semibold text-white/80 text-xs whitespace-nowrap">{s.to}</span>
                    <span className="text-white/35 text-xs leading-relaxed">— {s.detail}</span>
                  </div>
                </div>
              ))}
            </div>

            <Callout type="warn">
              Le wallet est débité <strong>immédiatement</strong>. En cas de FAILED ou EXPIRED, le montant est automatiquement remboursé par le système d'expiration.
            </Callout>

            {/* feeBearer */}
            <SubHeading id="payout-fearbearer" label="feeBearer — Qui paie les frais ?" />
            <p className="text-white/50 text-sm leading-relaxed mb-4">
              Le champ <IC>feeBearer</IC> détermine si c'est vous (SENDER) ou le destinataire (RECIPIENT) qui supporte les frais configurés sur votre compte.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <code className="font-mono font-bold text-purple-300">"SENDER"</code>
                  <span className="text-[11px] text-white/30 border border-white/10 px-2 py-0.5 rounded">défaut</span>
                </div>
                <p className="text-xs text-white/50 leading-relaxed">Vous payez les frais <em>en plus</em>. Le destinataire reçoit exactement le montant demandé.</p>
                <div className="rounded-lg bg-black/30 border border-white/10 p-3 font-mono text-xs space-y-1.5">
                  <div className="flex justify-between text-white/50"><span>Votre wallet débité</span><span className="text-red-400">amount + frais</span></div>
                  <div className="flex justify-between text-white/40 text-[11px]"><span>dont frais</span><span>feeAmount</span></div>
                  <div className="flex justify-between border-t border-white/10 pt-2 mt-1 font-bold"><span className="text-white/70">Téléphone reçoit</span><span className="text-green-400">amount ✓</span></div>
                </div>
                <p className="text-[11px] text-white/30">Usage : salaires, remboursements (montant exact garanti au destinataire)</p>
              </div>
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-5 space-y-3">
                <code className="font-mono font-bold text-indigo-300">"RECIPIENT"</code>
                <p className="text-xs text-white/50 leading-relaxed">Les frais sont déduits du montant reçu. Votre wallet est débité exactement du montant saisi.</p>
                <div className="rounded-lg bg-black/30 border border-white/10 p-3 font-mono text-xs space-y-1.5">
                  <div className="flex justify-between text-white/50"><span>Votre wallet débité</span><span className="text-red-400">amount</span></div>
                  <div className="flex justify-between text-white/40 text-[11px]"><span>frais déduits du reçu</span><span>feeAmount</span></div>
                  <div className="flex justify-between border-t border-white/10 pt-2 mt-1 font-bold"><span className="text-white/70">Téléphone reçoit</span><span className="text-yellow-400">amount − frais</span></div>
                </div>
                <p className="text-[11px] text-white/30">Usage : cashback, bonus (votre coût est fixe, connu à l'avance)</p>
              </div>
            </div>

            <EndpointHeader method="POST" path="payout" title="Envoyer de l'argent vers un numéro Mobile Money" color="purple" />

            <SubHeading id="payout-params" label="Paramètres de la requête (Body JSON)" />
            <ParamTable rows={[
              { name: "country",   type: "string",  req: true,  desc: "Code pays ISO-3166 en 2 lettres MAJUSCULES.",                                        ex: "CM" },
              { name: "operator",  type: "string",  req: true,  desc: "Opérateur Mobile Money en MAJUSCULES.",                                              ex: "MTN" },
              { name: "phone",     type: "string",  req: true,  desc: "Numéro du destinataire avec indicatif pays, sans le +.",                             ex: "237687194830" },
              { name: "amount",    type: "integer", req: true,  desc: "Montant entier à envoyer en devise locale.",                                          ex: "5000" },
              { name: "feeBearer", type: "string",  req: false, desc: '"SENDER" (défaut) : vous payez les frais. "RECIPIENT" : frais déduits du montant reçu.', ex: "SENDER" },
              { name: "metadata",  type: "object",  req: false, desc: "Objet JSON libre pour vos références internes.",                                      ex: '{"userId":99}' },
            ]} />

            <SubHeading id="payout-response" label="Réponse de succès" />
            <ReqRes
              request={<CodeBlock lang="json" title="Corps envoyé" code={PAYOUT_BODY} />}
              response={<CodeBlock lang="json" title="Réponse reçue" code={PAYOUT_RESP} />}
            />
            <RespTable rows={[
              { name: "reference",         type: "string",  desc: "Référence unique YookPay. Stockez-la pour le suivi." },
              { name: "providerReference", type: "string",  desc: "Référence opérateur. Utile pour le support." },
              { name: "status",            type: "string",  desc: 'Toujours "PENDING" à la réponse. Évolue en SUCCESS ou FAILED.' },
              { name: "amount",            type: "integer", desc: "Total débité de votre wallet. Inclut les frais si feeBearer = SENDER." },
              { name: "phoneReceives",     type: "integer", desc: "Ce que le destinataire reçoit effectivement sur son téléphone." },
              { name: "feeAmount",         type: "integer", desc: "Frais prélevés sur cette transaction (selon votre configuration)." },
              { name: "feeRate",           type: "number",  desc: "Taux de frais appliqué, en proportion décimale." },
              { name: "currency",          type: "string",  desc: "Devise de la transaction." },
              { name: "transactionId",     type: "integer", desc: "Identifiant interne YookPay." },
            ]} />

            <SubHeading id="payout-code" label="Exemples de code" />
            <LangTabs
              tabs={[{ id: "curl", label: "cURL" }, { id: "node", label: "Node.js" }]}
              active={payoutLang} onChange={setPayoutLang}
            />
            <CodeBlock lang={payoutLang} title={payoutLang === "curl" ? "cURL" : "Node.js / JS"} code={payoutCode[payoutLang]!} />
          </Section>

          {/* ═══ STATUSES ═══ */}
          <Section id="statuses">
            <SectionHeading icon={Clock} label="Statuts de transaction" color="text-cyan-400" />
            <p className="text-white/50 text-sm">Cycle de vie d'une transaction YookPay :</p>
            <div className="space-y-3">
              {[
                { s: "PENDING",  c: "text-yellow-400 border-yellow-500/25 bg-yellow-500/5",  desc: "État initial retourné immédiatement par l'API. La transaction est en cours de traitement chez l'opérateur. Le client n'a pas encore confirmé (payin) ou l'argent n'a pas encore été envoyé (payout)." },
                { s: "SUCCESS",  c: "text-green-400 border-green-500/25 bg-green-500/5",     desc: "Paiement confirmé par l'opérateur via IPN. Payin : votre wallet est crédité du netAmount. Payout : le destinataire a bien reçu l'argent sur son téléphone." },
                { s: "FAILED",   c: "text-red-400 border-red-500/25 bg-red-500/5",           desc: "La transaction a échoué : refus du client, solde insuffisant côté Mobile Money, numéro invalide, timeout opérateur. Payout : votre wallet est automatiquement remboursé du montant débité." },
                { s: "EXPIRED",  c: "text-white/40 border-white/10 bg-white/[0.02]",         desc: "Aucune confirmation reçue dans le délai imparti (8 minutes). Traité comme un FAILED. Payout : remboursement automatique." },
              ].map(row => (
                <div key={row.s} className={`flex gap-4 rounded-xl border p-4 ${row.c}`}>
                  <code className="font-mono font-bold text-sm w-20 shrink-0 mt-0.5">{row.s}</code>
                  <p className="text-xs text-white/55 leading-relaxed">{row.desc}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* ═══ ERRORS ═══ */}
          <Section id="errors">
            <SectionHeading icon={AlertTriangle} label="Codes d'erreur" color="text-red-400" />
            <p className="text-white/50 text-sm">Toutes les erreurs retournent ce format JSON :</p>
            <CodeBlock lang="json" title="Format d'erreur" code={ERROR_BODY} />
            <div className="rounded-lg border border-white/10 overflow-hidden overflow-x-auto">
              <table className="w-full text-xs min-w-[560px]">
                <thead className="bg-white/[0.04] border-b border-white/10">
                  <tr>
                    {["HTTP", "error", "Cause", "Solution"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-white/40 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["401", "Unauthorized",      "En-tête x-api-key absent",                        "Ajoutez l'en-tête x-api-key dans chaque requête."],
                    ["401", "Unauthorized",      "Clé invalide, révoquée ou inactive",               "Vérifiez la clé. Régénérez si nécessaire dans le tableau de bord."],
                    ["401", "Unauthorized",      "Mauvais type de clé (payin vs payout)",            "Utilisez YKP_IN_… pour /payin et YKP_OUT_… pour /payout."],
                    ["400", "ValidationError",   "Champ manquant ou mauvais type",                   "Vérifiez que tous les champs requis sont présents. amount doit être un entier."],
                    ["400", "ValidationError",   "Pays ou opérateur non supporté",                   "Vérifiez les valeurs exactes dans le tableau Pays & Opérateurs."],
                    ["400", "InsufficientFunds", "Solde wallet insuffisant (payout)",                 "Rechargez votre wallet YookPay avant de relancer."],
                    ["400", "WalletNotFound",    "Wallet dans cette devise introuvable",             "Contactez le support pour ouvrir un wallet dans la devise souhaitée."],
                    ["500", "PayinFailed",       "Erreur opérateur ou clé API non configurée",       "Vérifiez la configuration de votre compte. Contactez le support si persistant."],
                    ["500", "PayoutFailed",      "Erreur opérateur lors de l'envoi",                 "Le wallet sera remboursé automatiquement. Réessayez après quelques minutes."],
                  ].map(([code, err, cause, sol]) => (
                    <tr key={err + cause} className="border-b border-white/5 hover:bg-white/[0.015] align-top">
                      <td className="px-4 py-3 font-mono text-red-400 font-bold whitespace-nowrap">{code}</td>
                      <td className="px-4 py-3 font-mono text-yellow-300 whitespace-nowrap text-[11px]">{err}</td>
                      <td className="px-4 py-3 text-white/45 leading-relaxed">{cause}</td>
                      <td className="px-4 py-3 text-white/55 leading-relaxed">{sol}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* ═══ COUNTRIES ═══ */}
          <Section id="countries">
            <SectionHeading icon={Globe} label="Pays & Opérateurs supportés" color="text-emerald-400" />
            <p className="text-white/50 text-sm leading-relaxed">
              Utilisez exactement les valeurs <IC>country</IC> et <IC>operator</IC> indiquées ci-dessous.
            </p>

            {/* XAF */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-amber-500/20" />
                <span className="text-xs font-bold uppercase tracking-widest text-amber-400 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">Zone XAF — Franc CFA (BEAC)</span>
                <div className="h-px flex-1 bg-amber-500/20" />
              </div>
              <div className="rounded-lg border border-white/10 overflow-hidden overflow-x-auto">
                <table className="w-full text-xs min-w-[520px]">
                  <thead className="bg-white/[0.04] border-b border-white/10">
                    <tr>{["Pays", "country", "Indicatif", "Opérateurs (operator)"].map(h => <th key={h} className="text-left px-4 py-2.5 text-white/40 font-semibold">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {xafCountries.map(c => (
                      <tr key={c.code} className="border-b border-white/5 hover:bg-white/[0.015]">
                        <td className="px-4 py-3 whitespace-nowrap">{c.flag} {c.name}</td>
                        <td className="px-4 py-3"><code className="font-mono font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded">{c.code}</code></td>
                        <td className="px-4 py-3 text-white/40 font-mono">{c.dial}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {c.operators.map(op => <span key={op} className="font-mono text-[11px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-white/60">{op}</span>)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* XOF */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-emerald-500/20" />
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">Zone XOF — Franc CFA (BCEAO) & assimilés</span>
                <div className="h-px flex-1 bg-emerald-500/20" />
              </div>
              <Callout type="info">
                La Gambie (GMD) et la Guinée-Conakry (GNF) utilisent des devises nationales différentes du XOF, mais leur <IC>currency</IC> retourné par l'API est <IC>"XOF"</IC> car leurs transactions sont traitées dans la même zone.
              </Callout>
              <div className="rounded-lg border border-white/10 overflow-hidden overflow-x-auto">
                <table className="w-full text-xs min-w-[520px]">
                  <thead className="bg-white/[0.04] border-b border-white/10">
                    <tr>{["Pays", "country", "Indicatif", "Opérateurs (operator)"].map(h => <th key={h} className="text-left px-4 py-2.5 text-white/40 font-semibold">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {xofCountries.map(c => (
                      <tr key={c.code} className="border-b border-white/5 hover:bg-white/[0.015]">
                        <td className="px-4 py-3 whitespace-nowrap">{c.flag} {c.name}</td>
                        <td className="px-4 py-3"><code className="font-mono font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded">{c.code}</code></td>
                        <td className="px-4 py-3 text-white/40 font-mono">{c.dial}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {c.operators.map(op => <span key={op} className="font-mono text-[11px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-white/60">{op}</span>)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* CDF */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-orange-500/20" />
                <span className="text-xs font-bold uppercase tracking-widest text-orange-400 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20">Zone CDF — Franc congolais (Congo RDC)</span>
                <div className="h-px flex-1 bg-orange-500/20" />
              </div>
              <div className="rounded-lg border border-white/10 overflow-hidden overflow-x-auto">
                <table className="w-full text-xs min-w-[520px]">
                  <thead className="bg-white/[0.04] border-b border-white/10">
                    <tr>{["Pays", "country", "Indicatif", "Opérateurs (operator)"].map(h => <th key={h} className="text-left px-4 py-2.5 text-white/40 font-semibold">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {cdfCountries.map(c => (
                      <tr key={c.code} className="border-b border-white/5 hover:bg-white/[0.015]">
                        <td className="px-4 py-3 whitespace-nowrap">{c.flag} {c.name}</td>
                        <td className="px-4 py-3"><code className="font-mono font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded">{c.code}</code></td>
                        <td className="px-4 py-3 text-white/40 font-mono">{c.dial}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {c.operators.map(op => <span key={op} className="font-mono text-[11px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-white/60">{op}</span>)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>

          {/* ═══ SECURITY ═══ */}
          <Section id="security">
            <SectionHeading icon={Shield} label="Bonnes pratiques de sécurité" color="text-blue-400" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { title: "Variables d'environnement",       desc: "process.env.YOOKPAY_PAYIN_KEY en Node, os.environ en Python, getenv() en PHP. Jamais en dur dans le code." },
                { title: "Jamais côté client",              desc: "Une clé dans du JS frontend, une app mobile ou un repo public peut être extraite et utilisée pour vider votre wallet." },
                { title: "Révoquer en cas de fuite",        desc: "Tableau de bord → Clés API → Révoquer. Puis générez une nouvelle clé. N'attendez pas." },
                { title: "Stocker la référence",            desc: "La référence YPY-… est l'unique identifiant d'une transaction. Persistez-la en base dès réception de la réponse." },
                { title: "Retry avec vérification",         desc: "Avant de retenter, vérifiez via le dashboard si la transaction n'a pas déjà été créée pour éviter les doublons." },
                { title: "Validation côté serveur",         desc: "Validez toujours le pays, l'opérateur et le téléphone depuis votre propre liste avant d'appeler l'API." },
              ].map(i => (
                <div key={i.title} className="flex gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-4">
                  <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">{i.title}</p>
                    <p className="text-xs text-white/45 mt-1 leading-relaxed">{i.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* ═══ FAQ ═══ */}
          <Section id="faq">
            <SectionHeading icon={HelpCircle} label="Questions fréquentes" color="text-pink-400" />
            <div className="space-y-2">
              {[
                {
                  q: "Pourquoi status est PENDING et non SUCCESS immédiatement ?",
                  a: "La confirmation est asynchrone : le client valide sur son téléphone, puis l'opérateur renvoie la confirmation à YookPay. En général 30 secondes à 2 minutes selon l'opérateur et le pays.",
                },
                {
                  q: "Comment savoir si un paiement a finalement réussi ou échoué ?",
                  a: "Consultez Tableau de bord → Transactions et filtrez par référence (YPY-…). Un système de webhooks en temps réel est en cours de développement pour notifier votre serveur automatiquement.",
                },
                {
                  q: "Que se passe-t-il si une transaction PAYOUT échoue après que le wallet a été débité ?",
                  a: "Le wallet est remboursé automatiquement. Le système d'expiration (8 minutes) ou le callback FAILED déclenchent le remboursement. Vous n'avez rien à faire.",
                },
                {
                  q: "Puis-je envoyer vers n'importe quel numéro ?",
                  a: "Le numéro doit être actif sur l'opérateur indiqué dans le même pays. Un numéro inactif, suspendu ou appartenant à un autre opérateur entraînera un FAILED côté opérateur.",
                },
                {
                  q: "Quelle devise utiliser pour le montant ?",
                  a: "La devise est déduite automatiquement du pays — CM/CG/GA → XAF, autres pays → XOF, CD → CDF. Saisissez simplement le montant en unité locale (ex : 5000 pour 5 000 XAF). Pas de centimes.",
                },
                {
                  q: "Existe-t-il un environnement sandbox pour tester ?",
                  a: "L'API opère actuellement en mode production. Contactez le support YookPay pour discuter d'un accès sandbox dédié aux tests.",
                },
                {
                  q: "Puis-je avoir une clé Payin et une clé Payout en même temps ?",
                  a: "Oui. Les deux clés sont indépendantes. Vous pouvez en avoir une de chaque type active simultanément sur votre compte.",
                },
                {
                  q: "Que signifie le champ metadata et comment l'utiliser ?",
                  a: "C'est un objet JSON libre que vous associez à la transaction pour vos références internes (id commande, id utilisateur, etc.). Il est stocké et renvoyé dans la réponse. Il n'est pas utilisé par YookPay lui-même.",
                },
              ].map((item, i) => (
                <details key={i} className="rounded-lg border border-white/10 bg-white/[0.02] group">
                  <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none">
                    <span className="text-sm font-medium text-white/75">{item.q}</span>
                    <ChevronRight className="h-4 w-4 text-white/25 shrink-0 group-open:rotate-90 transition-transform" />
                  </summary>
                  <div className="px-5 pb-5 text-sm text-white/50 leading-relaxed border-t border-white/5 pt-4">
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </Section>

          {/* ═══ CTA ═══ */}
          <div className="rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent p-8 text-center space-y-4">
            <h3 className="text-2xl font-extrabold">Prêt à intégrer YookPay ?</h3>
            <p className="text-white/50 text-sm max-w-md mx-auto leading-relaxed">
              Créez votre compte, validez votre KYB, et lancez votre premier paiement Mobile Money en Afrique en moins d'une heure.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Link href="/register">
                <Button className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2 h-10 px-5">
                  Créer un compte gratuit <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" className="border-white/20 text-white/70 hover:bg-white/5 hover:text-white h-10 px-5">
                  Se connecter
                </Button>
              </Link>
            </div>
          </div>

        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/8 mt-10 py-6 text-center text-xs text-white/25">
        © {new Date().getFullYear()} YookPay · API Documentation v1 ·{" "}
        <Link href="/" className="hover:text-white/50 transition-colors">Accueil</Link>
      </footer>
    </div>
  );
}
