import { useEffect, useState, useMemo } from "react";
import {
  api,
  type ApiUser,
  type ApiAuthUser,
  type ApiOrder,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Handshake,
  PlusCircle,
  Search,
  MoreVertical,
  Mail,
  Phone,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  Trash2,
  Edit,
  Shield,
  Loader2,
  Users,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import {
  isValidIndianMobileNumber,
  INDIAN_MOBILE_ERROR_MESSAGE,
  INDIAN_MOBILE_PLACEHOLDER,
} from "@shared/phoneValidation";

interface PartnersSectionProps {
  currentUser: ApiAuthUser;
  onNavigateToOrders?: (partnerId?: number) => void;
}

export default function PartnersSection({
  currentUser,
  onNavigateToOrders,
}: PartnersSectionProps) {
  const [partners, setPartners] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [orderCounts, setOrderCounts] = useState<Record<number, number>>({});

  // Add Partner Dialog State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addOpenId, setAddOpenId] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [addErrors, setAddErrors] = useState<{
    name?: string;
    email?: string;
    openId?: string;
    password?: string;
    phone?: string;
  }>({});
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Edit Partner Dialog State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<ApiUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editErrors, setEditErrors] = useState<{
    name?: string;
    email?: string;
    phone?: string;
    password?: string;
  }>({});
  const [submittingEdit, setSubmittingEdit] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allUsers, ordersRes] = await Promise.all([
        api.users.list().catch(() => []),
        api.orders.list({ pageSize: 100 }).catch(() => ({ items: [], total: 0 })),
      ]);

      const partnerUsers = allUsers.filter(
        (u) =>
          u.role === "PARTNER" ||
          u.role === "PARTNER_ADMIN" ||
          u.role === "MARKETING_ADMIN"
      );
      setPartners(partnerUsers);

      // Compute order counts per partner
      const counts: Record<number, number> = {};
      for (const ord of ordersRes.items || []) {
        if (ord.placedByUserId) {
          counts[ord.placedByUserId] = (counts[ord.placedByUserId] || 0) + 1;
        }
      }
      setOrderCounts(counts);
    } catch (err) {
      console.error("Failed to load partners data", err);
      toast.error("Could not load partners");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered partners
  const filteredPartners = useMemo(() => {
    return partners.filter((p) => {
      if (statusFilter === "ACTIVE" && !p.isActive) return false;
      if (statusFilter === "INACTIVE" && p.isActive) return false;

      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return (
        p.name?.toLowerCase().includes(term) ||
        p.email?.toLowerCase().includes(term) ||
        p.openId?.toLowerCase().includes(term)
      );
    });
  }, [partners, search, statusFilter]);

  // Statistics
  const totalPartners = partners.length;
  const activePartners = partners.filter((p) => p.isActive).length;
  const inactivePartners = totalPartners - activePartners;
  const totalOrdersPlaced = Object.values(orderCounts).reduce((a, b) => a + b, 0);

  // Auto-generate Login ID based on name
  const handleNameChange = (val: string) => {
    setAddName(val);
    if (!addOpenId || addOpenId.startsWith("partner_") || addOpenId.startsWith("ptr_")) {
      const slug = val
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_")
        .slice(0, 16);
      if (slug) {
        setAddOpenId(`partner_${slug}`);
      }
    }
    setAddErrors((prev) => ({ ...prev, name: undefined }));
  };

  // Add Partner submit
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: typeof addErrors = {};

    if (!addName.trim()) errors.name = "Full name is required";
    if (!addEmail.trim()) {
      errors.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addEmail.trim())) {
      errors.email = "Enter a valid email address";
    }

    if (!addOpenId.trim()) {
      errors.openId = "Login ID / Username is required";
    } else if (addOpenId.trim().length < 3) {
      errors.openId = "Login ID must be at least 3 characters";
    }

    if (!addPassword) {
      errors.password = "Password is required";
    } else if (addPassword.length < 8) {
      errors.password = "Password must be at least 8 characters";
    }

    if (addPhone.trim() && !isValidIndianMobileNumber(addPhone.trim())) {
      errors.phone = INDIAN_MOBILE_ERROR_MESSAGE;
    }

    if (Object.keys(errors).length > 0) {
      setAddErrors(errors);
      return;
    }

    setSubmittingAdd(true);
    try {
      await api.users.create({
        name: addName.trim(),
        email: addEmail.trim().toLowerCase(),
        openId: addOpenId.trim(),
        password: addPassword,
        role: "PARTNER" as any,
        schoolId: null,
      });

      toast.success(`Partner "${addName.trim()}" added successfully!`);
      setAddModalOpen(false);
      // Reset form
      setAddName("");
      setAddEmail("");
      setAddOpenId("");
      setAddPassword("");
      setAddPhone("");
      setAddErrors({});
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to add partner");
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (partner: ApiUser) => {
    setEditingPartner(partner);
    setEditName(partner.name || "");
    setEditEmail(partner.email || "");
    setEditPhone("");
    setEditPassword("");
    setEditErrors({});
    setEditModalOpen(true);
  };

  // Edit Partner submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPartner) return;

    const errors: typeof editErrors = {};
    if (!editName.trim()) errors.name = "Full name is required";
    if (!editEmail.trim()) {
      errors.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail.trim())) {
      errors.email = "Enter a valid email address";
    }

    if (editPassword && editPassword.length < 8) {
      errors.password = "Password must be at least 8 characters";
    }

    if (editPhone.trim() && !isValidIndianMobileNumber(editPhone.trim())) {
      errors.phone = INDIAN_MOBILE_ERROR_MESSAGE;
    }

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    setSubmittingEdit(true);
    try {
      await api.users.update(editingPartner.id, {
        name: editName.trim(),
        email: editEmail.trim().toLowerCase(),
        role: "PARTNER",
        schoolId: null,
        ...(editPassword ? { password: editPassword } : {}),
      });

      toast.success(`Partner "${editName.trim()}" updated successfully!`);
      setEditModalOpen(false);
      setEditingPartner(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update partner");
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Toggle active/inactive status
  const handleToggleStatus = async (partner: ApiUser) => {
    try {
      await api.users.setStatus(partner.id, !partner.isActive);
      toast.success(
        `Partner "${partner.name || partner.email}" marked as ${
          !partner.isActive ? "Active" : "Inactive"
        }`
      );
      setPartners((prev) =>
        prev.map((p) => (p.id === partner.id ? { ...p, isActive: !p.isActive } : p))
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  // Delete partner
  const handleDeletePartner = async (partner: ApiUser) => {
    if (
      !window.confirm(
        `Are you sure you want to delete partner "${partner.name || partner.email}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await api.users.delete(partner.id);
      toast.success(`Partner "${partner.name || partner.email}" deleted successfully`);
      setPartners((prev) => prev.filter((p) => p.id !== partner.id));
    } catch (err: any) {
      toast.error(err.message || "Failed to delete partner");
    }
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-[-0.05em] sm:text-3xl text-foreground">
            Partners
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add and manage authorized partners and representatives.
          </p>
        </div>
        <Button
          onClick={() => {
            setAddName("");
            setAddEmail("");
            setAddOpenId("");
            setAddPassword("");
            setAddPhone("");
            setAddErrors({});
            setAddModalOpen(true);
          }}
          className="h-10 rounded-xl bg-primary text-xs font-bold text-white hover:bg-primary/90 gap-2 shrink-0 cursor-pointer shadow-sm"
        >
          <PlusCircle className="h-4 w-4" /> Add Partner
        </Button>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl border-border bg-card text-card-foreground shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total Partners
            </CardTitle>
            <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{totalPartners}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Registered partner accounts</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card text-card-foreground shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Active Partners
            </CardTitle>
            <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {activePartners}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Can access partner portal</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card text-card-foreground shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Inactive Partners
            </CardTitle>
            <UserX className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{inactivePartners}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Access currently paused</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card text-card-foreground shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Partner Orders
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-teal-600 dark:text-teal-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{totalOrdersPlaced}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Total orders placed by partners</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="rounded-3xl border-border bg-card shadow-[0_12px_35px_rgba(38,71,65,0.05)]">
        {/* Controls Bar */}
        <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, login ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 rounded-xl border-border bg-background pl-9 text-xs shadow-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">Filter:</span>
            {(["ALL", "ACTIVE", "INACTIVE"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === filter
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {filter === "ALL" ? "All Partners" : filter === "ACTIVE" ? "Active" : "Inactive"}
              </button>
            ))}
          </div>
        </div>

        {/* Partners Table */}
        <div className="divide-y divide-border">
          {loading ? (
            <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span>Loading registered partners…</span>
            </div>
          ) : filteredPartners.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mb-3">
                <Handshake className="h-6 w-6" />
              </div>
              <p className="font-semibold text-foreground text-sm">No partners found</p>
              <p className="mt-1">
                {search || statusFilter !== "ALL"
                  ? "No partners match your current filters. Try resetting the search or filter."
                  : "No partners have been registered yet. Click 'Add Partner' to create one."}
              </p>
              {!search && statusFilter === "ALL" && (
                <Button
                  onClick={() => setAddModalOpen(true)}
                  className="mt-4 rounded-xl bg-primary text-primary-foreground font-bold cursor-pointer"
                >
                  <PlusCircle className="h-4 w-4 mr-1.5" /> Add First Partner
                </Button>
              )}
            </div>
          ) : (
            filteredPartners.map((partner) => {
              const partnerOrdersCount = orderCounts[partner.id] || 0;
              const initials = (partner.name || "Partner")
                .split(" ")
                .map((n) => n[0])
                .filter(Boolean)
                .slice(0, 2)
                .join("")
                .toUpperCase();

              return (
                <div
                  key={partner.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 gap-4 hover:bg-muted/30 transition-colors"
                >
                  {/* Partner Identity */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-extrabold text-sm shadow-xs">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-foreground truncate">
                          {partner.name || "Unnamed Partner"}
                        </span>
                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[10px] font-bold">
                          Partner
                        </Badge>
                        {partner.isActive ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" /> Inactive
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                        {partner.openId && (
                          <span className="font-mono text-[11px] bg-muted/70 px-2 py-0.5 rounded-md">
                            ID: <b>{partner.openId}</b>
                          </span>
                        )}
                        {partner.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {partner.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Orders & Quick Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                    {/* Orders badge */}
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => onNavigateToOrders?.(partner.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-muted/60 hover:bg-muted border border-border text-xs font-semibold text-foreground transition-colors cursor-pointer"
                        title="View orders placed by this partner"
                      >
                        <ShoppingCart className="h-3.5 w-3.5 text-primary" />
                        <span>
                          <b>{partnerOrdersCount}</b> {partnerOrdersCount === 1 ? "order" : "orders"}
                        </span>
                      </button>
                    </div>

                    {/* Active toggle */}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={partner.isActive}
                        onCheckedChange={() => handleToggleStatus(partner)}
                        aria-label={`Toggle status for ${partner.name}`}
                      />
                    </div>

                    {/* Actions dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-xl hover:bg-muted cursor-pointer"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44 rounded-xl">
                        <DropdownMenuItem
                          onClick={() => openEditModal(partner)}
                          className="cursor-pointer font-medium text-xs gap-2"
                        >
                          <Edit className="h-3.5 w-3.5 text-muted-foreground" /> Edit Partner
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onNavigateToOrders?.(partner.id)}
                          className="cursor-pointer font-medium text-xs gap-2"
                        >
                          <ShoppingCart className="h-3.5 w-3.5 text-primary" /> View Orders
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeletePartner(partner)}
                          className="cursor-pointer font-medium text-xs gap-2 text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete Partner
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Add Partner Dialog */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border rounded-3xl">
          <form onSubmit={handleAddSubmit}>
            <DialogHeader>
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Handshake className="h-6 w-6" />
              </div>
              <DialogTitle className="text-center text-lg font-black text-foreground">
                Add New Partner
              </DialogTitle>
              <DialogDescription className="text-center text-xs text-muted-foreground">
                Create a partner account. They will use these credentials to log in to the Partner portal.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Full Name */}
              <div>
                <label className="text-xs font-bold text-foreground">
                  Partner / Representative Name <span className="text-red-500">*</span>
                </label>
                <Input
                  className="mt-1 h-10 rounded-xl"
                  placeholder="e.g., Rajesh Kumar"
                  value={addName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  autoComplete="off"
                  autoFocus
                />
                {addErrors.name && (
                  <p className="mt-1 text-xs font-medium text-red-600">{addErrors.name}</p>
                )}
              </div>

              {/* Email Address */}
              <div>
                <label className="text-xs font-bold text-foreground">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  className="mt-1 h-10 rounded-xl"
                  placeholder="e.g., rajesh@partneragency.com"
                  value={addEmail}
                  onChange={(e) => {
                    setAddEmail(e.target.value);
                    setAddErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  autoComplete="off"
                />
                {addErrors.email && (
                  <p className="mt-1 text-xs font-medium text-red-600">{addErrors.email}</p>
                )}
              </div>

              {/* Login ID / Username */}
              <div>
                <label className="text-xs font-bold text-foreground">
                  Login ID / Username <span className="text-red-500">*</span>
                </label>
                <Input
                  className="mt-1 h-10 rounded-xl font-mono text-xs"
                  placeholder="e.g., partner_rajesh"
                  value={addOpenId}
                  onChange={(e) => {
                    setAddOpenId(e.target.value);
                    setAddErrors((prev) => ({ ...prev, openId: undefined }));
                  }}
                  autoComplete="off"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Used by the partner to log into the Partner portal.
                </p>
                {addErrors.openId && (
                  <p className="mt-1 text-xs font-medium text-red-600">{addErrors.openId}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="text-xs font-bold text-foreground">
                  Temporary Password <span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1">
                  <Input
                    type={showAddPassword ? "text" : "password"}
                    className="h-10 rounded-xl pr-10"
                    placeholder="Min 8 characters"
                    value={addPassword}
                    onChange={(e) => {
                      setAddPassword(e.target.value);
                      setAddErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {showAddPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {addErrors.password && (
                  <p className="mt-1 text-xs font-medium text-red-600">{addErrors.password}</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="text-xs font-bold text-foreground">
                  Contact Phone (Optional)
                </label>
                <Input
                  className="mt-1 h-10 rounded-xl"
                  placeholder={INDIAN_MOBILE_PLACEHOLDER}
                  value={addPhone}
                  onChange={(e) => {
                    setAddPhone(e.target.value);
                    setAddErrors((prev) => ({ ...prev, phone: undefined }));
                  }}
                  autoComplete="off"
                />
                {addErrors.phone && (
                  <p className="mt-1 text-xs font-medium text-red-600">{addErrors.phone}</p>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddModalOpen(false)}
                className="rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submittingAdd}
                className="rounded-xl bg-primary font-bold text-primary-foreground cursor-pointer"
              >
                {submittingAdd ? "Adding Partner…" : "Add Partner"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Partner Dialog */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border rounded-3xl">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-foreground">
                Edit Partner: {editingPartner?.name || editingPartner?.email}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Update partner information or reset password.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <label className="text-xs font-bold text-foreground">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <Input
                  className="mt-1 h-10 rounded-xl"
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    setEditErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                />
                {editErrors.name && (
                  <p className="mt-1 text-xs font-medium text-red-600">{editErrors.name}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-foreground">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  className="mt-1 h-10 rounded-xl"
                  value={editEmail}
                  onChange={(e) => {
                    setEditEmail(e.target.value);
                    setEditErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                />
                {editErrors.email && (
                  <p className="mt-1 text-xs font-medium text-red-600">{editErrors.email}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-foreground">
                  Reset Password (leave blank to keep current)
                </label>
                <div className="relative mt-1">
                  <Input
                    type={showEditPassword ? "text" : "password"}
                    className="h-10 rounded-xl pr-10"
                    placeholder="Leave empty to keep unchanged"
                    value={editPassword}
                    onChange={(e) => {
                      setEditPassword(e.target.value);
                      setEditErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {editErrors.password && (
                  <p className="mt-1 text-xs font-medium text-red-600">{editErrors.password}</p>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditModalOpen(false)}
                className="rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submittingEdit}
                className="rounded-xl bg-primary font-bold text-primary-foreground cursor-pointer"
              >
                {submittingEdit ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
