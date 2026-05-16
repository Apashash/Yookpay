import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { COUNTRIES } from "@/lib/countries";
import { customFetch } from "@workspace/api-client-react";
import { formatDate } from "@/lib/format";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Lock,
  Trash2,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Requis"),
  newPassword: z.string().min(8, "Minimum 8 caractères"),
  confirmPassword: z.string().min(1, "Requis"),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

function ProfileField({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="mt-0.5 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export default function Settings() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting]         = useState(false);
  const [isChangingPwd, setIsChangingPwd]   = useState(false);
  const country = user
    ? COUNTRIES.find((c) => c.code === (user as { country?: string }).country)
    : null;

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onChangePassword = async (data: PasswordFormValues) => {
    setIsChangingPwd(true);
    try {
      await customFetch("/api/auth/password", {
        method: "PUT",
        body: JSON.stringify({ currentPassword: data.currentPassword, newPassword: data.newPassword }),
      });
      toast({ title: "Mot de passe mis à jour", description: "Votre mot de passe a été modifié avec succès." });
      form.reset();
    } catch (err: unknown) {
      const raw = (err as { message?: string })?.message ?? "Une erreur s'est produite.";
      const msg = raw.replace(/^HTTP\s+\d+[^:]*:\s*/i, "");
      toast({ variant: "destructive", title: "Échec", description: msg });
    } finally {
      setIsChangingPwd(false);
    }
  };

  const onDeleteAccount = async () => {
    if (!deletePassword) return;
    setIsDeleting(true);
    try {
      await customFetch("/api/auth/account", {
        method: "DELETE",
        body: JSON.stringify({ password: deletePassword }),
      });
      toast({ title: "Compte supprimé", description: "Votre compte a été supprimé définitivement." });
      logout();
      setLocation("/login");
    } catch (err: unknown) {
      const raw = (err as { message?: string })?.message ?? "Une erreur s'est produite.";
      const msg = raw.replace(/^HTTP\s+\d+[^:]*:\s*/i, "");
      toast({ variant: "destructive", title: "Échec", description: msg });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Avatar + nom */}
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center text-primary text-2xl font-bold flex-shrink-0">
          {user?.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 className="text-xl font-semibold">{user?.name}</h2>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      {/* Informations du profil */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations du profil</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <ProfileField icon={User}     label="Nom complet"   value={user?.name ?? "—"} />
          <ProfileField icon={Mail}     label="Adresse e-mail" value={user?.email ?? "—"} />
          <ProfileField icon={Phone}    label="Téléphone"      value={(user as { phone?: string })?.phone ?? "—"} />
          {country && (
            <ProfileField
              icon={MapPin}
              label="Pays"
              value={`${country.flag} ${country.name} (${country.currency})`}
            />
          )}
          <ProfileField
            icon={Calendar}
            label="Membre depuis"
            value={user ? formatDate((user as { createdAt?: string | Date }).createdAt ?? new Date()) : "—"}
          />
        </CardContent>
      </Card>

      {/* Changer le mot de passe */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Changer le mot de passe
          </CardTitle>
          <CardDescription>Choisissez un mot de passe fort d'au moins 8 caractères.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onChangePassword)} className="space-y-4">

              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mot de passe actuel</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type={showCurrent ? "text" : "password"} {...field} />
                        <button type="button" onClick={() => setShowCurrent((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nouveau mot de passe</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type={showNew ? "text" : "password"} {...field} />
                        <button type="button" onClick={() => setShowNew((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmer le nouveau mot de passe</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type={showConfirm ? "text" : "password"} {...field} />
                        <button type="button" onClick={() => setShowConfirm((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isChangingPwd} className="w-full sm:w-auto">
                <ShieldCheck className="h-4 w-4 mr-2" />
                {isChangingPwd ? "Mise à jour..." : "Mettre à jour le mot de passe"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Zone danger */}
      <Card className="border-rose-500/30">
        <CardHeader>
          <CardTitle className="text-base text-rose-600 flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            Zone dangereuse
          </CardTitle>
          <CardDescription>
            La suppression de votre compte est définitive. Toutes vos données seront effacées.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full sm:w-auto">
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer mon compte
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible. Votre compte, vos portefeuilles et toutes vos transactions seront définitivement supprimés.
                  <br /><br />
                  Saisissez votre mot de passe pour confirmer :
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                type="password"
                placeholder="Votre mot de passe"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="mt-2"
              />
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeletePassword("")}>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDeleteAccount}
                  disabled={!deletePassword || isDeleting}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {isDeleting ? "Suppression..." : "Supprimer définitivement"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      <Separator />

      <div className="text-center text-xs text-muted-foreground pb-4">
        YookPay · Plateforme de paiement africaine
      </div>
    </div>
  );
}
