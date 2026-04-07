import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, FileCheck, ArrowRightLeft, Star, ChevronRight, ShieldCheck } from "lucide-react";

interface AdminStats {
  totalUsers: number;
  pendingKyc: number;
  totalTx: number;
  customFees: number;
}

export default function AdminDashboard() {
  const { data, isLoading } = useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    queryFn: () => customFetch<AdminStats>("/api/admin/stats"),
  });

  const stats = [
    { label: "Utilisateurs inscrits", value: data?.totalUsers, icon: Users, href: "/admin/users", color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" },
    { label: "Documents KYC en attente", value: data?.pendingKyc, icon: FileCheck, href: "/admin/kyc", color: "text-amber-600 bg-amber-100 dark:bg-amber-900/30" },
    { label: "Transactions totales", value: data?.totalTx, icon: ArrowRightLeft, href: null, color: "text-green-600 bg-green-100 dark:bg-green-900/30" },
    { label: "Utilisateurs avec frais personnalisés", value: data?.customFees, icon: Star, href: "/admin/users", color: "text-purple-600 bg-purple-100 dark:bg-purple-900/30" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Administration</h1>
          <p className="text-muted-foreground text-sm">Vue d'ensemble de la plateforme YookPay</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className={stat.href ? "cursor-pointer hover:shadow-md transition-shadow" : ""}>
            {stat.href ? (
              <Link href={stat.href}>
                <CardContent className="pt-5 pb-5">
                  <StatContent stat={stat} isLoading={isLoading} />
                </CardContent>
              </Link>
            ) : (
              <CardContent className="pt-5 pb-5">
                <StatContent stat={stat} isLoading={isLoading} />
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Quick access */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Accès rapide</h2>
        <div className="grid grid-cols-1 gap-2">
          {[
            { href: "/admin/users", label: "Gérer les utilisateurs", desc: "Voir, modifier les frais et rôles", icon: Users },
            { href: "/admin/kyc",   label: "File de vérification KYC", desc: "Valider ou rejeter les documents", icon: FileCheck },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="cursor-pointer hover:shadow-md transition-shadow hover:bg-muted/30">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatContent({ stat, isLoading }: { stat: { label: string; value: number | undefined; icon: React.ComponentType<{ className?: string }>; color: string }; isLoading: boolean }) {
  const Icon = stat.icon;
  return (
    <div className="flex items-center gap-4">
      <div className={`h-11 w-11 rounded-full flex items-center justify-center flex-shrink-0 ${stat.color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        {isLoading ? (
          <Skeleton className="h-8 w-12 mb-1" />
        ) : (
          <p className="text-3xl font-bold">{stat.value ?? 0}</p>
        )}
        <p className="text-sm text-muted-foreground">{stat.label}</p>
      </div>
    </div>
  );
}
