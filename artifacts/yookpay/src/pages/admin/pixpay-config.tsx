import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { COUNTRIES, OPERATOR_LABELS } from "@/lib/countries";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings2, Plus, Save } from "lucide-react";

type PixPayService = {
  id: number;
  operator: string;
  currency: string;
  type: string;
  service_id: number;
  active: boolean;
  notes: string | null;
  updated_at: string;
};

type PlatformConfig = {
  key: string;
  value: string;
  updated_at: string;
};

const WAVE_CONFIG_KEYS = [
  { key: "WAVE_BUSINESS_NAME_ID", label: "Wave Business Name ID" },
  { key: "WAVE_REDIRECT_URL", label: "Wave Redirect URL (succès)" },
  { key: "WAVE_REDIRECT_ERROR_URL", label: "Wave Redirect Error URL (échec)" },
];

// Collect unique operators across all countries
const ALL_OPERATORS = Array.from(
  new Set(COUNTRIES.flatMap((c) => [...c.operators]))
).sort();

export default function PixPayConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state for adding/editing a service
  const [form, setForm] = useState({
    operator: "",
    currency: "XAF" as "XAF" | "XOF" | "CDF",
    type: "DEPOSIT" as "DEPOSIT" | "WITHDRAWAL",
    serviceId: "",
    active: true,
    notes: "",
  });

  // Platform config values
  const [configValues, setConfigValues] = useState<Record<string, string>>({});

  // ─── Queries ──────────────────────────────────────────────────────────────────
  const { data: servicesData, isLoading: loadingServices } = useQuery({
    queryKey: ["admin", "pixpay-services"],
    queryFn: () => customFetch("/api/admin/pixpay/services") as Promise<{ services: PixPayService[] }>,
  });

  const { data: configData } = useQuery({
    queryKey: ["admin", "pixpay-config"],
    queryFn: async () => {
      const res = await customFetch("/api/admin/pixpay/config") as { config: PlatformConfig[] };
      const map: Record<string, string> = {};
      for (const row of res.config) map[row.key] = row.value;
      setConfigValues(map);
      return res;
    },
  });

  // ─── Mutations ────────────────────────────────────────────────────────────────
  const upsertService = useMutation({
    mutationFn: (data: object) =>
      customFetch("/api/admin/pixpay/services", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "pixpay-services"] });
      toast({ title: "Service mis à jour", description: `Service PixPay enregistré avec succès.` });
      setForm({ operator: "", currency: "XAF", type: "DEPOSIT", serviceId: "", active: true, notes: "" });
    },
    onError: (err: unknown) => {
      const msg = (err as { message?: string })?.message ?? "Erreur inconnue";
      toast({ variant: "destructive", title: "Erreur", description: msg });
    },
  });

  const saveConfig = useMutation({
    mutationFn: (data: { key: string; value: string }) =>
      customFetch("/api/admin/pixpay/config", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "pixpay-config"] });
      toast({ title: "Configuration sauvegardée" });
    },
    onError: (err: unknown) => {
      const msg = (err as { message?: string })?.message ?? "Erreur inconnue";
      toast({ variant: "destructive", title: "Erreur", description: msg });
    },
  });

  const handleSaveService = () => {
    if (!form.operator || !form.serviceId) {
      toast({ variant: "destructive", title: "Champs requis", description: "Opérateur et Service ID sont obligatoires." });
      return;
    }
    upsertService.mutate({
      operator: form.operator,
      currency: form.currency,
      type: form.type,
      serviceId: parseInt(form.serviceId),
      active: form.active,
      notes: form.notes || undefined,
    });
  };

  const handleToggleService = (svc: PixPayService) => {
    upsertService.mutate({
      operator: svc.operator,
      currency: svc.currency,
      type: svc.type,
      serviceId: svc.service_id,
      active: !svc.active,
      notes: svc.notes ?? undefined,
    });
  };

  const handleEditService = (svc: PixPayService) => {
    setForm({
      operator: svc.operator,
      currency: svc.currency as "XAF" | "XOF" | "CDF",
      type: svc.type as "DEPOSIT" | "WITHDRAWAL",
      serviceId: String(svc.service_id),
      active: svc.active,
      notes: svc.notes ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const services = servicesData?.services ?? [];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuration PixPay</h1>
        <p className="text-muted-foreground mt-1">
          Configurez les service_id PixPay par opérateur, devise et type de transaction.
        </p>
      </div>

      {/* Add / Edit Service Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Ajouter / Modifier un service
          </CardTitle>
          <CardDescription>
            Associez un service_id PixPay à un opérateur Mobile Money pour activer les transactions réelles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Operator */}
            <div className="space-y-1.5">
              <Label>Opérateur</Label>
              <Select value={form.operator} onValueChange={(v) => setForm((f) => ({ ...f, operator: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_OPERATORS.map((op) => (
                    <SelectItem key={op} value={op}>{OPERATOR_LABELS[op] ?? op}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Currency */}
            <div className="space-y-1.5">
              <Label>Devise</Label>
              <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v as "XAF" | "XOF" | "CDF" }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="XAF">XAF (FCFA Central)</SelectItem>
                  <SelectItem value="XOF">XOF (FCFA Ouest)</SelectItem>
                  <SelectItem value="CDF">CDF (Franc Congolais)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as "DEPOSIT" | "WITHDRAWAL" }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEPOSIT">Dépôt (Collecte)</SelectItem>
                  <SelectItem value="WITHDRAWAL">Retrait (Déboursement)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Service ID */}
            <div className="space-y-1.5">
              <Label>Service ID PixPay</Label>
              <Input
                type="number"
                min={0}
                placeholder="ex : 42"
                value={form.serviceId}
                onChange={(e) => setForm((f) => ({ ...f, serviceId: e.target.value }))}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5 sm:col-span-1">
              <Label>Notes (optionnel)</Label>
              <Input
                placeholder="ex : Orange Money CI dépôt"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {/* Active */}
            <div className="space-y-1.5 flex flex-col justify-end">
              <Label>Actif</Label>
              <div className="flex items-center gap-2 h-10">
                <Switch
                  checked={form.active}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
                />
                <span className="text-sm text-muted-foreground">{form.active ? "Activé" : "Désactivé"}</span>
              </div>
            </div>
          </div>

          <Button
            className="mt-4"
            onClick={handleSaveService}
            disabled={upsertService.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {upsertService.isPending ? "Enregistrement..." : "Enregistrer le service"}
          </Button>
        </CardContent>
      </Card>

      {/* Services Table */}
      <Card>
        <CardHeader>
          <CardTitle>Services configurés</CardTitle>
          <CardDescription>{services.length} service(s) enregistré(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingServices ? (
            <p className="text-muted-foreground text-sm">Chargement...</p>
          ) : services.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">Aucun service configuré. Ajoutez-en un ci-dessus.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Opérateur</TableHead>
                  <TableHead>Devise</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Service ID</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((svc) => (
                  <TableRow key={svc.id}>
                    <TableCell className="font-medium">{OPERATOR_LABELS[svc.operator] ?? svc.operator}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{svc.currency}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={svc.type === "DEPOSIT" ? "default" : "secondary"}>
                        {svc.type === "DEPOSIT" ? "Dépôt" : "Retrait"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{svc.service_id}</code>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={svc.active}
                        onCheckedChange={() => handleToggleService(svc)}
                        disabled={upsertService.isPending}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate">
                      {svc.notes ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditService(svc)}
                      >
                        Modifier
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Wave Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Configuration Wave
          </CardTitle>
          <CardDescription>
            Paramètres requis pour les transactions Wave (business_name_id et URLs de redirection).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {WAVE_CONFIG_KEYS.map(({ key, label }) => (
            <div key={key} className="flex items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <Label>{label}</Label>
                <Input
                  placeholder={key}
                  value={configValues[key] ?? ""}
                  onChange={(e) => setConfigValues((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </div>
              <Button
                variant="outline"
                onClick={() => saveConfig.mutate({ key, value: configValues[key] ?? "" })}
                disabled={saveConfig.isPending}
              >
                <Save className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground pt-2">
            Ces valeurs sont fournies par PixPay Innov lors de l'onboarding Wave.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
