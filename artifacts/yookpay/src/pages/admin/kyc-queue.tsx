import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, XCircle, Clock, FileText, User, Building2, ExternalLink,
  AlertCircle, Eye, PenLine,
} from "lucide-react";

interface KycDoc {
  id: number; userId: number; type: string; status: string;
  fileName: string | null; notes: string | null; createdAt: string; updatedAt: string;
}

interface KycProfile {
  id: number; fullName: string | null; dateOfBirth: string | null;
  docType: string | null; docNumber: string | null; kycStatus: string;
  businessDescription: string | null; businessWebsite: string | null;
  businessCategory: string | null; businessType: string | null;
  kybStatus: string; adminNotes: string | null; hasSignature: boolean;
  createdAt: string; updatedAt: string;
}

interface Submission {
  userId: number; userName: string; userEmail: string;
  profile: KycProfile; documents: KycDoc[];
}

const DOC_LABELS: Record<string, string> = {
  ID_FRONT:    "Pièce d'identité — Recto",
  ID_BACK:     "Pièce d'identité — Verso",
  SELFIE:      "Selfie avec la pièce d'identité",
  KYB_STATUTS: "Statuts de l'entreprise",
  KYB_RCCM:    "RCCM",
  KYB_NIU:     "NIU",
  KYB_PLAN_LOC:"Plan de localisation",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  CNI: "CNI", PASSEPORT: "Passeport", PERMIS: "Permis de conduire", SEJOUR: "Carte de séjour",
};

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: any }> = {
  NOT_STARTED: { label: "Non démarré",  className: "text-muted-foreground",                                                                  icon: AlertCircle },
  PENDING:     { label: "En attente",   className: "text-amber-700 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400",   icon: Clock },
  VERIFIED:    { label: "Vérifié",      className: "text-green-700 border-green-200 bg-green-50 dark:bg-green-950/20 dark:text-green-400",   icon: CheckCircle2 },
  REJECTED:    { label: "Rejeté",       className: "text-red-700 border-red-200 bg-red-50 dark:bg-red-950/20 dark:text-red-400",             icon: XCircle },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const conf = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  const Icon = conf.icon;
  return (
    <Badge variant="outline" className={`text-xs gap-1 ${conf.className}`}>
      <Icon className="h-3 w-3" />{conf.label}
    </Badge>
  );
}

