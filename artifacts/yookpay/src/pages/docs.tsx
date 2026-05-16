import { Link } from "wouter";
import { YookPayLogo } from "@/components/yookpay-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  ArrowLeft, ArrowDownToLine, ArrowUpFromLine, Copy, Check,
  Key, BookOpen, Shield, Zap, Globe, AlertTriangle, CheckCircle2,
  Clock, Info, ChevronRight, Terminal, Code2, HelpCircle,
} from "lucide-react";

/* ─── Primitives ─────────────────────────────────────────────────────────── */

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="absolute top-3 right-3 p-1.5 rounded bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function CodeBlock({ code, language = "http", title }: { code: string; language?: string; title?: string }) {
  return (
    <div className="relative rounded-lg bg-[#0d1117] border border-white/10 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-white/5">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
        </div>
        <span className="text-xs text-white/40 ml-2">{title ?? language}</span>
      </div>
      <pre className="text-sm text-white/80 p-4 overflow-x-auto leading-relaxed font-mono whitespace-pre">
        <code>{code}</code>
      </pre>
      <CopyBtn text={code} />
    </div>
  );
}

function ParamRow({ name, type, required, desc, example }: { name: string; type: string; required?: boolean; desc: string; example?: string }) {
  return (
    <tr className="border-b border-white/5 hover:bg-white/[0.02] align-top">
      <td className="px-4 py-3 font-mono text-indigo-300 text-xs whitespace-nowrap">{name}</td>
      <td className="px-4 py-3 text-white/50 text-xs whitespace-nowrap">{type}</td>
      <td className="px-4 py-3 text-xs">{required ? <span className="text-red-400 font-medium">requis</span> : <span className="text-white/30">optionnel</span>}</td>
      <td className="px-4 py-3 text-white/60 text-xs leading-relaxed">
        {desc}
        {example && <span className="ml-1 font-mono text-white/40 text-[11px]">ex&nbsp;: <span className="text-emerald-400">{example}</span></span>}
      </td>
    </tr>
  );
}

function FieldRow({ name, type, desc }: { name: string; type: string; desc: string }) {
  return (
    <tr className="border-b border-white/5 hover:bg-white/[0.02] align-top">
      <td className="px-4 py-3 font-mono text-emerald-300 text-xs whitespace-nowrap">{name}</td>
      <td className="px-4 py-3 text-white/50 text-xs whitespace-nowrap">{type}</td>
      <td className="px-4 py-3 text-white/60 text-xs leading-relaxed">{desc}</td>
    </tr>
  );
}

function Callout({ type, children }: { type: "info" | "warning" | "success" | "danger"; children: React.ReactNode }) {
  const styles = {
    info:    "border-blue-500/30 bg-blue-500/5 text-blue-200",
    warning: "border-amber-500/30 bg-amber-500/5 text-amber-200",
    success: "border-green-500/30 bg-green-500/5 text-green-200",
    danger:  "border-red-500/30 bg-red-500/5 text-red-200",
  };
  const icons = {
    info: <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-400" />,
    warning: <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />,
    success: <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-green-400" />,
    danger: <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />,
  };
  return (
    <div className={`flex gap-3 rounded-lg border p-4 text-sm leading-relaxed ${styles[type]}`}>
      {icons[type]}
      <div>{children}</div>
    </div>
  );
}

function SectionTitle({ id, icon: Icon, title, color = "text-indigo-400" }: { id: string; icon: React.ComponentType<{ className?: string }>; title: string; color?: string }) {
  return (
    <div id={id} className="flex items-center gap-3 scroll-mt-24 mb-6">
      <Icon className={`h-5 w-5 shrink-0 ${color}`} />
      <h2 className="text-2xl font-bold">{title}</h2>
    </div>
  );
}

