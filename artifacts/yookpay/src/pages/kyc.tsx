import { useRef, useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Command, CommandEmpty, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, Clock, AlertCircle, Upload, Trash2, User, Building2,
  ShieldCheck, ChevronRight, ChevronLeft, PenLine, RotateCcw, FileText,
  ChevronsUpDown, Check,
} from "lucide-react";

// ── Business categories ──────────────────────────────────────────────────────
const BUSINESS_CATEGORIES = [
  // Activités en ligne
  "E-commerce général", "Mode & Vêtements en ligne", "Électronique & High-tech",
  "Cosmétiques & Beauté en ligne", "Alimentation & Livraison de repas",
  "Épicerie en ligne", "Pharmacie en ligne", "Services financiers & Fintech",
  "Crypto-monnaies & Blockchain", "Jeux vidéo & Gaming",
  "Streaming & Médias numériques", "Logiciels SaaS",
  "Développement web & Mobile", "Design graphique & Création",
  "Marketing digital & SEO", "Publicité en ligne",
  "Réseaux sociaux & Influenceurs", "Photographie & Vidéographie en ligne",
  "Formation en ligne & E-learning", "Coaching & Consulting en ligne",
  "Traduction & Interprétation", "Rédaction & Copywriting",
  "Musique & Podcasts", "Vente de tickets en ligne",
  "Voyages & Tourisme en ligne", "Immobilier en ligne",
  "Vente de voitures en ligne", "Vente de motos en ligne",
  "Marketplace & Petites annonces", "Artisanat & Produits faits main",
  "Livres & Publications numériques", "Imprimerie & Print on demand",
  "Services juridiques en ligne", "Comptabilité & Finance en ligne",
  "Santé & Télémédecine", "Télécommunications",
  "Hébergement web & Cloud", "Sécurité informatique",
  "Intelligence artificielle", "Robotique & Automatisation",
  "NFT & Art numérique", "Dropshipping",
  "Affiliation marketing", "Crowdfunding & Investissement",
  "Assurance en ligne", "Banque en ligne",
  "Transfert d'argent", "Paiement mobile",
  "Location de voitures en ligne", "Agence de voyage en ligne",
  // Activités physiques
  "Restaurant & Fast food", "Hôtel & Hébergement",
  "Café & Salon de thé", "Boulangerie & Pâtisserie",
  "Épicerie & Supermarché", "Pharmacie & Parapharmacie",
  "Clinique médicale", "Dentiste & Orthodontie",
  "Opticien", "Coiffeur & Barbier",
  "Salon de beauté & Spa", "Centre de fitness & Gym",
  "École & Formation", "Université & Institut",
  "Garde d'enfants & Crèche", "Architecte & BTP",
  "Électricien & Plombier", "Maçonnerie & Travaux",
  "Menuiserie & Ébénisterie", "Peinture & Décoration",
  "Nettoyage & Entretien", "Sécurité & Gardiennage",
  "Transport & Logistique", "Import & Export",
  "Agriculture & Élevage", "Pêche & Aquaculture",
  "Mines & Extraction", "Industrie manufacturière",
  "Usine & Production", "Textile & Couture",
  "Bijouterie & Joaillerie", "Horlogerie",
  "Imprimerie physique", "Librairie & Papeterie",
  "Quincaillerie", "Matériaux de construction",
  "Garage & Mécanique auto", "Vente de véhicules",
  "Location de véhicules", "Station-service",
  "Compagnie aérienne", "Agence de voyage physique",
  "Centre commercial & Mall", "Boutique de vêtements",
  "Chaussures & Maroquinerie", "Électroménager & Cuisine",
  "Mobilier & Décoration", "Luminaires & Éclairage",
  "Jardinage & Paysagisme", "Animalerie & Vétérinaire",
  "Librairie musicale & Instruments", "Studio d'enregistrement",
  "Cinéma & Spectacles", "Salle de concert & Événements",
  "Théâtre & Arts de scène", "Musée & Galerie d'art",
  "Sport & Équipements sportifs", "Club sportif",
  "Piscine & Centre aquatique", "Hôpital & Centre médical",
  "Pharmacie traditionnelle", "Médecine traditionnelle",
  "Kinésithérapie & Rééducation", "Laboratoire d'analyses",
  "Radiologie & Imagerie médicale", "Location immobilière",
  "Agence immobilière", "Notaire & Avocat",
  "Huissier de justice", "Comptable & Expert-comptable",
  "Assurance physique", "Banque & Microfinance",
  "Caisse d'épargne", "Fonds de placement",
  "Décoration d'événements", "Traiteur & Catering",
  "Photographe de mariage", "Organisation de mariages",
  "Fournitures de bureau", "Photocopie & Numérisation",
  "Bureau de change", "Western Union & MoneyGram",
  "Agence de communication", "Agence publicitaire",
  "Production audiovisuelle", "Studio photo & Vidéo",
  "Tatouage & Piercing", "Bien-être & Massage",
  "Cours de danse", "Cours de langues",
  "Auto-école", "Moto-école",
  "Centre de formation professionnelle", "Incubateur & Accélérateur",
  "Association & ONG", "Organisation internationale",
  "Ambassade & Consulat", "Administration publique",
  "Collectivité territoriale", "Syndicat professionnel",
  "Fondation & Philanthropie", "Église & Mosquée",
  "Restauration scolaire & Cantine", "Hébergement d'urgence",
  "Recyclage & Environnement", "Énergie solaire & Renouvelable",
  "Eau & Assainissement", "Téléphonie & Réparation mobile",
  "Informatique & Dépannage PC", "Installation CCTV & Alarmes",
  "Fournitures médicales", "Équipements industriels",
  "Équipements agricoles", "Semences & Engrais",
  "Bois & Scierie", "Pêcherie & Poissonnerie",
  "Boucherie & Charcuterie", "Pâtisserie artisanale",
  "Distillerie & Brasserie", "Eaux minérales & Boissons",
  "Tabac & Cigarettes", "Produits pharmaceutiques",
  "Cosmétiques artisanaux", "Savonnerie & Détergents",
  "Emballages & Packaging", "Plastiques & Caoutchouc",
  "Métallurgie & Forge", "Carrelage & Plâtrerie",
  "Peintures & Vernis industriels", "Composants électroniques",
  "Équipements de bureau", "Mobilier de bureau",
  "Fournitures scolaires", "Jouets & Jeux",
  "Fournitures de fêtes", "Fleurs & Plantes ornementales",
  "Décoration intérieure", "Climatisation & Froid",
  "Générateurs & Groupes électrogènes", "Panneaux solaires & Batteries",
  "Pompes & Irrigation", "Chantiers & Terrassement",
  "Sondage & Forage", "Expertise immobilière",
  "Géomètre & Topographe", "Chimie & Produits industriels",
  "Trading & Négoce international", "Multi-services & Divers",
  "Autre activité",
];

