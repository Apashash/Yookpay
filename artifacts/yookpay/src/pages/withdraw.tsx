import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  useCreateWithdrawal, 
  useGetFeePreview 
} from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

const withdrawSchema = z.object({
  amount: z.coerce.number().min(100, "Amount must be at least 100"),
  currency: z.enum(["XAF", "XOF", "CDF"]),
  operator: z.enum(["MTN", "ORANGE", "MOOV", "WAVE"]),
  phone: z.string().min(8, "Valid phone number required"),
});

type WithdrawFormValues = z.infer<typeof withdrawSchema>;

export default function Withdraw() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const withdrawMutation = useCreateWithdrawal();
  const [feePreview, setFeePreview] = useState<any>(null);

  const form = useForm<WithdrawFormValues>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: {
      amount: 1000,
      currency: "XAF",
      operator: "MTN",
      phone: "",
    },
  });

  const amount = form.watch("amount");
  const currency = form.watch("currency");
  const operator = form.watch("operator");

  // Map currency to country for fee preview
  const getCountryForCurrency = (curr: string) => {
    if (curr === "XOF") return "SN";
    if (curr === "CDF") return "CD";
    return "CM"; // XAF
  };

  useEffect(() => {
    let active = true;
    
    async function fetchFee() {
      if (amount >= 100 && currency && operator) {
        try {
          const { getFeePreview } = await import("@workspace/api-client-react");
          const res = await getFeePreview({
            amount,
            country: getCountryForCurrency(currency) as "CM" | "SN" | "CD",
            operator,
            type: "WITHDRAWAL",
          });
          if (active) {
            setFeePreview(res);
          }
        } catch (error) {
          console.error("Fee preview error:", error);
        }
      }
    }

    const timeoutId = setTimeout(() => {
      fetchFee();
    }, 500);

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [amount, currency, operator]);

  const onSubmit = (data: WithdrawFormValues) => {
    withdrawMutation.mutate(
      { data },
      {
        onSuccess: (res) => {
          toast({
            title: "Withdrawal Initiated",
            description: `Your withdrawal of ${formatCurrency(res.transaction.amount, res.transaction.currency)} is pending.`,
          });
          setLocation("/dashboard");
        },
        onError: (err) => {
          toast({
            variant: "destructive",
            title: "Withdrawal Failed",
            description: err.error?.message || "There was an error processing your withdrawal.",
          });
        },
      }
    );
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Withdraw Funds</CardTitle>
          <CardDescription>
            Withdraw funds from your wallet to a Mobile Money account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Wallet Currency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-currency">
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="XAF">XAF (Central African CFA)</SelectItem>
                          <SelectItem value="XOF">XOF (West African CFA)</SelectItem>
                          <SelectItem value="CDF">CDF (Congolese Franc)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="operator"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Receiving Operator</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-operator">
                            <SelectValue placeholder="Select an operator" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="MTN">MTN Mobile Money</SelectItem>
                          <SelectItem value="ORANGE">Orange Money</SelectItem>
                          <SelectItem value="MOOV">Moov Money</SelectItem>
                          <SelectItem value="WAVE">Wave</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recipient Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 600000000" {...field} data-testid="input-phone" />
                    </FormControl>
                    <FormDescription>
                      The mobile money number to receive the funds.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount to Withdraw</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="1000" {...field} data-testid="input-amount" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {feePreview && (
                <div className="bg-muted rounded-md p-4 space-y-2 mt-6">
                  <h4 className="text-sm font-medium mb-3">Transaction Summary</h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Withdrawal Amount</span>
                    <span>{formatCurrency(feePreview.grossAmount, feePreview.currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Fee ({feePreview.feeRate}%)</span>
                    <span>{formatCurrency(feePreview.feeAmount, feePreview.currency)}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between font-medium">
                    <span>Total Deduction from Wallet</span>
                    <span className="text-destructive">{formatCurrency(feePreview.netAmount, feePreview.currency)}</span>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={withdrawMutation.isPending}
                data-testid="button-submit-withdraw"
              >
                {withdrawMutation.isPending ? "Processing..." : "Initiate Withdrawal"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
