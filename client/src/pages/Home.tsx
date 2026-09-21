import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import CardRenderer from "@/components/CardRenderer";
import IdCardFormModal from "./IdCardFormModal";
import PrintModal from "@/components/PrintModal";
import ApprovalTimeline from "@/components/ApprovalTimeline";
import { SAMPLE_CARD_DATA, type DesignerElement } from "@shared/templateDesigner";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Copy,
  Download,
  Eye,
  FileCheck2,
  FileEdit,
  FilePlus2,
  Filter,
  Grid2X2,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MoreHorizontal,
  Palette,
  Printer,
  QrCode,
  RotateCcw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  api,
  type ApiActivity,
  type ApiSchool,
  type ApiTemplate,
  type ApiUser,
  type ApiIdCard,
  type ApiIdCardDetail,
  type ApiNotification,
  type ApiApproval,
  type ApiAuthUser,
} from "@/lib/api";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";

const navItems = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Schools", icon: Building2 },
  { label: "ID card templates", icon: Palette },
  { label: "ID card requests", icon: ClipboardCheck },
  { label: "Approved cards", icon: FileCheck2 },
  { label: "Reports", icon: Grid2X2 },
  { label: "Users", icon: Users },
  { label: "Notifications", icon: Bell },
  { label: "Audit logs", icon: BookOpenCheck },
];

/** Cycles through the four accent tones so rows stay visually distinct. */
const rowTones: Tone[] = ["teal", "coral", "indigo", "yellow"];

function initialsFor(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

type NavLabel =
  | "Overview"
  | "Schools"
  | "ID card templates"
  | "ID card requests"
  | "Approved cards"
  | "Reports"
  | "Users"
  | "Notifications"
  | "Audit logs";

type Tone = "teal" | "coral" | "indigo" | "yellow";

const toneStyles: Record<Tone, { bg: string; fg: string; border: string }> = {
  teal: { bg: "bg-[#dff3ee]", fg: "text-[#0b716b]", border: "border-[#b7e3d9]" },
  coral: { bg: "bg-[#fff0e8]", fg: "text-[#c65c3d]", border: "border-[#f6cdbb]" },
  indigo: { bg: "bg-[#e9ebfa]", fg: "text-[#5c64b7]", border: "border-[#cbd0f2]" },
  yellow: { bg: "bg-[#fff8d9]", fg: "text-[#9d7611]", border: "border-[#f1dda0]" },
};

function ToneIcon({
  icon: Icon,
  tone,
  size = "h-4 w-4",
}: {
  icon: typeof Bell;
  tone: Tone;
  size?: string;
}) {
  const style = toneStyles[tone];
  return (
    <span
      className={`inline-flex items-center justify-center rounded-lg ${style.bg} ${style.fg} ${size === "h-4 w-4" ? "h-8 w-8" : "h-10 w-10"
        }`}
    >
      <Icon className={size} strokeWidth={1.8} />
    </span>
  );
}

function CardPreview({
  accent = "teal",
  mini = false,
}: {
  accent?: Tone;
  mini?: boolean;
}) {
  const palette = {
    teal: "#2aa89d",
    coral: "#e78362",
    indigo: "#6d75ce",
    yellow: "#d7b545",
  }[accent];
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-white/50 shadow-[0_8px_25px_rgba(22,47,44,0.18)] ${mini ? "h-[94px] w-[150px]" : "h-[164px] w-[244px]"
        }`}
      style={{
        background: `linear-gradient(135deg, ${palette} 0%, #154847 66%, #123536 100%)`,
      }}
    >
      <div className="absolute -right-12 -top-10 h-28 w-28 rounded-full border-[16px] border-white/10" />
      <div className="absolute bottom-[-38px] left-[-15px] h-28 w-28 rounded-full border-[15px] border-white/10" />
      <div className="relative flex h-full flex-col justify-between p-3 text-white">
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-[9px] font-extrabold"
            style={{ color: palette }}
          >
            LP
          </span>
          <div className="leading-[1.05]">
            <div className="text-[8px] font-extrabold uppercase tracking-[0.16em]">
              School
            </div>
            <div className="text-[6px] font-medium uppercase tracking-[0.12em] text-white/70">
              ID Card
            </div>
          </div>
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="flex items-end gap-2">
            <div
              className={`${mini ? "h-9 w-8" : "h-14 w-12"
                } rounded-md border border-white/40 bg-white/25`}
            />
            <div>
              <div className="text-[12px] font-extrabold">Student Name</div>
              <div className="mt-1 text-[7px] uppercase tracking-[0.12em] text-white/65">
                Student record
              </div>
              <div className="mt-1 font-mono text-[7px] text-white/75">
                CARD NUMBER
              </div>
            </div>
          </div>
          <QrCode
            className={mini ? "h-6 w-6 text-white/80" : "h-9 w-9 text-white/80"}
            strokeWidth={1.5}
          />
        </div>
      </div>
    </div>
  );
}

