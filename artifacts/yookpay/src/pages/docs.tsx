import { Link } from "wouter";
import { YookPayLogo } from "@/components/yookpay-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowDownToLine,
  ArrowUpFromLine,
  Copy,
  Check,
  Key,
  BookOpen,
  Shield,
  Zap,
  Globe,
} from "lucide-react";

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="absolute top-3 right-3 p-1.5 rounded bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function CodeBlock({ code, language = "http" }: { code: string; language?: string }) {
  return (
    <div className="relative rounded-lg bg-[#0d1117] border border-white/10 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-white/5">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
        </div>
        <span className="text-xs text-white/40 ml-1">{language}</span>
      </div>
      <pre className="text-sm text-white/80 p-4 overflow-x-auto leading-relaxed font-mono">
        <code>{code}</code>
      </pre>
      <CopyBtn text={code} />
    </div>
  );
}

function Section({ id, children }: { id: string; children: React.ReactNode }) {
  return <section id={id} className="scroll-mt-20">{children}</section>;
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="block text-sm text-white/50 hover:text-white py-1 transition-colors border-l border-white/10 hover:border-indigo-400 pl-3"
    >
      {label}
    </a>
  );
}

const PAYIN_REQUEST = `POST /api/merchant/v1/payin HTTP/1.1
Host: yookpay.partner.ashtechpay.top
x-api-key: YKP_IN_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "country":  "CM",
  "operator": "MTN",
  "phone":    "237687194830",
  "amount":   5000
}`;

const PAYIN_RESPONSE = `HTTP/1.1 201 Created

{
  "success":           true,
  "reference":         "YPY-M9X1A2-K7TQ",
  "providerReference": "PIX-20240516-001",
  "status":            "PENDING",
  "amount":            5000,
  "netAmount":         4800,
  "feeAmount":         200,
  "feeRate":           0.04,
  "currency":          "XAF",
  "transactionId":     412
}`;

const PAYOUT_REQUEST = `POST /api/merchant/v1/payout HTTP/1.1
Host: yookpay.partner.ashtechpay.top
x-api-key: YKP_OUT_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "country":   "CM",
  "operator":  "MTN",
  "phone":     "237687194830",
  "amount":    5000,
  "feeBearer": "SENDER"
}`;

const PAYOUT_RESPONSE = `HTTP/1.1 201 Created

{
  "success":           true,
  "reference":         "YPY-M9X1A2-K8PL",
  "providerReference": "PIX-20240516-002",
  "status":            "PENDING",
  "amount":            5000,
  "phoneReceives":     4800,
  "feeAmount":         200,
  "feeRate":           0.04,
  "currency":          "XAF",
  "transactionId":     413
}`;

const PAYOUT_CURL = `curl -X POST https://yookpay.partner.ashtechpay.top/api/merchant/v1/payout \\
  -H "x-api-key: YKP_OUT_VOTRE_CLE" \\
  -H "Content-Type: application/json" \\
  -d '{
    "country":   "CM",
    "operator":  "MTN",
    "phone":     "237687194830",
    "amount":    5000,
    "feeBearer": "SENDER"
  }'`;

const PAYIN_CURL = `curl -X POST https://yookpay.partner.ashtechpay.top/api/merchant/v1/payin \\
  -H "x-api-key: YKP_IN_VOTRE_CLE" \\
  -H "Content-Type: application/json" \\
  -d '{
    "country":  "CM",
    "operator": "MTN",
    "phone":    "237687194830",
    "amount":   5000
  }'`;

const JS_PAYIN = `// Payin — encaisser un paiement
const response = await fetch('/api/merchant/v1/payin', {
  method: 'POST',
  headers: {
    'x-api-key': process.env.YOOKPAY_PAYIN_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    country:  'CM',
    operator: 'MTN',
    phone:    '237687194830',
    amount:   5000,
  }),
});

const result = await response.json();
// result.reference  → votre référence à stocker
// result.status     → "PENDING" (confirmation par webhook)`;

