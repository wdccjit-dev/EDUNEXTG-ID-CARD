import { useEffect, useState, useMemo } from "react";
import { api, type ApiOrder, type ApiAuthUser, type ApiSchool } from "@/lib/api";
import {
  ORDER_STATUSES,
  ORDER_TYPES,
  getOrderStatusMeta,
  type OrderStatus,
} from "@shared/orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Filter,
  PlusCircle,
  Calendar,
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  Truck,
  RotateCcw,
  Loader2,
  Eye,
  Ban,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  User,
  Phone,
  MapPin,
  FileText,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface OrderListViewProps {
  user: ApiAuthUser;
  schools: ApiSchool[];
  onCreateNew: () => void;
  initialSelectedOrder?: ApiOrder | null;
}

export default function OrderListView({
  user,
  schools,
  onCreateNew,
  initialSelectedOrder,
}: OrderListViewProps) {
  const isSuperAdmin = user.role === "SUPER_ADMIN";
  const isMarketingAdmin = user.role === "PARTNER" || user.role === "PARTNER_ADMIN" || user.role === "MARKETING_ADMIN";
  const isSchoolAdmin = user.role === "SCHOOL_ADMIN";

  // Data states
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [schoolFilter, setSchoolFilter] = useState<string>("ALL");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Details drawer/dialog
  const [selectedOrder, setSelectedOrder] = useState<ApiOrder | null>(initialSelectedOrder || null);
  const [detailsOpen, setDetailsOpen] = useState(!!initialSelectedOrder);

  // Status change modal (Super Admin)
  const [statusChangeOpen, setStatusChangeOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<OrderStatus>("CONFIRMED");
  const [statusNote, setStatusNote] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Cancel order modal
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const fetchOrders = () => {
    setLoading(true);
    api.orders
      .list({
        page,
        pageSize,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        orderType: typeFilter === "ALL" ? undefined : typeFilter,
        schoolId: schoolFilter === "ALL" ? undefined : Number(schoolFilter),
        placedByRole: roleFilter === "ALL" ? undefined : roleFilter,
        search: search.trim() || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      })
      .then((res) => {
        setOrders(res.items);
        setTotal(res.total);
      })
      .catch((err) => {
        toast.error("Failed to load orders", {
          description: err instanceof Error ? err.message : "Network error",
        });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
  }, [page, pageSize, statusFilter, typeFilter, schoolFilter, roleFilter, fromDate, toDate]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchOrders();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleOpenDetails = (ord: ApiOrder) => {
    setSelectedOrder(ord);
    setDetailsOpen(true);
  };

  // Status change handler
  const handleUpdateStatus = async () => {
    if (!selectedOrder) return;
    try {
      setUpdatingStatus(true);
      const updated = await api.orders.updateStatus(selectedOrder.id, {
        status: newStatus,
        statusNote: statusNote.trim() || undefined,
      });
      toast.success(`Order #${updated.orderNumber} status updated to ${updated.status}`);
      setSelectedOrder(updated);
      setStatusChangeOpen(false);
      setStatusNote("");
      fetchOrders();
    } catch (err) {
      toast.error("Failed to update status", {
        description: err instanceof Error ? err.message : "Error",
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Cancel order handler
  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    try {
      setCancelling(true);
      const updated = await api.orders.cancel(selectedOrder.id, {
        reason: cancelReason.trim() || undefined,
      });
      toast.success(`Order #${updated.orderNumber} has been cancelled`);
      setSelectedOrder(updated);
      setCancelModalOpen(false);
      setCancelReason("");
      fetchOrders();
    } catch (err) {
      toast.error("Failed to cancel order", {
        description: err instanceof Error ? err.message : "Error",
      });
    } finally {
      setCancelling(false);
    }
  };

  // Placed by role badge style helper
  const getRoleBadge = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 text-[10px] font-bold">Admin</Badge>;
      case "SCHOOL_ADMIN":
        return <Badge className="bg-teal-100 text-teal-800 border-teal-200 text-[10px] font-bold">School Admin</Badge>;
      case "PARTNER":
      case "PARTNER_ADMIN":
      case "MARKETING_ADMIN":
        return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[10px] font-bold">Partner</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{role}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground">ID Card Orders</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isSuperAdmin
              ? "All ID card batches across all partner schools and partners"
              : isSchoolAdmin
              ? "Order batches for your school"
              : "ID card orders placed by your partner account"}
          </p>
        </div>
        <Button
          onClick={onCreateNew}
          className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2 shadow-2xs"
        >
          <PlusCircle className="h-4 w-4" /> Create Order
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="rounded-2xl border-border bg-card text-card-foreground shadow-2xs p-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              className="pl-9 text-xs rounded-xl h-9"
              placeholder="Search order #, school, contact..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Status Filter */}
          <div>
            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
              <SelectTrigger className="text-xs rounded-xl h-9">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                {ORDER_STATUSES.map((st) => (
                  <SelectItem key={st.value} value={st.value}>
                    {st.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Order Type */}
          <div>
            <Select value={typeFilter} onValueChange={(val) => { setTypeFilter(val); setPage(1); }}>
              <SelectTrigger className="text-xs rounded-xl h-9">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                {ORDER_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* School filter (Super Admin only) */}
          {isSuperAdmin && (
            <div>
              <Select value={schoolFilter} onValueChange={(val) => { setSchoolFilter(val); setPage(1); }}>
                <SelectTrigger className="text-xs rounded-xl h-9">
                  <SelectValue placeholder="All Schools" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Schools</SelectItem>
                  {schools.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Placed by role filter (Super Admin only) */}
          {isSuperAdmin && (
            <div>
              <Select value={roleFilter} onValueChange={(val) => { setRoleFilter(val); setPage(1); }}>
                <SelectTrigger className="text-xs rounded-xl h-9">
                  <SelectValue placeholder="All Placed-By Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Placed-By Roles</SelectItem>
                  <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                  <SelectItem value="SCHOOL_ADMIN">School Admin</SelectItem>
                  <SelectItem value="PARTNER">Partner</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Date range filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Date Range:</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px]">From</span>
            <Input
              type="date"
              className="text-xs rounded-xl h-8 w-36"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px]">To</span>
            <Input
              type="date"
              className="text-xs rounded-xl h-8 w-36"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
            />
          </div>
          {(search || statusFilter !== "ALL" || typeFilter !== "ALL" || schoolFilter !== "ALL" || roleFilter !== "ALL" || fromDate || toDate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setStatusFilter("ALL");
                setTypeFilter("ALL");
                setSchoolFilter("ALL");
                setRoleFilter("ALL");
                setFromDate("");
                setToDate("");
                setPage(1);
              }}
              className="h-8 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3 mr-1" /> Reset Filters
            </Button>
          )}
        </div>
      </Card>

      {/* Orders Table */}
      <Card className="rounded-2xl border-border bg-card text-card-foreground shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                <th className="py-3 px-4">Order No</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Placed By</th>
                <th className="py-3 px-4">School</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Class/Sec</th>
                <th className="py-3 px-4 text-right">Qty</th>
                <th className="py-3 px-4">Hook / Clamps</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-gray-400">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-[#0f7f79]" />
                    Loading orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-gray-400">
                    No orders match your filter criteria.
                  </td>
                </tr>
              ) : (
                orders.map((ord) => {
                  const meta = getOrderStatusMeta(ord.status);
                  const isPlacer = ord.placedByUserId === user.id;
                  const canCancel = (isPlacer && ord.status === "PLACED") || isSuperAdmin;

                  return (
                    <tr
                      key={ord.id}
                      onClick={() => handleOpenDetails(ord)}
                      className="hover:bg-muted/40 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-primary">
                        {ord.orderNumber}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                        {format(new Date(ord.createdAt), "dd MMM yyyy")}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-foreground">
                            {ord.placedByName || "Unknown"}
                          </span>
                          <div>{getRoleBadge(ord.placedByRole)}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground max-w-[180px] truncate" title={ord.schoolName || undefined}>
                        {ord.schoolName || `School #${ord.schoolId}`}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-[10px] font-bold">
                          {ord.orderType}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {ord.orderType === "STUDENT" ? (
                          `${ord.className || "-"} (${ord.section || "-"})`
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-right text-foreground">
                        {ord.quantity.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-[11px]">
                        <div>{ord.hookType}</div>
                        <div className="text-[10px] text-muted-foreground">Clamps: {ord.clip ? "Yes" : "No"}</div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold px-2 py-0.5 whitespace-nowrap ${meta.badgeColor}`}
                        >
                          {meta.label}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDetails(ord)}
                            className="h-7 text-xs font-bold"
                          >
                            <Eye className="h-3 w-3 mr-1" /> View
                          </Button>
                          {canCancel && ord.status !== "CANCELLED" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedOrder(ord);
                                setCancelModalOpen(true);
                              }}
                              className="h-7 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                            >
                              <Ban className="h-3 w-3 mr-1" /> Cancel
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Count */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-border bg-muted/20">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              Showing <b>{orders.length}</b> of <b>{total}</b> orders
            </span>
            <div className="flex items-center gap-1.5 ml-2">
              <span>Per page:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(val) => {
                  setPageSize(Number(val));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-7 w-20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map((sz) => (
                    <SelectItem key={sz} value={String(sz)}>
                      {sz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground mr-2">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 rounded-lg text-xs font-bold"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-0.5" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 rounded-lg text-xs font-bold"
            >
              Next <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Order Details Drawer / Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6">
          {selectedOrder && (
            <>
              <DialogHeader className="border-b pb-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                    <DialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
                      Order #{selectedOrder.orderNumber}
                      <Badge
                        variant="outline"
                        className={`text-[11px] font-bold ${getOrderStatusMeta(selectedOrder.status).badgeColor}`}
                      >
                        {getOrderStatusMeta(selectedOrder.status).label}
                      </Badge>
                    </DialogTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Placed on {format(new Date(selectedOrder.createdAt), "dd MMMM yyyy, hh:mm a")}
                    </p>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 py-3 text-xs">
                {/* Status note if present */}
                {selectedOrder.statusNote && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
                    <span className="font-bold">Status Update Note: </span>
                    {selectedOrder.statusNote}
                  </div>
                )}

                {/* Primary info grid */}
                <div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-muted/40 p-3.5">
                  <div>
                    <span className="text-muted-foreground font-semibold block text-[10px] uppercase">Placed By</span>
                    <span className="font-bold text-foreground text-sm">{selectedOrder.placedByName}</span>
                    <div className="mt-0.5">{getRoleBadge(selectedOrder.placedByRole)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-semibold block text-[10px] uppercase">School</span>
                    <span className="font-bold text-foreground text-sm flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5 text-primary" />
                      {selectedOrder.schoolName || `School #${selectedOrder.schoolId}`}
                    </span>
                  </div>
                </div>

                {/* Specs */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-border p-2.5">
                    <span className="text-muted-foreground font-semibold block text-[10px] uppercase">Order Type</span>
                    <span className="font-bold text-foreground">{selectedOrder.orderType}</span>
                  </div>
                  <div className="rounded-xl border border-border p-2.5">
                    <span className="text-muted-foreground font-semibold block text-[10px] uppercase">Quantity</span>
                    <span className="font-bold text-foreground font-mono text-sm">{selectedOrder.quantity} cards</span>
                  </div>
                  <div className="rounded-xl border border-border p-2.5">
                    <span className="text-muted-foreground font-semibold block text-[10px] uppercase">Print Sides</span>
                    <span className="font-bold text-foreground">{selectedOrder.printSides === "SINGLE" ? "Single Sided" : "Double Sided"}</span>
                  </div>
                  <div className="rounded-xl border border-border p-2.5">
                    <span className="text-muted-foreground font-semibold block text-[10px] uppercase">Card Material</span>
                    <span className="font-bold text-foreground">{selectedOrder.cardMaterial === "PVC_PREMIUM" ? "PVC Core" : "PVC Inkjet"}</span>
                  </div>
                  <div className="rounded-xl border border-border p-2.5">
                    <span className="text-muted-foreground font-semibold block text-[10px] uppercase">Hook Type</span>
                    <span className="font-bold text-foreground">{selectedOrder.hookType}</span>
                  </div>
                  <div className="rounded-xl border border-border p-2.5">
                    <span className="text-muted-foreground font-semibold block text-[10px] uppercase">Clamps Included</span>
                    <span className="font-bold text-foreground">{selectedOrder.clip ? "Yes" : "No"}</span>
                  </div>
                </div>

                {/* Class & Section if Student */}
                {selectedOrder.orderType === "STUDENT" && (
                  <div className="grid grid-cols-2 gap-3 rounded-xl border border-border p-3 bg-card text-card-foreground">
                    <div>
                      <span className="text-muted-foreground font-semibold block text-[10px] uppercase">Class</span>
                      <span className="font-bold text-foreground">{selectedOrder.className || "-"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground font-semibold block text-[10px] uppercase">Section</span>
                      <span className="font-bold text-foreground">{selectedOrder.section || "-"}</span>
                    </div>
                  </div>
                )}

                {/* Lanyard info */}
                <div className="rounded-xl border border-border p-3 bg-card text-card-foreground flex items-center justify-between">
                  <div>
                    <span className="text-muted-foreground font-semibold block text-[10px] uppercase">Lanyard</span>
                    <span className="font-bold text-foreground">
                      {selectedOrder.lanyardIncluded ? `Included (${selectedOrder.lanyardColor || "Standard"})` : "Not Included"}
                    </span>
                  </div>
                  {selectedOrder.neededByDate && (
                    <div className="text-right">
                      <span className="text-muted-foreground font-semibold block text-[10px] uppercase">Needed By</span>
                      <span className="font-bold text-foreground">{selectedOrder.neededByDate}</span>
                    </div>
                  )}
                </div>

                {/* Contact & Delivery */}
                <div className="rounded-xl border border-border p-3.5 space-y-2 bg-muted/40">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-primary" /> {selectedOrder.contactPerson}
                    </span>
                    <span className="font-mono text-foreground flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-primary" /> +91 {selectedOrder.contactPhone}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-border text-foreground">
                    <span className="text-muted-foreground font-semibold block text-[10px] uppercase">Delivery Address:</span>
                    <p className="mt-0.5 whitespace-pre-wrap">{selectedOrder.deliveryAddress}</p>
                  </div>
                </div>

                {/* Notes */}
                {selectedOrder.notes && (
                  <div className="rounded-xl border border-border p-3 bg-card text-card-foreground">
                    <span className="text-muted-foreground font-semibold block text-[10px] uppercase">Production Notes:</span>
                    <p className="mt-0.5 text-foreground whitespace-pre-wrap">{selectedOrder.notes}</p>
                  </div>
                )}
              </div>

              <DialogFooter className="border-t pt-3 flex flex-wrap items-center justify-between gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDetailsOpen(false)}
                  className="rounded-xl"
                >
                  Close
                </Button>

                <div className="flex items-center gap-2">
                  {/* Cancel button */}
                  {((selectedOrder.placedByUserId === user.id && selectedOrder.status === "PLACED") || isSuperAdmin) && selectedOrder.status !== "CANCELLED" && (
                    <Button
                      variant="outline"
                      onClick={() => setCancelModalOpen(true)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 rounded-xl"
                    >
                      <Ban className="h-3.5 w-3.5 mr-1" /> Cancel Order
                    </Button>
                  )}

                  {/* Super Admin Status Change Button */}
                  {isSuperAdmin && (
                    <Button
                      onClick={() => {
                        setNewStatus(selectedOrder.status);
                        setStatusNote(selectedOrder.statusNote || "");
                        setStatusChangeOpen(true);
                      }}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold"
                    >
                      Update Status
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Super Admin Update Status Dialog */}
      <Dialog open={statusChangeOpen} onOpenChange={setStatusChangeOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Update Order Status
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Change the production or delivery status for Order #{selectedOrder?.orderNumber}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">New Status</label>
              <Select value={newStatus} onValueChange={(val: OrderStatus) => setNewStatus(val)}>
                <SelectTrigger className="text-xs rounded-xl h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_STATUSES.map((st) => (
                    <SelectItem key={st.value} value={st.value}>
                      {st.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                Status Note / Tracking ID (Optional)
              </label>
              <Textarea
                rows={2}
                className="text-xs rounded-xl"
                placeholder="e.g. Courier tracking #AWB12345 or batch printed"
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setStatusChangeOpen(false)}
              disabled={updatingStatus}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateStatus}
              disabled={updatingStatus}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold gap-2"
            >
              {updatingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Order Confirmation Dialog */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
              <Ban className="h-4 w-4" /> Cancel Order #{selectedOrder?.orderNumber}?
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Are you sure you want to cancel this order? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <label className="text-xs font-bold text-gray-700 block mb-1">
              Cancellation Reason (Optional)
            </label>
            <Textarea
              rows={2}
              className="text-xs rounded-xl"
              placeholder="e.g. Quantity changes needed or duplicate order"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setCancelModalOpen(false)}
              disabled={cancelling}
              className="rounded-xl"
            >
              Keep Order
            </Button>
            <Button
              onClick={handleCancelOrder}
              disabled={cancelling}
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold gap-2"
            >
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Cancellation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