const BUSINESS_TYPES = [
  "SARL — Société à Responsabilité Limitée",
  "SARLU — Société à Responsabilité Limitée Unipersonnelle",
  "SA — Société Anonyme",
  "SAS — Société par Actions Simplifiée",
  "SNC — Société en Nom Collectif",
  "SCA — Société en Commandite par Actions",
  "SCS — Société en Commandite Simple",
  "GIE — Groupement d'Intérêt Économique",
  "Entreprise Individuelle",
  "Auto-entrepreneur / Micro-entreprise",
  "Coopérative",
  "Association / ONG",
  "Autre forme juridique",
];

// ── Schemas ──────────────────────────────────────────────────────────────────
const kycSchema = z.object({
  fullName:    z.string().min(2, "Nom requis").max(255),
  dateOfBirth: z.string().min(1, "Date requise"),
  docType:     z.enum(["CNI", "PASSEPORT", "PERMIS", "SEJOUR"], { required_error: "Sélectionnez un type de document" }),
  docNumber:   z.string().min(1, "Numéro requis").max(100),
});

const kybSchema = z.object({
  businessDescription: z.string().min(10, "Description trop courte (min 10 caractères)").max(4000),
  businessWebsite:     z.string().max(500).optional().default(""),
  businessCategory:    z.string().min(1, "Sélectionnez une catégorie"),
  businessType:        z.string().min(1, "Sélectionnez le type d'entreprise"),
  niuNumber:           z.string().max(100).optional().default(""),
  rccmNumber:          z.string().max(100).optional().default(""),
});

