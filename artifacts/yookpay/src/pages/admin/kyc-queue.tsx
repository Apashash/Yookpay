import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Clock, FileText, User } from "lucide-react";

interface KycDocAdmin {
  id: number;
  userId: number;
  type: string;
  status: string;
  fileName: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  userName: string;
  userEmail: string;
}

const DOC_LABELS: Record<string, string> = {
  CNI: "Carte Nationale d'Identité",
  PASSEPORT: "Passeport",
  RCCM: "Registre de Commerce",
  JUSTIF_DOMICILE: "Justificatif de Domicile",
  PHOTO_SELFIE: "Photo Selfie",
};

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  PENDING:  { label: "En attente",  className: "text-amber-700 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400",  icon: Clock },
  VERIFIED: { label: "Vérifié",     className: "text-green-700 border-green-200 bg-green-50 dark:bg-green-950/20 dark:text-green-400",  icon: CheckCircle2 },
  REJECTED: { label: "Rejeté",      className: "text-red-700 border-red-200 bg-red-50 dark:bg-red-950/20 dark:text-red-400",            icon: XCircle },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminKycQueue() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "VERIFIED" | "REJECTED">("PENDING");
  const [reviewDoc, setReviewDoc] = useState<KycDocAdmin | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");

  const { data, isLoading } = useQuery<{ documents: KycDocAdmin[] }>({
    queryKey: ["admin-kyc"],
    queryFn: () => customFetch<{ documents: KycDocAdmin[] }>("/api/admin/kyc"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ docId, status, notes }: { docId: number; status: string; notes?: string }) =>
      customFetch(`/api/admin/kyc/${docId}`, {
        method: "PATCH",
        body: JSON.stringify({ status, notes }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-kyc"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      setReviewDoc(null);
      setRejectNotes("");
      toast({ title: "Statut mis à jour avec succès" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre à jour le statut", variant: "destructive" });
    },
  });

  const docs = (data?.documents ?? []).filter((d) => filter === "ALL" || d.status === filter);
  const pendingCount = (data?.documents ?? []).filter((d) => d.status === "PENDING").length;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">File KYC / KYB</h1>
        <p className="text-muted-foreground mt-1">
          Vérifiez et validez les documents d'identité soumis par les utilisateurs.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["PENDING", "ALL", "VERIFIED", "REJECTED"] as const).map((f) => {
          const count = f === "ALL" ? (data?.documents.length ?? 0) : (data?.documents ?? []).filter((d) => d.status === f).length;
          return (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className="gap-1.5"
            >
              {f === "PENDING" ? "En attente" : f === "ALL" ? "Tous" : f === "VERIFIED" ? "Vérifiés" : "Rejetés"}
              <Badge
                variant="secondary"
                className={`ml-1 text-xs ${filter === f ? "bg-white/20 text-white" : ""}`}
              >
                {count}
              </Badge>
            </Button>
          );
        })}
      </div>

      {/* Documents */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {filter === "PENDING" ? "Aucun document en attente — tout est à jour !" : "Aucun document dans cette catégorie."}
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => {
            const StatusConf = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.PENDING;
            const StatusIcon = StatusConf.icon;
            return (
              <Card key={doc.id} className={doc.status === "VERIFIED" ? "border-green-200 dark:border-green-800" : doc.status === "REJECTED" ? "border-red-200 dark:border-red-800" : ""}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{DOC_LABELS[doc.type] ?? doc.type}</span>
                        <Badge variant="outline" className={`text-xs ${StatusConf.className}`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {StatusConf.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                        <User className="h-3.5 w-3.5" />
                        <span className="font-medium text-foreground">{doc.userName}</span>
                        <span>·</span>
                        <span>{doc.userEmail}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {doc.fileName && <span className="font-mono mr-2">{doc.fileName}</span>}
                        Soumis le {fmtDate(doc.createdAt)}
                      </div>
                      {doc.notes && (
                        <p className="text-xs text-destructive mt-1.5 bg-destructive/5 border border-destructive/20 rounded px-2 py-1">
                          Note : {doc.notes}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {doc.status !== "VERIFIED" && (
                        <Button
                          size="sm"
                          className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => updateMutation.mutate({ docId: doc.id, status: "VERIFIED" })}
                          disabled={updateMutation.isPending}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Valider
                        </Button>
                      )}
                      {doc.status !== "REJECTED" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-1.5"
                          onClick={() => { setReviewDoc(doc); setRejectNotes(""); }}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Rejeter
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Reject dialog */}
      <Dialog open={!!reviewDoc} onOpenChange={() => setReviewDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter ce document</DialogTitle>
            <DialogDescription>
              Indiquez la raison du rejet. L'utilisateur verra cette note dans son espace KYC.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm font-medium">{reviewDoc && (DOC_LABELS[reviewDoc.type] ?? reviewDoc.type)} — {reviewDoc?.userName}</p>
            <Textarea
              placeholder="ex : Document illisible, informations incomplètes, document expiré…"
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDoc(null)}>Annuler</Button>
            <Button
              variant="destructive"
              disabled={!rejectNotes.trim() || updateMutation.isPending}
              onClick={() => reviewDoc && updateMutation.mutate({ docId: reviewDoc.id, status: "REJECTED", notes: rejectNotes.trim() })}
            >
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
