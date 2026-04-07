import { useState } from "react";
import { 
  useGetTransactions, 
  getGetTransactionsQueryKey 
} from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Transactions() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("ALL");
  const [currency, setCurrency] = useState<string>("ALL");
  
  const params: any = { page, limit: 10 };
  if (status !== "ALL") params.status = status;
  if (currency !== "ALL") params.currency = currency;

  const { data, isLoading } = useGetTransactions(params, {
    query: { queryKey: getGetTransactionsQueryKey(params) }
  });

  const getStatusBadge = (txStatus: string) => {
    switch (txStatus) {
      case "SUCCESS":
        return <Badge variant="default" className="bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 border-emerald-500/20">Success</Badge>;
      case "PENDING":
        return <Badge variant="secondary" className="bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 border-amber-500/20">Pending</Badge>;
      case "FAILED":
        return <Badge variant="destructive" className="bg-rose-500/15 text-rose-500 hover:bg-rose-500/25 border-rose-500/20">Failed</Badge>;
      default:
        return <Badge variant="outline">{txStatus}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle>Transaction History</CardTitle>
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="w-[140px]" data-testid="filter-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="SUCCESS">Success</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={currency} onValueChange={(v) => { setCurrency(v); setPage(1); }}>
              <SelectTrigger className="w-[140px]" data-testid="filter-currency">
                <SelectValue placeholder="Currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Currencies</SelectItem>
                <SelectItem value="XAF">XAF</SelectItem>
                <SelectItem value="XOF">XOF</SelectItem>
                <SelectItem value="CDF">CDF</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-6 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : data?.transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No transactions found matching your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-medium text-xs font-mono">{tx.reference}</TableCell>
                      <TableCell>
                        <div className="capitalize">{tx.type.toLowerCase()}</div>
                        {tx.operator && <div className="text-xs text-muted-foreground">{tx.operator}</div>}
                      </TableCell>
                      <TableCell>{formatCurrency(tx.amount, tx.currency)}</TableCell>
                      <TableCell>{formatCurrency(tx.netAmount, tx.currency)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(tx.createdAt)}</TableCell>
                      <TableCell className="text-right">{getStatusBadge(tx.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing page {data.page} of {data.totalPages}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                  disabled={page === data.totalPages}
                  data-testid="button-next-page"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
