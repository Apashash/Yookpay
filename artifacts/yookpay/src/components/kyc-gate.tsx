import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { ShieldAlert, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

type KycLevel = "kyc" | "kyb";

interface KycGateProps {
  level: KycLevel;
  children: React.ReactNode;
}

export function KycGate({ level, children }: KycGateProps) {
  const { data, isLoading } = useQuery<{ profile: { kycStatus: string; kybStatus: string } | null }>({
    queryKey: ["kyc-status-gate"],
    queryFn: () => customFetch("/api/kyc"),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const kycApproved = data?.profile?.kycStatus === "APPROVED";
  const kybApproved = data?.profile?.kybStatus === "APPROVED";

  const blocked =
    level === "kyb" ? !kybApproved :
    level === "kyc" ? !kycApproved : false;

  if (!blocked) return <>{children}</>;

  const isKyb = level === "kyb" && kycApproved && !kybApproved;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-6">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30">
        <ShieldAlert className="w-8 h-8 text-amber-500" />
      </div>
      <div className="space-y-2 max-w-sm">
        <h2 className="text-lg font-semibold">Vérification requise</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {isKyb
            ? "Pour accéder à cette fonctionnalité, vous devez passer la vérification KYB."
            : "Vous devez passer la vérification KYC au moins pour accéder à cette fonctionnalité."}
        </p>
      </div>
      <Link href="/kyc">
        <Button className="bg-blue-600 hover:bg-blue-700 text-white">
          {isKyb ? "Passer la vérification KYB" : "Passer la vérification KYC"}
        </Button>
      </Link>
    </div>
  );
}
