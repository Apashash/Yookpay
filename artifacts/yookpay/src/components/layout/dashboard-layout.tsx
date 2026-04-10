import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowRightLeft,
  ListOrdered,
  LogOut,
  Menu,
  X,
  Settings,
  Briefcase,
  KeyRound,
  ShieldCheck,
  Users,
  FileCheck,
  Repeat2,
  Zap,
  Coins,
  History,
  BadgeDollarSign,
  Link2,
} from "lucide-react";
import { YookPayLogo } from "@/components/yookpay-logo";
import { Button } from "@/components/ui/button";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  // Close sidebar on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const navItems = [
    { href: "/dashboard",    label: "Dashboard",     icon: LayoutDashboard },
    { href: "/deposit",      label: "Dépôt",          icon: ArrowDownToLine },
    { href: "/withdraw",     label: "Retrait",        icon: ArrowUpFromLine },
    { href: "/transfer",     label: "Échange USDT",   icon: ArrowRightLeft },
    { href: "/transactions", label: "Transactions",   icon: ListOrdered },
    { href: "/yooklink",     label: "YookLink",       icon: Link2 },
    { href: "/services",     label: "Mes Services",   icon: Briefcase },
    { href: "/api-keys",     label: "Clé API",        icon: KeyRound },
    { href: "/kyc",          label: "KYC / KYB",      icon: ShieldCheck },
    { href: "/settings",     label: "Paramètres",     icon: Settings },
  ];

  const adminItems = [
    { href: "/admin",               label: "Vue d'ensemble", icon: LayoutDashboard },
    { href: "/admin/users",         label: "Utilisateurs",   icon: Users },
    { href: "/admin/kyc",           label: "File KYC",       icon: FileCheck },
    { href: "/admin/conversion",    label: "Conversion",     icon: Repeat2 },
    { href: "/admin/pixpay-config", label: "PixPay",         icon: Zap },
    { href: "/admin/transactions",  label: "Transactions",   icon: History },
    { href: "/admin/exchanges",     label: "Échanges USDT",  icon: Coins },
    { href: "/admin/fees",          label: "Grille des frais", icon: BadgeDollarSign },
  ];

  const pageTitle = location.split("/")[1] || "Dashboard";

  return (
    <div className="flex h-screen bg-background overflow-hidden">

      {/* Backdrop overlay — tap outside to close */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
          data-testid="sidebar-backdrop"
          aria-hidden="true"
        />
      )}

      {/* Sidebar — slides in from left, always on top */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-40 w-72
          bg-card border-r border-border
          flex flex-col
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}
        `}
        data-testid="sidebar"
      >
        {/* Sidebar header with logo + close button */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-border flex-shrink-0">
          <YookPayLogo size="md" />
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            aria-label="Close menu"
            data-testid="button-close-sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive =
              location === item.href || (item.href !== "/admin" && location.startsWith(`${item.href}/`));
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-3 px-3 py-3 rounded-md transition-colors cursor-pointer ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}

          {/* Admin section — only visible to admins */}
          {user?.role === "ADMIN" && (
            <>
              <div className="px-3 pt-4 pb-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Administration</p>
              </div>
              {adminItems.map((item) => {
                const isActive = location === item.href || (item.href !== "/admin" && location.startsWith(`${item.href}/`));
                return (
                  <Link key={item.href} href={item.href}>
                    <div
                      className={`flex items-center gap-3 px-3 py-3 rounded-md transition-colors cursor-pointer ${
                        isActive
                          ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-medium"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }`}
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      <span>{item.label}</span>
                    </div>
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* User profile + logout */}
        <div className="p-4 border-t border-border flex-shrink-0">
          <Link href="/settings">
            <div className="flex items-center gap-3 mb-3 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors cursor-pointer group">
              <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold flex-shrink-0 group-hover:bg-primary/30 transition-colors">
                {user?.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium text-foreground truncate"
                  data-testid="text-username"
                >
                  {user?.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email}
                </p>
              </div>
              <Settings className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </div>
          </Link>
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-foreground"
            onClick={logout}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Déconnexion
          </Button>
        </div>
      </aside>

      {/* Main content — full width, no left offset */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar with hamburger toggle */}
        <header className="h-16 flex items-center gap-4 px-4 sm:px-6 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-20 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            aria-label="Open menu"
            data-testid="button-open-sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          <YookPayLogo size="sm" />

          <div className="ml-auto">
            <h1 className="text-sm font-medium text-muted-foreground capitalize">
              {pageTitle}
            </h1>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
