import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { YookPayLogo } from "@/components/yookpay-logo";
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
} from "lucide-react";

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

      {/* ── Footer ── */}
      <footer className="border-t border-border py-10 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <YookPayLogo size="sm" />
          <p className="text-sm text-muted-foreground text-center">
            © {new Date().getFullYear()} YookPay. Tous droits réservés.
          </p>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/login"    className="hover:text-foreground transition-colors">Connexion</Link>
            <Link href="/register" className="hover:text-foreground transition-colors">Inscription</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
