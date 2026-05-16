import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { YookPayLogo } from "@/components/yookpay-logo";
import { SupportFloat } from "@/components/support-float";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import {
  ArrowRight,
  Shield,
  Zap,
  Globe,
  Smartphone,
  RefreshCw,
  ChevronRight,
  Bitcoin,
  Banknote,
  Users,
  TrendingUp,
  Phone,
} from "lucide-react";

interface SupportLinks {
  whatsapp_url: string;
  facebook_url: string;
  telegram_url: string;
  phone_url: string;
}

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);
const TelegramIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);
const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const OPERATORS = [
  { name: "Orange Money", flag: "🇨🇮🇸🇳🇧🇫", color: "bg-orange-500" },
  { name: "MTN MoMo",     flag: "🇨🇮🇨🇲",     color: "bg-yellow-400" },
  { name: "Wave",         flag: "🇸🇳🇨🇮",     color: "bg-blue-500" },
  { name: "Moov Money",   flag: "🇨🇮🇧🇫",     color: "bg-green-500" },
  { name: "Free Money",   flag: "🇸🇳",         color: "bg-red-500" },
  { name: "USDT (TRC-20)",flag: "🌐",           color: "bg-emerald-400" },
];

const COUNTRIES = [
  { name: "Côte d'Ivoire", flag: "🇨🇮", currency: "XOF" },
  { name: "Sénégal",       flag: "🇸🇳", currency: "XOF" },
  { name: "Cameroun",      flag: "🇨🇲", currency: "XAF" },
  { name: "Burkina Faso",  flag: "🇧🇫", currency: "XOF" },
  { name: "Bénin",         flag: "🇧🇯", currency: "XOF" },
  { name: "Mali",          flag: "🇲🇱", currency: "XOF" },
  { name: "Togo",          flag: "🇹🇬", currency: "XOF" },
  { name: "Congo RDC",     flag: "🇨🇩", currency: "CDF" },
];

const FEATURES = [
  {
    icon: Smartphone,
    title: "Mobile Money Unifié",
    desc: "Orange, MTN, Wave, Moov, Free — gérez tous vos comptes mobile money depuis une seule plateforme.",
    color: "text-cyan-400",
    bg: "bg-cyan-400/10",
  },
  {
    icon: Globe,
    title: "Multi-Devises",
    desc: "XAF, XOF, CDF et USDT. Convertissez instantanément entre devises africaines et crypto.",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
  },
  {
    icon: Zap,
    title: "Transactions Rapides",
    desc: "Dépôts et retraits traités en moins de 5 minutes. Notifications en temps réel.",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
  },
  {
    icon: Shield,
    title: "Sécurisé & Conforme",
    desc: "Vérification KYC, chiffrement de bout en bout, et conformité aux réglementations locales.",
    color: "text-purple-400",
    bg: "bg-purple-400/10",
  },
  {
    icon: RefreshCw,
    title: "Conversions Automatiques",
    desc: "Taux de change compétitifs mis à jour en temps réel. Convertissez USDT ↔ XOF/XAF/CDF facilement.",
    color: "text-pink-400",
    bg: "bg-pink-400/10",
  },
  {
    icon: Bitcoin,
    title: "Crypto Intégré",
    desc: "Déposez et retirez en USDT via TRC-20. Passerelle entre crypto et mobile money.",
    color: "text-orange-400",
    bg: "bg-orange-400/10",
  },
];

const STATS = [
  { value: "8",    label: "Pays couverts",      icon: Globe },
  { value: "6+",   label: "Opérateurs intégrés", icon: Smartphone },
  { value: "< 5m", label: "Délai de traitement", icon: Zap },
  { value: "24/7", label: "Disponibilité",       icon: TrendingUp },
];

