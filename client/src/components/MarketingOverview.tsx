import { useEffect, useState } from "react";
import { api, type ApiOrder, type ApiAuthUser } from "@/lib/api";
import { ORDER_STATUSES, getOrderStatusMeta } from "@shared/orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  Layers,
  Clock,
  CheckCircle2,
  Truck,
  Package,
  XCircle,
  PlusCircle,
  ArrowRight,
  Loader2,
  Calendar,
  Building2,
} from "lucide-react";
import { format } from "date-fns";

interface MarketingOverviewProps {
  user: ApiAuthUser;
  onNavigate: (tab: "Create Order" | "Order List") => void;
  onViewOrder?: (order: ApiOrder) => void;
}

export default function MarketingOverview({
  user,
  onNavigate,
  onViewOrder,
}: MarketingOverviewProps) {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);

  useEffect(() => {
    setLoading(true);
    api.orders
      .list({ page: 1, pageSize: 50 })
      .then((res) => {
        setOrders(res.items);
        setTotalOrders(res.total);
      })
      .catch((err) => {
        console.error("Failed to load marketing overview orders:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  // Compute metrics
  const totalCardsOrdered = orders.reduce((sum, o) => sum + (o.quantity || 0), 0);
  const statusCounts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  const recentOrders = orders.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#102728] via-[#15393a] to-[#1a4a49] p-6 text-white shadow-md">
        <div>
          <span className="inline-block rounded-full bg-emerald-500/20 px-3 py-0.5 text-xs font-bold text-emerald-300 border border-emerald-500/30 mb-2">
            Marketing Portal
          </span>
          <h1 className="text-2xl font-black tracking-tight">
            Welcome back, {user.name}
          </h1>
          <p className="text-xs text-gray-300 mt-1 max-w-xl">
            Track your placed ID card orders, monitor production & dispatch progress, and submit new bulk batches across schools.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={() => onNavigate("Create Order")}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 shadow-sm rounded-xl"
          >
            <PlusCircle className="h-4 w-4" /> Create Order
          </Button>
          <Button
            onClick={() => onNavigate("Order List")}
            variant="outline"
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold gap-2 rounded-xl"
          >
            View Orders <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Orders */}
        <Card className="rounded-2xl border-border bg-card text-card-foreground shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-foreground/80 dark:text-foreground/90 uppercase tracking-wider">
              Total Orders Placed
            </CardTitle>
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <ShoppingCart className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{loading ? "..." : totalOrders}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Placed by you</p>
          </CardContent>
        </Card>

        {/* Total ID Cards Ordered */}
        <Card className="rounded-2xl border-border bg-card text-card-foreground shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-foreground/80 dark:text-foreground/90 uppercase tracking-wider">
              Total ID Cards Ordered
            </CardTitle>
            <div className="h-9 w-9 rounded-xl bg-[#fff0e8] dark:bg-[#3d1e16] text-[#c65c3d] dark:text-[#f28a63] flex items-center justify-center">
              <Layers className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{loading ? "..." : totalCardsOrdered.toLocaleString()}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Units across all batches</p>
          </CardContent>
        </Card>

        {/* In Production */}
        <Card className="rounded-2xl border-border bg-card text-card-foreground shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-foreground/80 dark:text-foreground/90 uppercase tracking-wider">
              In Production
            </CardTitle>
            <div className="h-9 w-9 rounded-xl bg-[#e9ebfa] dark:bg-[#1e223d] text-[#5c64b7] dark:text-[#8a94e8] flex items-center justify-center">
              <Package className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">
              {loading ? "..." : (statusCounts["IN_PRODUCTION"] || 0)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Currently on printing lines</p>
          </CardContent>
        </Card>

        {/* Delivered / Dispatched */}
        <Card className="rounded-2xl border-border bg-card text-card-foreground shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-foreground/80 dark:text-foreground/90 uppercase tracking-wider">
              Delivered
            </CardTitle>
            <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-800 dark:text-emerald-300">
              {loading ? "..." : (statusCounts["DELIVERED"] || 0)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {statusCounts["DISPATCHED"] || 0} dispatched in transit
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Orders by Status Breakdown Cards */}
      <div>
        <h2 className="text-sm font-bold text-foreground mb-3 uppercase tracking-wider">
          Orders by Status
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {ORDER_STATUSES.map((st) => {
            const count = statusCounts[st.value] || 0;
            const meta = getOrderStatusMeta(st.value);
            return (
              <div
                key={st.value}
                className="rounded-xl border border-border bg-muted/30 p-3 text-center transition-all hover:border-primary/50 hover:shadow-2xs text-card-foreground"
              >
                <Badge
                  variant="outline"
                  className={`text-[10px] font-bold px-2 py-0.5 ${meta.badgeColor}`}
                >
                  {meta.label}
                </Badge>
                <div className="mt-2 text-xl font-black text-foreground">
                  {loading ? "-" : count}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">orders</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5 Most Recent Orders */}
      <Card className="rounded-2xl border-border bg-card text-card-foreground shadow-2xs">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border p-5">
          <div>
            <CardTitle className="text-base font-bold text-foreground">
              Recent Orders
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your 5 most recently placed ID card batches
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate("Order List")}
            className="text-xs font-bold text-primary hover:bg-primary/10"
          >
            All Orders <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading orders...
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No orders placed yet. Click "Create Order" to place your first batch.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentOrders.map((ord) => {
                const meta = getOrderStatusMeta(ord.status);
                return (
                  <div
                    key={ord.id}
                    onClick={() => onViewOrder?.(ord)}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 hover:bg-muted/40 transition-colors cursor-pointer"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary">
                          {ord.orderNumber}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold px-2 py-0.2 ${meta.badgeColor}`}
                        >
                          {meta.label}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] font-semibold bg-muted text-foreground">
                          {ord.orderType}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 font-semibold text-foreground">
                          <Building2 className="h-3 w-3 text-primary" />
                          {ord.schoolName || `School #${ord.schoolId}`}
                        </span>
                        {ord.orderType === "STUDENT" && ord.className && (
                          <span>· Class {ord.className} - {ord.section}</span>
                        )}
                        <span>· {ord.quantity} cards</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(ord.createdAt), "dd MMM yyyy, HH:mm")}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewOrder?.(ord);
                        }}
                        className="h-7 text-xs font-bold"
                      >
                        Details
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