function StatusPill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: Tone;
}) {
  const style = toneStyles[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${style.bg} ${style.fg} ${style.border}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export default function Home({
  authenticatedUser,
  portal,
  initialNav = "Overview",
}: {
  authenticatedUser: ApiAuthUser;
  portal: "admin" | "school";
  initialNav?: string;
}) {
  const [activeNav, setActiveNav] = useState<NavLabel>(
    (initialNav as NavLabel) || "Overview",
  );
  const visibleNavItems =
    portal === "admin"
      ? navItems
      : navItems.filter(({ label }) =>
        [
          "Overview",
          "ID card templates",
          "ID card requests",
          "Notifications",
        ].includes(label),
      );
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filter, setFilter] = useState<"All" | "Pending" | "Changes required">(
    "All",
  );
  const [schools, setSchools] = useState<ApiSchool[]>([]);
  const [templates, setTemplates] = useState<ApiTemplate[]>([]);
  const [activity, setActivity] = useState<ApiActivity[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [idCards, setIdCards] = useState<ApiIdCard[]>([]);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [approvals, setApprovals] = useState<ApiApproval[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(true);
  const [approveLoading, setApproveLoading] = useState(false);

  // Super Admin explicit school selection
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(
    authenticatedUser.schoolId,
  );

  // School Credentials Display Modal state
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);
  const [credentialsData, setCredentialsData] = useState<{
    schoolName: string;
    loginId: string;
    password?: string;
  } | null>(null);

  // Modal dialog states replacing browser prompts
  const [schoolModalOpen, setSchoolModalOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<ApiSchool | null>(null);
  const [schoolNameInput, setSchoolNameInput] = useState("");
  const [schoolCodeInput, setSchoolCodeInput] = useState("");
  const [schoolEmailInput, setSchoolEmailInput] = useState("");
  const [schoolPhoneInput, setSchoolPhoneInput] = useState("");
  const [schoolAddressInput, setSchoolAddressInput] = useState("");

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState("");

  // User modal
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userNameInput, setUserNameInput] = useState("");
  const [userEmailInput, setUserEmailInput] = useState("");
  const [userPasswordInput, setUserPasswordInput] = useState("");
  const [userRoleInput, setUserRoleInput] = useState<"SCHOOL_ADMIN" | "SCHOOL_OPERATOR" | "VIEWER">("SCHOOL_OPERATOR");
  const [userSchoolIdInput, setUserSchoolIdInput] = useState<number | null>(null);

  // ID Card form & editing
  const [idCardFormOpen, setIdCardFormOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<ApiIdCardDetail | null>(null);

  // Print modal
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [cardsToPrint, setCardsToPrint] = useState<ApiIdCardDetail[]>([]);

  // Admin review & card details
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewingCard, setReviewingCard] = useState<ApiIdCardDetail | null>(null);
  const [reviewSide, setReviewSide] = useState<"FRONT" | "BACK">("FRONT");
  const [requestChangesOpen, setRequestChangesOpen] = useState(false);
  const [requestChangesComment, setRequestChangesComment] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Approved cards multi-selection
  const [selectedApprovedCardIds, setSelectedApprovedCardIds] = useState<number[]>([]);

  // Preview & template preview
  const [previewModalTemplate, setPreviewModalTemplate] = useState<ApiTemplate | null>(null);
  const [previewModalSide, setPreviewModalSide] = useState<"FRONT" | "BACK">("FRONT");

  const reloadWorkspace = async () => {
    try {
      const [nextCards, nextApprovals, nextNotifications, nextActivity] = await Promise.all([
        api.idCards.list(),
        api.approvals.list().catch(() => []),
        api.notifications.list().catch(() => []),
        api.auditLogs.list().catch(() => []),
      ]);
      setIdCards(nextCards);
      setApprovals(nextApprovals);
      setNotifications(nextNotifications);
      setActivity(nextActivity);
    } catch (err) {
      console.error("Failed to reload workspace", err);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [
          nextSchools,
          nextTemplates,
          nextActivity,
          nextUsers,
          nextCards,
          nextNotifications,
          nextApprovals,
        ] = await Promise.all([
          api.schools.list(),
          api.templates.list(),
          api.auditLogs.list().catch(() => []),
          api.users.list().catch(() => []),
          api.idCards.list().catch(() => []),
          api.notifications.list().catch(() => []),
          api.approvals.list().catch(() => []),
        ]);
        setSchools(nextSchools);
        setTemplates(nextTemplates);
        setActivity(nextActivity);
        setUsers(nextUsers);
        setIdCards(nextCards);
        setNotifications(nextNotifications);
        setApprovals(nextApprovals);

        if (authenticatedUser.role === "SUPER_ADMIN") {
          setSelectedSchoolId((prev) => prev ?? nextSchools[0]?.id ?? null);
        } else {
          setSelectedSchoolId(authenticatedUser.schoolId);
        }
      } catch (error) {
        setApiError(
          error instanceof Error ? error.message : "Unable to load workspace data",
        );
      } finally {
        setApprovalsLoading(false);
      }
    };
    void load();
  }, [authenticatedUser.role, authenticatedUser.schoolId]);

  // Current effective school for operations:
  // Non-super-admins ALWAYS use their authenticated schoolId.
  // Super Admin uses the selected school.
  const activeSchoolId =
    authenticatedUser.role === "SUPER_ADMIN"
      ? selectedSchoolId
      : authenticatedUser.schoolId;

  const currentActiveSchool = schools.find((s) => s.id === activeSchoolId);

  const pendingRequests = useMemo(
    () => approvals.filter((item) => item.status !== "APPROVED"),
    [approvals],
  );

  const filteredApprovals = useMemo(
    () =>
      pendingRequests
        .filter(
          (item) =>
            filter === "All" ||
            (filter === "Pending"
              ? item.status === "SUBMITTED"
              : item.status === "CHANGES_REQUIRED"),
        )
        .filter(
          (item) =>
            item.studentName.toLowerCase().includes(query.toLowerCase()) ||
            item.schoolName.toLowerCase().includes(query.toLowerCase()),
        )
        .map((item, index) => ({
          ...item,
          initials: initialsFor(item.studentName),
          tone: rowTones[index % rowTones.length],
          submitted: item.submittedAt
            ? formatDistanceToNow(new Date(item.submittedAt), { addSuffix: true })
            : "Not submitted",
        })),
    [pendingRequests, query, filter],
  );

  const approve = async (id: number, name: string) => {
    setApproveLoading(true);
    try {
      await api.approvals.approve(id);
      setApprovals((items) =>
        items.map((item) => (item.id === id ? { ...item, status: "APPROVED" } : item)),
      );
      toast.success(`${name}'s card approved`, {
        description: "The school has been notified and the card is ready to print.",
      });
    } catch (error) {
      toast.error("Couldn't approve that card", {
        description: error instanceof Error ? error.message : "Request failed",
      });
    } finally {
      setApproveLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.auth.logout();
      window.location.href =
        authenticatedUser.role === "SUPER_ADMIN"
          ? "/admin/login"
          : "/school/login";
    } catch (error) {
      toast.error("Could not sign out", {
        description: error instanceof Error ? error.message : "Request failed",
      });
    }
  };

  const openCreateSchool = () => {
    if (authenticatedUser.role !== "SUPER_ADMIN") {
      return toast.error("Only Super Admins can manage schools");
    }
    setEditingSchool(null);
    setSchoolNameInput("");
    setSchoolCodeInput("");
    setSchoolEmailInput("");
    setSchoolPhoneInput("");
    setSchoolAddressInput("");
    setSchoolModalOpen(true);
  };

  const handleEditSchool = (school: ApiSchool) => {
    if (authenticatedUser.role !== "SUPER_ADMIN") {
      return toast.error("Only Super Admins can manage schools");
    }
    setEditingSchool(school);
    setSchoolNameInput(school.name);
    setSchoolCodeInput(school.shortCode);
    setSchoolEmailInput(school.email ?? "");
    setSchoolPhoneInput(school.phone ?? "");
    setSchoolAddressInput(school.address ?? "");
    setSchoolModalOpen(true);
  };

  const handleDeleteSchool = async (schoolId: number, schoolName: string) => {
    if (authenticatedUser.role !== "SUPER_ADMIN") {
      return toast.error("Only Super Admins can delete schools");
    }
    if (!window.confirm(`Are you sure you want to delete "${schoolName}"? All associated data and templates will be affected.`)) {
      return;
    }
    // 1. Optimistically remove from state immediately
    setSchools((prev) => prev.filter((s) => s.id !== schoolId));
    if (selectedSchoolId === schoolId) {
      const remaining = schools.filter((s) => s.id !== schoolId);
      setSelectedSchoolId(remaining[0]?.id ?? null);
    }

    try {
      await api.schools.delete(schoolId);
      toast.success(`School "${schoolName}" deleted successfully`);
      // 2. Fetch fresh list from server in background to ensure total sync
      const freshSchools = await api.schools.list();
      setSchools(freshSchools);
      if (selectedSchoolId === schoolId) {
        setSelectedSchoolId(freshSchools[0]?.id ?? null);
      }
    } catch (error) {
      // Revert if delete failed
      const freshSchools = await api.schools.list().catch(() => []);
      if (freshSchools.length > 0) setSchools(freshSchools);
      toast.error("Could not delete school", {
        description: error instanceof Error ? error.message : "Request failed",
      });
    }
  };

  const handleCreateSchoolSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolNameInput.trim() || !schoolCodeInput.trim()) {
      return toast.error("School name and short code are required");
    }
    try {
      if (editingSchool) {
        const updated = await api.schools.update(editingSchool.id, {
          name: schoolNameInput.trim(),
          shortCode: schoolCodeInput.trim().toUpperCase(),
          email: schoolEmailInput.trim() || null,
          phone: schoolPhoneInput.trim() || null,
          address: schoolAddressInput.trim() || null,
        });
        setSchools((items) => items.map((s) => (s.id === updated.id ? updated : s)));
        setSchoolModalOpen(false);
        setEditingSchool(null);
        toast.success(`School "${updated.name}" updated successfully`);
      } else {
        const created = await api.schools.create({
          name: schoolNameInput.trim(),
          shortCode: schoolCodeInput.trim().toUpperCase(),
          email: schoolEmailInput.trim() || undefined,
          phone: schoolPhoneInput.trim() || undefined,
          address: schoolAddressInput.trim() || undefined,
        });
        setSchools((items) => [created, ...items]);
        setSelectedSchoolId(created.id);
        setSchoolModalOpen(false);
        toast.success(`School "${created.name}" created successfully`);
        if (created.credentials) {
          setCredentialsData({
            schoolName: created.name,
            loginId: created.credentials.loginId,
            password: created.credentials.password,
          });
          setCredentialsModalOpen(true);
        }
      }
    } catch (error) {
      toast.error(editingSchool ? "Could not update school" : "Could not create school", {
        description: error instanceof Error ? error.message : "Request failed",
      });
    }
  };

  const handleGenerateCredentials = async (school: ApiSchool) => {
    if (authenticatedUser.role !== "SUPER_ADMIN") {
      return toast.error("Only Super Admins can manage school credentials");
    }
    try {
      const creds = await api.schools.generateCredentials(school.id);
      setCredentialsData({
        schoolName: school.name,
        loginId: creds.credentials.loginId,
        password: creds.credentials.password,
      });
      setCredentialsModalOpen(true);
      toast.success(`Credentials generated for ${school.name}`);
    } catch (err) {
      toast.error("Failed to generate credentials", {
        description: err instanceof Error ? err.message : "Request failed",
      });
    }
  };

  const openCreateTemplate = () => {
    if (authenticatedUser.role !== "SUPER_ADMIN") {
      return toast.error("Only Super Admins can manage templates");
    }
    setTemplateNameInput("");
    setTemplateModalOpen(true);
  };

  const handleCreateTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateNameInput.trim()) {
      return toast.error("Template name is required");
    }
    try {
      const created = await api.templates.create({
        name: templateNameInput.trim(),
        status: "DRAFT",
        accent: "teal",
      });
      setTemplates((items) => [created, ...items]);
      setTemplateModalOpen(false);
      toast.success("Template created");
    } catch (error) {
      toast.error("Could not create template", {
        description: error instanceof Error ? error.message : "Request failed",
      });
    }
  };

  const openCreateUser = () => {
    if (authenticatedUser.role === "VIEWER") {
      return toast.error("Viewer accounts cannot create users");
    }
    setUserNameInput("");
    setUserEmailInput("");
    setUserPasswordInput("");
    setUserRoleInput("SCHOOL_OPERATOR");
    setUserSchoolIdInput(activeSchoolId ?? schools[0]?.id ?? null);
    setUserModalOpen(true);
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userNameInput.trim() || !userEmailInput.trim()) {
      return toast.error("Name and email are required");
    }
    if (userPasswordInput.length < 8) {
      return toast.error("Password must be at least 8 characters");
    }
    const targetSchoolId = authenticatedUser.role === "SUPER_ADMIN" ? userSchoolIdInput : activeSchoolId;
    if (!targetSchoolId) {
      return toast.error("Please select a school for this user");
    }
    try {
      const created = await api.users.create({
        name: userNameInput.trim(),
        email: userEmailInput.trim().toLowerCase(),
        password: userPasswordInput,
        role: userRoleInput,
        schoolId: targetSchoolId,
      });
      setUsers((prev) => [created, ...prev]);
      setUserModalOpen(false);
      toast.success(`User ${created.name || created.email} created successfully`);
    } catch (error) {
      toast.error("Could not create user", {
        description: error instanceof Error ? error.message : "Request failed",
      });
    }
  };

  const openCreateCard = () => {
    if (authenticatedUser.role === "VIEWER") {
      return toast.error("Viewer accounts are read-only");
    }
    const schoolToUse = activeSchoolId ?? schools[0]?.id;
    if (!schoolToUse) {
      return toast.error("Please create or select a school first before creating ID cards");
    }
    setEditingCard(null);
    setIdCardFormOpen(true);
  };

  const handleEditCard = async (cardId: number) => {
    try {
      const detail = await api.idCards.get(cardId);
      setEditingCard(detail);
      setIdCardFormOpen(true);
    } catch (e) {
      toast.error("Could not load card details");
    }
  };

  const handleDeleteCard = async (cardId: number, num: string) => {
    if (!confirm(`Are you sure you want to delete draft card ${num}?`)) return;
    try {
      await api.idCards.delete(cardId);
      toast.success(`Draft card ${num} deleted`);
      reloadWorkspace();
    } catch (e) {
      toast.error("Could not delete card", {
        description: e instanceof Error ? e.message : "Request failed",
      });
    }
  };

  const handleSubmitCard = async (cardId: number, num: string) => {
    try {
      await api.idCards.submit(cardId);
      toast.success(`Card #${num} submitted for approval!`);
      reloadWorkspace();
    } catch (e) {
      toast.error("Could not submit card", {
        description: e instanceof Error ? e.message : "Request failed",
      });
    }
  };

  const handleOpenReview = async (cardId: number) => {
    try {
      const detail = await api.idCards.get(cardId);
      setReviewingCard(detail);
      setReviewSide("FRONT");
      setReviewModalOpen(true);
    } catch (e) {
      toast.error("Could not load card details for review");
    }
  };

  const handleAdminApprove = async () => {
    if (!reviewingCard) return;
    setActionLoading(true);
    try {
      await api.approvals.approve(reviewingCard.id);
      toast.success(`Card #${reviewingCard.cardNumber} approved!`);
      setReviewModalOpen(false);
      reloadWorkspace();
    } catch (e) {
      toast.error("Approval failed", {
        description: e instanceof Error ? e.message : "Request failed",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdminRequestChanges = async () => {
    if (!reviewingCard || !requestChangesComment.trim()) {
      return toast.error("Comment is required when requesting changes");
    }
    setActionLoading(true);
    try {
      await api.approvals.requestChanges(reviewingCard.id, requestChangesComment.trim());
      toast.success(`Changes requested for card #${reviewingCard.cardNumber}`);
      setRequestChangesOpen(false);
      setReviewModalOpen(false);
      setRequestChangesComment("");
      reloadWorkspace();
    } catch (e) {
      toast.error("Action failed", {
        description: e instanceof Error ? e.message : "Request failed",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdminReject = async () => {
    if (!reviewingCard || !rejectReason.trim()) {
      return toast.error("Reason is required when rejecting card");
    }
    setActionLoading(true);
    try {
      await api.approvals.reject(reviewingCard.id, rejectReason.trim());
      toast.success(`Card #${reviewingCard.cardNumber} rejected`);
      setRejectOpen(false);
      setReviewModalOpen(false);
      setRejectReason("");
      reloadWorkspace();
    } catch (e) {
      toast.error("Rejection failed", {
        description: e instanceof Error ? e.message : "Request failed",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrintCard = async (cardId: number) => {
    try {
      const detail = await api.idCards.get(cardId);
      setCardsToPrint([detail]);
      setPrintModalOpen(true);
    } catch (e) {
      toast.error("Could not load card for printing");
    }
  };

  const handleBulkPrint = async () => {
    if (selectedApprovedCardIds.length === 0) {
      return toast.error("Please select at least one card to print");
    }
    try {
      const details = await Promise.all(
        selectedApprovedCardIds.map((id) => api.idCards.get(id)),
      );
      setCardsToPrint(details);
      setPrintModalOpen(true);
    } catch (e) {
      toast.error("Could not prepare cards for bulk print");
    }
  };

  const handleBulkDownloadPdf = async () => {
    if (selectedApprovedCardIds.length === 0) {
      return toast.error("Please select at least one card to download");
    }
    try {
      const blob = await api.idCards.bulkPdf(selectedApprovedCardIds);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `approved_cards_${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Bulk PDF downloaded successfully");
    } catch (e) {
      toast.error("Failed to download bulk PDF", {
        description: e instanceof Error ? e.message : "Request failed",
      });
    }
  };

  const handleToggleSelectApproved = (cardId: number) => {
    setSelectedApprovedCardIds((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId],
    );
  };

  const handleSelectAllApproved = (allIds: number[]) => {
    setSelectedApprovedCardIds((prev) =>
      prev.length === allIds.length ? [] : [...allIds],
    );
  };

  const handleMarkNotificationRead = async (notifId: number) => {
    try {
      await api.notifications.markRead(notifId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n)),
      );
    } catch { }
  };

  const handleSelectTemplate = async (template: ApiTemplate) => {
    if (authenticatedUser.role === "VIEWER") {
      return toast.error("Viewer accounts are read-only");
    }
    if (template.status !== "ACTIVE" && authenticatedUser.role !== "SUPER_ADMIN") {
      return toast.error("Only ACTIVE templates can be selected");
    }
    const schoolId = activeSchoolId;
    if (!schoolId) {
      return toast.error("Select or create a school first");
    }
    try {
      await api.schoolTemplates.select(schoolId, template.id);
      toast.success(`${template.name} selected as final template for ${currentActiveSchool?.name ?? `School #${schoolId}`}`);
      const freshSchools = await api.schools.list();
      setSchools(freshSchools);
    } catch (error) {
      toast.error("Could not select template", {
        description: error instanceof Error ? error.message : "Request failed",
      });
    }
  };

  const handlePreviewTemplate = async (template: ApiTemplate) => {
    try {
      const full = await api.templates.get(template.id);
      setPreviewModalTemplate(full);
    } catch {
      setPreviewModalTemplate(template);
    }
    setPreviewModalSide("FRONT");
  };

  const handleToggleTemplateStatus = async (template: ApiTemplate) => {
    const nextStatus = template.status === "ACTIVE" ? "DRAFT" : "ACTIVE";
    try {
      await api.templates.setStatus(template.id, nextStatus);
      setTemplates((items) =>
        items.map((t) => (t.id === template.id ? { ...t, status: nextStatus } : t)),
      );
      toast.success(`Template marked as ${nextStatus}`);
    } catch (err) {
      toast.error("Failed to update status", {
        description: err instanceof Error ? err.message : "Request failed",
      });
    }
  };

  const handleDeleteTemplate = async (templateId: number, templateName: string) => {
    if (authenticatedUser.role !== "SUPER_ADMIN") {
      return toast.error("Only Super Admins can delete templates");
    }
    if (!window.confirm(`Are you sure you want to delete template "${templateName}"? All associated template designs and cards will be deleted.`)) {
      return;
    }
    // Optimistically remove from state immediately
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    try {
      await api.templates.delete(templateId);
      toast.success(`Template "${templateName}" deleted successfully`);
      const freshTemplates = await api.templates.list();
      setTemplates(freshTemplates);
    } catch (error) {
      const freshTemplates = await api.templates.list().catch(() => []);
      if (freshTemplates.length > 0) setTemplates(freshTemplates);
      toast.error("Could not delete template", {
        description: error instanceof Error ? error.message : "Request failed",
      });
    }
  };

  const handleLockTemplate = async (template: ApiTemplate) => {
    if (authenticatedUser.role === "VIEWER") {
      return toast.error("Viewer accounts are read-only");
    }
    const schoolId = activeSchoolId;
    if (!schoolId) {
      return toast.error("Select or create a school first");
    }
    try {
      await api.schoolTemplates.lock(schoolId, template.id);
      toast.success(`Template locked for ${currentActiveSchool?.name ?? `School #${schoolId}`}`);
    } catch (error) {
      toast.error("Could not lock template", {
        description: error instanceof Error ? error.message : "Request failed",
      });
    }
  };

  const createForLabel = (label: NavLabel) =>
    label === "Schools"
      ? void openCreateSchool()
      : label === "ID card templates"
        ? void openCreateTemplate()
        : label === "ID card requests" || label === "Approved cards"
          ? void openCreateCard()
          : label === "Users"
            ? void openCreateUser()
            : toast("This module is read-only here");

  const goTo = (label: NavLabel) => {
    setActiveNav(label);
    setSidebarOpen(false);
    if (label !== "Overview")
      toast(`${label} module opened`, {
        description: "This workspace is connected to MySQL.",
      });
  };

  return (
    <div className="min-h-screen app-shell bg-[#f7f6f2] text-[#182326]">
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[244px] flex-col bg-[#102728] text-[#dfecea] transition-transform duration-200 lg:translate-x-0 overflow-y-auto overflow-x-hidden [scrollbar-width:thin] [scrollbar-color:#294344_transparent] ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="flex h-[76px] shrink-0 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[#40c8bb] text-[#092a2b]">
              <ShieldCheck className="h-5 w-5" strokeWidth={2.4} />
              <span className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-[#102728] bg-[#f2c94c]" />
            </div>
            <div>
              <div className="font-extrabold tracking-[-0.05em] text-white">
                atlas<span className="text-[#40c8bb]">id</span>
              </div>
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#7fa09c]">
                {portal === "admin" ? "admin console" : "school portal"}
              </div>
            </div>
          </div>
          <button
            className="text-[#86a7a3] lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mx-5 mb-6 shrink-0 rounded-2xl border border-[#294344] bg-[#173534] p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f5c87b] text-sm font-extrabold text-[#5c4523]">
              {authenticatedUser.role === "SUPER_ADMIN" ? "SA" : "SC"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-bold text-white">
                {authenticatedUser.name ??
                  authenticatedUser.email ??
                  "Authenticated user"}
              </div>
              <div className="mt-0.5 text-[10px] text-[#8bb2ac]">
                {authenticatedUser.role} ·{" "}
                {authenticatedUser.role === "SUPER_ADMIN"
                  ? currentActiveSchool
                    ? currentActiveSchool.name
                    : "All schools"
                  : authenticatedUser.schoolName ??
                  `School #${authenticatedUser.schoolId}`}
                <div className="mt-0.5 text-[9px] text-[#6f9892]">
                  {authenticatedUser.role === "VIEWER"
                    ? "Read only"
                    : authenticatedUser.role === "SCHOOL_OPERATOR"
                      ? "Cards and submissions"
                      : authenticatedUser.role === "SUPER_ADMIN"
                        ? "Super Administrator"
                        : "Full school permissions"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 shrink-0">
          <div className="mb-3 px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#6e928d]">
            workspace
          </div>
          <nav className="space-y-1">
            {visibleNavItems.map(({ label, icon: Icon }) => {
              const active = activeNav === label;
              const displayLabel =
                authenticatedUser.role !== "SUPER_ADMIN"
                  ? label === "ID card templates"
                    ? "Templates"
                    : label === "ID card requests"
                      ? "My ID Cards"
                      : label
                  : label;
              return (
                <button
                  key={label}
                  onClick={() => goTo(label as NavLabel)}
                  className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[12px] font-semibold transition-colors ${active
                      ? "bg-[#dff3ee] text-[#123b3b]"
                      : "text-[#99b6b2] hover:bg-[#1b3a3a] hover:text-white"
                    }`}
                >
                  <Icon
                    className={`h-[17px] w-[17px] ${active ? "text-[#0f7f79]" : "text-[#779b96]"
                      }`}
                    strokeWidth={active ? 2.3 : 1.8}
                  />
                  <span className="flex-1">{displayLabel}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto shrink-0 px-5 pt-6">
          <div className="mb-4 border-t border-[#294344]" />
          <nav className="space-y-1 pb-5">
            <button
              onClick={() => toast("Settings opened")}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[12px] font-semibold text-[#99b6b2] hover:bg-[#1b3a3a] hover:text-white"
            >
              <Settings2 className="h-[17px] w-[17px] text-[#779b96]" />
              Settings
            </button>
            {authenticatedUser.role === "SUPER_ADMIN" && (
              <button
                onClick={() => toast("Audit logs opened")}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[12px] font-semibold text-[#99b6b2] hover:bg-[#1b3a3a] hover:text-white"
              >
                <BookOpenCheck className="h-[17px] w-[17px] text-[#779b96]" />
                Audit logs
              </button>
            )}
            <button
              onClick={() => void logout()}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[12px] font-semibold text-[#f87171] hover:bg-[#341b1b] hover:text-[#fca5a5]"
            >
              <LogOut className="h-[17px] w-[17px]" />
              Sign out
            </button>
          </nav>
          <div className="flex items-center justify-between border-t border-[#294344] py-4">
            <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#6e928d]">
              Atlas ID v1.0
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-[#71c4a8]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#71c4a8]" />
              Live
            </span>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          className="fixed inset-0 z-40 bg-[#102728]/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
        />
      )}

      <main className="min-h-screen lg:pl-[244px]">
        <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-[#e4e8e4] bg-[#f7f6f2]/90 px-5 backdrop-blur-xl sm:px-8 lg:px-11">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-[#6d7c7b] hover:bg-white lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#82908e]">
                Tuesday · 15 September 2026
              </div>
              <h1 className="mt-1 text-[22px] font-extrabold tracking-[-0.05em]">
                {activeNav === "Overview"
                  ? `Good morning, ${authenticatedUser.name?.split(" ")[0] ?? "there"}`
                  : activeNav}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Super Admin School Dropdown Selector */}
            {authenticatedUser.role === "SUPER_ADMIN" && schools.length > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-[#e0e6e1] bg-white px-3 py-1.5 shadow-sm">
                <Building2 className="h-3.5 w-3.5 text-[#0f7f79]" />
                <span className="text-[11px] font-bold text-[#778381]">School:</span>
                <Select
                  value={selectedSchoolId ? String(selectedSchoolId) : ""}
                  onValueChange={(val) => {
                    const id = Number(val);
                    setSelectedSchoolId(id);
                    const sch = schools.find((s) => s.id === id);
                    toast.success(`Active school set to ${sch?.name ?? `School #${id}`}`);
                  }}
                >
                  <SelectTrigger className="h-7 border-0 bg-transparent px-2 text-xs font-extrabold text-[#1f3733] shadow-none focus-visible:ring-0">
                    <SelectValue placeholder="Select active school" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name} ({s.shortCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* School Users Indicator */}
            {authenticatedUser.role !== "SUPER_ADMIN" && (
              <div className="hidden items-center gap-2 rounded-xl border border-[#d6e4dc] bg-[#eef7f3] px-3 py-1.5 text-xs font-extrabold text-[#0f7f79] sm:flex">
                <Building2 className="h-3.5 w-3.5" />
                <span>
                  {authenticatedUser.schoolName ??
                    `School #${authenticatedUser.schoolId}`}
                </span>
              </div>
            )}

            <div className="relative hidden w-[200px] xl:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a4a1]" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search anything..."
                className="h-10 rounded-xl border-[#e0e6e1] bg-white pl-9 text-xs shadow-none placeholder:text-[#a1aaa8] focus-visible:ring-[#71c4a8]"
              />
            </div>

            <button
              onClick={() =>
                toast("No new notifications", {
                  description: "You are all caught up.",
                })
              }
              aria-label="Open notifications" className="icon-button relative rounded-xl border border-[#e0e6e1] bg-white p-2.5 text-[#74817f] shadow-sm hover:text-[#0f7f79]"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#e78362] ring-2 ring-white" />
            </button>

            <div className="hidden h-9 w-px bg-[#dfe6e1] sm:block" />

            <div className="flex items-center gap-2">
              <button
                onClick={() => void logout()}
                title="Sign out"
                aria-label="User profile and sign out"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f5c87b] text-xs font-extrabold text-[#5c4523] shadow-sm hover:ring-2 hover:ring-[#0f7f79]/30"
              >
                {initialsFor(
                  authenticatedUser.name ?? authenticatedUser.email ?? "User",
                )}
              </button>

              <button
                onClick={() => void logout()}
                title="Log out"
                className="flex items-center gap-1.5 rounded-xl border border-[#e0e6e1] bg-white px-3 py-2 text-xs font-bold text-[#4c5c59] shadow-sm transition hover:bg-[#fff5f5] hover:border-[#fca5a5] hover:text-[#dc2626]"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Log out</span>
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] px-4 pb-12 pt-6 sm:px-6 lg:px-9">
          {activeNav === "Overview" ? (
            <>
              <section className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#0f7f79]">
                    <Sparkles className="h-3.5 w-3.5" /> Your platform at a glance
                  </div>
                  <h2 className="max-w-xl text-3xl font-extrabold leading-[1.05] tracking-[-0.06em] sm:text-[38px]">
                    Keep every card moving{" "}
                    <span className="text-[#0f7f79]">forward.</span>
                  </h2>
                  <p className="mt-3 max-w-lg text-sm leading-6 text-[#778381]">
                    Manage school identity, approvals, and print-ready cards from
                    one calm workspace.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {authenticatedUser.role === "SUPER_ADMIN" && (
                    <Button
                      onClick={openCreateSchool}
                      className="h-10 rounded-xl bg-[#0f7f79] px-4 text-xs font-bold text-white shadow-[0_8px_18px_rgba(15,127,121,0.18)] hover:bg-[#096c67]"
                    >
                      <Building2 className="mr-2 h-4 w-4" /> Add school
                    </Button>
                  )}
                  {authenticatedUser.role === "SUPER_ADMIN" && (
                    <Button
                      onClick={openCreateTemplate}
                      variant="outline"
                      className="h-10 rounded-xl border-[#dce5df] bg-white px-4 text-xs font-bold text-[#38514e] shadow-sm hover:bg-[#edf5f0]"
                    >
                      <Palette className="mr-2 h-4 w-4" /> New template
                    </Button>
                  )}
                  {authenticatedUser.role === "SUPER_ADMIN" ? (
                    <Button
                      onClick={openCreateCard}
                      className="h-10 rounded-xl bg-[#0f7f79] px-4 text-xs font-bold text-white hover:bg-[#096c67]"
                    >
                      <FilePlus2 className="mr-2 h-4 w-4" /> Create card
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={() => goTo("ID card templates")}
                        variant="outline"
                        className="h-10 rounded-xl border-[#dce5df] bg-white px-4 text-xs font-bold text-[#38514e] shadow-sm hover:bg-[#edf5f0]"
                      >
                        <Palette className="mr-2 h-4 w-4" /> Select Template
                      </Button>
                      <Button
                        onClick={() => goTo("ID card requests")}
                        className="h-10 rounded-xl bg-[#0f7f79] px-4 text-xs font-bold text-white hover:bg-[#096c67]"
                      >
                        <ClipboardCheck className="mr-2 h-4 w-4" /> Review ID Cards
                      </Button>
                    </>
                  )}
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div
                  onClick={() => authenticatedUser.role === "SUPER_ADMIN" && goTo("Schools")}
                  className={authenticatedUser.role === "SUPER_ADMIN" ? "cursor-pointer transition-transform hover:-translate-y-0.5" : ""}
                >
                  <MetricCard
                    label={authenticatedUser.role === "SUPER_ADMIN" ? "Active schools" : "My School"}
                    value={
                      authenticatedUser.role === "SUPER_ADMIN"
                        ? String(schools.filter((school) => school.isActive).length)
                        : (currentActiveSchool?.shortCode || "Connected")
                    }
                    change={
                      authenticatedUser.role === "SUPER_ADMIN"
                        ? "Click to manage schools →"
                        : (currentActiveSchool?.name || "Active")
                    }
                    icon={Building2}
                    tone="teal"
                  />
                </div>
                <MetricCard
                  label="Cards in review"
                  value={String(pendingRequests.length)}
                  change={`${pendingRequests.filter((r) => r.status === "SUBMITTED").length} pending`}
                  icon={Clock3}
                  tone="coral"
                />
                <MetricCard
                  label="Approved cards"
                  value={String(
                    approvals.filter((request) => request.status === "APPROVED").length,
                  )}
                  change="Live from MySQL"
                  icon={FileCheck2}
                  tone="indigo"
                />
                <MetricCard
                  label="Print-ready cards"
                  value={String(
                    idCards.filter((card) => card.status === "PRINTED").length,
                  )}
                  change="Live from MySQL"
                  icon={Printer}
                  tone="yellow"
                />
              </section>

              <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
                <Card className="overflow-hidden ui-card rounded-2xl border-[#e2e8e3] bg-[#fffefa] shadow-[0_14px_40px_rgba(38,71,65,0.05)]">
                  <CardHeader className="flex flex-row items-start justify-between px-6 pb-3 pt-6">
                    <div>
                      <CardTitle className="text-[15px] font-extrabold tracking-[-0.02em]">
                        Approval queue
                      </CardTitle>
                      <p className="mt-1 text-xs text-[#84918e]">
                        Cards waiting for your review
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="hidden rounded-lg border border-[#e4e9e5] bg-[#f8faf8] p-0.5 sm:flex">
                        {(["All", "Pending", "Changes required"] as const).map(
                          (item) => (
                            <button
                              key={item}
                              onClick={() => setFilter(item)}
                              className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold ${filter === item
                                  ? "bg-white text-[#0f7f79] shadow-sm"
                                  : "text-[#8a9793]"
                                }`}
                            >
                              {item}
                            </button>
                          ),
                        )}
                      </div>
                      <button
                        onClick={() => toast("Filters opened")}
                        className="rounded-lg border border-[#e1e8e2] p-2 text-[#7b8985] hover:bg-[#f5f8f5]"
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="px-0">
                    {approvalsLoading ? (
                      <div className="px-6 py-10 text-center text-sm text-[#7f8d89]">
                        Loading requests…
                      </div>
                    ) : Boolean(apiError) ? (
                      <div className="px-6 py-10 text-center text-sm text-[#c65c3d]">
                        Couldn't load requests: {apiError}
                      </div>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[640px] text-left">
                            <thead>
                              <tr className="border-y border-[#edf0ed] bg-[#fbfcfa] text-[10px] font-bold uppercase tracking-[0.13em] text-[#9aa5a1]">
                                <th className="px-6 py-3 font-bold">Card holder</th>
                                <th className="px-4 py-3 font-bold">School</th>
                                <th className="px-4 py-3 font-bold">Submitted</th>
                                <th className="px-4 py-3 font-bold">Status</th>
                                <th className="px-6 py-3 text-right font-bold">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredApprovals.map((item) => (
                                <tr
                                  key={item.id}
                                  className="group border-b border-[#f0f2ef] last:border-0 hover:bg-[#fbfdfb]"
                                >
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                      <div
                                        className={`flex h-9 w-9 items-center justify-center rounded-xl text-[10px] font-extrabold ${toneStyles[item.tone].bg} ${toneStyles[item.tone].fg}`}
                                      >
                                        {item.initials}
                                      </div>
                                      <div>
                                        <div className="text-xs font-extrabold text-[#29403d]">
                                          {item.studentName}
                                        </div>
                                        <div className="mt-0.5 font-mono text-[10px] text-[#96a19e]">
                                          {item.admissionCode}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 text-xs font-semibold text-[#667571]">
                                    {item.schoolName}
                                  </td>
                                  <td className="px-4 py-4 text-[11px] text-[#83918d]">
                                    {item.submitted}
                                  </td>
                                  <td className="px-4 py-4">
                                    {item.status === "SUBMITTED" ? (
                                      <StatusPill tone="yellow">Pending review</StatusPill>
                                    ) : (
                                      <StatusPill tone="coral">Changes requested</StatusPill>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    {(authenticatedUser.role === "SUPER_ADMIN" ||
                                      authenticatedUser.schoolId === item.schoolId) && (
                                        <button
                                          disabled={approveLoading}
                                          onClick={() => approve(item.id, item.studentName)}
                                          className="rounded-lg bg-[#e1f3ed] px-3 py-2 text-[10px] font-extrabold text-[#0a716b] transition-colors hover:bg-[#c7ebe1] disabled:opacity-50"
                                        >
                                          Approve
                                        </button>
                                      )}
                                    <button
                                      onClick={() => handleOpenReview(item.cardId || item.id)}
                                      className="ml-1 rounded-lg p-2 text-[#a3adaa] hover:bg-[#eef5f1] hover:text-[#50706b]"
                                      title="View card details"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {filteredApprovals.length === 0 && (
                          <div className="px-6 py-10 text-center text-sm text-[#7f8d89]">
                            No cards match your search.
                          </div>
                        )}
                        <div className="flex items-center justify-between border-t border-[#edf0ed] px-6 py-4">
                          <span className="font-mono text-[10px] text-[#a1aaa7]">
                            Showing {filteredApprovals.length} of {pendingRequests.length} pending cards
                          </span>
                          <button
                            onClick={() => goTo("ID card requests")}
                            className="flex items-center gap-1 text-[11px] font-extrabold text-[#0f7f79] hover:underline"
                          >
                            View all requests <ArrowUpRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card className="ui-card rounded-2xl border-[#e2e8e3] bg-[#fffefa] shadow-[0_14px_40px_rgba(38,71,65,0.05)]">
                  <CardHeader className="flex flex-row items-start justify-between px-6 pb-2 pt-6">
                    <div>
                      <CardTitle className="text-[15px] font-extrabold tracking-[-0.02em]">
                        Recent activity
                      </CardTitle>
                      <p className="mt-1 text-xs text-[#84918e]">
                        Your team’s latest actions
                      </p>
                    </div>
                    <button
                      onClick={() => toast("Audit logs opened")}
                      className="text-[10px] font-extrabold text-[#0f7f79] hover:underline"
                    >
                      View log
                    </button>
                  </CardHeader>
                  <CardContent className="px-6 pb-6 pt-4">
                    <div className="space-y-5">
                      {activity.map((item) => (
                        <div key={item.id} className="flex gap-3">
                          <ToneIcon icon={BookOpenCheck} tone="teal" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-xs font-extrabold text-[#304541]">
                                {item.action.replaceAll("_", " ")}
                              </div>
                              <span className="whitespace-nowrap font-mono text-[9px] text-[#a3adaa]">
                                {formatDistanceToNow(new Date(item.createdAt), {
                                  addSuffix: true,
                                })}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] leading-4 text-[#81908b]">
                              {item.entityType} #{item.entityId ?? "-"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 rounded-xl border border-dashed border-[#d6e4dc] bg-[#f7fbf8] p-3 text-center">
                      <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#8ea49d]">
                        All systems operational
                      </div>
                      <div className="mt-1 text-[10px] text-[#6c827c]">
                        {apiError ?? "Synced from MySQL"}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>

              <section className="mt-7 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <Card className="ui-card rounded-2xl border-[#e2e8e3] bg-[#fffefa] shadow-[0_14px_40px_rgba(38,71,65,0.05)]">
                  <CardHeader className="flex flex-row items-start justify-between px-6 pb-3 pt-6">
                    <div>
                      <CardTitle className="text-[15px] font-extrabold tracking-[-0.02em]">
                        Template library
                      </CardTitle>
                      <p className="mt-1 text-xs text-[#84918e]">
                        Active designs across your network
                      </p>
                    </div>
                    <button
                      onClick={() => goTo("ID card templates")}
                      className="text-[10px] font-extrabold text-[#0f7f79] hover:underline"
                    >
                      Manage templates
                    </button>
                  </CardHeader>
                  <CardContent className="space-y-3 px-6 pb-6">
                    {templates.map((template) => (
                      <div
                        key={template.name}
                        className="flex items-center gap-3 rounded-xl border border-[#edf1ed] bg-[#fcfdfb] p-3"
                      >
                        <CardPreview accent={template.accent as Tone} mini />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="truncate text-xs font-extrabold text-[#304541]">
                              {template.name}
                            </div>
                            {template.status === "ACTIVE" ? (
                              <StatusPill tone="teal">Active</StatusPill>
                            ) : (
                              <StatusPill tone="indigo">Draft</StatusPill>
                            )}
                          </div>
                          <div className="mt-1 text-[10px] text-[#8b9793]">
                            {template.meta ??
                              template.description ??
                              "No description"}
                          </div>
                          <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.1em] text-[#adb6b2]">
                            {template.status}
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            toast(`${template.name} preview opened`)
                          }
                          className="rounded-lg p-2 text-[#a1ada9] hover:bg-[#edf6f1] hover:text-[#0f7f79]"
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="relative overflow-hidden rounded-2xl border-0 bg-[#163b3a] text-white shadow-[0_14px_40px_rgba(15,72,67,0.14)]">
                  <div className="absolute -right-14 -top-20 h-56 w-56 rounded-full border-[28px] border-[#3aa99b]/20" />
                  <div className="absolute bottom-[-90px] right-[20%] h-48 w-48 rounded-full border-[24px] border-[#f2c94c]/10" />
                  <CardContent className="relative flex h-full min-h-[248px] flex-col justify-between p-6 sm:p-7">
                    <div>
                      <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-[#40c8bb] text-[#0a4542]">
                        <QrCode className="h-5 w-5" />
                      </div>
                      <div className="max-w-md text-xl font-extrabold leading-tight tracking-[-0.04em]">
                        Every approved card has a story. Make it easy to verify.
                      </div>
                      <p className="mt-2 max-w-sm text-xs leading-5 text-[#a5cfca]">
                        QR verification keeps schools, families, and staff confident
                        that every card is authentic and current.
                      </p>
                    </div>
                    <button
                      onClick={() => toast("Verification settings opened")}
                      className="mt-7 flex w-fit items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2.5 text-[11px] font-extrabold text-white transition-colors hover:bg-white/20"
                    >
                      Explore verification <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  </CardContent>
                </Card>

                {authenticatedUser.role === "SUPER_ADMIN" && (
                  <Card className="ui-card xl:col-span-2 rounded-2xl border-[#e2e8e3] bg-[#fffefa] shadow-[0_14px_40px_rgba(38,71,65,0.05)]">
                    <CardHeader className="flex flex-row items-center justify-between px-6 pb-3 pt-6 border-b border-[#edf0ed]">
                      <div>
                        <CardTitle className="text-[15px] font-extrabold tracking-[-0.02em]">
                          Registered Schools ({schools.length})
                        </CardTitle>
                        <p className="mt-1 text-xs text-[#84918e]">
                          Super Admin directory to edit, update, or remove schools
                        </p>
                      </div>
                      <Button
                        onClick={openCreateSchool}
                        className="h-8 rounded-xl bg-[#0f7f79] px-3 text-xs font-bold text-white hover:bg-[#096c67]"
                      >
                        <Building2 className="mr-1.5 h-3.5 w-3.5" /> Add school
                      </Button>
                    </CardHeader>
                    <CardContent className="divide-y divide-[#edf0ed] p-0">
                      {schools.length === 0 ? (
                        <div className="p-6 text-center text-xs text-[#98a4a1]">No schools found. Click "Add school" to create one.</div>
                      ) : (
                        schools.map((school) => (
                          <div key={school.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 px-6 gap-3 hover:bg-[#fbfdfb] transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#dff3ee] text-[#0b716b] shrink-0">
                                <Building2 className="h-5 w-5" />
                              </div>
                              <div>
                                <div className="text-sm font-extrabold text-[#304541] flex items-center gap-2">
                                  {school.name}
                                  <StatusPill tone="teal">Active</StatusPill>
                                </div>
                                <div className="text-[11px] text-[#8d9995] flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                  <span>Code: <b className="text-[#304541]">{school.shortCode}</b></span>
                                  {school.email && <span>Email: {school.email}</span>}
                                  {school.phone && <span>Phone: {school.phone}</span>}
                                  {school.address && <span>Address: {school.address}</span>}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                              <button
                                onClick={() => handleEditSchool(school)}
                                className="flex items-center gap-1 rounded-lg border border-[#d3ded8] bg-white px-3 py-1.5 text-xs font-bold text-[#304541] shadow-sm hover:bg-[#f2f7f4] hover:text-[#0f7f79]"
                              >
                                <FileEdit className="h-3.5 w-3.5" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteSchool(school.id, school.name)}
                                className="flex items-center gap-1 rounded-lg border border-[#fecaca] bg-white px-3 py-1.5 text-xs font-bold text-[#dc2626] shadow-sm hover:bg-[#fef2f2]"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                )}
              </section>
            </>
          ) : (
            <ModuleView
              label={activeNav}
              onBack={() => setActiveNav("Overview")}
              onCreate={() => void createForLabel(activeNav)}
              authenticatedUser={authenticatedUser}
              schools={schools}
              templates={templates}
              users={users}
              idCards={idCards}
              approvals={approvals}
              notifications={notifications}
              activity={activity}
              onSelectTemplate={handleSelectTemplate}
              onLockTemplate={handleLockTemplate}
              onPreviewTemplate={handlePreviewTemplate}
              onToggleTemplateStatus={handleToggleTemplateStatus}
              onEditCard={handleEditCard}
              onSubmitCard={handleSubmitCard}
              onDeleteCard={handleDeleteCard}
              onOpenReview={handleOpenReview}
              onPrintCard={handlePrintCard}
              onBulkPrint={handleBulkPrint}
              onBulkPdf={handleBulkDownloadPdf}
              selectedApprovedCardIds={selectedApprovedCardIds}
              onToggleSelectApproved={handleToggleSelectApproved}
              onSelectAllApproved={handleSelectAllApproved}
              onMarkNotificationRead={handleMarkNotificationRead}
              onEditSchool={handleEditSchool}
              onDeleteSchool={handleDeleteSchool}
              onDeleteTemplate={handleDeleteTemplate}
              activeSchool={currentActiveSchool}
              onGenerateCredentials={handleGenerateCredentials}
              onApproveCardDirect={(id: number, num: string) => approve(id, num)}
              onRejectCardDirect={(id: number) => handleOpenReview(id)}
            />
          )}
        </div>
      </main>

      {/* Dialog for Creating / Editing School */}
      <Dialog open={schoolModalOpen} onOpenChange={setSchoolModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleCreateSchoolSubmit}>
            <DialogHeader>
              <DialogTitle>{editingSchool ? `Edit School: ${editingSchool.name}` : "Add New School"}</DialogTitle>
              <DialogDescription>
                {editingSchool
                  ? "Update school details, contact information, and registration parameters."
                  : "Register a new school in the identity platform database."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#304541]">
                    School Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    className="mt-1"
                    placeholder="e.g., Pinecrest International Academy"
                    value={schoolNameInput}
                    onChange={(e) => setSchoolNameInput(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#304541]">
                    Short Code <span className="text-red-500">*</span>
                  </label>
                  <Input
                    className="mt-1 uppercase"
                    placeholder="e.g., PIA"
                    maxLength={10}
                    value={schoolCodeInput}
                    onChange={(e) => setSchoolCodeInput(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#304541]">
                    Contact Email
                  </label>
                  <Input
                    type="email"
                    className="mt-1"
                    placeholder="admin@school.edu"
                    value={schoolEmailInput}
                    onChange={(e) => setSchoolEmailInput(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#304541]">
                    Phone Number
                  </label>
                  <Input
                    type="tel"
                    className="mt-1"
                    placeholder="+1 555-0199"
                    value={schoolPhoneInput}
                    onChange={(e) => setSchoolPhoneInput(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#304541]">
                  Campus Address
                </label>
                <Input
                  className="mt-1"
                  placeholder="100 Education Lane, City, State"
                  value={schoolAddressInput}
                  onChange={(e) => setSchoolAddressInput(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSchoolModalOpen(false);
                  setEditingSchool(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-[#0f7f79] hover:bg-[#096c67]">
                {editingSchool ? "Update School" : "Create School"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog for Creating Template */}
      <Dialog open={templateModalOpen} onOpenChange={setTemplateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateTemplateSubmit}>
            <DialogHeader>
              <DialogTitle>New ID Card Template</DialogTitle>
              <DialogDescription>
                Create a draft template definition in the system.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-xs font-bold text-[#304541]">
                  Template Name
                </label>
                <Input
                  className="mt-1"
                  placeholder="e.g., Standard Student Pass 2026"
                  value={templateNameInput}
                  onChange={(e) => setTemplateNameInput(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setTemplateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-[#0f7f79] hover:bg-[#096c67]">
                Create Template
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog for Creating School User */}
      <Dialog open={userModalOpen} onOpenChange={setUserModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateUserSubmit}>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a school administrator, operator, or viewer account.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-xs font-bold text-[#304541]">
                  Full Name
                </label>
                <Input
                  className="mt-1"
                  placeholder="e.g., Sarah Connor"
                  value={userNameInput}
                  onChange={(e) => setUserNameInput(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#304541]">
                  Email Address
                </label>
                <Input
                  type="email"
                  className="mt-1"
                  placeholder="e.g., sarah@school.edu"
                  value={userEmailInput}
                  onChange={(e) => setUserEmailInput(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#304541]">
                  Temporary Password (min 8 chars)
                </label>
                <Input
                  type="password"
                  className="mt-1"
                  placeholder="••••••••"
                  value={userPasswordInput}
                  onChange={(e) => setUserPasswordInput(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#304541]">
                  Role
                </label>
                <Select
                  value={userRoleInput}
                  onValueChange={(val: any) => setUserRoleInput(val)}
                >
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SCHOOL_OPERATOR">School Operator (Create & Submit cards)</SelectItem>
                    <SelectItem value="SCHOOL_ADMIN">School Admin (Manage templates & users)</SelectItem>
                    <SelectItem value="VIEWER">Viewer (Read-only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {authenticatedUser.role === "SUPER_ADMIN" ? (
                <div>
                  <label className="text-xs font-bold text-[#304541]">
                    Assign School
                  </label>
                  <Select
                    value={userSchoolIdInput ? String(userSchoolIdInput) : ""}
                    onValueChange={(val) => setUserSchoolIdInput(Number(val))}
                  >
                    <SelectTrigger className="mt-1 w-full">
                      <SelectValue placeholder="Select school" />
                    </SelectTrigger>
                    <SelectContent>
                      {schools.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name} ({s.shortCode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="rounded-xl bg-[#eef7f3] p-3 text-xs text-[#0f7f79]">
                  <strong>School:</strong> {authenticatedUser.schoolName ?? `School #${authenticatedUser.schoolId}`}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setUserModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-[#0f7f79] hover:bg-[#096c67]">
                Create User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dynamic ID Card Create / Edit Modal with Live Preview */}
      <IdCardFormModal
        open={idCardFormOpen}
        onOpenChange={setIdCardFormOpen}
        initialCard={editingCard}
        schoolId={activeSchoolId ?? schools[0]?.id ?? 0}
        schoolName={currentActiveSchool?.name}
        schoolCode={currentActiveSchool?.shortCode}
        availableTemplates={templates}
        onSaved={() => {
          reloadWorkspace();
        }}
      />

      {/* Print & Bulk Print Modal */}
      <PrintModal
        open={printModalOpen}
        onOpenChange={setPrintModalOpen}
        cards={cardsToPrint}
        onPrinted={() => {
          reloadWorkspace();
        }}
      />

      {/* Admin Card Review & Detail Modal */}
      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {reviewingCard && (
            <div>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                      <span>Card Review: #{reviewingCard.cardNumber}</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold bg-[#eef5f0] text-[#0f7f79]">
                        {reviewingCard.status}
                      </span>
                    </DialogTitle>
                    <DialogDescription>
                      School: {reviewingCard.schoolName} · Template: {reviewingCard.templateName}
                    </DialogDescription>
                  </div>
                  {/* Side switcher */}
                  <div className="flex gap-1.5 bg-[#f0efec] p-1 rounded-xl">
                    {(["FRONT", "BACK"] as const).map((side) => (
                      <button
                        key={side}
                        onClick={() => setReviewSide(side)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${reviewSide === side
                            ? "bg-[#0f7f79] text-white shadow-sm"
                            : "text-[#55605d] hover:text-[#203734]"
                          }`}
                      >
                        {side}
                      </button>
                    ))}
                  </div>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-6 border-b border-[#edf0ed]">
                {/* Visual Card Preview */}
                <div className="flex flex-col items-center justify-center p-4 bg-[#f8faf8] rounded-2xl border border-[#e2e8e3]">
                  <CardRenderer
                    cardWidth={reviewingCard.template?.cardWidth ?? 324}
                    cardHeight={reviewingCard.template?.cardHeight ?? 204}
                    elements={((reviewingCard.template?.elements ?? []) as any[]).map((el: any, i: number) => ({
                      id: el.id,
                      elementKey: el.elementKey,
                      elementType: el.elementType as any,
                      label: el.label ?? null,
                      config: el.config as any,
                      sortOrder: el.sortOrder ?? i,
                    }))}
                    side={reviewSide}
                    cardData={reviewingCard.dataMap ?? {}}
                    scale={1.2}
                  />
                  <div className="mt-3 text-xs text-[#84918e]">
                    Card dimensions: {reviewingCard.template?.cardWidth ?? 324} × {reviewingCard.template?.cardHeight ?? 204}px
                  </div>
                </div>

                {/* Form Data & Details */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#84918e] mb-2">
                      Card Fields & Data
                    </h4>
                    <div className="rounded-xl border border-[#e2e8e3] bg-white divide-y divide-[#edf0ed] overflow-hidden">
                      {Object.entries(reviewingCard.dataMap || {}).map(([key, val]) => (
                        <div key={key} className="flex justify-between items-center px-3 py-2 text-xs">
                          <span className="font-semibold text-[#55605d] capitalize">
                            {key.replace(/_/g, " ")}
                          </span>
                          <span className="font-mono text-[#203734] truncate max-w-[200px]">
                            {String(val)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Attached files */}
                  {reviewingCard.files && reviewingCard.files.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#84918e] mb-2">
                        Uploaded Assets
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {reviewingCard.files.map((file) => (
                          <a
                            key={file.id}
                            href={file.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#e2e8e3] bg-white text-xs text-[#0f7f79] hover:bg-[#eef7f3]"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="font-medium">{file.fileType}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Approval Timeline */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#84918e] mb-2">
                      Approval & Audit History
                    </h4>
                    <ApprovalTimeline
                      history={reviewingCard.approvalHistory || []}
                      currentStatus={reviewingCard.status}
                      reviewNote={reviewingCard.request?.reviewNote}
                    />
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <DialogFooter className="mt-4 flex flex-wrap gap-2 sm:justify-between">
                <div className="flex gap-2">
                  {authenticatedUser.role === "SUPER_ADMIN" && (
                    <Button
                      variant="outline"
                      onClick={() => handlePrintCard(reviewingCard.id)}
                      className="text-xs"
                    >
                      <Printer className="w-3.5 h-3.5 mr-1" /> Print / PDF
                    </Button>
                  )}
                </div>

                <div className="flex gap-2">
                  {(authenticatedUser.role === "SUPER_ADMIN" ||
                    authenticatedUser.schoolId === reviewingCard.schoolId) &&
                    (reviewingCard.status === "SUBMITTED" ||
                      reviewingCard.status === "UNDER_REVIEW" ||
                      reviewingCard.status === "RESUBMITTED") && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => setRequestChangesOpen(true)}
                          disabled={actionLoading}
                          className="border-[#f39c12] text-[#f39c12] hover:bg-[#fffbf0] text-xs"
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1" /> Request Changes
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => setRejectOpen(true)}
                          disabled={actionLoading}
                          className="text-xs"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                        </Button>
                        <Button
                          onClick={handleAdminApprove}
                          disabled={actionLoading}
                          className="bg-[#0f7f79] hover:bg-[#096c67] text-white text-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve Card
                        </Button>
                      </>
                    )}
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Request Changes Sub-Modal */}
      <Dialog open={requestChangesOpen} onOpenChange={setRequestChangesOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Changes</DialogTitle>
            <DialogDescription>
              Explain what the school operator needs to correct before this card can be approved.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-xs font-bold text-[#304541]">
              Review Comments / Instructions <span className="text-red-500">*</span>
            </label>
            <Textarea
              className="mt-1.5"
              placeholder="e.g., Student photo is blurry. Please upload a clear passport-style photo."
              rows={4}
              value={requestChangesComment}
              onChange={(e) => setRequestChangesComment(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRequestChangesOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAdminRequestChanges}
              disabled={actionLoading || !requestChangesComment.trim()}
              className="bg-[#f39c12] hover:bg-[#e08e0b] text-white"
            >
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Card Sub-Modal */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject ID Card</DialogTitle>
            <DialogDescription>
              Provide a clear reason for rejecting this card. This will mark the card as REJECTED.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-xs font-bold text-[#304541]">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <Textarea
              className="mt-1.5"
              placeholder="e.g., Duplicate record detected or student no longer enrolled."
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleAdminReject}
              disabled={actionLoading || !rejectReason.trim()}
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for Template Preview */}
      <Dialog open={!!previewModalTemplate} onOpenChange={(open) => !open && setPreviewModalTemplate(null)}>
        <DialogContent className="max-w-[700px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              Template Preview — {previewModalTemplate?.name}
            </DialogTitle>
          </DialogHeader>
          {previewModalTemplate && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="flex gap-2">
                {(["FRONT", "BACK"] as const).map((side) => (
                  <button
                    key={side}
                    onClick={() => setPreviewModalSide(side)}
                    className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${previewModalSide === side
                        ? "bg-[#0f7f79] text-white"
                        : "bg-[#f0efec] text-[#778381] hover:bg-[#e5e4e0]"
                      }`}
                  >
                    {side}
                  </button>
                ))}
              </div>
              <CardRenderer
                cardWidth={previewModalTemplate.cardWidth ?? 324}
                cardHeight={previewModalTemplate.cardHeight ?? 204}
                elements={(previewModalTemplate.elements ?? []).map((el, i) => ({
                  id: el.id,
                  elementKey: el.elementKey,
                  elementType: el.elementType as any,
                  label: el.label ?? null,
                  config: (el.config as any) ?? {
                    x: 20,
                    y: 20,
                    width: 100,
                    height: 30,
                    side: "FRONT",
                    rotation: 0,
                    opacity: 1,
                  },
                  sortOrder: el.sortOrder ?? i,
                }))}
                side={previewModalSide}
                cardData={SAMPLE_CARD_DATA}
                scale={Math.min(2, 560 / (previewModalTemplate.cardWidth ?? 324))}
              />
              <div className="text-center text-xs text-[#98a4a1]">
                {previewModalTemplate.elements && previewModalTemplate.elements.length > 0
                  ? "Live preview with designer layout and realistic student data."
                  : "This template has no custom elements yet. Super Admins can open the designer to add layout elements."}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({
  label,
  value,
  change,
  icon,
  tone,
}: {
  label: string;
  value: string;
  change: string;
  icon: typeof Bell;
  tone: Tone;
}) {
  return (
    <Card className="rounded-2xl border-[#e2e8e3] bg-[#fffefa] shadow-[0_12px_35px_rgba(38,71,65,0.045)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] font-semibold text-[#84918e]">{label}</div>
            <div className="mt-2 text-3xl font-extrabold tracking-[-0.07em] text-[#203734]">
              {value}
            </div>
          </div>
          <ToneIcon icon={icon} tone={tone} />
        </div>
        <div
          className={`mt-5 flex items-center gap-1 text-[10px] font-bold ${toneStyles[tone].fg}`}
        >
          <ArrowUpRight className="h-3 w-3" />
          {change}
        </div>
      </CardContent>
    </Card>
  );
}

function ModuleView({
  label,
  onBack,
  onCreate,
  authenticatedUser,
  schools,
  templates,
  users,
  idCards,
  approvals,
  notifications,
  activity,
  onSelectTemplate,
  onLockTemplate,
  onPreviewTemplate,
  onToggleTemplateStatus,
  onEditCard,
  onSubmitCard,
  onDeleteCard,
  onOpenReview,
  onPrintCard,
  onBulkPrint,
  onBulkPdf,
  selectedApprovedCardIds,
  onToggleSelectApproved,
  onSelectAllApproved,
  onMarkNotificationRead,
  onEditSchool,
  onDeleteSchool,
  onDeleteTemplate,
  activeSchool,
  onGenerateCredentials,
  onApproveCardDirect,
  onRejectCardDirect,
}: {
  label: NavLabel;
  onBack: () => void;
  onCreate: () => void;
  authenticatedUser: ApiAuthUser;
  schools: ApiSchool[];
  templates: ApiTemplate[];
  users: ApiUser[];
  idCards: ApiIdCard[];
  approvals: ApiApproval[];
  notifications: ApiNotification[];
  activity: ApiActivity[];
  onSelectTemplate: (template: ApiTemplate) => void;
  onLockTemplate: (template: ApiTemplate) => void;
  onPreviewTemplate: (template: ApiTemplate) => void;
  onToggleTemplateStatus: (template: ApiTemplate) => void;
  onEditCard: (cardId: number) => void;
  onSubmitCard: (cardId: number, num: string) => void;
  onDeleteCard: (cardId: number, num: string) => void;
  onOpenReview: (cardId: number) => void;
  onPrintCard: (cardId: number) => void;
  onBulkPrint: () => void;
  onBulkPdf: () => void;
  selectedApprovedCardIds: number[];
  onToggleSelectApproved: (cardId: number) => void;
  onSelectAllApproved: (ids: number[]) => void;
  onMarkNotificationRead: (id: number) => void;
  onEditSchool?: (school: ApiSchool) => void;
  onDeleteSchool?: (schoolId: number, schoolName: string) => void;
  onDeleteTemplate?: (templateId: number, templateName: string) => void;
  activeSchool?: ApiSchool;
  onGenerateCredentials?: (school: ApiSchool) => void;
  onApproveCardDirect?: (cardId: number, num: string) => void;
  onRejectCardDirect?: (cardId: number) => void;
}) {
  const [, navigate] = useLocation();
  const [cardStatusFilter, setCardStatusFilter] = useState<string>("All");
  const [searchTerm, setSearchTerm] = useState("");

  const isTemplates = label === "ID card templates";
  const isSchools = label === "Schools";
  const isUsers = label === "Users";
  const isRequests = label === "ID card requests";
  const isApproved = label === "Approved cards";
  const isNotifications = label === "Notifications";
  const isAudit = label === "Audit logs";

  // Filtered lists for ID cards
  const requestCards = useMemo(() => {
    return idCards
      .filter((c) => c.status !== "APPROVED" && c.status !== "PRINTED")
      .filter((c) => cardStatusFilter === "All" || c.status === cardStatusFilter)
      .filter(
        (c) =>
          !searchTerm ||
          c.cardNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (c.schoolName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
          (c.templateName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false),
      );
  }, [idCards, cardStatusFilter, searchTerm]);

  const approvedCards = useMemo(() => {
    return idCards
      .filter((c) => c.status === "APPROVED" || c.status === "PRINTED")
      .filter(
        (c) =>
          !searchTerm ||
          c.cardNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (c.schoolName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
          (c.templateName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false),
      );
  }, [idCards, searchTerm]);

  const allApprovedCardIds = useMemo(() => approvedCards.map((c) => c.id), [approvedCards]);

  const getStatusTone = (status: string): Tone => {
    switch (status) {
      case "APPROVED":
      case "PRINTED":
        return "teal";
      case "SUBMITTED":
      case "UNDER_REVIEW":
        return "yellow";
      case "CHANGES_REQUIRED":
      case "REJECTED":
        return "coral";
      default:
        return "indigo";
    }
  };

  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <button
        onClick={onBack}
        className="mb-6 text-[11px] font-extrabold text-[#0f7f79] hover:underline"
      >
        ← Back to overview
      </button>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#82908e]">
            Workspace module
          </div>
          <h2 className="text-2xl font-extrabold tracking-[-0.05em] sm:text-3xl">
            {authenticatedUser.role !== "SUPER_ADMIN"
              ? label === "ID card templates"
                ? "Templates"
                : label === "ID card requests"
                  ? "My ID Cards"
                  : label
              : label}
          </h2>
          <p className="mt-2 text-sm text-[#778381]">
            {isRequests
              ? authenticatedUser.role === "SUPER_ADMIN"
                ? "Create, edit, submit, and manage student ID cards for all schools."
                : "View and approve or reject student ID cards created for your school."
              : isApproved
                ? "Print and export batch production-ready verified ID cards."
                : isTemplates
                  ? authenticatedUser.role === "SUPER_ADMIN"
                    ? "Manage customizable front and back ID card templates."
                    : "Browse available templates and select your school's final preferred template."
                  : "A focused workspace for managing your school identity operations."}
          </p>
        </div>
        {((isRequests && authenticatedUser.role === "SUPER_ADMIN") ||
          (isSchools && authenticatedUser.role === "SUPER_ADMIN") ||
          (isTemplates && authenticatedUser.role === "SUPER_ADMIN") ||
          (isUsers && authenticatedUser.role === "SUPER_ADMIN")) && (
          <Button
            onClick={onCreate}
            className="h-10 rounded-xl bg-[#0f7f79] text-xs font-bold text-white hover:bg-[#096c67]"
          >
            <FilePlus2 className="mr-2 h-4 w-4" />{" "}
            {isRequests ? "New ID Card Draft" : isUsers ? "New User" : "Create new"}
          </Button>
        )}
      </div>

      {/* 1. Templates Tab */}
      {isTemplates && (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {templates
            .filter((t) => authenticatedUser.role === "SUPER_ADMIN" || t.status === "ACTIVE")
            .map((template) => (
              <Card
                key={template.id}
                className="overflow-hidden rounded-2xl border-[#e2e8e3] bg-[#fffefa] shadow-[0_12px_35px_rgba(38,71,65,0.05)]"
              >
                <div className="flex h-44 items-center justify-center bg-[#eef5f0]">
                  <CardPreview accent={template.accent as Tone} />
                </div>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-[#304541]">
                      {template.name}
                    </h3>
                    {template.status === "ACTIVE" ? (
                      <StatusPill tone="teal">Active</StatusPill>
                    ) : template.status === "INACTIVE" ? (
                      <StatusPill tone="yellow">Inactive</StatusPill>
                    ) : template.status === "ARCHIVED" ? (
                      <StatusPill tone="coral">Archived</StatusPill>
                    ) : (
                      <StatusPill tone="indigo">Draft</StatusPill>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[#84918e]">{template.description || template.meta || `${template.orientation ?? 'landscape'} · ${template.cardWidth ?? 324}×${template.cardHeight ?? 204}px`}</p>
                  <div className="mt-5 flex items-center justify-between">
                    <span className="font-mono text-[10px] text-[#9aa6a2]">
                      {template.status}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => onPreviewTemplate(template)}
                        className="rounded-lg bg-[#f0efec] px-2.5 py-1.5 text-[10px] font-extrabold text-[#55605d] hover:bg-[#e4e2de]"
                      >
                        Preview
                      </button>

                      {authenticatedUser.role === "SUPER_ADMIN" && (
                        <button
                          onClick={() => navigate(`/admin/templates/${template.id}/design`)}
                          className="rounded-lg bg-[#e9ebfa] px-2.5 py-1.5 text-[10px] font-extrabold text-[#5c64b7] hover:bg-[#d8dbf3]"
                        >
                          Design
                        </button>
                      )}

                      {authenticatedUser.role === "SUPER_ADMIN" && (
                        <button
                          onClick={() => onToggleTemplateStatus(template)}
                          className={`rounded-lg px-2.5 py-1.5 text-[10px] font-extrabold ${template.status === "ACTIVE"
                              ? "bg-[#fff0e8] text-[#c65c3d] hover:bg-[#fde2d6]"
                              : "bg-[#e1f3ed] text-[#0a716b] hover:bg-[#cbf0e4]"
                            }`}
                        >
                          {template.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </button>
                      )}

                      {/* Final template badge if this is school's selected template */}
                      {activeSchool?.selectedTemplateId === template.id && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-[#0f7f79] px-2.5 py-1.5 text-[10px] font-bold text-white shadow-xs">
                          <CheckCircle2 className="w-3 h-3" /> Final Selected Template
                        </span>
                      )}

                      {/* Select as Final Template button for School users when not currently selected */}
                      {authenticatedUser.role !== "SUPER_ADMIN" &&
                        template.status === "ACTIVE" &&
                        activeSchool?.selectedTemplateId !== template.id && (
                          <button
                            onClick={() => onSelectTemplate(template)}
                            className="rounded-lg bg-[#e1f3ed] px-2.5 py-1.5 text-[10px] font-extrabold text-[#0a716b] hover:bg-[#cbf0e4]"
                          >
                            Select as Final Template
                          </button>
                        )}

                      {/* Lock button only for Super Admin */}
                      {authenticatedUser.role === "SUPER_ADMIN" && (
                        <button
                          onClick={() => onLockTemplate(template)}
                          className="rounded-lg bg-[#fff0e8] px-2.5 py-1.5 text-[10px] font-extrabold text-[#c65c3d] hover:bg-[#fde2d6]"
                        >
                          Lock
                        </button>
                      )}

                      {/* Delete button for Super Admin */}
                      {authenticatedUser.role === "SUPER_ADMIN" && (
                        <button
                          onClick={() => onDeleteTemplate?.(template.id, template.name)}
                          className="rounded-lg bg-[#fef2f2] border border-[#fecaca] px-2.5 py-1.5 text-[10px] font-extrabold text-[#dc2626] hover:bg-[#fee2e2]"
                        >
                          <Trash2 className="inline w-3 h-3 mr-0.5" /> Delete
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* 2. ID Card Requests / LifeCycle Queue */}
      {isRequests && (
        <Card className="rounded-2xl border-[#e2e8e3] bg-[#fffefa] shadow-[0_12px_35px_rgba(38,71,65,0.05)]">
          <div className="flex flex-col gap-3 border-b border-[#edf0ed] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a4a1]" />
              <Input
                placeholder="Search card #, student, or school..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 rounded-xl border-[#e2e8e3] pl-9 text-xs shadow-none"
              />
            </div>
            {/* Status filter chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {["All", "DRAFT", "SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUIRED", "REJECTED"].map((status) => (
                <button
                  key={status}
                  onClick={() => setCardStatusFilter(status)}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all ${cardStatusFilter === status
                      ? "bg-[#0f7f79] text-white shadow-sm"
                      : "bg-[#f0efec] text-[#55605d] hover:bg-[#e4e2de]"
                    }`}
                >
                  {status.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f8faf8] border-b border-[#edf0ed] text-[#84918e] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-3.5">Card Number</th>
                  <th className="px-5 py-3.5">School</th>
                  <th className="px-5 py-3.5">Template</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Updated</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0ed]">
                {requestCards.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-[#98a4a1]">
                      No ID card requests found matching the current filters.
                    </td>
                  </tr>
                ) : (
                  requestCards.map((card) => (
                    <tr key={card.id} className="hover:bg-[#fbfdfb] transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-[#203734]">
                        {card.cardNumber}
                      </td>
                      <td className="px-5 py-4 font-medium text-[#304541]">
                        {card.schoolName}
                      </td>
                      <td className="px-5 py-4 text-[#778381]">
                        {card.templateName}
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill tone={getStatusTone(card.status)}>
                          {card.status.replace(/_/g, " ")}
                        </StatusPill>
                      </td>
                      <td className="px-5 py-4 text-[#84918e]">
                        {card.updatedAt
                          ? formatDistanceToNow(new Date(card.updatedAt), { addSuffix: true })
                          : "Recently"}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Review/Detail for all */}
                          <button
                            onClick={() => onOpenReview(card.id)}
                            className="rounded-lg bg-[#e1f3ed] px-2.5 py-1.5 text-[11px] font-bold text-[#0a716b] hover:bg-[#cbf0e4]"
                          >
                            <Eye className="inline w-3 h-3 mr-1" />
                            {authenticatedUser.role === "SUPER_ADMIN" ? "Review" : "View"}
                          </button>

                          {/* Admin actions: Edit, Submit, Delete draft */}
                          {(card.status === "DRAFT" || card.status === "CHANGES_REQUIRED") &&
                            authenticatedUser.role === "SUPER_ADMIN" && (
                              <>
                                <button
                                  onClick={() => onEditCard(card.id)}
                                  className="rounded-lg bg-[#f0efec] px-2.5 py-1.5 text-[11px] font-bold text-[#55605d] hover:bg-[#e4e2de]"
                                >
                                  <FileEdit className="inline w-3 h-3 mr-1" /> Edit
                                </button>
                                <button
                                  onClick={() => onSubmitCard(card.id, card.cardNumber)}
                                  className="rounded-lg bg-[#0f7f79] px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#096c67]"
                                >
                                  <Send className="inline w-3 h-3 mr-1" /> Submit
                                </button>
                                {card.status === "DRAFT" && (
                                  <button
                                    onClick={() => onDeleteCard(card.id, card.cardNumber)}
                                    className="rounded-lg p-1.5 text-[#e74c3c] hover:bg-[#fdeae8]"
                                    title="Delete draft"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            )}

                          {/* Approval actions: When card is SUBMITTED, UNDER_REVIEW, or RESUBMITTED, School user can Approve or Reject */}
                          {(card.status === "SUBMITTED" || card.status === "UNDER_REVIEW" || card.status === "RESUBMITTED") && (
                            <>
                              <button
                                onClick={() => onApproveCardDirect?.(card.id, card.cardNumber)}
                                className="rounded-lg bg-[#dff3ee] border border-[#a2d8ce] px-2.5 py-1.5 text-[11px] font-bold text-[#0a716b] hover:bg-[#caebe3]"
                              >
                                <CheckCircle2 className="inline w-3 h-3 mr-1" /> Approve
                              </button>
                              <button
                                onClick={() => onRejectCardDirect?.(card.id)}
                                className="rounded-lg bg-[#fef2f2] border border-[#fecaca] px-2.5 py-1.5 text-[11px] font-bold text-[#dc2626] hover:bg-[#fee2e2]"
                              >
                                <XCircle className="inline w-3 h-3 mr-1" /> Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 3. Approved Cards Tab with Bulk Actions */}
      {isApproved && (
        <Card className="rounded-2xl border-[#e2e8e3] bg-[#fffefa] shadow-[0_12px_35px_rgba(38,71,65,0.05)]">
          <div className="flex flex-col gap-3 border-b border-[#edf0ed] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a4a1]" />
              <Input
                placeholder="Search approved cards..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 rounded-xl border-[#e2e8e3] pl-9 text-xs shadow-none"
              />
            </div>

            {/* Bulk Actions Toolbar */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#84918e] mr-2">
                {selectedApprovedCardIds.length} of {approvedCards.length} selected
              </span>
              <Button
                variant="outline"
                onClick={onBulkPrint}
                disabled={selectedApprovedCardIds.length === 0}
                className="h-10 rounded-xl text-xs font-bold border-[#e2e8e3]"
              >
                <Printer className="w-4 h-4 mr-1.5 text-[#0f7f79]" /> Bulk Print
              </Button>
              <Button
                onClick={onBulkPdf}
                disabled={selectedApprovedCardIds.length === 0}
                className="h-10 rounded-xl bg-[#0f7f79] hover:bg-[#096c67] text-xs font-bold text-white"
              >
                <Download className="w-4 h-4 mr-1.5" /> Download PDF
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f8faf8] border-b border-[#edf0ed] text-[#84918e] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-3.5 w-12 text-center">
                    <Checkbox
                      checked={
                        allApprovedCardIds.length > 0 &&
                        selectedApprovedCardIds.length === allApprovedCardIds.length
                      }
                      onCheckedChange={() => onSelectAllApproved(allApprovedCardIds)}
                    />
                  </th>
                  <th className="px-5 py-3.5">Card Number</th>
                  <th className="px-5 py-3.5">School</th>
                  <th className="px-5 py-3.5">Template</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0ed]">
                {approvedCards.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-[#98a4a1]">
                      No approved cards found. Submit cards and approve them to print here.
                    </td>
                  </tr>
                ) : (
                  approvedCards.map((card) => (
                    <tr key={card.id} className="hover:bg-[#fbfdfb] transition-colors">
                      <td className="px-5 py-4 text-center">
                        <Checkbox
                          checked={selectedApprovedCardIds.includes(card.id)}
                          onCheckedChange={() => onToggleSelectApproved(card.id)}
                        />
                      </td>
                      <td className="px-5 py-4 font-mono font-bold text-[#203734]">
                        {card.cardNumber}
                      </td>
                      <td className="px-5 py-4 font-medium text-[#304541]">
                        {card.schoolName}
                      </td>
                      <td className="px-5 py-4 text-[#778381]">
                        {card.templateName}
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill tone="teal">
                          {card.status}
                        </StatusPill>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onPrintCard(card.id)}
                            className="rounded-lg bg-[#e1f3ed] px-2.5 py-1.5 text-[11px] font-bold text-[#0a716b] hover:bg-[#cbf0e4]"
                          >
                            <Printer className="inline w-3 h-3 mr-1" /> Print / PDF
                          </button>
                          <button
                            onClick={() => onOpenReview(card.id)}
                            className="rounded-lg bg-[#f0efec] px-2.5 py-1.5 text-[11px] font-bold text-[#55605d] hover:bg-[#e4e2de]"
                          >
                            <Eye className="inline w-3 h-3 mr-1" /> View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 4. Notifications Tab */}
      {isNotifications && (
        <Card className="rounded-2xl border-[#e2e8e3] bg-[#fffefa] shadow-[0_12px_35px_rgba(38,71,65,0.05)]">
          <div className="p-5 border-b border-[#edf0ed]">
            <h3 className="text-sm font-bold text-[#304541]">Notifications Inbox</h3>
          </div>
          <div className="divide-y divide-[#edf0ed]">
            {notifications.length === 0 ? (
              <div className="px-5 py-10 text-center text-[#98a4a1] text-xs">
                No notifications recorded yet.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start justify-between gap-4 p-5 transition-colors ${!n.isRead ? "bg-[#f4faf7]" : "hover:bg-[#fbfdfb]"
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${!n.isRead ? "bg-[#dff3ee] text-[#0b716b]" : "bg-[#f0efec] text-[#84918e]"
                        }`}
                    >
                      <Bell className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-[#304541]">{n.title}</span>
                        {!n.isRead && (
                          <span className="rounded-full bg-[#0f7f79] px-2 py-0.5 text-[9px] font-bold text-white">
                            New
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-[#778381]">{n.message}</p>
                      <div className="mt-2 text-[10px] text-[#98a4a1]">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                  {!n.isRead && (
                    <button
                      onClick={() => onMarkNotificationRead(n.id)}
                      className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-[10px] font-bold text-[#0f7f79] border border-[#e2e8e3] hover:bg-[#e1f3ed]"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* 5. Audit Logs Tab */}
      {isAudit && (
        <Card className="rounded-2xl border-[#e2e8e3] bg-[#fffefa] shadow-[0_12px_35px_rgba(38,71,65,0.05)]">
          <div className="p-5 border-b border-[#edf0ed]">
            <h3 className="text-sm font-bold text-[#304541]">System Audit Log & Traceability</h3>
          </div>
          <div className="divide-y divide-[#edf0ed]">
            {activity.length === 0 ? (
              <div className="px-5 py-10 text-center text-[#98a4a1] text-xs">
                No activity logs recorded yet.
              </div>
            ) : (
              activity.map((act) => (
                <div key={act.id} className="flex items-center justify-between p-4 hover:bg-[#fbfdfb]">
                  <div>
                    <span className="inline-block font-mono text-xs font-bold text-[#0f7f79] bg-[#eef7f4] px-2 py-0.5 rounded mr-2">
                      {act.action}
                    </span>
                    <span className="text-xs text-[#55605d]">
                      {act.entityType} {act.entityId ? `#${act.entityId}` : ""}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#98a4a1] shrink-0 font-mono">
                    {formatDistanceToNow(new Date(act.createdAt), { addSuffix: true })}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* 6. Schools & Users Standard Tables */}
      {(isSchools || isUsers || label === "Reports") && (
        <Card className="rounded-2xl border-[#e2e8e3] bg-[#fffefa] shadow-[0_12px_35px_rgba(38,71,65,0.05)]">
          <div className="flex flex-col gap-3 border-b border-[#edf0ed] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a4a1]" />
              <Input
                placeholder={`Search ${isSchools ? "schools by name or code" : "users"}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 rounded-xl border-[#e2e8e3] pl-9 text-xs shadow-none"
              />
            </div>
            {isSchools && authenticatedUser.role === "SUPER_ADMIN" && (
              <Button
                onClick={onCreate}
                className="h-10 rounded-xl bg-[#0f7f79] px-4 text-xs font-bold text-white hover:bg-[#096c67] self-start sm:self-auto"
              >
                <Building2 className="mr-2 h-4 w-4" /> Add school
              </Button>
            )}
          </div>
          <div className="divide-y divide-[#edf0ed]">
            {isSchools ? (
              schools
                .filter(
                  (s) =>
                    !searchTerm ||
                    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    s.shortCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false),
                )
                .map((school) => (
                  <div key={school.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-[#fbfdfb] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#dff3ee] text-[#0b716b] shrink-0">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-extrabold text-[#304541] flex flex-wrap items-center gap-2">
                          {school.name}
                          <StatusPill tone="teal">Active</StatusPill>
                          {school.templateSelectionStatus === "Selected" ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-[10px] font-bold text-teal-800">
                              <CheckCircle2 className="h-3 w-3 text-teal-600" />
                              Template: {school.selectedTemplateName || "Selected"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                              <AlertTriangle className="h-3 w-3 text-amber-600" />
                              Template: Not Selected
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#8d9995] flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                          <span>Code: <b className="text-[#304541]">{school.shortCode}</b></span>
                          {school.email && <span>Email: {school.email}</span>}
                          {school.phone && <span>Phone: {school.phone}</span>}
                          {school.address && <span>Address: {school.address}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {authenticatedUser.role === "SUPER_ADMIN" && (
                        <>
                          <button
                            onClick={() => onGenerateCredentials?.(school)}
                            className="flex items-center gap-1 rounded-lg border border-[#c3dfd9] bg-[#eef7f4] px-2.5 py-1.5 text-xs font-bold text-[#0f7f79] shadow-sm hover:bg-[#dff1ec]"
                            title="View or regenerate school login credentials and ID pass"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            ID Pass
                          </button>
                          <button
                            onClick={() => onEditSchool?.(school)}
                            className="flex items-center gap-1 rounded-lg border border-[#d3ded8] bg-white px-2.5 py-1.5 text-xs font-bold text-[#304541] shadow-sm hover:bg-[#f2f7f4] hover:text-[#0f7f79]"
                          >
                            <FileEdit className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => onDeleteSchool?.(school.id, school.name)}
                            className="flex items-center gap-1 rounded-lg border border-[#fecaca] bg-white px-2.5 py-1.5 text-xs font-bold text-[#dc2626] shadow-sm hover:bg-[#fef2f2]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
            ) : isUsers ? (
              users.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 hover:bg-[#fbfdfb]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e9ebfa] text-[#5c64b7] font-bold text-xs">
                      {user.name ? user.name[0]?.toUpperCase() : "U"}
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-[#304541]">{user.name || user.email}</div>
                      <div className="text-[10px] text-[#8d9995]">{user.email} · Role: {user.role}</div>
                    </div>
                  </div>
                  <StatusPill tone={user.role === "SUPER_ADMIN" ? "indigo" : "teal"}>
                    {user.role}
                  </StatusPill>
                </div>
              ))
            ) : (
              <div className="px-5 py-10 text-center text-[#98a4a1] text-xs">
                Analytics and summary export reports module.
              </div>
            )}
          </div>
        </Card>
      )}
    </section>
  );
}

