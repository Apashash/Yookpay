import { useState, useRef } from "react";
import { KycGate } from "@/components/kyc-gate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent,
} from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { COUNTRIES } from "@/lib/countries";
import {
  Link2, Copy, Check, Trash2, Plus, Image, X, ExternalLink,
  Loader2, MousePointerClick, Pencil, TrendingUp,
} from "lucide-react";

export type PaymentLink = {
  id: number;
  token: string;
  title: string;
  description: string | null;
  photoData: string | null;
  priceType: "FIXED" | "FREE";
  priceAmount: number | null;
  currency: string | null;
  countries: string[];
  isActive: boolean;
  clickCount: number;
  transactionCount: number;
  rejectedCount: number;
  totalCollected: number;
  createdAt: string;
};

const CURRENCIES = [
  { code: "XOF", label: "XOF — Franc CFA (UEMOA)" },
  { code: "XAF", label: "XAF — Franc CFA (CEMAC)" },
  { code: "CDF", label: "CDF — Franc Congolais" },
  { code: "USDT", label: "USDT — Tether" },
];

export function getPublicUrl(token: string): string {
  return `${window.location.origin}/pay/${token}`;
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 shrink-0"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copié !" : "Copier"}
    </Button>
  );
}

export default function YookLink() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editLink, setEditLink] = useState<PaymentLink | null>(null);
  const [successLink, setSuccessLink] = useState<PaymentLink | null>(null);

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["payment-links"],
    queryFn: () => customFetch<PaymentLink[]>("/api/payment-links"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      customFetch(`/api/payment-links/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-links"] });
      toast({ title: "Lien supprimé" });
      setDeleteId(null);
    },
    onError: () => toast({ variant: "destructive", title: "Erreur lors de la suppression" }),
  });

  return (
    <KycGate level="kyc">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Link2 className="w-6 h-6 text-cyan-400" />
            YookLink
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Créez des liens de paiement à partager avec vos clients
          </p>
        </div>
        <Button
          className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold gap-2"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="w-4 h-4" />
          Nouveau lien
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : links.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <Link2 className="w-12 h-12 text-muted-foreground/40" />
            <div>
              <p className="font-semibold text-lg">Aucun lien de paiement</p>
              <p className="text-muted-foreground text-sm mt-1">
                Créez votre premier lien YookLink et partagez-le avec vos clients.
              </p>
            </div>
            <Button
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold gap-2 mt-2"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="w-4 h-4" />
              Créer mon premier lien
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {links.map((link) => (
            <Card
              key={link.id}
              className="hover:border-cyan-500/40 transition-colors cursor-pointer"
              onClick={() => navigate(`/yooklink/${link.id}`)}
            >
              <CardContent className="p-4 space-y-3">
                {/* Top row: photo + title + badges + action buttons */}
                <div className="flex items-start gap-3">
                  {link.photoData && (
                    <img
                      src={link.photoData}
                      alt={link.title}
                      className="w-10 h-10 rounded-md object-cover flex-shrink-0 border border-border"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{link.title}</p>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {link.priceType === "FIXED"
                          ? `${link.priceAmount?.toLocaleString("fr-FR")} ${link.currency}`
                          : "Montant libre"}
                      </Badge>
                      <Badge variant="outline" className="text-xs text-muted-foreground shrink-0">
                        {link.countries.length} pays
                      </Badge>
                    </div>
                    {/* URL row — code + copy only */}
                    <div className="flex items-center gap-2 mt-2">
                      <code className="flex-1 text-xs bg-muted rounded px-2 py-1 truncate text-muted-foreground min-w-0">
                        {getPublicUrl(link.token)}
                      </code>
                      <CopyButton text={getPublicUrl(link.token)} />
                    </div>
                  </div>
                </div>

                {/* Actions row */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={(e) => { e.stopPropagation(); window.open(getPublicUrl(link.token), "_blank"); }}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Voir
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={(e) => { e.stopPropagation(); setEditLink(link); }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Modifier
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive shrink-0"
                    onClick={(e) => { e.stopPropagation(); setDeleteId(link.id); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {/* Stats bar */}
                <div className="flex items-center gap-4 pt-1 border-t border-border/50">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MousePointerClick className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="font-medium text-foreground">{link.clickCount.toLocaleString("fr-FR")}</span>
                    <span>clics</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-medium text-foreground">{link.transactionCount}</span>
                    <span>transactions</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
                    <span className="font-semibold text-emerald-400">
                      {link.totalCollected.toLocaleString("fr-FR")}
                    </span>
                    <span>{link.currency ?? "—"} collectés</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      {showCreate && (
        <LinkFormDialog
          mode="create"
          onClose={() => setShowCreate(false)}
          onCreated={(link) => {
            setShowCreate(false);
            setSuccessLink(link);
            qc.invalidateQueries({ queryKey: ["payment-links"] });
          }}
        />
      )}

      {/* Edit Dialog */}
      {editLink && (
        <LinkFormDialog
          mode="edit"
          link={editLink}
          onClose={() => setEditLink(null)}
          onCreated={() => {
            setEditLink(null);
            qc.invalidateQueries({ queryKey: ["payment-links"] });
            toast({ title: "Lien mis à jour" });
          }}
        />
      )}

      {/* Success Dialog */}
      <Dialog open={!!successLink} onOpenChange={() => setSuccessLink(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="w-5 h-5 text-emerald-500" />
              Lien créé avec succès !
            </DialogTitle>
            <DialogDescription>
              Copiez ce lien et envoyez-le à votre client.
            </DialogDescription>
          </DialogHeader>
          {successLink && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Lien de paiement</p>
                <p className="text-sm break-all font-mono">{getPublicUrl(successLink.token)}</p>
              </div>
              <div className="flex gap-2">
                <CopyButton text={getPublicUrl(successLink.token)} />
                <Button variant="outline" size="sm" asChild>
                  <a href={getPublicUrl(successLink.token)} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5" />
                    Tester
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce lien ?</AlertDialogTitle>
            <AlertDialogDescription>
              Ce lien de paiement sera définitivement supprimé. Vos clients ne pourront plus l'utiliser.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/80"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </KycGate>
  );
}

// ── Shared Link Form Dialog (create & edit) ────────────────────────────────────

export function LinkFormDialog({
  mode,
  link,
  onClose,
  onCreated,
}: {
  mode: "create" | "edit";
  link?: PaymentLink;
  onClose: () => void;
  onCreated: (link: PaymentLink) => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(link?.title ?? "");
  const [description, setDescription] = useState(link?.description ?? "");
  const [photoData, setPhotoData] = useState<string | null>(link?.photoData ?? null);
  const [priceType, setPriceType] = useState<"FREE" | "FIXED">(link?.priceType ?? "FREE");
  const [priceAmount, setPriceAmount] = useState(link?.priceAmount?.toString() ?? "");
  const [currency, setCurrency] = useState(link?.currency ?? "XOF");
  const [selectedCountries, setSelectedCountries] = useState<string[]>(link?.countries ?? []);
  const [loading, setLoading] = useState(false);

  const toggleCountry = (code: string) => {
    setSelectedCountries((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: "destructive", title: "Image trop lourde", description: "Maximum 2 Mo." });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoData(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!title.trim()) { toast({ variant: "destructive", title: "Le titre est requis" }); return; }
    if (selectedCountries.length === 0) { toast({ variant: "destructive", title: "Sélectionnez au moins un pays" }); return; }
    if (priceType === "FIXED" && !priceAmount) { toast({ variant: "destructive", title: "Entrez le montant fixe" }); return; }

    setLoading(true);
    try {
      const body = {
        title: title.trim(),
        description: description.trim() || undefined,
        photoData: photoData ?? undefined,
        priceType,
        priceAmount: priceType === "FIXED" ? parseFloat(priceAmount) : undefined,
        currency: priceType === "FIXED" ? currency : undefined,
        countries: selectedCountries,
      };
      const result = mode === "edit" && link
        ? await customFetch<PaymentLink>(`/api/payment-links/${link.id}`, { method: "PUT", body: JSON.stringify(body) })
        : await customFetch<PaymentLink>("/api/payment-links", { method: "POST", body: JSON.stringify(body) });
      onCreated(result);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erreur", description: err?.message ?? "Impossible de sauvegarder le lien" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-cyan-400" />
            {mode === "edit" ? "Modifier le lien YookLink" : "Créer un lien YookLink"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit" ? "Modifiez les informations de votre lien." : "Remplissez les informations de votre produit ou service."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-1.5">
            <Label>Titre du produit / service <span className="text-destructive">*</span></Label>
            <Input
              placeholder="Ex: Abonnement mensuel, Cours de formation..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Description <span className="text-muted-foreground text-xs">(optionnel)</span></Label>
            <Textarea
              placeholder="Décrivez votre produit ou service..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={1000}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Photo du produit <span className="text-muted-foreground text-xs">(optionnel)</span></Label>
            {photoData ? (
              <div className="relative inline-block">
                <img src={photoData} alt="preview" className="w-28 h-28 rounded-lg object-cover border border-border" />
                <button
                  onClick={() => setPhotoData(null)}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-destructive rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-28 h-28 rounded-lg border-2 border-dashed border-border hover:border-cyan-500/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Image className="w-6 h-6" />
                <span className="text-xs">Ajouter</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label>Type de prix <span className="text-destructive">*</span></Label>
            <div className="flex gap-2">
              {[
                { value: "FREE", label: "Montant libre" },
                { value: "FIXED", label: "Prix fixe" },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setPriceType(value as "FREE" | "FIXED")}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                    priceType === value
                      ? "bg-cyan-500/10 border-cyan-500 text-cyan-400"
                      : "border-border text-muted-foreground hover:border-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {priceType === "FIXED" && (
            <div className="flex gap-2">
              <div className="flex-1 space-y-1.5">
                <Label>Montant <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="Ex: 5000"
                  value={priceAmount}
                  onChange={(e) => setPriceAmount(e.target.value)}
                />
              </div>
              <div className="w-40 space-y-1.5">
                <Label>Devise</Label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.code}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <Separator />

          <div className="space-y-2">
            <Label>Pays acceptés <span className="text-destructive">*</span></Label>
            <p className="text-xs text-muted-foreground">
              Sélectionnez les pays depuis lesquels vos clients peuvent payer.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {COUNTRIES.map((c) => (
                <button
                  key={c.code}
                  onClick={() => toggleCountry(c.code)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors text-left ${
                    selectedCountries.includes(c.code)
                      ? "bg-cyan-500/10 border-cyan-500 text-foreground"
                      : "border-border text-muted-foreground hover:border-muted-foreground"
                  }`}
                >
                  <span>{c.flag}</span>
                  <span className="truncate">{c.name}</span>
                </button>
              ))}
            </div>
            {selectedCountries.length > 0 && (
              <p className="text-xs text-cyan-400">{selectedCountries.length} pays sélectionné(s)</p>
            )}
          </div>

          <Separator />

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />{mode === "edit" ? "Sauvegarde..." : "Création..."}</>
              ) : (
                mode === "edit" ? "Sauvegarder" : "Créer le lien"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
