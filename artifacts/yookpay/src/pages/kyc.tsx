import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  Clock,
  Upload,
  Trash2,
  AlertCircle,
  FileText,
  User,
  Building2,
  Home,
  Camera,
  ShieldCheck,
} from "lucide-react";

type DocStatus = "PENDING" | "VERIFIED" | "REJECTED";

interface KycDoc {
  id: number;
  type: string;
  status: DocStatus;
  fileName: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface KycData {
  documents: KycDoc[];
  kycStatus: "NOT_STARTED" | "PENDING" | "VERIFIED";
  missingDocuments: string[];
}

const DOC_META: Record<string, { label: string; description: string; icon: React.ComponentType<{ className?: string }> }> = {
  CNI:             { label: "Carte Nationale d'Identité",   description: "Recto et verso de votre CNI en cours de validité.",                icon: User },
  PASSEPORT:       { label: "Passeport",                    description: "Page principale de votre passeport biométrique.",                  icon: FileText },
  RCCM:            { label: "Registre de Commerce (RCCM)",  description: "Document officiel d'enregistrement de votre entreprise.",          icon: Building2 },
  JUSTIF_DOMICILE: { label: "Justificatif de Domicile",     description: "Facture d'eau, d'électricité ou relevé bancaire de moins de 3 mois.", icon: Home },
  PHOTO_SELFIE:    { label: "Photo Selfie",                 description: "Photo de vous tenant votre pièce d'identité devant vous.",         icon: Camera },
};

const STATUS_BADGE: Record<DocStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  PENDING:  { label: "En attente",  variant: "secondary", className: "text-amber-700 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-400" },
  VERIFIED: { label: "Vérifié",     variant: "secondary", className: "text-green-700 border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 dark:text-green-400" },
  REJECTED: { label: "Rejeté",      variant: "destructive", className: "" },
};

