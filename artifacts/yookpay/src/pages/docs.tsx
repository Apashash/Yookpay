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
  Smartphone, Link2, Bell, ExternalLink, RefreshCw, Search,
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
   CODE SAMPLES
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
  "flow":              "STANDARD",           // STANDARD | OTP | WAVE | QMONEY
  "smsLink":           null,                 // URL Wave si flow="WAVE", sinon null
  "amount":            5000,
  "netAmount":         4925,
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

const TX_GET_RESP = `// HTTP 200 OK
{
  "success":           true,
  "id":                412,
  "reference":         "YPY-M9X1A2-K7TQ",
  "providerReference": "TXN-20240516-001",
  "status":            "SUCCESS",           // PENDING | SUCCESS | FAILED | EXPIRED
  "type":              "DEPOSIT",           // DEPOSIT | WITHDRAWAL
  "amount":            5000,
  "netAmount":         4925,
  "feeAmount":         75,
  "feeRate":           0.015,
  "currency":          "XAF",
  "country":           "CM",
  "operator":          "MTN",
  "phone":             "237687194830",
  "metadata":          { "orderId": "CMD-42" },
  "createdAt":         "2024-05-16T10:23:00.000Z",
  "updatedAt":         "2024-05-16T10:23:47.000Z"
}`;

const TX_GET_404 = `// HTTP 404 — référence inconnue ou appartenant à un autre compte
{
  "error":   "NotFound",
  "message": "Transaction YPY-XXXXXX-XXXX introuvable ou n'appartient pas à ce compte."
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

const PAYIN_BODY_OTP = `// Orange Money (CM, CI, SN, BF, BJ, ML, TG…)
// Le client compose *#144*82# sur son téléphone, puis vous transmet le code
{
  "country":  "CM",
  "operator": "ORANGE",
  "phone":    "237699123456",
  "amount":   5000,
  "omOtp":    "123456",
  "metadata": { "orderId": "CMD-42" }
}`;

const PAYIN_BODY_WAVE = `// Wave (Côte d'Ivoire ou Sénégal)
// Pas de omOtp — l'API retourne un smsLink à ouvrir dans l'app Wave
{
  "country":  "CI",
  "operator": "WAVE",
  "phone":    "2250701234567",
  "amount":   5000,
  "metadata": { "orderId": "CMD-42" }
}`;

const PAYIN_RESP_WAVE = `// HTTP 201 Created — présence de flow + smsLink
{
  "success":           true,
  "reference":         "YPY-W4A2B1-K9PQ",
  "providerReference": "PIX-00123456",
  "status":            "PENDING",
  "flow":              "WAVE",
  "smsLink":           "https://wave.com/pay/xxxxxxxxxxxxxxxx",
  "amount":            5000,
  "netAmount":         4925,
  "feeAmount":         75,
  "currency":          "XOF",
  "transactionId":     415
}`;

const PAYIN_RESP_STANDARD = `// HTTP 201 Created — MTN, AIRTEL, MOOV… (USSD push)
{
  "success":           true,
  "reference":         "YPY-M9X1A2-K7TQ",
  "providerReference": "PIX-00109876",
  "status":            "PENDING",
  "flow":              "STANDARD",
  "smsLink":           null,
  "amount":            5000,
  "netAmount":         4925,
  "feeAmount":         75,
  "currency":          "XAF",
  "transactionId":     412
}`;

const NODE_PAYIN_OTP = `// Étape 1 : demandez le code OTP à votre client
// (ex: dans un formulaire ou par saisie dans votre app)
const userOtp = "123456"; // saisi par l'utilisateur

// Étape 2 : appelez l'API avec omOtp
const res = await fetch("${BASE}/api/merchant/v1/payin", {
  method: "POST",
  headers: {
    "x-api-key":    process.env.YOOKPAY_PAYIN_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    country: "CM", operator: "ORANGE",
    phone: "237699123456", amount: 5000,
    omOtp: userOtp,                // ← obligatoire pour Orange
    metadata: { orderId: "CMD-42" },
  }),
});
const { reference, flow } = await res.json();
console.log(reference, flow); // "YPY-…", "OTP"`;

const NODE_PAYIN_WAVE = `const res = await fetch("${BASE}/api/merchant/v1/payin", {
  method: "POST",
  headers: {
    "x-api-key":    process.env.YOOKPAY_PAYIN_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    country: "CI", operator: "WAVE",
    phone: "2250701234567", amount: 5000,
  }),
});
const { reference, flow, smsLink } = await res.json();

if (flow === "WAVE" && smsLink) {
  // Redirigez l'utilisateur ou affichez le lien
  // Ex. React Native: Linking.openURL(smsLink)
  // Ex. Web: window.location.href = smsLink
  console.log("Redirect to:", smsLink);
}`;