function SubTitle({ id, title }: { id: string; title: string }) {
  return <h3 id={id} className="text-lg font-semibold mt-8 mb-4 scroll-mt-24 text-white/90">{title}</h3>;
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 overflow-hidden overflow-x-auto">
      <table className="w-full text-sm min-w-[500px]">
        <thead className="bg-white/5 border-b border-white/10">
          <tr>{headers.map(h => <th key={h} className="text-left px-4 py-2.5 text-white/50 font-medium text-xs">{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function NavLink({ href, label, sub }: { href: string; label: string; sub?: boolean }) {
  return (
    <a href={href} className={`block text-sm py-1 transition-colors border-l hover:border-indigo-400 pl-3 ${sub ? "text-white/40 hover:text-white/70 border-white/5 text-xs ml-2" : "text-white/50 hover:text-white border-white/10"}`}>
      {label}
    </a>
  );
}

/* ─── Code samples ───────────────────────────────────────────────────────── */

const BASE_URL = "https://yookpay.partner.ashtechpay.top";

const PAYIN_CURL = `curl -X POST ${BASE_URL}/api/merchant/v1/payin \\
  -H "x-api-key: YKP_IN_VOTRE_CLE_PAYIN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "country":  "CM",
    "operator": "MTN",
    "phone":    "237687194830",
    "amount":   5000
  }'`;

const PAYIN_JS = `const YOOKPAY_BASE = "${BASE_URL}";

async function initierPaiement({ country, operator, phone, amount }) {
  const response = await fetch(\`\${YOOKPAY_BASE}/api/merchant/v1/payin\`, {
    method: "POST",
    headers: {
      "x-api-key":    process.env.YOOKPAY_PAYIN_KEY, // Stockez la clé en variable d'env
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ country, operator, phone, amount }),
  });

  if (!response.ok) {
    const err = await response.json();
    // err.error   → code d'erreur (ex : "ValidationError")
    // err.message → message lisible
    throw new Error(err.message);
  }

  const result = await response.json();
  // ⚠ Stockez result.reference dans votre base de données
  //   pour faire le suivi de ce paiement.
  return result;
}

// Utilisation
const paiement = await initierPaiement({
  country:  "CM",
  operator: "MTN",
  phone:    "237687194830",
  amount:   5000,
});
console.log("Référence :", paiement.reference); // "YPY-M9X1A2-K7TQ"
console.log("Statut :", paiement.status);       // "PENDING"`;

const PAYIN_PYTHON = `import os, requests

YOOKPAY_BASE = "${BASE_URL}"

def initier_paiement(country, operator, phone, amount):
    response = requests.post(
        f"{YOOKPAY_BASE}/api/merchant/v1/payin",
        headers={
            "x-api-key":    os.environ["YOOKPAY_PAYIN_KEY"],
            "Content-Type": "application/json",
        },
        json={
            "country":  country,
            "operator": operator,
            "phone":    phone,
            "amount":   amount,
        },
    )
    response.raise_for_status()
    return response.json()

# Utilisation
paiement = initier_paiement("CM", "MTN", "237687194830", 5000)
print("Référence :", paiement["reference"])
print("Statut    :", paiement["status"])`;

const PAYIN_PHP = `<?php
$YOOKPAY_BASE = "${BASE_URL}";

function initierPaiement(string $country, string $operator, string $phone, int $amount): array {
    global $YOOKPAY_BASE;
    $ch = curl_init("$YOOKPAY_BASE/api/merchant/v1/payin");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => [
            "x-api-key: " . getenv("YOOKPAY_PAYIN_KEY"),
            "Content-Type: application/json",
        ],
        CURLOPT_POSTFIELDS => json_encode([
            "country"  => $country,
            "operator" => $operator,
            "phone"    => $phone,
            "amount"   => $amount,
        ]),
    ]);
    $body     = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $data = json_decode($body, true);
    if ($httpCode >= 400) {
        throw new RuntimeException($data["message"] ?? "Erreur inconnue");
    }
    return $data;
}

// Utilisation
$paiement = initierPaiement("CM", "MTN", "237687194830", 5000);
echo "Référence : " . $paiement["reference"] . PHP_EOL;`;

const PAYIN_RESPONSE_EXAMPLE = `{
  "success":           true,
  "reference":         "YPY-M9X1A2-K7TQ",   // ← Stockez cette valeur
  "providerReference": "PIX-20240516-001",
  "status":            "PENDING",
  "amount":            5000,                  // Montant brut envoyé
  "netAmount":         4800,                  // Crédité dans votre wallet
  "feeAmount":         200,                   // Frais YookPay
  "feeRate":           0.04,                  // 4%
  "currency":          "XAF",
  "transactionId":     412
}`;

const PAYOUT_CURL = `curl -X POST ${BASE_URL}/api/merchant/v1/payout \\
  -H "x-api-key: YKP_OUT_VOTRE_CLE_PAYOUT" \\
  -H "Content-Type: application/json" \\
  -d '{
    "country":   "CM",
    "operator":  "MTN",
    "phone":     "237687194830",
    "amount":    5000,
    "feeBearer": "SENDER"
  }'`;

const PAYOUT_JS = `async function distribuerArgent({ country, operator, phone, amount, feeBearer = "SENDER" }) {
  const response = await fetch(\`\${YOOKPAY_BASE}/api/merchant/v1/payout\`, {
    method: "POST",
    headers: {
      "x-api-key":    process.env.YOOKPAY_PAYOUT_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ country, operator, phone, amount, feeBearer }),
  });

  if (!response.ok) {
    const err = await response.json();
    // Cas important : "InsufficientFunds" → solde wallet insuffisant
    throw new Error(\`[\${err.error}] \${err.message}\`);
  }

  return response.json();
}

// Exemple : envoyer 5000 XAF à un numéro MTN Cameroun
// Vous payez les frais (SENDER), le destinataire reçoit 5000 XAF
const resultat = await distribuerArgent({
  country:   "CM",
  operator:  "MTN",
  phone:     "237687194830",
  amount:    5000,
  feeBearer: "SENDER",
});
console.log("Téléphone reçoit :", resultat.phoneReceives); // 5000
console.log("Débité wallet    :", resultat.amount);         // 5200 (5000 + frais)`;

const PAYOUT_RESPONSE_EXAMPLE = `{
  "success":           true,
  "reference":         "YPY-M9X1A2-K8PL",
  "providerReference": "PIX-20240516-002",
  "status":            "PENDING",
  "amount":            5200,    // Total débité de votre wallet (montant + frais si SENDER)
  "phoneReceives":     5000,    // Ce que le téléphone reçoit effectivement
  "feeAmount":         200,
  "feeRate":           0.04,
  "currency":          "XAF",
  "transactionId":     413
}`;

const ERROR_EXAMPLE = `// Toutes les erreurs ont ce format JSON
{
  "error":   "InsufficientFunds",       // Code machine (pour votre code)
  "message": "Solde insuffisant (...)"  // Message lisible (pour les logs)
}`;

/* ─── Main component ────────────────────────────────────────────────────── */

export default function Docs() {
  const [payinTab, setPayinTab] = useState<"curl" | "js" | "python" | "php">("curl");
  const [payoutTab, setPayoutTab] = useState<"curl" | "js">("curl");

  return (
    <div className="min-h-screen bg-[#060b18] text-white">

      {/* ── Top nav ── */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#060b18]/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="text-white/60 hover:text-white h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <YookPayLogo className="h-7" />
            <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 text-xs hidden sm:flex">
              Documentation API v1
            </Badge>
          </div>
          <Link href="/register">
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 text-xs px-3">
              Créer un compte
            </Button>
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-10 py-12">

        {/* ── Sidebar ── */}
        <aside className="hidden xl:block w-56 shrink-0 sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
          <div className="space-y-5 text-sm">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-2">Démarrage</p>
              <NavLink href="#introduction" label="Introduction" />
              <NavLink href="#quickstart" label="Démarrage rapide" />
              <NavLink href="#authentication" label="Authentification" />
              <NavLink href="#format" label="Format des requêtes" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-2 mt-1">Payin</p>
              <NavLink href="#payin-comment-ca-marche" label="Comment ça marche" />
              <NavLink href="#payin-endpoint" label="Endpoint" />
              <NavLink href="#payin-params" label="Paramètres" />
              <NavLink href="#payin-response" label="Réponse" />
              <NavLink href="#payin-code" label="Exemples de code" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-2 mt-1">Payout</p>
              <NavLink href="#payout-comment-ca-marche" label="Comment ça marche" />
              <NavLink href="#payout-endpoint" label="Endpoint" />
              <NavLink href="#payout-params" label="Paramètres" />
              <NavLink href="#payout-fearbearer" label="feeBearer expliqué" />
              <NavLink href="#payout-response" label="Réponse" />
              <NavLink href="#payout-code" label="Exemples de code" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-2 mt-1">Référence</p>
              <NavLink href="#statuses" label="Statuts de transaction" />
              <NavLink href="#errors" label="Erreurs & Solutions" />
              <NavLink href="#countries" label="Pays & Opérateurs" />
              <NavLink href="#security" label="Sécurité" />
              <NavLink href="#faq" label="FAQ" />
            </div>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="flex-1 max-w-3xl space-y-20 min-w-0">

          {/* ── Introduction ── */}
          <section id="introduction" className="scroll-mt-24 space-y-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
                <BookOpen className="h-3.5 w-3.5" />
                Documentation API
              </div>
              <h1 className="text-4xl font-extrabold leading-tight">API YookPay — Guide d'intégration</h1>
              <p className="text-white/60 text-lg leading-relaxed">
                L'API YookPay vous permet d'encaisser des paiements (Payin) et de distribuer de l'argent (Payout) via Mobile Money en Afrique — en quelques lignes de code, depuis n'importe quel langage ou plateforme.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: Zap, c: "text-yellow-400", label: "Temps réel", desc: "Transactions initiées en < 2 secondes" },
                { icon: Globe, c: "text-emerald-400", label: "Multi-pays", desc: "CM, SN, CI, BF, BJ, ML, TG, CD" },
                { icon: Shield, c: "text-blue-400", label: "Sécurisé", desc: "Clés hachées SHA-256, HTTPS obligatoire" },
              ].map(f => (
                <div key={f.label} className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-1.5">
                  <f.icon className={`h-4 w-4 ${f.c}`} />
                  <p className="font-semibold text-sm">{f.label}</p>
                  <p className="text-xs text-white/50">{f.desc}</p>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 flex items-center gap-3">
              <Terminal className="h-4 w-4 text-white/40 shrink-0" />
              <div className="text-sm">
                <span className="text-white/50">Base URL — </span>
                <code className="text-indigo-300 font-mono">{BASE_URL}</code>
              </div>
            </div>
          </section>

          {/* ── Quick start ── */}
          <section id="quickstart" className="scroll-mt-24 space-y-5">
            <SectionTitle id="quickstart-title" icon={Zap} title="Démarrage rapide" color="text-yellow-400" />
            <p className="text-white/60">Suivez ces 4 étapes pour effectuer votre premier paiement.</p>
            <div className="space-y-4">
              {[
                {
                  step: "1",
                  title: "Créer un compte YookPay",
                  desc: "Rendez-vous sur la page d'inscription et créez votre compte marchand.",
                  action: <Link href="/register"><Button size="sm" variant="outline" className="border-white/20 text-white hover:bg-white/10 mt-2 text-xs gap-1.5">Créer un compte <ChevronRight className="h-3 w-3" /></Button></Link>,
                },
                {
                  step: "2",
                  title: "Valider votre KYB",
                  desc: "Le KYB (Know Your Business) est requis pour accéder aux clés API. Allez dans Tableau de bord → KYC/KYB et soumettez vos documents d'entreprise.",
                },
                {
                  step: "3",
                  title: "Générer vos clés API",
                  desc: "Dans votre tableau de bord, allez sur la page Clés API. Générez une clé Payin (pour encaisser) et/ou une clé Payout (pour distribuer). Copiez et stockez la clé immédiatement — elle ne sera plus affichée.",
                  action: <Link href="/api-keys"><Button size="sm" variant="outline" className="border-white/20 text-white hover:bg-white/10 mt-2 text-xs gap-1.5">Gérer mes clés <ChevronRight className="h-3 w-3" /></Button></Link>,
                },
                {
                  step: "4",
                  title: "Faire votre premier appel API",
                  desc: "Stockez votre clé comme variable d'environnement et appelez l'endpoint de votre choix (voir ci-dessous).",
                },
              ].map(s => (
                <div key={s.step} className="flex gap-4">
                  <div className="h-8 w-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-sm shrink-0 mt-0.5">{s.step}</div>
                  <div className="flex-1">
                    <p className="font-semibold">{s.title}</p>
                    <p className="text-sm text-white/55 mt-1 leading-relaxed">{s.desc}</p>
                    {s.action}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Authentication ── */}
          <section id="authentication" className="scroll-mt-24 space-y-5">
            <SectionTitle id="auth-title" icon={Key} title="Authentification" />
            <p className="text-white/60 leading-relaxed">
              Chaque requête doit inclure votre clé API dans l'en-tête HTTP <code className="text-indigo-300 font-mono">x-api-key</code>. Il n'y a pas de session, de cookie, ni de token JWT — uniquement cet en-tête.
            </p>
            <CodeBlock language="HTTP" code={`POST /api/merchant/v1/payin HTTP/1.1
Host: yookpay.partner.ashtechpay.top
x-api-key: YKP_IN_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json`} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <ArrowDownToLine className="h-4 w-4 text-blue-400" />
                  <span className="font-semibold text-blue-200">Clé Payin</span>
                  <code className="text-xs font-mono text-blue-400 ml-auto">YKP_IN_…</code>
                </div>
                <ul className="text-xs text-white/55 space-y-1 list-disc list-inside">
                  <li>Autorise uniquement <strong className="text-white/80">POST /v1/payin</strong></li>
                  <li>Encaissement uniquement</li>
                  <li>1 clé active maximum par compte</li>
                </ul>
              </div>
              <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <ArrowUpFromLine className="h-4 w-4 text-purple-400" />
                  <span className="font-semibold text-purple-200">Clé Payout</span>
                  <code className="text-xs font-mono text-purple-400 ml-auto">YKP_OUT_…</code>
                </div>
                <ul className="text-xs text-white/55 space-y-1 list-disc list-inside">
                  <li>Autorise uniquement <strong className="text-white/80">POST /v1/payout</strong></li>
                  <li>Distribution d'argent uniquement</li>
                  <li>1 clé active maximum par compte</li>
                </ul>
              </div>
            </div>
            <Callout type="danger">
              <strong>Ne jamais exposer vos clés côté client.</strong> Une clé API dans du JavaScript frontend, une application mobile ou un dépôt Git public peut être volée et utilisée pour vider votre wallet. Appelez toujours l'API depuis votre <strong>serveur backend</strong> (Node.js, Python, PHP, etc.) et stockez la clé dans une variable d'environnement (<code>process.env.YOOKPAY_PAYIN_KEY</code>).
            </Callout>
          </section>

          {/* ── Request format ── */}
          <section id="format" className="scroll-mt-24 space-y-5">
            <SectionTitle id="format-title" icon={Code2} title="Format des requêtes" />
            <p className="text-white/60">Toutes les requêtes et réponses utilisent le format <strong className="text-white/90">JSON</strong>. Les en-têtes obligatoires sont :</p>
            <Table headers={["En-tête", "Valeur", "Description"]}>
              <tr className="border-b border-white/5"><td className="px-4 py-3 font-mono text-indigo-300 text-xs">x-api-key</td><td className="px-4 py-3 font-mono text-emerald-300 text-xs">YKP_IN_… ou YKP_OUT_…</td><td className="px-4 py-3 text-white/60 text-xs">Votre clé API</td></tr>
              <tr className="border-b border-white/5"><td className="px-4 py-3 font-mono text-indigo-300 text-xs">Content-Type</td><td className="px-4 py-3 font-mono text-emerald-300 text-xs">application/json</td><td className="px-4 py-3 text-white/60 text-xs">Type du corps de la requête</td></tr>
            </Table>
            <Callout type="info">
              Les montants sont toujours des <strong>nombres entiers</strong> (pas de décimales). Pour <code>5000 XAF</code>, envoyez <code>5000</code> — jamais <code>5000.00</code>.
            </Callout>
          </section>

          {/* ─────────────── PAYIN ─────────────── */}
          <div className="flex items-center gap-3 pt-4">
            <div className="flex-1 h-px bg-blue-500/20" />
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20">
              <ArrowDownToLine className="h-4 w-4 text-blue-400" />
              <span className="text-blue-300 font-bold text-sm">API Payin — Encaisser un paiement</span>
            </div>
            <div className="flex-1 h-px bg-blue-500/20" />
          </div>

          {/* Payin — comment ça marche */}
          <section id="payin-comment-ca-marche" className="scroll-mt-24 space-y-5">
            <SubTitle id="payin-flow-title" title="Comment ça marche" />
            <p className="text-white/60 leading-relaxed">
              Le Payin permet de collecter un paiement depuis le téléphone d'un client (acheteur) vers votre wallet YookPay. Voici le flux complet de la transaction :
            </p>
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-6 space-y-3 font-mono text-sm">
              {[
                { icon: "1", color: "bg-blue-500", label: "Votre serveur", desc: 'appelle POST /payin avec country, operator, phone, amount' },
                { icon: "2", color: "bg-indigo-500", label: "YookPay API", desc: "valide la clé, calcule les frais, enregistre la transaction (status: PENDING)" },
                { icon: "3", color: "bg-violet-500", label: "PixPay (opérateur)", desc: "envoie une notification USSD ou SMS au téléphone du client" },
                { icon: "4", color: "bg-purple-500", label: "Le client", desc: "confirme le paiement sur son téléphone" },
                { icon: "5", color: "bg-pink-500", label: "YookPay API", desc: "reçoit la confirmation (IPN), met à jour status → SUCCESS, crédite votre wallet" },
              ].map((s, i) => (
                <div key={s.icon} className="flex items-start gap-3">
                  <div className={`h-6 w-6 rounded-full ${s.color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>{s.icon}</div>
                  <div className="flex-1 flex flex-wrap items-baseline gap-2 min-w-0">
                    <span className="font-semibold text-white/80 text-xs shrink-0">{s.label}</span>
                    <span className="text-white/40 text-xs leading-relaxed">{s.desc}</span>
                  </div>
                  {i < 4 && <div className="hidden" />}
                </div>
              ))}
            </div>
            <Callout type="info">
              La réponse à votre appel API est <strong>immédiate</strong> avec <code>status: "PENDING"</code>. La transaction passe à <code>SUCCESS</code> ou <code>FAILED</code> de manière asynchrone — en général en moins de 2 minutes selon l'opérateur.
            </Callout>
          </section>

          {/* Payin endpoint */}
          <section id="payin-endpoint" className="scroll-mt-24 space-y-4">
            <SubTitle id="payin-ep-title" title="Endpoint" />
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
              <Badge className="bg-blue-600 text-white text-xs shrink-0">POST</Badge>
              <code className="text-sm font-mono text-white/80">/api/merchant/v1/payin</code>
            </div>
          </section>

          {/* Payin params */}
          <section id="payin-params" className="scroll-mt-24 space-y-4">
            <SubTitle id="payin-params-title" title="Paramètres de la requête" />
            <Table headers={["Champ", "Type", "Statut", "Description"]}>
              <ParamRow name="country"  type="string"  required desc="Code pays ISO-3166 en 2 lettres majuscules." example="CM" />
              <ParamRow name="operator" type="string"  required desc="Nom de l'opérateur Mobile Money en majuscules. Voir tableau Pays & Opérateurs." example="MTN" />
              <ParamRow name="phone"    type="string"  required desc="Numéro de téléphone incluant l'indicatif pays, sans le +. Doit appartenir à l'opérateur indiqué." example="237687194830" />
              <ParamRow name="amount"   type="integer" required desc="Montant entier dans la devise locale du pays. Pas de décimales." example="5000" />
              <ParamRow name="metadata" type="object"  desc="Objet JSON libre (id commande, email client, etc.). Renvoyé dans les réponses et webhooks." example='{"orderId": "CMD-42"}' />
            </Table>
            <Callout type="warning">
              Le numéro <code>phone</code> doit correspondre à l'opérateur indiqué dans <code>operator</code>. Si un numéro Orange est envoyé avec <code>operator: "MTN"</code>, la transaction échouera côté opérateur.
            </Callout>
          </section>

          {/* Payin response */}
          <section id="payin-response" className="scroll-mt-24 space-y-4">
            <SubTitle id="payin-resp-title" title="Réponse (201 Created)" />
            <CodeBlock code={PAYIN_RESPONSE_EXAMPLE} language="JSON" title="Exemple de réponse" />
            <Table headers={["Champ", "Type", "Description"]}>
              <FieldRow name="reference"         type="string"  desc="Référence unique générée par YookPay. Stockez-la en base de données pour suivre la transaction." />
              <FieldRow name="providerReference" type="string"  desc="Référence côté opérateur (PixPay). Utile pour le support en cas de problème." />
              <FieldRow name="status"            type="string"  desc="Statut initial : toujours PENDING. La transaction évolue en asynchrone vers SUCCESS ou FAILED." />
              <FieldRow name="amount"            type="integer" desc="Montant brut envoyé par le client (= le champ amount de votre requête)." />
              <FieldRow name="netAmount"         type="integer" desc="Montant crédité dans votre wallet après déduction des frais. netAmount = amount - feeAmount." />
              <FieldRow name="feeAmount"         type="integer" desc="Frais YookPay prélevés sur cette transaction." />
              <FieldRow name="feeRate"           type="number"  desc="Taux de frais appliqué, en proportion (0.04 = 4%). Défini par votre gestionnaire de compte." />
              <FieldRow name="currency"          type="string"  desc="Devise déduite automatiquement du pays (XAF pour CM/CG/GA, XOF pour SN/CI/BF…, CDF pour CD)." />
              <FieldRow name="transactionId"     type="integer" desc="Identifiant interne de la transaction dans la base YookPay." />
            </Table>
          </section>

          {/* Payin code examples */}
          <section id="payin-code" className="scroll-mt-24 space-y-4">
            <SubTitle id="payin-code-title" title="Exemples de code" />
            <div className="flex gap-2 flex-wrap">
              {(["curl", "js", "python", "php"] as const).map(tab => (
                <button key={tab} onClick={() => setPayinTab(tab)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${payinTab === tab ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : "text-white/50 hover:text-white border border-white/10 hover:border-white/20"}`}>
                  {tab === "js" ? "Node.js / JS" : tab === "curl" ? "cURL" : tab === "python" ? "Python" : "PHP"}
                </button>
              ))}
            </div>
            {payinTab === "curl"   && <CodeBlock code={PAYIN_CURL}   language="bash"       title="cURL" />}
            {payinTab === "js"     && <CodeBlock code={PAYIN_JS}     language="javascript"  title="Node.js / JavaScript" />}
            {payinTab === "python" && <CodeBlock code={PAYIN_PYTHON} language="python"      title="Python (requests)" />}
            {payinTab === "php"    && <CodeBlock code={PAYIN_PHP}    language="php"         title="PHP (cURL)" />}
          </section>

          {/* ─────────────── PAYOUT ─────────────── */}
          <div className="flex items-center gap-3 pt-4">
            <div className="flex-1 h-px bg-purple-500/20" />
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20">
              <ArrowUpFromLine className="h-4 w-4 text-purple-400" />
              <span className="text-purple-300 font-bold text-sm">API Payout — Distribuer de l'argent</span>
            </div>
            <div className="flex-1 h-px bg-purple-500/20" />
          </div>

          {/* Payout — comment ça marche */}
          <section id="payout-comment-ca-marche" className="scroll-mt-24 space-y-5">
            <SubTitle id="payout-flow-title" title="Comment ça marche" />
            <p className="text-white/60 leading-relaxed">
              Le Payout envoie de l'argent depuis votre wallet YookPay vers un numéro Mobile Money. Idéal pour : remboursements, versement de commissions, paiement de salaires, cashback, transferts en masse.
            </p>
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-6 space-y-3 font-mono text-sm">
              {[
                { icon: "1", color: "bg-purple-500", label: "Votre serveur", desc: 'appelle POST /payout avec country, operator, phone, amount, feeBearer' },
                { icon: "2", color: "bg-violet-500", label: "YookPay API", desc: "vérifie le solde de votre wallet, débite le montant, enregistre (status: PENDING)" },
                { icon: "3", color: "bg-indigo-500", label: "PixPay (opérateur)", desc: "initie le virement vers le numéro de téléphone indiqué" },
                { icon: "4", color: "bg-blue-500", label: "Le destinataire", desc: "reçoit l'argent sur son compte Mobile Money" },
                { icon: "5", color: "bg-cyan-500", label: "YookPay API", desc: "reçoit la confirmation (IPN), met à jour status → SUCCESS" },
              ].map((s) => (
                <div key={s.icon} className="flex items-start gap-3">
                  <div className={`h-6 w-6 rounded-full ${s.color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>{s.icon}</div>
                  <div className="flex-1 flex flex-wrap items-baseline gap-2 min-w-0">
                    <span className="font-semibold text-white/80 text-xs shrink-0">{s.label}</span>
                    <span className="text-white/40 text-xs leading-relaxed">{s.desc}</span>
                  </div>
                </div>
              ))}
            </div>
            <Callout type="warning">
              Le wallet est débité <strong>immédiatement</strong> à l'appel de l'API. En cas d'échec (FAILED), la somme est automatiquement remboursée dans votre wallet par le système d'expiration.
            </Callout>
          </section>

          {/* Payout endpoint */}
          <section id="payout-endpoint" className="scroll-mt-24 space-y-4">
            <SubTitle id="payout-ep-title" title="Endpoint" />
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
              <Badge className="bg-purple-600 text-white text-xs shrink-0">POST</Badge>
              <code className="text-sm font-mono text-white/80">/api/merchant/v1/payout</code>
            </div>
          </section>

          {/* Payout params */}
          <section id="payout-params" className="scroll-mt-24 space-y-4">
            <SubTitle id="payout-params-title" title="Paramètres de la requête" />
            <Table headers={["Champ", "Type", "Statut", "Description"]}>
              <ParamRow name="country"   type="string"  required desc="Code pays ISO-3166 en 2 lettres majuscules." example="CM" />
              <ParamRow name="operator"  type="string"  required desc="Opérateur Mobile Money en majuscules." example="MTN" />
              <ParamRow name="phone"     type="string"  required desc="Numéro du destinataire avec indicatif pays, sans le +." example="237687194830" />
              <ParamRow name="amount"    type="integer" required desc="Montant à envoyer, en unité locale entière." example="5000" />
              <ParamRow name="feeBearer" type="string"  desc='Qui supporte les frais. "SENDER" (défaut) ou "RECIPIENT". Voir section feeBearer.' example="SENDER" />
              <ParamRow name="metadata"  type="object"  desc="Objet JSON libre pour votre référence interne." example='{"userId": 99}' />
            </Table>
          </section>

          {/* feeBearer explanation */}
          <section id="payout-fearbearer" className="scroll-mt-24 space-y-4">
            <SubTitle id="fearbearer-title" title="feeBearer — qui paie les frais ?" />
            <p className="text-white/60 text-sm leading-relaxed">
              Le champ <code className="text-purple-300">feeBearer</code> détermine si c'est vous (l'expéditeur) ou le destinataire qui supporte les frais de la transaction. Prenons un exemple avec <strong>5 000 XAF et 4% de frais (200 XAF)</strong> :
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <code className="text-purple-300 font-mono font-bold text-sm">SENDER</code>
                  <Badge variant="outline" className="text-purple-300 border-purple-500/30 text-xs">défaut</Badge>
                </div>
                <p className="text-xs text-white/60 leading-relaxed">Vous payez les frais en plus. Le destinataire reçoit <strong className="text-white/90">exactement 5 000 XAF</strong>.</p>
                <div className="rounded bg-white/5 p-3 font-mono text-xs space-y-1 text-white/70">
                  <div className="flex justify-between"><span>Débité de votre wallet</span><span className="text-red-400">5 200 XAF</span></div>
                  <div className="flex justify-between"><span>Frais YookPay</span><span className="text-red-400">200 XAF</span></div>
                  <div className="flex justify-between border-t border-white/10 pt-1 mt-1"><span>Reçu par le téléphone</span><span className="text-green-400 font-bold">5 000 XAF</span></div>
                </div>
                <p className="text-xs text-white/40">Usage : salaires, remboursements où le montant exact est garanti.</p>
              </div>
              <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-5 space-y-3">
                <code className="text-indigo-300 font-mono font-bold text-sm">RECIPIENT</code>
                <p className="text-xs text-white/60 leading-relaxed">Le destinataire supporte les frais. Votre wallet est débité exactement du montant saisi.</p>
                <div className="rounded bg-white/5 p-3 font-mono text-xs space-y-1 text-white/70">
                  <div className="flex justify-between"><span>Débité de votre wallet</span><span className="text-red-400">5 000 XAF</span></div>
                  <div className="flex justify-between"><span>Frais YookPay</span><span className="text-red-400">200 XAF</span></div>
                  <div className="flex justify-between border-t border-white/10 pt-1 mt-1"><span>Reçu par le téléphone</span><span className="text-yellow-400 font-bold">4 800 XAF</span></div>
                </div>
                <p className="text-xs text-white/40">Usage : cashback, bonus où votre coût est fixe.</p>
              </div>
            </div>
          </section>

          {/* Payout response */}
          <section id="payout-response" className="scroll-mt-24 space-y-4">
            <SubTitle id="payout-resp-title" title="Réponse (201 Created)" />
            <CodeBlock code={PAYOUT_RESPONSE_EXAMPLE} language="JSON" title="Exemple de réponse" />
            <Table headers={["Champ", "Type", "Description"]}>
              <FieldRow name="reference"         type="string"  desc="Référence unique YookPay. Stockez-la pour le suivi." />
              <FieldRow name="providerReference" type="string"  desc="Référence côté PixPay / opérateur." />
              <FieldRow name="status"            type="string"  desc="Toujours PENDING à la réponse initiale." />
              <FieldRow name="amount"            type="integer" desc="Total débité de votre wallet. Inclut les frais si feeBearer = SENDER." />
              <FieldRow name="phoneReceives"     type="integer" desc="Montant effectivement reçu par le destinataire sur son téléphone." />
              <FieldRow name="feeAmount"         type="integer" desc="Frais YookPay de cette transaction." />
              <FieldRow name="feeRate"           type="number"  desc="Taux de frais en proportion (ex : 0.04 = 4%)." />
              <FieldRow name="currency"          type="string"  desc="Devise de la transaction." />
              <FieldRow name="transactionId"     type="integer" desc="Identifiant interne YookPay." />
            </Table>
          </section>

          {/* Payout code examples */}
          <section id="payout-code" className="scroll-mt-24 space-y-4">
            <SubTitle id="payout-code-title" title="Exemples de code" />
            <div className="flex gap-2 flex-wrap">
              {(["curl", "js"] as const).map(tab => (
                <button key={tab} onClick={() => setPayoutTab(tab)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${payoutTab === tab ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "text-white/50 hover:text-white border border-white/10 hover:border-white/20"}`}>
                  {tab === "js" ? "Node.js / JS" : "cURL"}
                </button>
              ))}
            </div>
            {payoutTab === "curl" && <CodeBlock code={PAYOUT_CURL} language="bash"        title="cURL" />}
            {payoutTab === "js"   && <CodeBlock code={PAYOUT_JS}   language="javascript"  title="Node.js / JavaScript" />}
          </section>

          {/* ── Statuses ── */}
          <section id="statuses" className="scroll-mt-24 space-y-5">
            <SectionTitle id="statuses-title" icon={Clock} title="Statuts de transaction" color="text-cyan-400" />
            <p className="text-white/60 text-sm">Chaque transaction passe par ces statuts dans cet ordre :</p>
            <div className="space-y-3">
              {[
                { status: "PENDING",  color: "text-yellow-400 border-yellow-500/30 bg-yellow-500/5", desc: "Transaction créée, en attente de confirmation de l'opérateur Mobile Money. État initial retourné par l'API." },
                { status: "SUCCESS",  color: "text-green-400 border-green-500/30 bg-green-500/5",   desc: "Paiement confirmé par l'opérateur. Pour un payin : votre wallet est crédité. Pour un payout : le destinataire a reçu l'argent." },
                { status: "FAILED",   color: "text-red-400 border-red-500/30 bg-red-500/5",         desc: "La transaction a échoué (refus client, solde insuffisant côté Mobile Money, timeout opérateur). Pour un payout : votre wallet est automatiquement remboursé." },
                { status: "EXPIRED",  color: "text-white/40 border-white/10 bg-white/5",            desc: "La transaction n'a reçu aucune confirmation dans le délai imparti (8 minutes). Remboursement automatique pour les payouts." },
              ].map(s => (
                <div key={s.status} className={`flex items-start gap-4 rounded-lg border p-4 ${s.color}`}>
                  <code className="font-mono font-bold text-sm shrink-0 w-20">{s.status}</code>
                  <p className="text-sm text-white/60 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
            <Callout type="info">
              Pour connaître le statut final d'une transaction, consultez la page <strong>Transactions</strong> de votre tableau de bord, ou attendez la notification webhook (disponible prochainement).
            </Callout>
          </section>

          {/* ── Errors ── */}
          <section id="errors" className="scroll-mt-24 space-y-5">
            <SectionTitle id="errors-title" icon={AlertTriangle} title="Erreurs & Solutions" color="text-red-400" />
            <p className="text-white/60 text-sm">Toutes les erreurs retournent un JSON avec ce format :</p>
            <CodeBlock code={ERROR_EXAMPLE} language="JSON" title="Format d'erreur" />
            <Table headers={["HTTP", "error", "Cause probable", "Solution"]}>
              {[
                ["401", "Unauthorized",       "Clé absente, invalide ou révoquée",                   "Vérifiez l'en-tête x-api-key. Régénérez la clé si nécessaire."],
                ["401", "Unauthorized",       "Clé de mauvais type (payin ≠ payout)",                "Utilisez YKP_IN_ pour /payin et YKP_OUT_ pour /payout."],
                ["400", "ValidationError",    "Paramètre manquant ou type incorrect",                "Vérifiez que tous les champs requis sont présents et bien typés (amount = entier)."],
                ["400", "ValidationError",    "Pays non supporté",                                   "Vérifiez que country fait partie de la liste des pays supportés."],
                ["400", "InsufficientFunds",  "Solde wallet insuffisant (payout)",                   "Rechargez votre wallet YookPay avant de relancer."],
                ["400", "WalletNotFound",     "Aucun wallet pour cette devise",                      "Contactez le support pour ouvrir un wallet dans la devise souhaitée."],
                ["500", "PayinFailed",        "Erreur opérateur ou clé PixPay manquante",            "Vérifiez la configuration PixPay de votre compte. Contactez le support si persistant."],
                ["500", "PayoutFailed",       "Erreur opérateur lors de l'envoi",                    "Votre wallet sera remboursé automatiquement. Réessayez ultérieurement."],
              ].map(([code, err, cause, sol]) => (
                <tr key={err + cause} className="border-b border-white/5 hover:bg-white/[0.02] align-top">
                  <td className="px-4 py-3 font-mono text-red-400 text-xs shrink-0">{code}</td>
                  <td className="px-4 py-3 font-mono text-yellow-300 text-xs whitespace-nowrap">{err}</td>
                  <td className="px-4 py-3 text-white/50 text-xs leading-relaxed">{cause}</td>
                  <td className="px-4 py-3 text-white/60 text-xs leading-relaxed">{sol}</td>
                </tr>
              ))}
            </Table>
          </section>

          {/* ── Countries ── */}
          <section id="countries" className="scroll-mt-24 space-y-5">
            <SectionTitle id="countries-title" icon={Globe} title="Pays & Opérateurs supportés" color="text-emerald-400" />
            <p className="text-white/60 text-sm">Utilisez exactement les valeurs <code className="text-indigo-300">country</code> et <code className="text-indigo-300">operator</code> indiquées dans ce tableau.</p>
            <Table headers={["Pays", "country", "Devise (currency)", "Opérateurs (operator)"]}>
              {[
                ["🇨🇲 Cameroun",     "CM", "XAF", "MTN, ORANGE"],
                ["🇸🇳 Sénégal",      "SN", "XOF", "ORANGE, FREE, WAVE"],
                ["🇨🇮 Côte d'Ivoire","CI", "XOF", "MTN, ORANGE, MOOV, WAVE"],
                ["🇧🇫 Burkina Faso", "BF", "XOF", "ORANGE, MOOV"],
                ["🇧🇯 Bénin",        "BJ", "XOF", "MTN, MOOV"],
                ["🇲🇱 Mali",         "ML", "XOF", "ORANGE, MOOV"],
                ["🇹🇬 Togo",         "TG", "XOF", "TOGOCEL, MOOV"],
                ["🇨🇩 Congo RDC",    "CD", "CDF", "VODACOM, AIRTEL, ORANGE, AFRICELL"],
              ].map(([pays, code, devise, ops]) => (
                <tr key={code} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-sm">{pays}</td>
                  <td className="px-4 py-3 font-mono text-indigo-300 font-bold text-sm">{code}</td>
                  <td className="px-4 py-3 font-mono text-emerald-300 text-sm">{devise}</td>
                  <td className="px-4 py-3 text-xs text-white/60 font-mono">{ops}</td>
                </tr>
              ))}
            </Table>
            <Callout type="info">
              La devise (<code>currency</code>) dans la réponse est déduite automatiquement du pays — vous n'avez pas à l'envoyer. Si vous envoyez <code>country: "CM"</code>, la devise sera toujours <code>XAF</code>.
            </Callout>
          </section>

          {/* ── Security ── */}
          <section id="security" className="scroll-mt-24 space-y-5">
            <SectionTitle id="security-title" icon={Shield} title="Bonnes pratiques de sécurité" color="text-blue-400" />
            <div className="space-y-3">
              {[
                { title: "Stockez les clés dans des variables d'environnement", desc: "Ne codez jamais une clé en dur dans votre code source. Utilisez process.env.YOOKPAY_PAYIN_KEY (Node), os.environ (Python), getenv (PHP)." },
                { title: "N'exposez jamais les clés côté client", desc: "Les clés API ne doivent exister que sur votre serveur backend. Une clé dans du JavaScript frontend ou une app mobile peut être extraite par n'importe qui." },
                { title: "Révoquez immédiatement toute clé compromise", desc: "Si une clé est accidentellement exposée (commit Git, log, etc.), révoquez-la depuis le tableau de bord et générez-en une nouvelle." },
                { title: "Stockez la référence de chaque transaction", desc: "La référence (YPY-…) est la seule façon d'identifier une transaction. Stockez-la en base de données dès réception de la réponse." },
                { title: "Gérez les erreurs réseau avec retry", desc: "En cas d'erreur 5xx ou de timeout, attendez quelques secondes avant de réessayer. Vérifiez d'abord si la transaction n'a pas déjà été créée (via votre tableau de bord)." },
              ].map((item, i) => (
                <div key={i} className="flex gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-4">
                  <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">{item.title}</p>
                    <p className="text-sm text-white/55 mt-1 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── FAQ ── */}
          <section id="faq" className="scroll-mt-24 space-y-5">
            <SectionTitle id="faq-title" icon={HelpCircle} title="Questions fréquentes" color="text-pink-400" />
            <div className="space-y-4">
              {[
                {
                  q: "Pourquoi le statut est-il PENDING et non SUCCESS immédiatement ?",
                  a: "La confirmation du paiement est asynchrone : le client doit valider sur son téléphone, et l'opérateur doit renvoyer la confirmation à YookPay. Ce processus prend en général 30 secondes à 2 minutes selon l'opérateur et le pays.",
                },
                {
                  q: "Que faire si une transaction reste PENDING trop longtemps ?",
                  a: "Les transactions expirent automatiquement après 8 minutes sans confirmation. Le statut passe à EXPIRED et, pour un payout, votre wallet est remboursé. Vous pouvez relancer une nouvelle transaction.",
                },
                {
                  q: "Comment savoir si un paiement a réussi (PAYIN) ?",
                  a: "Consultez la page Transactions de votre tableau de bord. Vous pouvez filtrer par référence (YPY-…). Un système de webhook en temps réel sera disponible prochainement pour notifier votre serveur automatiquement.",
                },
                {
                  q: "Quelle devise dois-je utiliser pour le montant ?",
                  a: "La devise est déterminée par le pays. CM → XAF, SN/CI/BF… → XOF, CD → CDF. Vous n'envoyez jamais la devise dans la requête — elle est déduite automatiquement. Assurez-vous que le montant est cohérent (ex : 5000 XAF, pas 5000 EUR).",
                },
                {
                  q: "Puis-je tester l'API sans argent réel ?",
                  a: "Actuellement, l'API opère en mode production. Contactez le support YookPay pour obtenir un accès sandbox si vous souhaitez tester vos intégrations sans transactions réelles.",
                },
                {
                  q: "Mon wallet est-il remboursé si un payout échoue ?",
                  a: "Oui. Le wallet est débité à l'appel de l'API, mais si la transaction passe à FAILED ou EXPIRED, le système de remboursement automatique recrédite votre wallet du montant total débité (montant + frais).",
                },
                {
                  q: "Puis-je envoyer vers n'importe quel numéro de téléphone ?",
                  a: "Le numéro doit être actif sur l'opérateur Mobile Money indiqué et dans le pays indiqué. Un numéro inactif ou appartenant à un autre opérateur entraînera un FAILED côté PixPay.",
                },
              ].map((item, i) => (
                <details key={i} className="rounded-lg border border-white/10 bg-white/[0.02] group">
                  <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer list-none">
                    <span className="font-medium text-sm text-white/80">{item.q}</span>
                    <ChevronRight className="h-4 w-4 text-white/30 shrink-0 group-open:rotate-90 transition-transform" />
                  </summary>
                  <div className="px-5 pb-4 text-sm text-white/55 leading-relaxed border-t border-white/5 pt-4">
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </section>

          {/* ── CTA ── */}
          <div className="rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-8 text-center space-y-4">
            <h3 className="text-xl font-bold">Prêt à intégrer YookPay ?</h3>
            <p className="text-white/60 text-sm max-w-md mx-auto">
              Créez votre compte, validez votre KYB, et vous pouvez encaisser votre premier paiement Mobile Money en moins d'une heure.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Link href="/register">
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                  Créer un compte gratuit
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
                  Se connecter
                </Button>
              </Link>
            </div>
          </div>

        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-16 py-8 text-center text-sm text-white/30">
        © {new Date().getFullYear()} YookPay ·{" "}
        <Link href="/" className="hover:text-white/60 transition-colors">Accueil</Link>
        {" · "}
        <Link href="/register" className="hover:text-white/60 transition-colors">Créer un compte</Link>
      </footer>
    </div>
  );
}
