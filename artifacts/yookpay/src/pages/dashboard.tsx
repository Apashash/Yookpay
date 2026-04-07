import { useAuth } from "@/lib/auth";
import { 
  useGetDashboardSummary, 
  useGetVolumeChart,
  getGetDashboardSummaryQueryKey,
  getGetVolumeChartQueryKey
} from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer 
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { ArrowDownRight, ArrowUpRight, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

export default function Dashboard() {
  const { user } = useAuth();
  
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() }
  });

  const { data: volumeData, isLoading: isLoadingVolume } = useGetVolumeChart({
    query: { queryKey: getGetVolumeChartQueryKey() }
  });

  if (isLoadingSummary || !summary) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-[120px] mb-2" />
                <Skeleton className="h-3 w-[80px]" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <Skeleton className="h-6 w-[150px] mb-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
          <Card className="col-span-3">
            <CardHeader>
              <Skeleton className="h-6 w-[150px] mb-2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUCCESS":
        return <Badge variant="default" className="bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 border-emerald-500/20">Success</Badge>;
      case "PENDING":
        return <Badge variant="secondary" className="bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 border-amber-500/20">Pending</Badge>;
      case "FAILED":
        return <Badge variant="destructive" className="bg-rose-500/15 text-rose-500 hover:bg-rose-500/25 border-rose-500/20">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Wallet Balances */}
      <div className="grid gap-4 md:grid-cols-3">
        {summary.wallets.map((wallet) => (
          <Card key={wallet.id} className="bg-gradient-to-br from-card to-card/50 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-6 opacity-5">
              <Wallet className="w-24 h-24" />
            </div>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 relative z-10">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {wallet.currency} Balance
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold tracking-tight text-foreground" data-testid={`text-balance-${wallet.currency}`}>
                {formatCurrency(wallet.balance, wallet.currency)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Deposited</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalDeposited, "XAF")}</div>
            <p className="text-xs text-muted-foreground mt-1">+20.1% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Withdrawn</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalWithdrawn, "XAF")}</div>
            <p className="text-xs text-muted-foreground mt-1">+10.1% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.successRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">Over {summary.transactionCount} transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Fees Paid</CardTitle>
            <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground font-bold">%</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalFeesPaid, "XAF")}</div>
            <p className="text-xs text-muted-foreground mt-1">Platform processing fees</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Volume (Last 7 Days)</CardTitle>
            <CardDescription>
              Aggregate transaction volume across all currencies (in XAF equivalent)
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {isLoadingVolume ? (
              <Skeleton className="h-[300px] w-full" />
            ) : volumeData && volumeData.length > 0 ? (
              <div className="h-[300px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={volumeData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorDeposits" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorWithdrawals" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="date" 
                      stroke="#888888" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <YAxis 
                      stroke="#888888" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(value) => `${value / 1000}k`} 
                    />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="deposits" 
                      stroke="hsl(var(--primary))" 
                      fillOpacity={1} 
                      fill="url(#colorDeposits)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="withdrawals" 
                      stroke="hsl(var(--chart-3))" 
                      fillOpacity={1} 
                      fill="url(#colorWithdrawals)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No volume data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Latest transactions across your wallets
              </CardDescription>
            </div>
            <Link href="/transactions" className="text-sm font-medium text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-6 mt-4">
              {summary.recentTransactions.length > 0 ? (
                summary.recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center">
                    <div className={`mr-4 h-10 w-10 rounded-full flex items-center justify-center border ${
                      tx.type === "DEPOSIT" ? "bg-primary/10 text-primary border-primary/20" : 
                      tx.type === "WITHDRAWAL" ? "bg-chart-3/10 text-chart-3 border-chart-3/20" : 
                      "bg-chart-4/10 text-chart-4 border-chart-4/20"
                    }`}>
                      {tx.type === "DEPOSIT" ? <ArrowDownRight className="h-5 w-5" /> : 
                       tx.type === "WITHDRAWAL" ? <ArrowUpRight className="h-5 w-5" /> : 
                       <ArrowRightLeft className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none capitalize">
                        {tx.type.toLowerCase()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(tx.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="font-medium text-sm">
                        {tx.type === "WITHDRAWAL" ? "-" : "+"}{formatCurrency(tx.amount, tx.currency)}
                      </div>
                      {getStatusBadge(tx.status)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No recent transactions found.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Quick component for lucide icons that I used that aren't imported natively
function Wallet(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a8 8 0 0 1-5 7.59l-9.74 3.25" />
      <path d="M19 13v-2" />
      <path d="M19 17v-2" />
    </svg>
  );
}