const PL_PAY_BODY = `// POST /api/payment-links/public/{token}/pay
// Appelé depuis la page de paiement par le client final
{
  "amount":    5000,
  "country":   "CM",
  "operator":  "MTN",
  "phone":     "237687194830",
  "feeBearer": "RECIPIENT"
}

// Pour Orange Money, ajoutez le code OTP :
{
  "amount":    5000,
  "country":   "CM",
  "operator":  "ORANGE",
  "phone":     "237699123456",
  "omOtp":     "123456",
  "feeBearer": "RECIPIENT"
}`;

const PL_PAY_RESP = `// HTTP 201 Created
{
  "transaction": {
    "id":       412,
    "amount":   5000,
    "currency": "XAF",
    "status":   "PENDING"
  },
  "flow":    "STANDARD",   // STANDARD | OTP | WAVE | QMONEY
  "smsLink": null,         // URL Wave si flow = "WAVE", sinon null
  "pending": true,
  "message": "Votre paiement est en cours de traitement."
}`;

const PL_POLL_RESP = `// GET /api/payment-links/public/tx/{transactionId}
// Appelez toutes les 5 secondes jusqu'à status ≠ PENDING
{
  "status":   "SUCCESS",   // PENDING | SUCCESS | FAILED | EXPIRED
  "amount":   5000,
  "currency": "XAF"
}`;

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
            <NavItem href="#tx-get" label="GET /transaction/{ref}" />
            <NavItem href="#tx-get-resp" label="Réponse" indent />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/20 mb-2">Flows & Liens</p>
            <NavItem href="#flows" label="Flows de paiement" />
            <NavItem href="#flows-standard" label="USSD Standard" indent />
            <NavItem href="#flows-otp" label="OTP Orange Money" indent />
            <NavItem href="#flows-wave" label="Wave Redirect" indent />
            <NavItem href="#payment-links" label="Liens de paiement" />
            <NavItem href="#pl-pay" label="Endpoint public" indent />
            <NavItem href="#pl-poll" label="Polling statut" indent />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/20 mb-2">Référence</p>
            <NavItem href="#notifications" label="Notifications IPN" />
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
              { name: "country",  type: "string",  req: true,  desc: "Code pays ISO-3166 en 2 lettres MAJUSCULES.",                                                                                                  ex: "CM" },
              { name: "operator", type: "string",  req: true,  desc: "Opérateur Mobile Money en MAJUSCULES. Voir tableau Pays & Opérateurs.",                                                                        ex: "MTN" },
              { name: "phone",    type: "string",  req: true,  desc: "Numéro du payeur avec indicatif pays, sans le +. Min 6 chiffres, max 20.",                                                                     ex: "237687194830" },
              { name: "amount",   type: "integer", req: true,  desc: "Montant entier en devise locale. Pas de décimales.",                                                                                            ex: "5000" },
              { name: "omOtp",   type: "string",  req: false, desc: "Code OTP Orange Money à 6 chiffres. Requis uniquement si operator = \"ORANGE\". Le client le génère en composant *#144*82# sur son téléphone.", ex: "123456" },
              { name: "metadata", type: "object",  req: false, desc: "Objet JSON libre pour vos références internes. Renvoyé dans les réponses.",                                                                     ex: '{"orderId":"CMD-42"}' },
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
              { name: "flow",              type: "string",  desc: 'Type d\'interaction déclenchée : "STANDARD" (USSD push), "OTP" (Orange Money), "WAVE" (redirection app), "QMONEY" (Gambie).' },
              { name: "smsLink",          type: "string?", desc: 'URL de paiement Wave. Présent uniquement si flow = "WAVE". Redirigez le client vers cette URL pour qu\'il approuve dans l\'app Wave.' },
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

          {/* ═══ GET TRANSACTION ═══ */}
          <Section id="tx-get">
            <SectionHeading icon={Search} label="Vérifier une transaction" color="text-violet-400" />
            <p className="text-white/55 text-sm leading-relaxed">
              Consultez le statut et les détails de n'importe quelle transaction par sa référence YPY-…, directement depuis votre serveur. Fonctionne avec une clé payin <strong className="text-white/70">ou</strong> payout.
            </p>

            <EndpointHeader method="GET" path="transaction/{reference}" title="Récupérer les détails et le statut d'une transaction par sa référence YPY-…" color="purple" />

            <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 flex flex-wrap gap-6 text-sm">
              {[
                { label: "Authentification", value: "x-api-key (payin ou payout)", mono: false },
                { label: "Méthode",          value: "GET",                         mono: true  },
                { label: "Paramètre URL",    value: "{reference} = YPY-XXXXXX-XXXX", mono: true },
              ].map(i => (
                <div key={i.label}>
                  <p className="text-[11px] uppercase tracking-widest text-white/25 mb-1">{i.label}</p>
                  {i.mono
                    ? <code className="font-mono text-violet-300 text-xs">{i.value}</code>
                    : <p className="text-white/60 text-xs">{i.value}</p>
                  }
                </div>
              ))}
            </div>

            <SubHeading id="tx-get-resp" label="Réponse" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CodeBlock lang="json" title="200 OK — transaction trouvée" code={TX_GET_RESP} />
              <CodeBlock lang="json" title="404 Not Found — inconnue ou autre compte" code={TX_GET_404} />
            </div>

            <RespTable rows={[
              { name: "reference",         type: "string",   desc: "Référence YookPay (YPY-…)." },
              { name: "providerReference", type: "string?",  desc: "Référence opérateur (null si pas encore transmise)." },
              { name: "status",            type: "string",   desc: "PENDING · SUCCESS · FAILED · EXPIRED" },
              { name: "type",              type: "string",   desc: "DEPOSIT (payin) ou WITHDRAWAL (payout)." },
              { name: "amount",            type: "number",   desc: "Montant brut de la transaction." },
              { name: "netAmount",         type: "number",   desc: "Montant net après frais." },
              { name: "feeAmount",         type: "number",   desc: "Frais prélevés." },
              { name: "feeRate",           type: "number",   desc: "Taux de frais appliqué." },
              { name: "currency",          type: "string",   desc: "Devise : XAF, XOF ou CDF." },
              { name: "country",           type: "string",   desc: "Code pays (CM, SN, CI…)." },
              { name: "operator",          type: "string",   desc: "Opérateur Mobile Money." },
              { name: "phone",             type: "string",   desc: "Numéro de téléphone du client." },
              { name: "metadata",          type: "object?",  desc: "Données personnalisées passées à la création (orderId, userId…)." },
              { name: "createdAt",         type: "datetime", desc: "Horodatage de création (ISO 8601 UTC)." },
              { name: "updatedAt",         type: "datetime", desc: "Horodatage de dernière mise à jour (passe à SUCCESS/FAILED via IPN)." },
            ]} />

            <SubHeading id="tx-get-code" label="Exemples de code" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CodeBlock lang="bash" title="cURL" code={`curl -X GET ${BASE}/api/merchant/v1/transaction/YPY-M9X1A2-K7TQ \\
  -H "x-api-key: YKP_IN_votre_cle"`} />
              <CodeBlock lang="js" title="Node.js / Browser" code={`const ref = "YPY-M9X1A2-K7TQ";
const res = await fetch(
  \`${BASE}/api/merchant/v1/transaction/\${ref}\`,
  { headers: { "x-api-key": process.env.YOOKPAY_API_KEY } }
);
const tx = await res.json();

if (tx.status === "SUCCESS") {
  console.log("Paiement confirmé — net reçu :", tx.netAmount, tx.currency);
} else if (tx.status === "PENDING") {
  console.log("En attente de confirmation opérateur…");
} else {
  console.log("Transaction échouée ou expirée :", tx.status);
}`} />
            </div>

            <Callout type="info">
              <strong>Cas d'usage principal :</strong> après avoir initié un payin ou payout et stocké la référence YPY-… en base de données, interrogez cet endpoint depuis votre backend pour vérifier le statut sans avoir à ouvrir le tableau de bord.
            </Callout>

            <Callout type="warn">
              <strong>Isolation par compte :</strong> une clé API ne peut accéder qu'aux transactions de son propre compte. Toute tentative d'accès à une référence appartenant à un autre marchand retourne HTTP 404 (jamais 403) pour ne pas révéler l'existence de la transaction.
            </Callout>
          </Section>

          {/* ═══ FLOWS ═══ */}
          <Divider label="Flows de paiement" icon={Smartphone} color="text-cyan-400" />

          <Section id="flows">
            <SectionHeading icon={Smartphone} label="Flows de paiement — Comment le client valide" color="text-cyan-400" />
            <p className="text-white/55 text-sm leading-relaxed">
              Chaque opérateur utilise un mécanisme différent pour que le client confirme le paiement. Le champ <IC>flow</IC> dans la réponse API indique lequel a été déclenché. Votre intégration doit gérer les 3 cas ci-dessous.
            </p>

            {/* Résumé flows */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: "STANDARD", ops: "MTN · AIRTEL · MOOV · TOGOCEL · AFRICELL · FREE…", color: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300", icon: "📳", desc: "Push USSD automatique sur le téléphone. Aucune action de votre côté." },
                { id: "OTP",      ops: "ORANGE (tous pays)",                                color: "border-orange-500/30 bg-orange-500/5 text-orange-300",  icon: "🔢", desc: "Le client génère un code OTP et vous le transmet. Vous le passez dans omOtp." },
                { id: "WAVE",     ops: "WAVE (CI · SN)",                                   color: "border-blue-500/30 bg-blue-500/5 text-blue-300",          icon: "🌊", desc: "L'API retourne un smsLink. Redirigez le client vers cette URL." },
              ].map(f => (
                <div key={f.id} className={`rounded-xl border p-4 space-y-2 ${f.color}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{f.icon}</span>
                    <code className="font-mono font-bold text-sm">{f.id}</code>
                  </div>
                  <p className="text-[11px] opacity-70 font-medium">{f.ops}</p>
                  <p className="text-xs opacity-60 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>

            {/* STANDARD */}
            <div id="flows-standard" className="scroll-mt-24 space-y-4 pt-4">
              <h3 className="text-base font-bold text-emerald-300 border-b border-emerald-500/20 pb-2">STANDARD — Push USSD (MTN, AIRTEL, MOOV…)</h3>
              <p className="text-white/50 text-sm leading-relaxed">
                C'est le flow le plus simple. L'opérateur envoie automatiquement une notification USSD sur le téléphone du client dès que vous appelez <IC>/payin</IC>. Le client voit un menu sur son écran et appuie sur <strong className="text-white/70">OK</strong> (ou tape son PIN) pour confirmer. Aucune étape supplémentaire de votre côté.
              </p>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-white/25 mb-3">Séquence STANDARD</p>
                {[
                  { n: "1", actor: "Votre serveur", to: "POST /payin (MTN, AIRTEL, MOOV…)", color: "bg-emerald-500/20 border-emerald-500/30 text-emerald-300" },
                  { n: "2", actor: "YookPay → Opérateur", to: "Requête d'encaissement transmise", color: "bg-emerald-500/20 border-emerald-500/30 text-emerald-300" },
                  { n: "3", actor: "Opérateur → Téléphone", to: "Notification USSD push (*# menu) envoyée au client", color: "bg-emerald-500/20 border-emerald-500/30 text-emerald-300" },
                  { n: "4", actor: "Client", to: "Appuie OK / entre son PIN → paiement confirmé", color: "bg-emerald-500/20 border-emerald-500/30 text-emerald-300" },
                  { n: "5", actor: "Opérateur → YookPay (IPN)", to: "status → SUCCESS · wallet crédité", color: "bg-green-500/20 border-green-500/30 text-green-300" },
                ].map(s => (
                  <div key={s.n} className="flex items-start gap-3 text-xs">
                    <div className={`h-5 w-5 rounded border flex items-center justify-center font-bold shrink-0 mt-0.5 ${s.color}`}>{s.n}</div>
                    <div><span className="font-semibold text-white/70">{s.actor}</span> <span className="text-white/35">— {s.to}</span></div>
                  </div>
                ))}
              </div>
              <ReqRes
                request={<CodeBlock lang="json" title="Requête STANDARD (MTN)" code={PAYIN_BODY} />}
                response={<CodeBlock lang="json" title="Réponse — flow: STANDARD" code={PAYIN_RESP_STANDARD} />}
              />
              <Callout type="ok">
                <strong>Aucune action requise</strong> après l'appel API. Le client reçoit la notification automatiquement. Votre wallet est crédité dès réception de la confirmation IPN (30 s à 2 min).
              </Callout>
            </div>

            {/* OTP */}
            <div id="flows-otp" className="scroll-mt-24 space-y-4 pt-6">
              <h3 className="text-base font-bold text-orange-300 border-b border-orange-500/20 pb-2">OTP — Orange Money (hors Cameroun)</h3>
              <p className="text-white/50 text-sm leading-relaxed">
                Dans la plupart des pays, Orange Money utilise un système OTP (One-Time Password) pour sécuriser les paiements. Le client génère un code à 6 chiffres en composant un code USSD sur son téléphone, puis vous transmet ce code. Vous l'incluez dans le champ <IC>omOtp</IC> de la requête.
              </p>

              <Callout type="info">
                <strong>Orange Money Cameroun (CM) n'utilise pas l'OTP.</strong> Pour <IC>operator = "ORANGE"</IC> et <IC>country = "CM"</IC>, le flux est automatiquement <IC>STANDARD</IC> (confirmation USSD push). Le champ <IC>omOtp</IC> n'est ni requis ni utilisé.
              </Callout>

              <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-5 space-y-4">
                <p className="text-xs font-bold uppercase tracking-widest text-white/25 mb-1">Intégration OTP — étapes côté marchand (hors CM)</p>
                {[
                  { n: "1", t: "Affichez un champ de saisie", d: 'Avant de lancer le paiement, montrez un message à l\'utilisateur : "Composez *#144*82# sur votre téléphone Orange pour obtenir votre code de paiement, puis saisissez-le ici."' },
                  { n: "2", t: "Le client compose et saisit le code", d: "Il compose *#144*82# (ou #144*82# selon le pays), reçoit un code à 6 chiffres par USSD, et l'entre dans votre formulaire." },
                  { n: "3", t: "Appelez /payin avec omOtp", d: 'Passez le code dans le champ "omOtp". Si omOtp est absent pour un opérateur ORANGE hors CM, l\'API retourne HTTP 400 OtpRequired.' },
                  { n: "4", t: "Confirmation asynchrone", d: "Comme pour STANDARD, le status passe à SUCCESS via IPN. Le code OTP est à usage unique — il expire en quelques minutes." },
                ].map(s => (
                  <div key={s.n} className="flex gap-3">
                    <div className="h-6 w-6 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-300 font-bold text-[11px] shrink-0 mt-0.5">{s.n}</div>
                    <div>
                      <p className="text-sm font-semibold text-white/80">{s.t}</p>
                      <p className="text-xs text-white/45 mt-0.5 leading-relaxed">{s.d}</p>
                    </div>
                  </div>
                ))}
              </div>

              <ReqRes
                request={<CodeBlock lang="json" title="Requête OTP (Orange Money — hors CM)" code={PAYIN_BODY_OTP} />}
                response={<CodeBlock lang="json" title="Code Node.js — flux OTP" code={NODE_PAYIN_OTP} />}
              />

              <Callout type="warn">
                <strong>Le code OTP expire rapidement</strong> (1 à 5 minutes selon l'opérateur). Votre formulaire doit permettre la saisie et l'envoi rapides. Ne stockez jamais le code OTP — il est à usage unique.
              </Callout>

              <div className="rounded-lg border border-white/10 overflow-hidden overflow-x-auto">
                <table className="w-full text-xs min-w-[400px]">
                  <thead className="bg-white/[0.04] border-b border-white/10">
                    <tr>{["Pays", "country", "Code USSD OTP"].map(h => <th key={h} className="text-left px-4 py-2.5 text-white/40 font-semibold">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {[
                      ["Côte d'Ivoire",  "CI", "*#144*82#"],
                      ["Sénégal",        "SN", "*#144*82#"],
                      ["Burkina Faso",   "BF", "*#144*82#"],
                      ["Bénin",          "BJ", "*#144*82#"],
                      ["Mali",           "ML", "*#144*82#"],
                      ["Togo",           "TG", "*#144*82#"],
                    ].map(([name, code, ussd]) => (
                      <tr key={code} className="border-b border-white/5 hover:bg-white/[0.015]">
                        <td className="px-4 py-3 text-white/60">{name}</td>
                        <td className="px-4 py-3"><code className="font-mono font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded">{code}</code></td>
                        <td className="px-4 py-3 font-mono text-orange-300 font-bold">{ussd}</td>
                      </tr>
                    ))}
                    <tr className="border-b border-white/5 bg-white/[0.015]">
                      <td className="px-4 py-3 text-white/60">Cameroun</td>
                      <td className="px-4 py-3"><code className="font-mono font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded">CM</code></td>
                      <td className="px-4 py-3 text-white/30 italic">STANDARD — pas d'OTP</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* WAVE */}
            <div id="flows-wave" className="scroll-mt-24 space-y-4 pt-6">
              <h3 className="text-base font-bold text-blue-300 border-b border-blue-500/20 pb-2">WAVE — Redirection app (CI · SN)</h3>
              <p className="text-white/50 text-sm leading-relaxed">
                Wave ne supporte pas le push USSD. À la place, l'API retourne un <IC>smsLink</IC> : une URL vers l'app Wave. Vous devez rediriger le client vers cette URL (web) ou l'ouvrir via deep link (mobile). Le client approuve dans son app Wave, et la confirmation revient via IPN.
              </p>

              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5 space-y-4">
                <p className="text-xs font-bold uppercase tracking-widest text-white/25 mb-1">Intégration Wave — étapes côté marchand</p>
                {[
                  { n: "1", t: "Appelez /payin normalement", d: 'Passez country="CI" (ou "SN") et operator="WAVE". Pas de omOtp requis.' },
                  { n: "2", t: "Récupérez le smsLink", d: 'La réponse contient flow: "WAVE" et smsLink: "https://wave.com/pay/…". Ce lien est unique à cette transaction.' },
                  { n: "3", t: "Redirigez le client", d: "Web : window.location.href = smsLink. Mobile React Native : Linking.openURL(smsLink). Mobile Flutter : url_launcher. Le client voit la page de confirmation Wave." },
                  { n: "4", t: "Client approuve dans Wave", d: "Il confirme le paiement dans son app. Wave renvoie la confirmation à YookPay via IPN → status → SUCCESS." },
                ].map(s => (
                  <div key={s.n} className="flex gap-3">
                    <div className="h-6 w-6 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-300 font-bold text-[11px] shrink-0 mt-0.5">{s.n}</div>
                    <div>
                      <p className="text-sm font-semibold text-white/80">{s.t}</p>
                      <p className="text-xs text-white/45 mt-0.5 leading-relaxed">{s.d}</p>
                    </div>
                  </div>
                ))}
              </div>

              <ReqRes
                request={<CodeBlock lang="json" title="Requête Wave (CI)" code={PAYIN_BODY_WAVE} />}
                response={<CodeBlock lang="json" title="Réponse — flow: WAVE + smsLink" code={PAYIN_RESP_WAVE} />}
              />
              <CodeBlock lang="js" title="Node.js — gestion du smsLink" code={NODE_PAYIN_WAVE} />

              <Callout type="info">
                <strong>Le smsLink expire</strong> si le client ne clique pas dans les 15 minutes. En cas d'expiration, la transaction passe à EXPIRED et votre wallet n'est pas débité (payin). Pour une nouvelle tentative, relancez un appel <IC>/payin</IC> complet.
              </Callout>
            </div>
          </Section>

          {/* ═══ PAYMENT LINKS ═══ */}
          <Divider label="Liens de paiement — YookLink" icon={Link2} color="text-pink-400" />

          <Section id="payment-links">
            <SectionHeading icon={Link2} label="Liens de paiement (YookLink)" color="text-pink-400" />
            <p className="text-white/55 text-sm leading-relaxed">
              Un <strong className="text-white/80">YookLink</strong> est une page de paiement hébergée par YookPay. Partagez le lien à vos clients — ils choisissent leur opérateur, saisissent leur numéro, et paient directement. Aucune intégration API requise pour collecter des paiements.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: "🔗", title: "Zéro intégration",    desc: "Créez le lien depuis le tableau de bord. Partagez-le par SMS, WhatsApp, email, QR code." },
                { icon: "🌍", title: "Multi-pays",          desc: "Un seul lien accepte tous vos pays cibles : CI, CM, SN, CD… Le client choisit son pays." },
                { icon: "💰", title: "Prix fixe ou libre",  desc: "Prix fixe pour une commande précise, ou laissez le client saisir le montant (don, abonnement)." },
              ].map(f => (
                <div key={f.title} className="rounded-xl border border-pink-500/20 bg-pink-500/5 p-4 space-y-2">
                  <span className="text-2xl">{f.icon}</span>
                  <p className="font-bold text-sm text-pink-200">{f.title}</p>
                  <p className="text-xs text-white/45 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>

            <SubHeading id="pl-create" label="Créer un lien — depuis le tableau de bord" />
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
              {[
                { n: "1", t: "Tableau de bord → Liens de paiement → Nouveau lien" },
                { n: "2", t: 'Donnez un titre, une description, une photo (optionnel), sélectionnez les pays acceptés' },
                { n: "3", t: 'Choisissez "Prix fixe" (avec montant et devise) ou "Libre" (le client saisit le montant)' },
                { n: "4", t: "Copiez l'URL générée : https://yookpay.partner.ashtechpay.top/pay/{token}" },
                { n: "5", t: "Partagez-le à vos clients — le lien est actif immédiatement" },
              ].map(s => (
                <div key={s.n} className="flex items-start gap-3 text-sm">
                  <div className="h-5 w-5 rounded bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-pink-300 text-[11px] font-bold shrink-0 mt-0.5">{s.n}</div>
                  <p className="text-white/55 leading-relaxed">{s.t}</p>
                </div>
              ))}
            </div>

            <SubHeading id="pl-pay" label="Endpoint de paiement public (appelé par la page)" />
            <p className="text-white/50 text-sm leading-relaxed">
              La page de paiement YookLink appelle cet endpoint automatiquement. Si vous construisez votre propre interface de paiement par-dessus un lien, vous pouvez l'appeler directement — aucune clé API n'est requise.
            </p>
            <EndpointHeader method="POST" path={`payment-links/public/{token}/pay`} title="Initier un paiement via un lien YookLink (public, sans authentification)" color="blue" />

            <ParamTable rows={[
              { name: "amount",    type: "number",  req: true,  desc: 'Montant à payer. Si le lien est en "Prix fixe", doit correspondre exactement.', ex: "5000" },
              { name: "country",   type: "string",  req: true,  desc: "Code pays du client (doit faire partie des pays autorisés sur le lien).",        ex: "CM" },
              { name: "operator",  type: "string",  req: true,  desc: "Opérateur Mobile Money du client.",                                               ex: "MTN" },
              { name: "phone",     type: "string",  req: true,  desc: "Numéro Mobile Money du client, avec indicatif pays.",                             ex: "237687194830" },
              { name: "feeBearer", type: "string",  req: false, desc: '"SENDER" ou "RECIPIENT" (défaut : RECIPIENT). Le client supporte généralement les frais.', ex: "RECIPIENT" },
              { name: "omOtp",    type: "string",  req: false, desc: "Code OTP Orange Money si operator = ORANGE. Obligatoire pour ce cas.",             ex: "123456" },
            ]} />

            <ReqRes
              request={<CodeBlock lang="json" title="Corps envoyé" code={PL_PAY_BODY} />}
              response={<CodeBlock lang="json" title="Réponse 201" code={PL_PAY_RESP} />}
            />

            <RespTable rows={[
              { name: "transaction.id",      type: "integer", desc: "ID de la transaction. Utilisez-le pour le polling de statut." },
              { name: "transaction.status",  type: "string",  desc: 'Toujours "PENDING" à la réponse initiale.' },
              { name: "flow",                type: "string",  desc: '"STANDARD", "OTP", "WAVE" ou "QMONEY" — indique le mécanisme déclenché.' },
              { name: "smsLink",             type: "string?", desc: 'URL Wave si flow = "WAVE". Redirigez le client vers cette URL.' },
              { name: "pending",             type: "boolean", desc: 'true tant que le paiement n\'est pas finalisé.' },
              { name: "message",             type: "string",  desc: "Message lisible à afficher au client." },
            ]} />

            <SubHeading id="pl-poll" label="Polling de statut (transaction payment link)" />
            <p className="text-white/50 text-sm leading-relaxed">
              Interrogez cet endpoint toutes les 5 secondes pour savoir si le paiement est confirmé. Aucune clé API requise.
            </p>
            <EndpointHeader method="GET" path={`payment-links/public/tx/{transactionId}`} title="Vérifier le statut d'une transaction payment link (public)" color="blue" />
            <CodeBlock lang="js" title="Polling Node.js / Browser" code={`// Polling toutes les 5 secondes
async function pollStatus(txId, onSuccess, onFailed) {
  const interval = setInterval(async () => {
    const r = await fetch(\`${BASE}/api/payment-links/public/tx/\${txId}\`);
    const { status } = await r.json();
    if (status === "SUCCESS") { clearInterval(interval); onSuccess(); }
    if (status === "FAILED" || status === "EXPIRED") { clearInterval(interval); onFailed(status); }
  }, 5000);
  // Timeout sécurité : arrêt après 10 min
  setTimeout(() => clearInterval(interval), 600_000);
}`} />
            <CodeBlock lang="json" title="Réponse du polling" code={PL_POLL_RESP} />
          </Section>

          {/* ═══ NOTIFICATIONS ═══ */}
          <Section id="notifications">
            <SectionHeading icon={Bell} label="Notifications & IPN" color="text-amber-400" />
            <p className="text-white/55 text-sm leading-relaxed">
              YookPay reçoit les confirmations de paiement directement de l'opérateur via IPN (Instant Payment Notification). Voici comment le cycle complet fonctionne et comment rester informé du statut de vos transactions.
            </p>

            {/* Flux IPN */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-white/25 mb-3">Cycle de notification complet</p>
              {[
                { n: "1", from: "Votre serveur",          to: "POST /payin ou /payout",        color: "bg-amber-500/20 border-amber-500/30 text-amber-300",  detail: "Requête initiée — status PENDING retourné immédiatement" },
                { n: "2", from: "Opérateur Mobile Money", to: "Téléphone client",               color: "bg-amber-500/20 border-amber-500/30 text-amber-300",  detail: "USSD push / OTP / Wave redirect selon l'opérateur" },
                { n: "3", from: "Client",                 to: "Confirme sur son téléphone",     color: "bg-amber-500/20 border-amber-500/30 text-amber-300",  detail: "Validation du paiement (PIN / OK / app Wave)" },
                { n: "4", from: "Opérateur → YookPay",   to: "IPN reçu à /api/ipn/pixpay",    color: "bg-green-500/20 border-green-500/30 text-green-300",   detail: "Corps : { transaction_id, state, custom_data, amount, hash }" },
                { n: "5", from: "YookPay",                to: "Mise à jour automatique",        color: "bg-green-500/20 border-green-500/30 text-green-300",   detail: "status → SUCCESS ou FAILED · wallet crédité (DEPOSIT) ou remboursé (WITHDRAWAL FAILED)" },
                { n: "6", from: "YookPay",                to: "Notification in-app",            color: "bg-indigo-500/20 border-indigo-500/30 text-indigo-300",detail: "Alerte push dans le tableau de bord YookPay (dépôt confirmé / retrait effectué)" },
              ].map(s => (
                <div key={s.n} className="flex items-start gap-3 text-xs">
                  <div className={`h-5 w-5 rounded border flex items-center justify-center font-bold shrink-0 mt-0.5 ${s.color}`}>{s.n}</div>
                  <div className="flex flex-wrap items-baseline gap-1.5">
                    <span className="font-semibold text-white/70">{s.from}</span>
                    <span className="text-white/30">→</span>
                    <span className="font-semibold text-white/70">{s.to}</span>
                    <span className="text-white/35">— {s.detail}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Payload IPN */}
            <SubHeading id="notif-ipn-payload" label="Format du payload IPN reçu par YookPay" />
            <p className="text-white/50 text-sm">Ce payload est envoyé par l'opérateur à YookPay. La correspondance avec votre transaction se fait via <IC>custom_data</IC> = votre référence YPY-…</p>
            <CodeBlock lang="json" title="Corps IPN reçu de l'opérateur" code={`{
  "transaction_id": "PIX-00123456",   // référence opérateur
  "state":          "SUCCESSFUL",      // SUCCESSFUL | FAILED | REJECTED | CANCELLED
  "custom_data":    "YPY-M9X1A2-K7TQ",// ← votre référence, pour retrouver la transaction
  "amount":         5000,
  "hash":           "sha256_signature",// signature optionnelle
  "response":       "Approved",
  "error":          null
}`} />

            {/* Comment surveiller */}
            <SubHeading id="notif-how" label="Comment surveiller vos transactions" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/5 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-indigo-400" />
                  <span className="font-bold text-indigo-200 text-sm">Polling (Payment Links)</span>
                </div>
                <p className="text-xs text-white/50 leading-relaxed">Pour les paiements via lien YookLink, interrogez <IC>GET /api/payment-links/public/tx/{"{txId}"}</IC> toutes les 5 secondes jusqu'à obtenir <IC>status: "SUCCESS"</IC> ou <IC>"FAILED"</IC>.</p>
                <Callout type="info">Timeout recommandé : 10 minutes. Au-delà, la transaction sera expirée.</Callout>
              </div>
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="font-bold text-emerald-200 text-sm">Tableau de bord</span>
                </div>
                <p className="text-xs text-white/50 leading-relaxed">Consultez <strong className="text-white/70">Tableau de bord → Transactions</strong> et filtrez par référence YPY-… pour voir le statut en temps réel. Chaque changement de statut (SUCCESS, FAILED) déclenche aussi une notification in-app.</p>
                <Callout type="ok">Les notifications push apparaissent dans la cloche en haut à droite du tableau de bord.</Callout>
              </div>
            </div>

            <Callout type="warn">
              <strong>Pas de webhook sortant actuellement.</strong> YookPay reçoit les IPN des opérateurs et met à jour les transactions automatiquement. Pour vos propres serveurs, utilisez le polling sur les transactions Payment Link ou consultez le tableau de bord. Un système de webhook configurable (avec URL de callback vers votre serveur) sera disponible dans une prochaine version.
            </Callout>
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
                  a: "Pour les paiements via API merchant : consultez Tableau de bord → Transactions et filtrez par référence (YPY-…). Pour les paiements via YookLink : utilisez le polling GET /api/payment-links/public/tx/{id} toutes les 5 secondes. Dans les deux cas, une notification in-app apparaît dans le tableau de bord dès confirmation.",
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