function StatusIcon({ status }: { status: DocStatus | undefined }) {
  if (status === "VERIFIED") return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  if (status === "PENDING")  return <Clock className="h-5 w-5 text-amber-500" />;
  if (status === "REJECTED") return <AlertCircle className="h-5 w-5 text-destructive" />;
  return <Upload className="h-5 w-5 text-muted-foreground" />;
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function Kyc() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [uploading, setUploading] = useState<string | null>(null);

  const { data, isLoading } = useQuery<KycData>({
    queryKey: ["kyc"],
    queryFn: () => customFetch<KycData>("/api/kyc"),
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ type, file }: { type: string; file: File }) => {
      const fileData = await toBase64(file);
      return customFetch("/api/kyc", {
        method: "POST",
        body: JSON.stringify({ type, fileName: file.name, fileData }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kyc"] });
      toast({ title: "Document soumis", description: "Votre document est en cours de vérification." });
      setUploading(null);
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
      setUploading(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      customFetch(`/api/kyc/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kyc"] });
      toast({ title: "Document supprimé" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const handleFileChange = async (type: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Fichier trop volumineux", description: "Taille maximale : 5 Mo.", variant: "destructive" });
      return;
    }
    setUploading(type);
    uploadMutation.mutate({ type, file });
    e.target.value = "";
  };

  const docMap = Object.fromEntries((data?.documents ?? []).map((d) => [d.type, d]));
  const verifiedCount = Object.values(docMap).filter((d) => d.status === "VERIFIED").length;
  const totalDocs = Object.keys(DOC_META).length;
  const progress = Math.round((verifiedCount / totalDocs) * 100);

  const kycStatusConfig = {
    NOT_STARTED: { label: "Non démarré",   className: "text-muted-foreground border-muted-foreground/30 bg-muted/30",                                     icon: AlertCircle },
    PENDING:     { label: "En cours",       className: "text-amber-700 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400",             icon: Clock },
    VERIFIED:    { label: "Vérifié ✓",      className: "text-green-700 border-green-200 bg-green-50 dark:bg-green-950/20 dark:text-green-400",             icon: ShieldCheck },
  };
  const kycStatus = data?.kycStatus ?? "NOT_STARTED";
  const StatusConf = kycStatusConfig[kycStatus];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documents KYC / KYB</h1>
        <p className="text-muted-foreground mt-1">
          Vérifiez votre identité et débloquez l'accès complet aux services YookPay.
        </p>
      </div>

      {/* KYC status card */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-semibold">Statut de vérification</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {verifiedCount} sur {totalDocs} documents vérifiés
              </p>
            </div>
            <Badge variant="outline" className={`${StatusConf.className} text-sm px-3 py-1`}>
              {StatusConf.label}
            </Badge>
          </div>
          <Progress value={isLoading ? 0 : progress} className="h-2" />
          {kycStatus === "VERIFIED" && (
            <div className="flex items-center gap-2 mt-3 text-sm text-green-700 dark:text-green-400">
              <ShieldCheck className="h-4 w-4" />
              Votre identité est entièrement vérifiée. Vous avez accès à tous les services.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(DOC_META).map(([type, meta]) => {
            const doc = docMap[type];
            const Icon = meta.icon;
            const isUploading = uploading === type;
            const badgeConf = doc ? STATUS_BADGE[doc.status] : null;

            return (
              <Card
                key={type}
                className={doc?.status === "VERIFIED" ? "border-green-200 dark:border-green-800" : ""}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      doc?.status === "VERIFIED" ? "bg-green-100 dark:bg-green-900/30" :
                      doc?.status === "PENDING"  ? "bg-amber-100 dark:bg-amber-900/30" :
                      doc?.status === "REJECTED" ? "bg-red-100 dark:bg-red-900/30" :
                      "bg-muted"
                    }`}>
                      <Icon className={`h-5 w-5 ${
                        doc?.status === "VERIFIED" ? "text-green-600" :
                        doc?.status === "PENDING"  ? "text-amber-600" :
                        doc?.status === "REJECTED" ? "text-red-600" :
                        "text-muted-foreground"
                      }`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{meta.label}</span>
                            <StatusIcon status={doc?.status} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                            {meta.description}
                          </p>
                          {doc && (
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              {badgeConf && (
                                <Badge variant="outline" className={`text-xs ${badgeConf.className}`}>
                                  {badgeConf.label}
                                </Badge>
                              )}
                              {doc.fileName && (
                                <span className="text-xs text-muted-foreground font-mono">{doc.fileName}</span>
                              )}
                              <span className="text-xs text-muted-foreground">
                                Soumis le {fmtDate(doc.createdAt)}
                              </span>
                            </div>
                          )}
                          {doc?.notes && (
                            <p className="text-xs text-destructive mt-1.5 bg-destructive/5 border border-destructive/20 rounded px-2 py-1">
                              {doc.notes}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {doc?.status !== "VERIFIED" && (
                            <>
                              <input
                                ref={(el) => { fileRefs.current[type] = el; }}
                                type="file"
                                accept="image/*,.pdf"
                                className="hidden"
                                onChange={(e) => handleFileChange(type, e)}
                              />
                              <Button
                                size="sm"
                                variant={doc ? "outline" : "default"}
                                className="gap-1.5 text-xs"
                                disabled={isUploading}
                                onClick={() => fileRefs.current[type]?.click()}
                              >
                                <Upload className="h-3.5 w-3.5" />
                                {isUploading ? "Envoi…" : doc ? "Remplacer" : "Téléverser"}
                              </Button>
                            </>
                          )}
                          {doc && doc.status !== "VERIFIED" && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Le document <strong>{meta.label}</strong> sera supprimé. Vous pourrez en
                                    soumettre un nouveau.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => deleteMutation.mutate(doc.id)}
                                  >
                                    Supprimer
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Info note */}
      <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
        Formats acceptés : JPG, PNG, PDF · Taille maximale : 5 Mo par document · Délai de vérification : 24 à 48 heures ouvrables.
      </div>
    </div>
  );
}