type KycValues = z.infer<typeof kycSchema>;
type KybValues = z.infer<typeof kybSchema>;

// ── File upload helper ───────────────────────────────────────────────────────
function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Signature pad ────────────────────────────────────────────────────────────
function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing   = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top)  * scaleY,
      };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    drawing.current = true;
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    const pos    = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }, []);

  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    const pos    = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.stroke();
    setHasSignature(true);
  }, []);

  const endDraw = useCallback(() => {
    drawing.current = false;
    if (canvasRef.current && hasSignature) {
      onChange(canvasRef.current.toDataURL("image/png"));
    }
  }, [hasSignature, onChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener("mousedown",  startDraw as any);
    canvas.addEventListener("mousemove",  draw      as any);
    canvas.addEventListener("mouseup",    endDraw);
    canvas.addEventListener("mouseleave", endDraw);
    canvas.addEventListener("touchstart", startDraw as any, { passive: false });
    canvas.addEventListener("touchmove",  draw      as any, { passive: false });
    canvas.addEventListener("touchend",   endDraw);
    return () => {
      canvas.removeEventListener("mousedown",  startDraw as any);
      canvas.removeEventListener("mousemove",  draw      as any);
      canvas.removeEventListener("mouseup",    endDraw);
      canvas.removeEventListener("mouseleave", endDraw);
      canvas.removeEventListener("touchstart", startDraw as any);
      canvas.removeEventListener("touchmove",  draw      as any);
      canvas.removeEventListener("touchend",   endDraw);
    };
  }, [startDraw, draw, endDraw]);

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="border-2 border-dashed rounded-lg overflow-hidden bg-white dark:bg-zinc-900 touch-none" style={{ cursor: "crosshair" }}>
        <canvas
          ref={canvasRef}
          width={600}
          height={180}
          className="w-full"
          style={{ display: "block" }}
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <PenLine className="h-3.5 w-3.5" />
          Signez à l'intérieur du cadre (souris ou doigt)
        </p>
        {hasSignature && (
          <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-xs text-destructive hover:text-destructive" onClick={clear}>
            <RotateCcw className="h-3.5 w-3.5" />
            Effacer et resignez
          </Button>
        )}
      </div>
    </div>
  );
}

