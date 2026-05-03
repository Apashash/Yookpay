import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, ArrowLeft, CheckCircle2, Server, TriangleAlert } from "lucide-react";
import { Link } from "wouter";

async function fetchHealth() {
  const res = await fetch("/healthz");
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.status}`);
  }
  return res.json() as Promise<{ status: string }>;
}

export default function Health() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["healthz"],
    queryFn: fetchHealth,
    retry: false,
  });

  const statusLabel = isLoading ? "Checking…" : isError ? "Down" : "Up";
  const statusClass = isLoading
    ? "bg-muted text-muted-foreground"
    : isError
      ? "bg-red-500/10 text-red-500"
      : "bg-emerald-500/10 text-emerald-500";

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-5 w-5 text-cyan-500" />
            <CardTitle>Deployment health</CardTitle>
          </div>
          <CardDescription>Quick check for the web app and backend.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <Server className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium">API /healthz</div>
                <div className="text-sm text-muted-foreground">Checks if the Node server is reachable.</div>
              </div>
            </div>
            <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${statusClass}`}>
              {isLoading ? null : isError ? <TriangleAlert className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {statusLabel}
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 text-sm">
            <div className="font-medium mb-1">Response</div>
            <pre className="whitespace-pre-wrap break-words text-muted-foreground">{isError ? "Unable to reach /healthz" : JSON.stringify(data, null, 2)}</pre>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Button asChild variant="outline">
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back home
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
