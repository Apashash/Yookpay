import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import Deposit from "@/pages/deposit";
import Withdraw from "@/pages/withdraw";
import Transfer from "@/pages/transfer";
import Transactions from "@/pages/transactions";
import Settings from "@/pages/settings";
import Services from "@/pages/services";
import ApiKeys from "@/pages/api-keys";
import ApiKeyDetail from "@/pages/api-key-detail";
import Kyc from "@/pages/kyc";
import AdminDashboard from "@/pages/admin/index";
import AdminUsers from "@/pages/admin/users";
import AdminUserDetail from "@/pages/admin/user-detail";
import AdminKycQueue from "@/pages/admin/kyc-queue";
import AdminConversion from "@/pages/admin/conversion";
import AdminPixPayConfig from "@/pages/admin/pixpay-config";
import AdminTransactions from "@/pages/admin/transactions";
import AdminTransactionDetail from "@/pages/admin/transaction-detail";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;
  }
  
  if (!user) {
    return <Redirect to="/login" />;
  }
  
  return (
    <DashboardLayout>
      <Component />
    </DashboardLayout>
  );
}

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;
  }
  
  if (!user) return <Redirect to="/login" />;
  if (user.role !== "ADMIN") return <Redirect to="/dashboard" />;
  
  return (
    <DashboardLayout>
      <Component />
    </DashboardLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <Redirect to="/dashboard" />} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      {/* Protected Routes */}
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/deposit" component={() => <ProtectedRoute component={Deposit} />} />
      <Route path="/withdraw" component={() => <ProtectedRoute component={Withdraw} />} />
      <Route path="/transfer" component={() => <ProtectedRoute component={Transfer} />} />
      <Route path="/transactions" component={() => <ProtectedRoute component={Transactions} />} />
      <Route path="/settings"  component={() => <ProtectedRoute component={Settings} />} />
      <Route path="/services"  component={() => <ProtectedRoute component={Services} />} />
      <Route path="/api-keys"  component={() => <ProtectedRoute component={ApiKeys} />} />
      <Route path="/api-keys/:id" component={() => <ProtectedRoute component={ApiKeyDetail} />} />
      <Route path="/kyc"              component={() => <ProtectedRoute component={Kyc} />} />
      
      {/* Admin Routes */}
      <Route path="/admin"            component={() => <AdminRoute component={AdminDashboard} />} />
      <Route path="/admin/users"      component={() => <AdminRoute component={AdminUsers} />} />
      <Route path="/admin/users/:id"  component={() => <AdminRoute component={AdminUserDetail} />} />
      <Route path="/admin/kyc"        component={() => <AdminRoute component={AdminKycQueue} />} />
      <Route path="/admin/conversion" component={() => <AdminRoute component={AdminConversion} />} />
      <Route path="/admin/pixpay-config" component={() => <AdminRoute component={AdminPixPayConfig} />} />
      <Route path="/admin/transactions" component={() => <AdminRoute component={AdminTransactions} />} />
      <Route path="/admin/transactions/:id" component={() => <AdminRoute component={AdminTransactionDetail} />} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