// ── File upload slot ─────────────────────────────────────────────────────────
function FileSlot({
  label, accept, file, onChange, required,
}: {
  label: string; accept: string;
  file: { name: string; preview?: string } | null;
  onChange: (f: { name: string; data: string } | null) => void;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      alert("Fichier trop volumineux (max 10 Mo)");
      return;
    }
    const data = await toBase64(f);
    onChange({ name: f.name, data });
    e.target.value = "";
  };

  return (
    <div
      className={`border-2 rounded-lg p-3 cursor-pointer hover:border-primary/60 transition-colors ${file ? "border-green-400 dark:border-green-700 bg-green-50/30 dark:bg-green-950/10" : "border-dashed border-muted-foreground/30"}`}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFile} />
      <div className="flex items-center gap-3">
        <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${file ? "bg-green-100 dark:bg-green-900/30" : "bg-muted"}`}>
          {file ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Upload className="h-5 w-5 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {label}{required && <span className="text-destructive ml-0.5">*</span>}
          </p>
          {file
            ? <p className="text-xs text-green-600 truncate">{file.name}</p>
            : <p className="text-xs text-muted-foreground">Cliquer pour sélectionner</p>}
        </div>
        {file && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-destructive hover:bg-destructive/10"
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Category combobox with live search ───────────────────────────────────────
function CategoryCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal text-left h-auto min-h-9 py-2"
        >
          <span className={`truncate ${!value ? "text-muted-foreground" : ""}`}>
            {value || "Rechercher parmi les activités…"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Taper pour rechercher…" autoFocus />
          <CommandList className="max-h-64">
            <CommandEmpty>Aucune activité trouvée.</CommandEmpty>
            {BUSINESS_CATEGORIES.map((cat) => (
              <CommandItem
                key={cat}
                value={cat}
                onSelect={(v) => {
                  onChange(v === value ? "" : v);
                  setOpen(false);
                }}
              >
                <Check className={`mr-2 h-4 w-4 shrink-0 ${value === cat ? "opacity-100" : "opacity-0"}`} />
                {cat}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function Kyc() {
  const qc    = useQueryClient();
  const { toast } = useToast();
  const [step, setStep]         = useState<1 | 2>(1);
  const [stepAutoSet, setStepAutoSet] = useState(false);

  // Files for step 1
  const [frontFile,  setFrontFile]  = useState<{ name: string; data: string } | null>(null);
  const [backFile,   setBackFile]   = useState<{ name: string; data: string } | null>(null);
  const [selfieFile, setSelfieFile] = useState<{ name: string; data: string } | null>(null);
  // Files for step 2
  const [statutsFile, setStatutsFile] = useState<{ name: string; data: string } | null>(null);
  const [rccmFile,    setRccmFile]    = useState<{ name: string; data: string } | null>(null);
  const [niuFile,     setNiuFile]     = useState<{ name: string; data: string } | null>(null);
  const [planLocFile, setPlanLocFile] = useState<{ name: string; data: string } | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ profile: any; documents: any[] }>({
    queryKey: ["kyc"],
    queryFn: () => customFetch<any>("/api/kyc"),
  });

  const profile = data?.profile ?? null;

  const kycForm = useForm<KycValues>({
    resolver: zodResolver(kycSchema),
    defaultValues: { fullName: "", dateOfBirth: "", docNumber: "" },
  });

  const kybForm = useForm<KybValues>({
    resolver: zodResolver(kybSchema),
    defaultValues: { businessDescription: "", businessWebsite: "", businessCategory: "", businessType: "" },
  });

  // Pre-fill forms and auto-navigate when profile is loaded
  useEffect(() => {
    if (!profile) return;
    // Pre-fill KYC identity
    if (profile.fullName)    kycForm.setValue("fullName",    profile.fullName);
    if (profile.dateOfBirth) kycForm.setValue("dateOfBirth", profile.dateOfBirth?.split("T")[0] ?? "");
    if (profile.docType)     kycForm.setValue("docType",     profile.docType);
    if (profile.docNumber)   kycForm.setValue("docNumber",   profile.docNumber);
    // Pre-fill KYB
    if (profile.businessDescription) kybForm.setValue("businessDescription", profile.businessDescription);
    if (profile.businessWebsite)     kybForm.setValue("businessWebsite",     profile.businessWebsite ?? "");
    if (profile.businessCategory)    kybForm.setValue("businessCategory",    profile.businessCategory);
    if (profile.businessType)        kybForm.setValue("businessType",        profile.businessType);
    if (profile.niuNumber)           kybForm.setValue("niuNumber",           profile.niuNumber ?? "");
    if (profile.rccmNumber)          kybForm.setValue("rccmNumber",          profile.rccmNumber ?? "");
    // Auto-jump to step 2 if identity already registered (regardless of status)
    if (!stepAutoSet) {
      setStepAutoSet(true);
      if (profile.fullName) {
        setStep(2);
      }
    }
  }, [profile]);

  const kycMutation = useMutation({
    mutationFn: (values: KycValues) =>
      customFetch("/api/kyc/identity", {
        method: "POST",
        body: JSON.stringify({ ...values, frontFile, backFile, selfieFile }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kyc"] });
      setStep(2);
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const kybMutation = useMutation({
    mutationFn: (values: KybValues) => {
      if (!signatureData) throw new Error("Veuillez signer dans le cadre prévu");
      return customFetch("/api/kyc/kyb", {
        method: "POST",
        body: JSON.stringify({ ...values, signatureData, statutsFile, rccmFile, niuFile, planLocFile }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kyc"] });
      toast({ title: "Dossier soumis ✓", description: "Votre dossier KYC/KYB est en cours de vérification." });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const statusConfig: Record<string, { label: string; className: string; icon: any }> = {
    NOT_STARTED: { label: "Non démarré",              className: "text-muted-foreground border-muted-foreground/30",                                       icon: AlertCircle },
    PENDING:     { label: "En cours de vérification", className: "text-amber-700 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400",   icon: Clock },
    VERIFIED:    { label: "Vérifié ✓",                className: "text-green-700 border-green-200 bg-green-50 dark:bg-green-950/20 dark:text-green-400",   icon: ShieldCheck },
    APPROVED:    { label: "Approuvé ✓",               className: "text-green-700 border-green-200 bg-green-50 dark:bg-green-950/20 dark:text-green-400",   icon: ShieldCheck },
    REJECTED:    { label: "Rejeté",                   className: "text-red-700 border-red-200 bg-red-50 dark:bg-red-950/20 dark:text-red-400",             icon: AlertCircle },
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const kycStatus = profile?.kycStatus ?? "NOT_STARTED";
  const kybStatus = profile?.kybStatus ?? "NOT_STARTED";
  const kycConf   = statusConfig[kycStatus];
  const kybConf   = statusConfig[kybStatus];

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Vérification KYC / KYB</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Complétez votre vérification d'identité et d'activité professionnelle.
        </p>
      </div>

      {/* Status overview */}
      {profile && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Identité (KYC)</p>
                <Badge variant="outline" className={`text-xs ${kycConf.className}`}>
                  {kycConf.label}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Entreprise (KYB)</p>
                <Badge variant="outline" className={`text-xs ${kybConf.className}`}>
                  {kybConf.label}
                </Badge>
              </div>
            </div>
            {profile.adminNotes && (
              <div className="mt-3 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded p-2">
                Note admin : {profile.adminNotes}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${step === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          <User className="h-4 w-4" />
          1. Identité (KYC)
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${step === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          <Building2 className="h-4 w-4" />
          2. Entreprise (KYB)
        </div>
      </div>

      {/* ── STEP 1 — Identity ── */}
      {step === 1 && (
        <Form {...kycForm}>
          <form onSubmit={kycForm.handleSubmit((v) => kycMutation.mutate(v))} className="space-y-5">
            {/* Banner when returning to edit already-saved KYC */}
            {profile?.fullName && profile?.kycStatus !== "NOT_STARTED" && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 px-4 py-3 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-700 dark:text-blue-300">Modification de l'identité</p>
                  <p className="text-blue-600 dark:text-blue-400 text-xs mt-0.5">
                    Votre identité est déjà enregistrée. Modifiez les champs souhaités puis cliquez sur "Enregistrer et continuer".
                  </p>
                </div>
              </div>
            )}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Informations personnelles
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={kycForm.control} name="fullName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom complet <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input placeholder="Jean-Baptiste Ekounou" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={kycForm.control} name="dateOfBirth" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de naissance <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={kycForm.control} name="docType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type de document <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="CNI">Carte Nationale d'Identité (CNI)</SelectItem>
                        <SelectItem value="PASSEPORT">Passeport</SelectItem>
                        <SelectItem value="PERMIS">Permis de conduire</SelectItem>
                        <SelectItem value="SEJOUR">Carte de séjour</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={kycForm.control} name="docNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Numéro du document <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input placeholder="123456789" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Scans du document</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <FileSlot
                  label="Recto de la pièce d'identité"
                  accept="image/*,.pdf"
                  file={frontFile}
                  onChange={setFrontFile}
                  required
                />
                <FileSlot
                  label="Verso de la pièce d'identité"
                  accept="image/*,.pdf"
                  file={backFile}
                  onChange={setBackFile}
                  required
                />
                <FileSlot
                  label="Selfie avec la pièce d'identité"
                  accept="image/*"
                  file={selfieFile}
                  onChange={setSelfieFile}
                  required
                />
                <p className="text-xs text-muted-foreground">Formats acceptés : JPG, PNG, PDF · Max 10 Mo par fichier</p>
                <p className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded p-2">
                  📸 Le selfie doit vous montrer tenant votre pièce d'identité ouverte, lisible, face caméra.
                </p>
              </CardContent>
            </Card>

            <Button type="submit" className="w-full gap-2" disabled={kycMutation.isPending}>
              {kycMutation.isPending
                ? "Enregistrement…"
                : (profile?.fullName && profile?.kycStatus !== "NOT_STARTED")
                  ? "Enregistrer les modifications et continuer"
                  : "Suivant : Vérification Entreprise"}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </form>
        </Form>
      )}

      {/* ── STEP 2 — KYB ── */}
      {step === 2 && (
        <Form {...kybForm}>
          <form onSubmit={kybForm.handleSubmit((v) => kybMutation.mutate(v))} className="space-y-5">
            {/* KYC already saved indicator */}
            {profile?.fullName && (
              <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>
                    <span className="font-medium">Identité enregistrée ✓</span>
                    <span className="text-xs text-green-600 dark:text-green-500 ml-1">— {profile.fullName}</span>
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/20 gap-1 shrink-0"
                  onClick={() => setStep(1)}
                >
                  <ChevronLeft className="h-3 w-3" />
                  Modifier
                </Button>
              </div>
            )}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  Informations de l'entreprise
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={kybForm.control} name="businessDescription" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description de l'activité <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Décrivez brièvement votre activité, vos produits ou services proposés…"
                        className="min-h-[100px]"
                        maxLength={4000}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-right">{(field.value ?? "").length}/4000</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={kybForm.control} name="businessWebsite" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site web ou lien</FormLabel>
                    <FormControl><Input placeholder="https://monsite.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={kybForm.control} name="businessCategory" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catégorie d'activité <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <CategoryCombobox value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={kybForm.control} name="businessType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Forme juridique <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {BUSINESS_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={kybForm.control} name="niuNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Numéro NIU</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex : P012345678901N" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={kybForm.control} name="rccmNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Numéro RCCM</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex : RC/DLA/2023/B/1234" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Documents de l'entreprise
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <FileSlot label="Statuts de l'entreprise" accept=".pdf,application/pdf" file={statutsFile} onChange={setStatutsFile} required />
                <FileSlot label="RCCM (Registre du Commerce)" accept=".pdf,application/pdf" file={rccmFile} onChange={setRccmFile} required />
                <FileSlot label="NIU (Numéro d'Identification Unique)" accept=".pdf,image/*" file={niuFile} onChange={setNiuFile} required />
                <FileSlot label="Plan de localisation" accept=".pdf,image/*" file={planLocFile} onChange={setPlanLocFile} />
                <p className="text-xs text-muted-foreground">PDF ou image · Max 10 Mo par fichier</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <PenLine className="h-4 w-4 text-primary" />
                  Signature électronique
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SignaturePad onChange={setSignatureData} />
                {kybMutation.isError && !signatureData && (
                  <p className="text-xs text-destructive mt-1">Veuillez apposer votre signature</p>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button type="button" variant="outline" className="gap-2" onClick={() => setStep(1)}>
                <ChevronLeft className="h-4 w-4" />
                Retour
              </Button>
              <Button
                type="submit"
                className="flex-1 gap-2"
                disabled={kybMutation.isPending || !signatureData}
              >
                {kybMutation.isPending ? "Soumission…" : "Soumettre le dossier"}
                <ShieldCheck className="h-4 w-4" />
              </Button>
            </div>

            {kybMutation.isSuccess && (
              <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-4 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-green-700 dark:text-green-400">Dossier soumis avec succès !</p>
                  <p className="text-sm text-green-600 dark:text-green-500 mt-0.5">
                    Votre dossier KYC/KYB est en cours de vérification. Vous serez informé par email sous 24 à 48 heures.
                  </p>
                </div>
              </div>
            )}
          </form>
        </Form>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Formats acceptés : PDF, JPG, PNG · Délai de vérification : 24 à 48 heures ouvrables
      </p>
    </div>
  );
}