function ViewFileButton({ docId, fileName }: { docId: number; fileName: string | null }) {
  const [loading, setLoading] = useState(false);
  const open = async () => {
    setLoading(true);
    try {
      const res = await customFetch<{ fileData: string; fileName: string }>(`/api/admin/kyc/doc/${docId}/file`);
      if (res.fileData) {
        const a = document.createElement("a");
        a.href     = res.fileData;
        a.target   = "_blank";
        a.download = res.fileName ?? "document";
        a.click();
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={open} disabled={loading}>
      <Eye className="h-3.5 w-3.5" />
      {loading ? "Chargement…" : (fileName ?? "Voir")}
    </Button>
  );
}

function SignatureButton({ userId }: { userId: number }) {
  const [loading, setLoading] = useState(false);
  const [sigData, setSigData] = useState<string | null>(null);
  const open = async () => {
    if (sigData) { setSigData(null); return; }
    setLoading(true);
    try {
      const res = await customFetch<{ signatureData: string }>(`/api/admin/kyc/signature/${userId}`);
      setSigData(res.signatureData ?? null);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div>
      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={open} disabled={loading}>
        <PenLine className="h-3.5 w-3.5" />
        {sigData ? "Masquer la signature" : loading ? "Chargement…" : "Voir la signature"}
      </Button>
      {sigData && (
        <div className="mt-2 border rounded-lg overflow-hidden bg-white dark:bg-zinc-900 p-2">
          <img src={sigData} alt="Signature" className="max-h-24 w-full object-contain" />
        </div>
      )}
    </div>
  );
}

export default function AdminKycQueue() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "VERIFIED" | "REJECTED">("PENDING");
  const [selected, setSelected]   = useState<Submission | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [action, setAction] = useState<"kycVerify" | "kycReject" | "kybVerify" | "kybReject" | null>(null);

  const { data, isLoading } = useQuery<{ submissions: Submission[] }>({
    queryKey: ["admin-kyc"],
    queryFn: () => customFetch<{ submissions: Submission[] }>("/api/admin/kyc"),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { userId: number; kycStatus?: string; kybStatus?: string; adminNotes?: string }) =>
      customFetch(`/api/admin/kyc/profile/${payload.userId}`, {
        method: "PATCH",
        body: JSON.stringify({ kycStatus: payload.kycStatus, kybStatus: payload.kybStatus, adminNotes: payload.adminNotes }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-kyc"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      setAction(null);
      setAdminNotes("");
      setSelected(null);
      toast({ title: "Statut mis à jour" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre à jour", variant: "destructive" });
    },
  });

  const submissions = data?.submissions ?? [];
  const filtered = submissions.filter((s) => {
    if (filter === "ALL") return true;
    return s.profile.kycStatus === filter || s.profile.kybStatus === filter;
  });

  const pendingCount   = submissions.filter((s) => s.profile.kycStatus === "PENDING" || s.profile.kybStatus === "PENDING").length;
  const verifiedCount  = submissions.filter((s) => s.profile.kycStatus === "VERIFIED" && s.profile.kybStatus === "VERIFIED").length;
  const rejectedCount  = submissions.filter((s) => s.profile.kycStatus === "REJECTED" || s.profile.kybStatus === "REJECTED").length;

  const confirmAction = () => {
    if (!selected || !action) return;
    const payload: any = { userId: selected.userId };
    if (action === "kycVerify") payload.kycStatus = "VERIFIED";
    if (action === "kycReject") { payload.kycStatus = "REJECTED"; payload.adminNotes = adminNotes; }
    if (action === "kybVerify") payload.kybStatus = "VERIFIED";
    if (action === "kybReject") { payload.kybStatus = "REJECTED"; payload.adminNotes = adminNotes; }
    updateMutation.mutate(payload);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">File KYC / KYB</h1>
        <p className="text-muted-foreground mt-1">Dossiers de vérification soumis par les utilisateurs.</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {([["PENDING", "En attente", pendingCount], ["ALL", "Tous", submissions.length], ["VERIFIED", "Vérifiés", verifiedCount], ["REJECTED", "Rejetés", rejectedCount]] as const).map(([f, label, count]) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="gap-1.5">
            {label}
            <Badge variant="secondary" className={`ml-1 text-xs ${filter === f ? "bg-white/20 text-white" : ""}`}>{count}</Badge>
          </Button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          {filter === "PENDING" ? "Aucun dossier en attente." : "Aucun dossier dans cette catégorie."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <Card key={s.userId} className={
              (s.profile.kycStatus === "VERIFIED" && s.profile.kybStatus === "VERIFIED") ? "border-green-200 dark:border-green-800" :
              (s.profile.kycStatus === "REJECTED" || s.profile.kybStatus === "REJECTED") ? "border-red-200 dark:border-red-800" : ""
            }>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{s.userName}</span>
                      <span className="text-sm text-muted-foreground">{s.userEmail}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <User className="h-3 w-3" /> KYC : <StatusBadge status={s.profile.kycStatus} />
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3" /> KYB : <StatusBadge status={s.profile.kybStatus} />
                      </div>
                    </div>
                    {s.profile.fullName && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {s.profile.fullName} · {s.profile.docType && DOC_TYPE_LABELS[s.profile.docType]} {s.profile.docNumber}
                        {s.profile.dateOfBirth && ` · Né le ${fmtDate(s.profile.dateOfBirth)}`}
                      </p>
                    )}
                    {s.profile.businessCategory && (
                      <p className="text-xs text-muted-foreground">
                        {s.profile.businessCategory} · {s.profile.businessType}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">Soumis le {fmtDate(s.profile.updatedAt)}</p>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => setSelected(s)}>
                    <Eye className="h-3.5 w-3.5" />
                    Détails
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {selected?.userName}
            </DialogTitle>
            <DialogDescription>{selected?.userEmail}</DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-5 py-1">
              {/* KYC Identity */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />Identité (KYC)
                  </h3>
                  <StatusBadge status={selected.profile.kycStatus} />
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div><span className="text-muted-foreground">Nom complet</span><p className="font-medium">{selected.profile.fullName ?? "—"}</p></div>
                  <div><span className="text-muted-foreground">Date de naissance</span><p className="font-medium">{selected.profile.dateOfBirth ? fmtDate(selected.profile.dateOfBirth) : "—"}</p></div>
                  <div><span className="text-muted-foreground">Type de document</span><p className="font-medium">{selected.profile.docType ? DOC_TYPE_LABELS[selected.profile.docType] : "—"}</p></div>
                  <div><span className="text-muted-foreground">Numéro</span><p className="font-medium font-mono">{selected.profile.docNumber ?? "—"}</p></div>
                </div>
                {/* ID docs */}
                <div className="space-y-1.5">
                  {selected.documents.filter((d) => ["ID_FRONT", "ID_BACK", "SELFIE"].includes(d.type)).map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                      <span className="text-xs font-medium">{DOC_LABELS[doc.type]}</span>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={doc.status} />
                        <ViewFileButton docId={doc.id} fileName={doc.fileName} />
                      </div>
                    </div>
                  ))}
                </div>
                {/* KYC actions */}
                {selected.profile.kycStatus !== "VERIFIED" && (
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 text-white" onClick={() => setAction("kycVerify")}>
                      <CheckCircle2 className="h-3.5 w-3.5" />Valider KYC
                    </Button>
                    {selected.profile.kycStatus !== "REJECTED" && (
                      <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => setAction("kycReject")}>
                        <XCircle className="h-3.5 w-3.5" />Rejeter KYC
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* KYB Business */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />Entreprise (KYB)
                  </h3>
                  <StatusBadge status={selected.profile.kybStatus} />
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div><span className="text-muted-foreground">Catégorie</span><p className="font-medium">{selected.profile.businessCategory ?? "—"}</p></div>
                  <div><span className="text-muted-foreground">Forme juridique</span><p className="font-medium">{selected.profile.businessType ?? "—"}</p></div>
                  {selected.profile.businessWebsite && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Site web</span>
                      <a href={selected.profile.businessWebsite} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-medium text-primary hover:underline">
                        {selected.profile.businessWebsite}<ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                  {selected.profile.businessDescription && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Description</span>
                      <p className="font-medium text-xs mt-0.5 leading-relaxed whitespace-pre-wrap bg-muted/50 rounded p-2">{selected.profile.businessDescription}</p>
                    </div>
                  )}
                </div>
                {/* KYB docs */}
                <div className="space-y-1.5">
                  {selected.documents.filter((d) => d.type.startsWith("KYB_")).map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                      <span className="text-xs font-medium">{DOC_LABELS[doc.type] ?? doc.type}</span>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={doc.status} />
                        <ViewFileButton docId={doc.id} fileName={doc.fileName} />
                      </div>
                    </div>
                  ))}
                </div>
                {/* Signature */}
                {selected.profile.hasSignature && (
                  <SignatureButton userId={selected.userId} />
                )}
                {/* KYB actions */}
                {selected.profile.kybStatus !== "VERIFIED" && selected.profile.kybStatus !== "NOT_STARTED" && (
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 text-white" onClick={() => setAction("kybVerify")}>
                      <CheckCircle2 className="h-3.5 w-3.5" />Valider KYB
                    </Button>
                    {selected.profile.kybStatus !== "REJECTED" && (
                      <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => setAction("kybReject")}>
                        <XCircle className="h-3.5 w-3.5" />Rejeter KYB
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {selected.profile.adminNotes && (
                <div className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded p-2">
                  Note admin : {selected.profile.adminNotes}
                </div>
              )}
            </div>
          )}

          {/* Confirm action */}
          {action && (
            <div className="border rounded-lg p-3 bg-muted/30 space-y-3">
              <p className="text-sm font-medium">
                {action === "kycVerify" && "Confirmer la validation KYC ?"}
                {action === "kycReject" && "Rejeter la vérification KYC ?"}
                {action === "kybVerify" && "Confirmer la validation KYB ?"}
                {action === "kybReject" && "Rejeter la vérification KYB ?"}
              </p>
              {(action === "kycReject" || action === "kybReject") && (
                <Textarea
                  placeholder="Raison du rejet…"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={2}
                />
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setAction(null)}>Annuler</Button>
                <Button
                  size="sm"
                  className={(action === "kycVerify" || action === "kybVerify") ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                  variant={(action === "kycReject" || action === "kybReject") ? "destructive" : "default"}
                  disabled={((action === "kycReject" || action === "kybReject") && !adminNotes.trim()) || updateMutation.isPending}
                  onClick={confirmAction}
                >
                  Confirmer
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelected(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
