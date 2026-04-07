import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  useCreateDeposit, 
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

const depositSchema = z.object({
  amount: z.coerce.number().min(100, "Amount must be at least 100"),
  country: z.enum(["CM", "SN", "CD"]),
  operator: z.enum(["MTN", "ORANGE", "MOOV", "WAVE"]),
  phone: z.string().min(8, "Valid phone number required"),
});

type DepositFormValues = z.infer<typeof depositSchema>;

export default function Deposit() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const depositMutation = useCreateDeposit();
  const [feePreview, setFeePreview] = useState<any>(null);

  const form = useForm<DepositFormValues>({
    resolver: zodResolver(depositSchema),
    defaultValues: {
      amount: 1000,
      country: "CM",
      operator: "MTN",
      phone: "",
    },
  });

  const amount = form.watch("amount");
  const country = form.watch("country");
  const operator = form.watch("operator");

  useEffect(() => {
    let active = true;
    
    async function fetchFee() {
      if (amount >= 100 && country && operator) {
        try {
          // Dynamic import of the function since it's a fetch, not a hook
          const { getFeePreviewUrl, getFeePreview } = await import("@workspace/api-client-react");
          const res = await getFeePreview({
            amount,
            country,
            operator,
            type: "DEPOSIT",
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
  }, [amount, country, operator]);

  const onSubmit = (data: DepositFormValues) => {
    depositMutation.mutate(
      { data },
      {
        onSuccess: (res) => {
          toast({
            title: "Deposit Initiated",
            description: `Your deposit of ${formatCurrency(res.transaction.amount, res.transaction.currency)} is pending.`,
          });
          setLocation("/dashboard");
        },
        onError: (err) => {
          toast({
            variant: "destructive",
            title: "Deposit Failed",
            description: err.error?.message || "There was an error processing your deposit.",
          });
        },
      }
    );
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Deposit Funds</CardTitle>
          <CardDescription>
            Add funds to your wallet using Mobile Money. The amount will be credited to the corresponding currency wallet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-country">
                            <SelectValue placeholder="Select a country" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="CM">Cameroon (CM)</SelectItem>
                          <SelectItem value="SN">Senegal (SN)</SelectItem>
                          <SelectItem value="CD">DR Congo (CD)</SelectItem>
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
                      <FormLabel>Operator</FormLabel>
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
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 600000000" {...field} data-testid="input-phone" />
                    </FormControl>
                    <FormDescription>
                      The mobile money number to charge.
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
                    <FormLabel>Amount</FormLabel>
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
                    <span className="text-muted-foreground">Amount</span>
                    <span>{formatCurrency(feePreview.grossAmount, feePreview.currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Fee ({feePreview.feeRate}%)</span>
                    <span>{formatCurrency(feePreview.feeAmount, feePreview.currency)}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between font-medium">
                    <span>You will receive</span>
                    <span className="text-primary">{formatCurrency(feePreview.netAmount, feePreview.currency)}</span>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={depositMutation.isPending}
                data-testid="button-submit-deposit"
              >
                {depositMutation.isPending ? "Processing..." : "Initiate Deposit"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