const JS_PAYOUT = `// Payout — distribuer de l'argent vers un mobile
const response = await fetch('/api/merchant/v1/payout', {
  method: 'POST',
  headers: {
    'x-api-key': process.env.YOOKPAY_PAYOUT_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    country:   'CM',
    operator:  'MTN',
    phone:     '237687194830',
    amount:    5000,
    feeBearer: 'SENDER', // ou "RECIPIENT"
  }),
});

const result = await response.json();
// result.phoneReceives → montant crédité sur le téléphone`;

export default function Docs() {
  return (
    <div className="min-h-screen bg-[#060b18] text-white">
      {/* Top nav */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#060b18]/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="text-white/60 hover:text-white h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <YookPayLogo className="h-7" />
            <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 text-xs">
              API v1
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/register">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 text-xs px-3">
                Créer un compte
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-8 py-10">
        {/* Sidebar nav */}
        <aside className="hidden lg:block w-56 shrink-0 sticky top-24 self-start">
          <div className="space-y-6 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-2">Démarrage</p>
              <div className="space-y-0.5">
                <NavLink href="#introduction" label="Introduction" />
                <NavLink href="#authentication" label="Authentification" />
                <NavLink href="#errors" label="Erreurs" />
                <NavLink href="#countries" label="Pays & Opérateurs" />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-2">Payin</p>
              <div className="space-y-0.5">
                <NavLink href="#payin-overview" label="Vue d'ensemble" />
                <NavLink href="#payin-request" label="Requête" />
                <NavLink href="#payin-response" label="Réponse" />
                <NavLink href="#payin-example" label="Exemples de code" />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-2">Payout</p>
              <div className="space-y-0.5">
                <NavLink href="#payout-overview" label="Vue d'ensemble" />
                <NavLink href="#payout-request" label="Requête" />
                <NavLink href="#payout-response" label="Réponse" />
                <NavLink href="#payout-example" label="Exemples de code" />
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 max-w-3xl space-y-16">

          {/* Introduction */}
          <Section id="introduction">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <BookOpen className="h-6 w-6 text-indigo-400" />
                <h1 className="text-3xl font-bold">Documentation API</h1>
              </div>
              <p className="text-white/60 text-lg leading-relaxed">
                L'API YookPay vous permet d'intégrer des paiements Mobile Money (XAF, XOF, CDF) directement dans votre application en quelques lignes de code.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                {[
                  { icon: Zap, label: "Simple", desc: "Une seule requête pour encaisser ou distribuer" },
                  { icon: Shield, label: "Sécurisé", desc: "Clés distinctes payin / payout, hash SHA-256" },
                  { icon: Globe, label: "Multi-pays", desc: "Cameroun, Sénégal, Côte d'Ivoire, RDC…" },
                ].map((f) => (
                  <div key={f.label} className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-1">
                    <f.icon className="h-4 w-4 text-indigo-400" />
                    <p className="font-semibold text-sm">{f.label}</p>
                    <p className="text-xs text-white/50">{f.desc}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
                <p className="font-semibold mb-1">Base URL</p>
                <code className="text-indigo-300 font-mono">https://yookpay.partner.ashtechpay.top</code>
              </div>
            </div>
          </Section>

          {/* Authentication */}
          <Section id="authentication">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-indigo-400" />
                <h2 className="text-2xl font-bold">Authentification</h2>
              </div>
              <p className="text-white/60">
                Toutes les requêtes doivent inclure votre clé API dans l'en-tête <code className="text-indigo-300">x-api-key</code>.
                Deux types de clés existent — chacune n'autorise que les opérations correspondantes.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <ArrowDownToLine className="h-4 w-4 text-blue-400" />
                    <span className="font-semibold text-blue-300">Clé Payin</span>
                  </div>
                  <p className="text-xs text-white/50">Préfixe <code className="text-blue-300">YKP_IN_</code></p>
                  <p className="text-sm text-white/60">Encaissement uniquement. Utilisez-la dans votre backend.</p>
                </div>
                <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <ArrowUpFromLine className="h-4 w-4 text-purple-400" />
                    <span className="font-semibold text-purple-300">Clé Payout</span>
                  </div>
                  <p className="text-xs text-white/50">Préfixe <code className="text-purple-300">YKP_OUT_</code></p>
                  <p className="text-sm text-white/60">Distribution d'argent. Protégez-la côté serveur.</p>
                </div>
              </div>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-200/80">
                ⚠ Ne jamais exposer vos clés dans du code client (JavaScript frontend, applications mobiles). Utilisez toujours un backend.
              </div>
            </div>
          </Section>

          {/* Errors */}
          <Section id="errors">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Codes d'erreur</h2>
              <div className="rounded-lg border border-white/10 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-white/50 font-medium">HTTP</th>
                      <th className="text-left px-4 py-2.5 text-white/50 font-medium">Code</th>
                      <th className="text-left px-4 py-2.5 text-white/50 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {[
                      ["401", "Unauthorized", "Clé API manquante, invalide ou révoquée"],
                      ["400", "ValidationError", "Paramètre manquant ou invalide"],
                      ["400", "InsufficientFunds", "Solde wallet insuffisant (payout)"],
                      ["400", "AmountTooLow", "Montant inférieur au minimum requis"],
                      ["500", "PayinFailed / PayoutFailed", "Erreur PixPay ou interne"],
                    ].map(([code, name, desc]) => (
                      <tr key={name} className="hover:bg-white/3">
                        <td className="px-4 py-2.5 font-mono text-red-400">{code}</td>
                        <td className="px-4 py-2.5 font-mono text-yellow-300 text-xs">{name}</td>
                        <td className="px-4 py-2.5 text-white/60">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>

          {/* Countries */}
          <Section id="countries">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Pays & Opérateurs</h2>
              <div className="rounded-lg border border-white/10 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-white/50 font-medium">Pays</th>
                      <th className="text-left px-4 py-2.5 text-white/50 font-medium">country</th>
                      <th className="text-left px-4 py-2.5 text-white/50 font-medium">Devise</th>
                      <th className="text-left px-4 py-2.5 text-white/50 font-medium">Opérateurs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {[
                      ["🇨🇲 Cameroun",      "CM", "XAF", "MTN, ORANGE"],
                      ["🇸🇳 Sénégal",       "SN", "XOF", "ORANGE, FREE, WAVE"],
                      ["🇨🇮 Côte d'Ivoire", "CI", "XOF", "MTN, ORANGE, MOOV, WAVE"],
                      ["🇧🇫 Burkina Faso",  "BF", "XOF", "ORANGE, MOOV"],
                      ["🇧🇯 Bénin",         "BJ", "XOF", "MTN, MOOV"],
                      ["🇲🇱 Mali",          "ML", "XOF", "ORANGE, MOOV"],
                      ["🇹🇬 Togo",          "TG", "XOF", "TOGOCEL, MOOV"],
                      ["🇨🇩 Congo RDC",     "CD", "CDF", "VODACOM, AIRTEL, ORANGE, AFRICELL"],
                    ].map(([country, code, currency, ops]) => (
                      <tr key={code} className="hover:bg-white/3">
                        <td className="px-4 py-2.5">{country}</td>
                        <td className="px-4 py-2.5 font-mono text-indigo-300">{code}</td>
                        <td className="px-4 py-2.5 font-mono text-emerald-300">{currency}</td>
                        <td className="px-4 py-2.5 text-white/60 text-xs">{ops}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <ArrowDownToLine className="h-5 w-5 text-blue-400 shrink-0" />
            <h2 className="text-xl font-bold text-blue-300">API Payin</h2>
            <div className="flex-1 h-px bg-blue-500/20" />
          </div>

          {/* Payin overview */}
          <Section id="payin-overview">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Vue d'ensemble</h3>
              <p className="text-white/60">
                L'endpoint payin permet d'encaisser un paiement depuis le téléphone d'un client vers votre wallet YookPay. Le client reçoit une notification sur son téléphone pour confirmer le paiement. Les frais configurés par votre gestionnaire de compte sont automatiquement déduits du montant.
              </p>
              <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                <Badge className="bg-blue-500 text-white text-xs shrink-0">POST</Badge>
                <code className="text-sm font-mono text-white/80">/api/merchant/v1/payin</code>
              </div>
            </div>
          </Section>

          {/* Payin request */}
          <Section id="payin-request">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Corps de la requête</h3>
              <div className="rounded-lg border border-white/10 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-white/50 font-medium">Champ</th>
                      <th className="text-left px-4 py-2.5 text-white/50 font-medium">Type</th>
                      <th className="text-left px-4 py-2.5 text-white/50 font-medium">Requis</th>
                      <th className="text-left px-4 py-2.5 text-white/50 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {[
                      ["country",  "string", "Oui", "Code pays ISO 2 lettres (ex : CM)"],
                      ["operator", "string", "Oui", "Opérateur en majuscules (ex : MTN)"],
                      ["phone",    "string", "Oui", "Numéro avec indicatif (ex : 237687194830)"],
                      ["amount",   "integer","Oui", "Montant en unité locale (ex : 5000 XAF)"],
                      ["metadata", "object", "Non", "Données libres renvoyées dans les webhooks"],
                    ].map(([f, t, r, d]) => (
                      <tr key={f} className="hover:bg-white/3">
                        <td className="px-4 py-2.5 font-mono text-indigo-300 text-xs">{f}</td>
                        <td className="px-4 py-2.5 text-white/50 text-xs">{t}</td>
                        <td className="px-4 py-2.5 text-xs">{r === "Oui" ? <span className="text-red-400">Oui</span> : <span className="text-white/40">Non</span>}</td>
                        <td className="px-4 py-2.5 text-white/60 text-xs">{d}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <CodeBlock code={PAYIN_REQUEST} language="HTTP" />
            </div>
          </Section>

          {/* Payin response */}
          <Section id="payin-response">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Réponse</h3>
              <CodeBlock code={PAYIN_RESPONSE} language="JSON" />
              <div className="rounded-lg border border-white/10 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-white/50 font-medium">Champ</th>
                      <th className="text-left px-4 py-2.5 text-white/50 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {[
                      ["reference",         "Référence unique YookPay — stockez-la dans votre base de données"],
                      ["providerReference", "Référence PixPay (opérateur tiers)"],
                      ["status",            "PENDING → SUCCESS / FAILED (mis à jour par webhook)"],
                      ["amount",            "Montant brut envoyé par le client"],
                      ["netAmount",         "Montant crédité dans votre wallet après frais"],
                      ["feeAmount",         "Frais prélevés"],
                      ["feeRate",           "Taux appliqué (ex : 0.04 = 4%)"],
                    ].map(([f, d]) => (
                      <tr key={f} className="hover:bg-white/3">
                        <td className="px-4 py-2.5 font-mono text-indigo-300 text-xs">{f}</td>
                        <td className="px-4 py-2.5 text-white/60 text-xs">{d}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>

          {/* Payin examples */}
          <Section id="payin-example">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Exemples de code</h3>
              <p className="text-sm text-white/50">cURL</p>
              <CodeBlock code={PAYIN_CURL} language="bash" />
              <p className="text-sm text-white/50">JavaScript / Node.js</p>
              <CodeBlock code={JS_PAYIN} language="javascript" />
            </div>
          </Section>

          {/* Payout divider */}
          <div className="flex items-center gap-3">
            <ArrowUpFromLine className="h-5 w-5 text-purple-400 shrink-0" />
            <h2 className="text-xl font-bold text-purple-300">API Payout</h2>
            <div className="flex-1 h-px bg-purple-500/20" />
          </div>

          {/* Payout overview */}
          <Section id="payout-overview">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Vue d'ensemble</h3>
              <p className="text-white/60">
                L'endpoint payout permet de distribuer de l'argent depuis votre wallet YookPay vers un numéro de téléphone mobile. Idéal pour les remboursements, salaires, commissions ou cashback. Le solde de votre wallet est débité au moment de l'appel.
              </p>
              <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                <Badge className="bg-purple-600 text-white text-xs shrink-0">POST</Badge>
                <code className="text-sm font-mono text-white/80">/api/merchant/v1/payout</code>
              </div>
              <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4 text-sm space-y-1 text-white/60">
                <p className="font-semibold text-white">feeBearer — qui paie les frais ?</p>
                <p><code className="text-purple-300">SENDER</code> — vous payez les frais, le téléphone reçoit le montant exact saisi.</p>
                <p><code className="text-purple-300">RECIPIENT</code> — le destinataire supporte les frais (montant reçu = montant – frais).</p>
              </div>
            </div>
          </Section>

          {/* Payout request */}
          <Section id="payout-request">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Corps de la requête</h3>
              <div className="rounded-lg border border-white/10 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-white/50 font-medium">Champ</th>
                      <th className="text-left px-4 py-2.5 text-white/50 font-medium">Type</th>
                      <th className="text-left px-4 py-2.5 text-white/50 font-medium">Requis</th>
                      <th className="text-left px-4 py-2.5 text-white/50 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {[
                      ["country",   "string",  "Oui", "Code pays ISO 2 lettres (ex : CM)"],
                      ["operator",  "string",  "Oui", "Opérateur en majuscules (ex : MTN)"],
                      ["phone",     "string",  "Oui", "Numéro avec indicatif (ex : 237687194830)"],
                      ["amount",    "integer", "Oui", "Montant en unité locale (ex : 5000 XAF)"],
                      ["feeBearer", "string",  "Non", "SENDER (défaut) ou RECIPIENT"],
                      ["metadata",  "object",  "Non", "Données libres"],
                    ].map(([f, t, r, d]) => (
                      <tr key={f} className="hover:bg-white/3">
                        <td className="px-4 py-2.5 font-mono text-purple-300 text-xs">{f}</td>
                        <td className="px-4 py-2.5 text-white/50 text-xs">{t}</td>
                        <td className="px-4 py-2.5 text-xs">{r === "Oui" ? <span className="text-red-400">Oui</span> : <span className="text-white/40">Non</span>}</td>
                        <td className="px-4 py-2.5 text-white/60 text-xs">{d}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <CodeBlock code={PAYOUT_REQUEST} language="HTTP" />
            </div>
          </Section>

          {/* Payout response */}
          <Section id="payout-response">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Réponse</h3>
              <CodeBlock code={PAYOUT_RESPONSE} language="JSON" />
              <div className="rounded-lg border border-white/10 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-white/50 font-medium">Champ</th>
                      <th className="text-left px-4 py-2.5 text-white/50 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {[
                      ["reference",         "Référence unique YookPay"],
                      ["providerReference", "Référence PixPay"],
                      ["status",            "PENDING → SUCCESS / FAILED"],
                      ["amount",            "Montant total débité de votre wallet"],
                      ["phoneReceives",     "Montant effectivement reçu sur le téléphone"],
                      ["feeAmount",         "Frais prélevés"],
                    ].map(([f, d]) => (
                      <tr key={f} className="hover:bg-white/3">
                        <td className="px-4 py-2.5 font-mono text-purple-300 text-xs">{f}</td>
                        <td className="px-4 py-2.5 text-white/60 text-xs">{d}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>

          {/* Payout examples */}
          <Section id="payout-example">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Exemples de code</h3>
              <p className="text-sm text-white/50">cURL</p>
              <CodeBlock code={PAYOUT_CURL} language="bash" />
              <p className="text-sm text-white/50">JavaScript / Node.js</p>
              <CodeBlock code={JS_PAYOUT} language="javascript" />
            </div>
          </Section>

          {/* CTA */}
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-8 text-center space-y-4">
            <h3 className="text-xl font-bold">Prêt à intégrer ?</h3>
            <p className="text-white/60">Créez votre compte, activez votre KYB et générez vos clés API depuis le tableau de bord.</p>
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
        © {new Date().getFullYear()} YookPay · <Link href="/" className="hover:text-white/60 transition-colors">Accueil</Link>
      </footer>
    </div>
  );
}
