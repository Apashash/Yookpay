import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { customFetch } from "@workspace/api-client-react";
import {
  Bell,
  BellRing,
  ArrowDownToLine,
  ArrowUpFromLine,
  Link2,
  ArrowRightLeft,
  Info,
  Trash2,
  X,
  CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Notification {
  id: number;
  type: "DEPOSIT" | "WITHDRAWAL" | "PAYMENT_LINK" | "EXCHANGE" | "SYSTEM";
  title: string;
  body: string;
  transactionId: number | null;
  readAt: string | null;
  createdAt: string;
  unread: boolean;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

const TYPE_ICON: Record<string, React.ElementType> = {
  DEPOSIT:      ArrowDownToLine,
  WITHDRAWAL:   ArrowUpFromLine,
  PAYMENT_LINK: Link2,
  EXCHANGE:     ArrowRightLeft,
  SYSTEM:       Info,
};

const TYPE_COLOR: Record<string, string> = {
  DEPOSIT:      "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
  WITHDRAWAL:   "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
  PAYMENT_LINK: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
  EXCHANGE:     "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400",
  SYSTEM:       "bg-muted text-muted-foreground",
};

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)   return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  return `Il y a ${Math.floor(diff / 86400)} j`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { data } = useQuery<NotificationsResponse>({
    queryKey: ["notifications"],
    queryFn: () => customFetch<NotificationsResponse>("/api/notifications"),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  const unreadCount = data?.unreadCount ?? 0;
  const notifications = data?.notifications ?? [];

  const markRead = useMutation({
    mutationFn: (id: number) =>
      customFetch(`/api/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const deleteOne = useMutation({
    mutationFn: (id: number) =>
      customFetch(`/api/notifications/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const deleteAll = useMutation({
    mutationFn: () =>
      customFetch("/api/notifications", { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  function handleClick(n: Notification) {
    if (n.unread) markRead.mutate(n.id);
    if (n.transactionId) {
      setOpen(false);
      navigate("/transactions");
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          aria-label="Notifications"
        >
          {unreadCount > 0 ? (
            <BellRing className="h-5 w-5 text-primary" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white leading-none">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-80 p-0 overflow-hidden"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                {unreadCount}
              </span>
            )}
          </div>
          {notifications.length > 0 && (
            <button
              onClick={() => deleteAll.mutate()}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
              title="Tout supprimer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Tout supprimer
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <CheckCheck className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">Aucune notification</p>
            </div>
          ) : (
            notifications.map((n) => {
              const Icon = TYPE_ICON[n.type] ?? Info;
              const colorClass = TYPE_COLOR[n.type] ?? TYPE_COLOR.SYSTEM;
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-b-0 transition-colors ${
                    n.unread
                      ? "bg-primary/5 hover:bg-primary/10"
                      : "hover:bg-muted/40"
                  } ${n.transactionId ? "cursor-pointer" : ""}`}
                  onClick={() => handleClick(n)}
                >
                  <div className={`flex-shrink-0 mt-0.5 flex h-7 w-7 items-center justify-center rounded-full ${colorClass}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${n.unread ? "font-semibold text-foreground" : "font-medium text-foreground/80"}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteOne.mutate(n.id); }}
                    className="flex-shrink-0 p-0.5 rounded text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                    aria-label="Supprimer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer note */}
        {notifications.length > 0 && (
          <div className="px-4 py-2 border-t border-border bg-muted/30">
            <p className="text-[10px] text-muted-foreground text-center">
              Les notifications sont supprimées automatiquement après 24h
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
