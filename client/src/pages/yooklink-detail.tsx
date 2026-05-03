import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, ExternalLink, Pencil, Trash2, MousePointerClick,
  TrendingUp, XCircle, Wallet, Link2, Loader2, Globe,
} from "lucide-react";
import { type PaymentLink, getPublicUrl, CopyButton, LinkFormDialog } from "./yooklink";
import { COUNTRIES } from "@/lib/countries";

type LinkStats = {
  clickCount: number;
  transactionCount: number;
  rejectedCount: number;
  totalCollected: number;
  currency: string | null;
};

export default function YookLinkDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const { data: links = [] } = useQuery({
    queryKey: ["payment-links"],
    queryFn: () => customFetch<PaymentLink[]>("/api/payment-links"),
  });

  const link = links.find((l) => l.id === parseInt(id ?? "0"));

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["payment-links", id, "stats"],
    queryFn: () => customFetch<LinkStats>(`/api/payment-links/${id}/stats`),
    enabled: !!id,
    refetchInterval: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: () => customFetch(`/api/payment-links/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-links"] });
      toast({ title: "Lien supprimé" });
      navigate("/yooklink");
    },
    onError: () => toast({ variant: "destructive", title: "Erreur lors de la suppression" }),
  });

  if (!link && links.length > 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <Link2 className="w-12 h-12 text-muted-foreground/40" />
        <p className="text-lg font-semibold">Lien introuvable</p>
        <Button variant="outline" onClick={() => navigate("/yooklink")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour à YookLink
        </Button>
      </div>
    );
  }

  if (!link) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const publicUrl = getPublicUrl(link.token);
  const displayCurrency = stats?.currency ?? link.currency ?? "";

  const statCards = [
    {
      icon: <MousePointerClick className="w-5 h-5 text-cyan-400" />,
      label: "Clics",
      value: (stats?.clickCount ?? link.clickCount).toLocaleString("fr-FR"),
      sub: "visites sur le lien",
    },
    {
      icon: <TrendingUp className="w-5 h-5 text-emerald-400" />,
      label: "Transactions",
      value: (stats?.transactionCount ?? link.transactionCount).toString(),
      sub: "paiements initiés",
    },
    {
      icon: <XCircle className="w-5 h-5 text-red-400" />,
      label: "Rejetées",
      value: (stats?.rejectedCount ?? link.rejectedCount).toString(),
      sub: "transactions échouées",
    },
    {
      icon: <Wallet className="w-5 h-5 text-yellow-400" />,
      label: "Total collecté",
      value: `${(stats?.totalCollected ?? link.totalCollected).toLocaleString("fr-FR")} ${displayCurrency}`,
      sub: "net reçu dans le wallet",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/yooklink")} className="gap-1.5 -ml-2">
          <ArrowLeft className="w-4 h-4" />
          YookLink
        </Button>
      </div>

      {/* Link info card */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start gap-4">
            {link.photoData ? (
              <img
                src={link.photoData}
                alt={link.title}
                className="w-16 h-16 rounded-xl object-cover border border-border flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center border border-border flex-shrink-0">
                <Link2 className="w-7 h-7 text-muted-foreground/40" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold">{link.title}</h1>
              {link.description && (
                <p className="text-sm text-muted-foreground mt-1">{link.description}</p>
              )}
              <div className="flex gap-2 mt-2 flex-wrap">
                <Badge variant="outline">
                  {link.priceType === "FIXED"
                    ? `${link.priceAmount?.toLocaleString("fr-FR")} ${link.currency}`
                    : "Montant libre"}
                </Badge>
                <Badge variant="outline" className="text-muted-foreground">
                  {link.countries.length} pays
                </Badge>
                <Badge
                  variant="outline"
                  className={link.isActive ? "text-emerald-400 border-emerald-500/40" : "text-red-400 border-red-500/40"}
                >
                  {link.isActive ? "Actif" : "Inactif"}
                </Badge>
              </div>
            </div>
          </div>

          {/* URL section */}
          <div className="bg-muted rounded-lg p-3 space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Lien de paiement</p>
            <p className="text-sm font-mono break-all text-foreground">{publicUrl}</p>
            <div className="flex gap-2 flex-wrap">
              <CopyButton text={publicUrl} />
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ouvrir
                </a>
              </Button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setShowEdit(true)}
            >
              <Pencil className="w-4 h-4" />
              Modifier
            </Button>
            <Button
              variant="outline"
              className="gap-2 text-destructive hover:text-destructive ml-auto"
              onClick={() => setShowDelete(true)}
            >
              <Trash2 className="w-4 h-4" />
              Supprimer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center gap-2">
                {s.icon}
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-xl font-bold">{statsLoading ? "—" : s.value}</p>
              <p className="text-xs text-muted-foreground">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Countries */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            Pays acceptés
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            {link.countries.map((code) => {
              const country = COUNTRIES.find((c) => c.code === code);
              return (
                <Badge key={code} variant="outline" className="gap-1.5">
                  {country?.flag} {country?.name ?? code}
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      {showEdit && (
        <LinkFormDialog
          mode="edit"
          link={link}
          onClose={() => setShowEdit(false)}
          onCreated={() => {
            setShowEdit(false);
            qc.invalidateQueries({ queryKey: ["payment-links"] });
            toast({ title: "Lien mis à jour" });
          }}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce lien ?</AlertDialogTitle>
            <AlertDialogDescription>
              Ce lien sera définitivement supprimé. Vos clients ne pourront plus l'utiliser.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/80"
              onClick={() => deleteMutation.mutate()}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