export default function Landing() {
  const { data: supportLinks } = useQuery<SupportLinks>({
    queryKey: ["support-links"],
    queryFn: () => customFetch<SupportLinks>("/api/support-links"),
    staleTime: 5 * 60_000,
  });

  const contactChannels = [
    { key: "whatsapp_url" as const, label: "WhatsApp", icon: WhatsAppIcon, color: "bg-[#25D366] hover:bg-[#1ebe5c] text-white" },
    { key: "telegram_url" as const, label: "Telegram", icon: TelegramIcon, color: "bg-[#229ED9] hover:bg-[#1a8fc4] text-white" },
    { key: "facebook_url" as const, label: "Facebook", icon: FacebookIcon, color: "bg-[#1877F2] hover:bg-[#1467d6] text-white" },
    { key: "phone_url"    as const, label: "Service client", icon: null,         color: "bg-amber-500 hover:bg-amber-400 text-white" },
  ].filter((c) => supportLinks?.[c.key]?.trim());

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <YookPayLogo size="md" />
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#fonctionnalites" className="hover:text-foreground transition-colors">Fonctionnalités</a>
            <a href="#pays"           className="hover:text-foreground transition-colors">Pays</a>
            <a href="#operateurs"     className="hover:text-foreground transition-colors">Opérateurs</a>
            <Link href="/docs" className="hover:text-foreground transition-colors">API</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Connexion</Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold">
                Créer un compte
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-20 pb-32 px-4">
        {/* background glow */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-emerald-500/8 blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium mb-8">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            Plateforme de paiement africaine
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
            Le wallet{" "}
            <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              tout-en-un
            </span>
            {" "}pour l'Afrique
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Déposez, retirez et convertissez votre argent mobile en toute simplicité. 
            YookPay unifie Orange Money, MTN MoMo, Wave, Moov et USDT dans une seule application.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-base px-8 h-12 gap-2">
                Ouvrir un compte gratuit
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="h-12 px-8 text-base gap-2">
                Se connecter
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats row */}
        <div className="max-w-4xl mx-auto mt-20 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {STATS.map(({ value, label, icon: Icon }) => (
            <div key={label} className="rounded-2xl bg-card border border-border p-5 text-center">
              <Icon className="w-5 h-5 text-cyan-400 mx-auto mb-2" />
              <div className="text-2xl font-extrabold text-foreground">{value}</div>
              <div className="text-xs text-muted-foreground mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="fonctionnalites" className="py-24 px-4 bg-card/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">
              Tout ce dont vous avez besoin
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Une plateforme pensée pour les marchés africains, avec des intégrations natives aux opérateurs locaux.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc, color, bg }) => (
              <div key={title} className="rounded-2xl bg-card border border-border p-6 hover:border-cyan-500/30 transition-colors group">
                <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center mb-4`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <h3 className="font-bold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Countries ── */}
      <section id="pays" className="py-24 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">Disponible dans 8 pays</h2>
          <p className="text-muted-foreground text-lg mb-12">
            XOF, XAF, CDF et USDT — les devises qui font tourner l'économie africaine.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {COUNTRIES.map(({ name, flag, currency }) => (
              <div key={name} className="rounded-2xl bg-card border border-border p-5 flex flex-col items-center gap-2 hover:border-cyan-500/30 transition-colors">
                <span className="text-4xl">{flag}</span>
                <span className="font-semibold text-sm text-foreground text-center">{name}</span>
                <span className="text-xs text-muted-foreground font-mono">{currency}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Operators ── */}
      <section id="operateurs" className="py-24 px-4 bg-card/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">Opérateurs supportés</h2>
          <p className="text-muted-foreground text-lg mb-12">
            Connectez tous vos comptes mobile money et crypto depuis une seule interface.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            {OPERATORS.map(({ name, flag, color }) => (
              <div key={name} className="flex items-center gap-3 px-5 py-3 rounded-full bg-card border border-border hover:border-cyan-500/30 transition-colors">
                <span className="text-xl">{flag}</span>
                <span className="font-medium text-sm">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto relative overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-600/20 to-emerald-600/20 border border-cyan-500/20 p-12 text-center">
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-emerald-500/5" />
          </div>
          <Users className="w-12 h-12 text-cyan-400 mx-auto mb-6" />
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">
            Rejoignez YookPay aujourd'hui
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
            Inscription gratuite et rapide. Commencez à envoyer et recevoir de l'argent en Afrique en moins de 5 minutes.
          </p>
          <Link href="/register">
            <Button size="lg" className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-base px-10 h-12 gap-2">
              Créer mon compte gratuitement
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Contact / Support ── */}
      {contactChannels.length > 0 && (
        <section className="py-16 px-4 bg-muted/30">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">Besoin d'aide ?</h2>
            <p className="text-muted-foreground mb-8">
              Notre équipe est disponible 24h/24 pour répondre à vos questions.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {contactChannels.map(({ key, label, icon: Icon, color }) => (
                <a
                  key={key}
                  href={supportLinks![key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2.5 px-5 py-3 rounded-full font-semibold text-sm shadow-md transition-all ${color}`}
                >
                  {Icon ? <Icon /> : <Phone className="w-5 h-5" />}
                  {label}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Footer ── */}
      <footer className="border-t border-border py-10 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <YookPayLogo size="sm" />
          <p className="text-sm text-muted-foreground text-center">
            © {new Date().getFullYear()} YookPay. Tous droits réservés.
          </p>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/docs"     className="hover:text-foreground transition-colors">Documentation API</Link>
            <Link href="/login"    className="hover:text-foreground transition-colors">Connexion</Link>
            <Link href="/register" className="hover:text-foreground transition-colors">Inscription</Link>
          </div>
        </div>
      </footer>

      <SupportFloat />
    </div>
  );
}
