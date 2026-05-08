import { useAuth } from "@/lib/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRegister } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff } from "lucide-react";
import { YookPayLogo } from "@/components/yookpay-logo";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

import { COUNTRIES, type CountryCode } from "@/lib/countries";

const registerSchema = z
  .object({
    name:            z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
    email:           z.string().email("Adresse email invalide"),
    country:         z.string().min(2, "Veuillez sélectionner un pays"),
    phone:           z.string().min(6, "Numéro de téléphone invalide"),
    password:        z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Les mots de passe ne correspondent pas",
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function Register() {
  const { login: setAuth, token, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const registerMutation = useRegister();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      country: undefined,
      phone: "",
      password: "",
      confirmPassword: "",
    },
  });

  const selectedCountry = form.watch("country") as CountryCode | undefined;
  const dialCode = COUNTRIES.find((c) => c.code === selectedCountry)?.dialCode ?? "";

  useEffect(() => {
    if (!isLoading && token) setLocation("/dashboard");
  }, [token, isLoading, setLocation]);

  const onSubmit = (data: RegisterFormValues) => {
    const fullPhone = data.phone.startsWith("+") ? data.phone : `${dialCode}${data.phone}`;
    registerMutation.mutate(
      { data: { name: data.name, email: data.email, country: data.country, phone: fullPhone, password: data.password } },
      {
        onSuccess: (res) => {
          setAuth(res.token, res.user);
          toast({ title: "Compte créé", description: "Bienvenue sur YookPay !" });
        },
        onError: (err: unknown) => {
          const apiErr = err as { data?: { error?: string; message?: string }; status?: number };
          const serverMsg = apiErr.data?.message ?? "";
          const isEmailTaken = apiErr.data?.error === "Conflict" || serverMsg === "Email already registered";
          toast({
            variant: "destructive",
            title: isEmailTaken ? "Email déjà utilisé" : "Échec de l'inscription",
            description: isEmailTaken
              ? "Un compte existe déjà avec cet email. Veuillez vous connecter."
              : serverMsg || "Une erreur s'est produite lors de la création du compte.",
          });
        },
      }
    );
  };

  if (isLoading) return null;

  return (
    <div className="min-h-screen flex flex-col justify-center bg-background py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-4">
          <YookPayLogo size="lg" />
        </div>
        <h2 className="text-center text-2xl font-bold tracking-tight text-foreground">
          Créer un compte
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Déjà inscrit ?{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:text-primary/80 transition-colors"
            data-testid="link-login"
          >
            Se connecter
          </Link>
        </p>
      </div>

      {/* Card */}
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-card py-8 px-4 shadow sm:rounded-xl sm:px-8 border border-border">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              {/* Nom complet */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom complet</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Jean Dupont"
                        autoComplete="name"
                        data-testid="input-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Adresse email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adresse email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="vous@exemple.com"
                        autoComplete="email"
                        data-testid="input-email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Pays */}
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pays</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-country">
                          <SelectValue placeholder="Sélectionner votre pays" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent modal={false} className="max-h-64 overflow-y-auto">
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            <span className="flex items-center gap-2">
                              <span>{c.flag}</span>
                              <span>{c.name}</span>
                              <span className="text-muted-foreground text-xs">{c.dialCode}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Numéro de téléphone */}
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Numéro de téléphone</FormLabel>
                    <FormControl>
                      <div className="flex">
                        {dialCode && (
                          <div className="flex items-center px-3 border border-r-0 border-input rounded-l-md bg-muted text-sm text-muted-foreground font-medium select-none whitespace-nowrap">
                            {dialCode}
                          </div>
                        )}
                        <Input
                          type="tel"
                          placeholder="600 000 000"
                          autoComplete="tel"
                          className={dialCode ? "rounded-l-none" : ""}
                          data-testid="input-phone"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Mot de passe */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mot de passe</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          autoComplete="new-password"
                          className="pr-10"
                          data-testid="input-password"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((p) => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Confirmation mot de passe */}
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmer le mot de passe</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showConfirm ? "text" : "password"}
                          placeholder="••••••••"
                          autoComplete="new-password"
                          className="pr-10"
                          data-testid="input-confirm-password"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm((p) => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          tabIndex={-1}
                        >
                          {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full mt-2"
                disabled={registerMutation.isPending}
                data-testid="button-submit"
              >
                {registerMutation.isPending ? "Création en cours..." : "Créer mon compte"}
              </Button>
            </form>
          </Form>
        </div>
      </div>

      <div className="mt-6 text-center">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}
