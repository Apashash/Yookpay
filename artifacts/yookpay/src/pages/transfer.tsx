import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  useCreateTransfer, 
  useGetWallets
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
import { ArrowRight } from "lucide-react";

const transferSchema = z.object({
  amount: z.coerce.number().min(100, "Amount must be at least 100"),
  fromCurrency: z.enum(["XAF", "XOF", "CDF"]),
  toCurrency: z.enum(["XAF", "XOF", "CDF"]),
}).refine(data => data.fromCurrency !== data.toCurrency, {
  message: "Source and destination currencies must be different",
  path: ["toCurrency"],
});

type TransferFormValues = z.infer<typeof transferSchema>;

export default function Transfer() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const transferMutation = useCreateTransfer();
  const { data: wallets } = useGetWallets();

  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      amount: 1000,
      fromCurrency: "XAF",
      toCurrency: "XOF",
    },
  });

  const fromCurrency = form.watch("fromCurrency");
  const toCurrency = form.watch("toCurrency");
  const amount = form.watch("amount");

  const onSubmit = (data: TransferFormValues) => {
    transferMutation.mutate(
      { data },
      {
        onSuccess: (res) => {
          toast({
            title: "Transfer Complete",
            description: `Successfully transferred ${formatCurrency(res.transaction.amount, res.transaction.currency)}.`,
          });
          setLocation("/dashboard");
        },
        onError: (err) => {
          toast({
            variant: "destructive",
            title: "Transfer Failed",
            description: err.error?.message || "There was an error processing your transfer.",
          });
        },
      }
    );
  };

  const getWalletBalance = (currency: string) => {
    const wallet = wallets?.find(w => w.currency === currency);
    return wallet ? wallet.balance : 0;
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Transfer Funds</CardTitle>
          <CardDescription>
            Exchange funds between your different currency wallets instantly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                <FormField
                  control={form.control}
                  name="fromCurrency"
                  render={({ field }) => (
                    <FormItem className="flex-1 w-full">
                      <FormLabel>From Wallet</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-from-currency">
                            <SelectValue placeholder="Source Currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="XAF">XAF (Bal: {formatCurrency(getWalletBalance("XAF"), "XAF")})</SelectItem>
                          <SelectItem value="XOF">XOF (Bal: {formatCurrency(getWalletBalance("XOF"), "XOF")})</SelectItem>
                          <SelectItem value="CDF">CDF (Bal: {formatCurrency(getWalletBalance("CDF"), "CDF")})</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="hidden md:flex mt-6 px-2 text-muted-foreground">
                  <ArrowRight className="w-6 h-6" />
                </div>

                <FormField
                  control={form.control}
                  name="toCurrency"
                  render={({ field }) => (
                    <FormItem className="flex-1 w-full">
                      <FormLabel>To Wallet</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-to-currency">
                            <SelectValue placeholder="Destination Currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="XAF">XAF</SelectItem>
                          <SelectItem value="XOF">XOF</SelectItem>
                          <SelectItem value="CDF">CDF</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount to Transfer (in {fromCurrency})</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="1000" {...field} data-testid="input-amount" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={transferMutation.isPending}
                data-testid="button-submit-transfer"
              >
                {transferMutation.isPending ? "Processing..." : "Transfer Funds"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
