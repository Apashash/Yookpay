import { useAuth } from "@/lib/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useLogin } from "@workspace/api-client-react";
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
import { Link, useLocation } from "wouter";
import { useEffect } from "react";
import { YookPayLogo } from "@/components/yookpay-logo";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const { login: setAuth, token, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const loginMutation = useLogin();
  const { toast } = useToast();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (!isLoading && token) {
      setLocation("/dashboard");
    }
  }, [token, isLoading, setLocation]);

  const onSubmit = (data: LoginFormValues) => {
    loginMutation.mutate(
      { data },
      {
        onSuccess: (res) => {
          setAuth(res.token, res.user);
          toast({
            title: "Welcome back",
            description: "Successfully logged into YookPay.",
          });
        },
        onError: (err) => {
          const isBanned = (err as any)?.error === "Banned";
          toast({
            variant: "destructive",
            title: isBanned ? "Compte suspendu" : "Connexion échouée",
            description: isBanned
              ? "Votre compte a été suspendu. Contactez le support YookPay."
              : err.error?.message || "Vérifiez vos identifiants et réessayez.",
          });
        },
      }
    );
  };

  if (isLoading) return null;

  return (
    <div className="min-h-screen flex flex-col justify-center bg-background sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <YookPayLogo size="lg" />
        </div>
        <h2 className="text-center text-2xl font-bold tracking-tight text-foreground">
          Connexion à votre compte
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link href="/register" className="font-medium text-primary hover:text-primary/80 transition-colors" data-testid="link-register">
            S'inscrire
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-card py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-border">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adresse email</FormLabel>
                    <FormControl>
                      <Input placeholder="vous@exemple.com" autoComplete="email" {...field} data-testid="input-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mot de passe</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" autoComplete="current-password" {...field} data-testid="input-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
                data-testid="button-submit"
              >
                {loginMutation.isPending ? "Connexion..." : "Se connecter"}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
