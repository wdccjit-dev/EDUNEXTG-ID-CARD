import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import CardRenderer from "@/components/CardRenderer";
import IdCardFormModal from "./IdCardFormModal";
import PrintModal from "@/components/PrintModal";
import DeleteSchoolDialog from "@/components/DeleteSchoolDialog";
import ExcelUploadModal from "@/components/ExcelUploadModal";
import BulkImageUploadModal from "@/components/BulkImageUploadModal";
import ApprovalTimeline from "@/components/ApprovalTimeline";
import { DYNAMIC_FIELDS, SAMPLE_CARD_DATA, SAMPLE_STAFF_CARD_DATA, type DesignerElement } from "@shared/templateDesigner";
import {
  type LucideIcon,
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  BookOpenCheck,
  Building2,
  Camera,
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
  FileText,
  Filter,
  Grid2X2,
  Info,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MoreHorizontal,
  MoreVertical,
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
  Upload,
  User,
  Users,
  X,
  XCircle,
  ShoppingCart,
  Bell,
  Package,
} from "lucide-react";
import SuperAdminProfileDialog from "@/components/SuperAdminProfileDialog";
import AboutUsSection from "@/components/AboutUsSection";
import SettingsSection from "@/components/SettingsSection";
import AuditLogsSection from "@/components/AuditLogsSection";
import MarketingOverview from "@/components/MarketingOverview";
import CreateOrderView from "@/components/CreateOrderView";
import OrderListView from "@/components/OrderListView";
import RemovedCardsHistorySection from "@/components/RemovedCardsHistorySection";
import NotificationsView from "@/components/NotificationsView";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  type ApiApproval,
  type ApiAuthUser,
} from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  isValidIndianMobileNumber,
  INDIAN_MOBILE_ERROR_MESSAGE,
  INDIAN_MOBILE_PLACEHOLDER,
} from "@shared/phoneValidation";

const navItems = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Schools", icon: Building2 },
  { label: "ID card templates", icon: Palette },
  { label: "ID card requests", icon: ClipboardCheck },
  { label: "Approved cards", icon: FileCheck2 },
  { label: "Orders", icon: ShoppingCart },
  { label: "Reports", icon: Grid2X2 },
  { label: "Users", icon: Users },
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
  | "Audit logs"
  | "About Us"
  | "Orders"
  | "Create Order"
  | "Order List"
  | "Notifications"
  | "Settings";

type Tone = "teal" | "coral" | "indigo" | "yellow";

const toneStyles: Record<Tone, { bg: string; fg: string; border: string }> = {
  teal: { bg: "bg-[#dff3ee] dark:bg-[#0f3d38]", fg: "text-[#0b716b] dark:text-[#40c8bb]", border: "border-[#b7e3d9] dark:border-[#1e5c54]" },
  coral: { bg: "bg-[#fff0e8] dark:bg-[#3d1e16]", fg: "text-[#c65c3d] dark:text-[#f28a63]", border: "border-[#f6cdbb] dark:border-[#5c2a1c]" },
  indigo: { bg: "bg-[#e9ebfa] dark:bg-[#1e223d]", fg: "text-[#5c64b7] dark:text-[#8a94e8]", border: "border-[#cbd0f2] dark:border-[#343b6b]" },
  yellow: { bg: "bg-[#fff8d9] dark:bg-[#3d3314]", fg: "text-[#9d7611] dark:text-[#f2c94c]", border: "border-[#f1dda0] dark:border-[#5c4a17]" },
};

function ToneIcon({
  icon: Icon,
  tone,
  size = "h-4 w-4",
}: {
  icon: LucideIcon;
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
  cardType = "student",
  templateName,
}: {
  accent?: Tone;
  mini?: boolean;
  cardType?: "student" | "staff";
  templateName?: string;
}) {
  const isStaff = cardType === "staff" || (templateName && /staff|teacher|faculty|employee/i.test(templateName));
  const palette = {
    teal: isStaff ? "#1e5b53" : "#2aa89d",
    coral: isStaff ? "#933924" : "#e78362",
    indigo: isStaff ? "#373b75" : "#6d75ce",
    yellow: isStaff ? "#785f1c" : "#d7b545",
  }[accent];

  const bgGradient = isStaff
    ? `linear-gradient(135deg, ${palette} 0%, #0d2222 55%, #081617 100%)`
    : `linear-gradient(135deg, ${palette} 0%, #154847 66%, #123536 100%)`;

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-white/50 shadow-[0_8px_25px_rgba(22,47,44,0.18)] shrink-0 select-none ${
        mini ? "h-[94px] w-[150px]" : "h-[164px] w-[244px]"
      }`}
      style={{
        background: bgGradient,
      }}
    >
      {/* Decorative accent geometry */}
      {isStaff ? (
        <>
          <div className="absolute top-0 right-0 h-full w-1/3 bg-white/[0.04] transform -skew-x-12 pointer-events-none" />
          <div className="absolute -top-6 -left-6 h-24 w-24 rounded-full border-[8px] border-white/10 pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 opacity-90 pointer-events-none" />
        </>
      ) : (
        <>
          <div className="absolute -right-12 -top-10 h-28 w-28 rounded-full border-[16px] border-white/10 pointer-events-none" />
          <div className="absolute bottom-[-38px] left-[-15px] h-28 w-28 rounded-full border-[15px] border-white/10 pointer-events-none" />
        </>
      )}

      <div className={`relative flex h-full flex-col justify-between text-white ${mini ? "p-2.5 pb-2" : "p-3 pb-2.5"}`}>
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`flex items-center justify-center font-extrabold ${
                mini ? "h-5 w-5 text-[8px] rounded" : "h-7 w-7 rounded-md text-[9px]"
              } ${isStaff ? "bg-amber-400 text-slate-900" : "bg-white/90"}`}
              style={!isStaff ? { color: palette } : undefined}
            >
              LP
            </span>
            <div className="leading-tight min-w-0">
              <div className={`font-extrabold uppercase tracking-[0.16em] truncate ${mini ? "text-[7px]" : "text-[8px]"}`}>
                School
              </div>
              <div className={`font-medium uppercase tracking-[0.12em] text-white/70 ${mini ? "text-[5px]" : "text-[6px]"}`}>
                {isStaff ? "Staff ID Card" : "Student ID Card"}
              </div>
            </div>
          </div>
          {isStaff && (
            <span
              className={`font-black uppercase tracking-wider rounded border border-amber-300/40 bg-amber-400/20 text-amber-200 ${
                mini ? "px-1 py-0.2 text-[5px]" : "px-1.5 py-0.5 text-[7px]"
              }`}
            >
              STAFF
            </span>
          )}
        </div>

        <div className="flex items-end justify-between gap-1.5">
          <div className="flex items-end gap-1.5 min-w-0">
            <div
              className={`${
                mini ? "h-8 w-7" : "h-14 w-12"
              } rounded border ${isStaff ? "border-amber-300/40 bg-white/20" : "border-white/40 bg-white/25"} shrink-0`}
            />
            <div className="min-w-0 leading-tight">
              <div className={`font-extrabold truncate ${mini ? "text-[9px]" : "text-[12px]"}`}>
                {isStaff ? "Staff Name" : "Student Name"}
              </div>
              <div className={`uppercase tracking-[0.12em] ${isStaff ? "text-amber-200/80" : "text-white/65"} ${mini ? "mt-0.5 text-[6px]" : "mt-1 text-[7px]"}`}>
                {isStaff ? "Employee ID" : "Student record"}
              </div>
              <div className={`font-mono ${isStaff ? "text-white/80" : "text-white/75"} ${mini ? "mt-0.5 text-[6px]" : "mt-1 text-[7px]"}`}>
                {isStaff ? "EMP-2026-001" : "CARD NUMBER"}
              </div>
            </div>
          </div>
          <QrCode
            className={`shrink-0 ${isStaff ? "text-amber-200/90" : "text-white/80"} ${mini ? "h-5 w-5" : "h-9 w-9"}`}
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
  authenticatedUser: initialAuthenticatedUser,
  portal,
  initialNav = "Overview",
}: {
  authenticatedUser: ApiAuthUser;
  portal: "admin" | "school" | "marketing";
  initialNav?: string;
}) {
  const [authenticatedUser, setAuthenticatedUser] = useState<ApiAuthUser>(initialAuthenticatedUser);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [orderMenuOpen, setOrderMenuOpen] = useState(true);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    if (profileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [profileMenuOpen]);

  const [activeNav, setActiveNav] = useState<NavLabel>(
    (initialNav as NavLabel) || "Overview",
  );

  useEffect(() => {
    if (initialNav) {
      setActiveNav(initialNav as NavLabel);
    }
  }, [initialNav]);

  // Guard for marketing admin & school portal navigation
  useEffect(() => {
    if (portal === "marketing") {
      const allowed = ["Overview", "Orders", "Create Order", "Order List", "Settings", "About Us"];
      if (!allowed.includes(activeNav)) {
        setActiveNav("Overview");
      }
    } else if (portal === "school") {
      if (activeNav === "Reports") {
        setActiveNav("Overview");
      }
    }
  }, [portal, activeNav]);

  const visibleNavItems =
    portal === "marketing"
      ? [
          { label: "Overview", icon: LayoutDashboard },
          { label: "Orders", icon: ShoppingCart },
        ]
      : portal === "admin"
      ? navItems
      : navItems.filter(({ label }) =>
          [
            "Overview",
            "ID card templates",
            "ID card requests",
            "Approved cards",
            "Orders",
          ].includes(label),
        );
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filter, setFilter] = useState<"All" | "Pending" | "Changes required" | "Rejected">(
    "All",
  );
  const [schools, setSchools] = useState<ApiSchool[]>([]);
  const [templates, setTemplates] = useState<ApiTemplate[]>([]);
  const [activity, setActivity] = useState<ApiActivity[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [idCards, setIdCards] = useState<ApiIdCard[]>([]);
  const [approvals, setApprovals] = useState<ApiApproval[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(true);
  const [approveLoading, setApproveLoading] = useState(false);

  // Overview Active Schools display options & filtering
  const [overviewActiveSchoolsLimit, setOverviewActiveSchoolsLimit] = useState<number>(5);
  const activeSchools = useMemo(() => schools.filter((s) => s.isActive), [schools]);
  const displayedActiveSchools = useMemo(
    () => activeSchools.slice(0, overviewActiveSchoolsLimit),
    [activeSchools, overviewActiveSchoolsLimit],
  );

  // Overview Recent Activity display options & filtering
  const [overviewRecentActivityLimit, setOverviewRecentActivityLimit] = useState<number>(5);
  const displayedRecentActivity = useMemo(
    () => activity.slice(0, overviewRecentActivityLimit),
    [activity, overviewRecentActivityLimit],
  );

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
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    shortCode?: string | null;
  } | null>(null);

  // Modal dialog states replacing browser prompts
  const [schoolModalOpen, setSchoolModalOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<ApiSchool | null>(null);
  const [schoolPendingDelete, setSchoolPendingDelete] = useState<{ id: number; name: string; shortCode?: string } | null>(null);
  const [schoolNameInput, setSchoolNameInput] = useState("");
  const [schoolCodeInput, setSchoolCodeInput] = useState("");
  const [schoolEmailInput, setSchoolEmailInput] = useState("");
  const [schoolPhoneInput, setSchoolPhoneInput] = useState("");
  const [schoolAddressInput, setSchoolAddressInput] = useState("");

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState("");

  // User modal (Create / Edit)
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ApiUser | null>(null);
  const [userNameInput, setUserNameInput] = useState("");
  const [userEmailInput, setUserEmailInput] = useState("");
  const [userPasswordInput, setUserPasswordInput] = useState("");
  const [userRoleInput, setUserRoleInput] = useState<"SUPER_ADMIN" | "SCHOOL_ADMIN" | "MARKETING_ADMIN">("SCHOOL_ADMIN");
  const [userSchoolIdInput, setUserSchoolIdInput] = useState<string>("");
  const [userFormErrors, setUserFormErrors] = useState<Partial<Record<"name" | "email" | "password" | "schoolId", string>>>({});

  // Delete User Confirmation
  const [userPendingDelete, setUserPendingDelete] = useState<ApiUser | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

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

  // ID card requests multi-selection
  const [selectedRequestCardIds, setSelectedRequestCardIds] = useState<number[]>([]);
  const [bulkRejectModalOpen, setBulkRejectModalOpen] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState("");
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Preview & template preview
  const [previewModalTemplate, setPreviewModalTemplate] = useState<ApiTemplate | null>(null);
  const [previewModalSide, setPreviewModalSide] = useState<"FRONT" | "BACK">("FRONT");

  // Excel upload modal
  const [excelUploadOpen, setExcelUploadOpen] = useState(false);
  // Bulk photo upload modal
  const [bulkPhotoUploadOpen, setBulkPhotoUploadOpen] = useState(false);

  const handleDownloadExampleExcel = async (templateId?: number, cardType?: string) => {
    try {
      const targetTemplateId = templateId || currentActiveSchool?.selectedTemplateId || undefined;
      const targetSchoolId = currentActiveSchool?.id || authenticatedUser.schoolId || undefined;
      const blob = await api.requests.downloadExampleExcel({
        templateId: targetTemplateId,
        schoolId: targetSchoolId,
        cardType,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const label = cardType === "staff" ? "Staff" : "Student";
      a.download = `ID_Card_${label}_Template_${targetTemplateId || "Standard"}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`${label} example Excel file downloaded successfully`);
    } catch (err: any) {
      toast.error("Download failed", {
        description: err instanceof Error ? err.message : "Failed to download example Excel",
      });
    }
  };

  const reloadWorkspace = async () => {
    try {
      const [nextCards, nextApprovals, nextActivity] = await Promise.all([
        api.idCards.list(),
        api.approvals.list().catch(() => []),
        api.auditLogs.list().catch(() => []),
      ]);
      setIdCards(nextCards);
      setApprovals(nextApprovals);
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
          nextApprovals,
        ] = await Promise.all([
          api.schools.list(),
          api.templates.list(),
          api.auditLogs.list().catch(() => []),
          api.users.list().catch(() => []),
          api.idCards.list().catch(() => []),
          api.approvals.list().catch(() => []),
        ]);
        setSchools(nextSchools);
        setTemplates(nextTemplates);
        setActivity(nextActivity);
        setUsers(nextUsers);
        setIdCards(nextCards);
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

  const schoolApprovals = useMemo(() => {
    if (!activeSchoolId) return approvals;
    return approvals.filter((item) => item.schoolId === activeSchoolId);
  }, [approvals, activeSchoolId]);

  const schoolIdCards = useMemo(() => {
    if (!activeSchoolId) return idCards;
    return idCards.filter((card) => card.schoolId === activeSchoolId);
  }, [idCards, activeSchoolId]);

  const pendingRequests = useMemo(
    () => schoolApprovals.filter((item) => item.status !== "APPROVED" && item.status !== "PRINTED"),
    [schoolApprovals],
  );

  const filteredApprovals = useMemo(
    () =>
      pendingRequests
        .filter((item) => {
          if (filter === "All") return true;
          if (filter === "Pending") {
            return (
              item.status === "SUBMITTED" ||
              item.status === "UNDER_REVIEW" ||
              item.status === "RESUBMITTED"
            );
          }
          if (filter === "Changes required") {
            return item.status === "CHANGES_REQUIRED";
          }
          if (filter === "Rejected") {
            return item.status === "REJECTED";
          }
          return true;
        })
        .filter(
          (item) =>
            item.studentName.toLowerCase().includes(query.toLowerCase()) ||
            item.schoolName.toLowerCase().includes(query.toLowerCase()) ||
            (item.admissionCode && item.admissionCode.toLowerCase().includes(query.toLowerCase())),
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
    } catch (error) {
      console.error("Logout error", error);
    } finally {
      try {
        sessionStorage.clear();
        localStorage.clear();
        sessionStorage.setItem("just_logged_out", "1");
      } catch {}
      window.location.replace("/login");
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

  const handleToggleSchoolStatus = async (school: ApiSchool) => {
    if (authenticatedUser.role !== "SUPER_ADMIN") {
      return toast.error("Only Super Admins can manage school status");
    }
    const nextStatus = !school.isActive;
    setSchools((prev) =>
      prev.map((s) => (s.id === school.id ? { ...s, isActive: nextStatus } : s))
    );
    try {
      await api.schools.setStatus(school.id, nextStatus);
      toast.success(`School "${school.name}" is now ${nextStatus ? "Active" : "Inactive"}`);
      const freshSchools = await api.schools.list().catch(() => null);
      if (freshSchools) setSchools(freshSchools);
    } catch (err) {
      setSchools((prev) =>
        prev.map((s) => (s.id === school.id ? { ...s, isActive: school.isActive } : s))
      );
      toast.error("Could not update school status", {
        description: err instanceof Error ? err.message : "Request failed",
      });
    }
  };

  // Opens the confirmation dialog (both delete buttons call this). The actual deletion
  // happens in confirmDeleteSchool once the user has typed the school name.
  const handleDeleteSchool = (schoolId: number, schoolName: string) => {
    if (authenticatedUser.role !== "SUPER_ADMIN") {
      toast.error("Only Super Admins can delete schools");
      return;
    }
    const school = schools.find((s) => s.id === schoolId);
    setSchoolPendingDelete({ id: schoolId, name: schoolName, shortCode: school?.shortCode });
  };

  // Deletes on the server FIRST; the UI only changes after the server confirms.
  // Throws on failure so DeleteSchoolDialog stays open.
  const confirmDeleteSchool = async (school: { id: number; name: string }) => {
    try {
      const result = await api.schools.delete(school.id);
      const cardCount = result?.deleted?.cards;
      const [freshSchools, freshUsers] = await Promise.all([
        api.schools.list().catch(() => null),
        api.users.list().catch(() => null),
      ]);
      if (freshSchools) {
        setSchools(freshSchools);
      } else {
        setSchools((prev) => prev.filter((s) => s.id !== school.id));
      }
      if (freshUsers) {
        setUsers(freshUsers);
      } else {
        setUsers((prev) => prev.filter((u) => u.schoolId !== school.id));
      }
      if (selectedSchoolId === school.id) {
        const remaining = (freshSchools ?? schools.filter((s) => s.id !== school.id));
        setSelectedSchoolId(remaining[0]?.id ?? null);
      }
      setSchoolPendingDelete(null);
      toast.success(
        typeof cardCount === "number"
          ? `School "${school.name}" and its ${cardCount} ID card${cardCount === 1 ? "" : "s"} were deleted`
          : `School "${school.name}" and all its ID cards were deleted`,
      );
    } catch (error) {
      toast.error("Could not delete school", {
        description: error instanceof Error ? error.message : "Request failed",
      });
      throw error;
    }
  };

  const handleClearActivity = async () => {
    if (authenticatedUser.role !== "SUPER_ADMIN") {
      return toast.error("Only administrators can clear audit logs");
    }
    try {
      await api.auditLogs.clear();
      setActivity([]);
      toast.success("Recent activity cleared");
    } catch (err) {
      toast.error("Failed to clear recent activity", {
        description: err instanceof Error ? err.message : "Request failed",
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
        // Background sync to ensure total synchronization
        const freshSchools = await api.schools.list().catch(() => null);
        if (freshSchools) setSchools(freshSchools);
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
        // Refresh users list so new school user immediately appears in Users
        const freshUsers = await api.users.list().catch(() => []);
        setUsers(freshUsers);
        if (created.credentials) {
          setCredentialsData({
            schoolName: created.name,
            loginId: created.credentials.loginId,
            password: created.credentials.password,
            email: created.email,
            phone: created.phone,
            address: created.address,
            shortCode: created.shortCode,
          });
          setCredentialsModalOpen(true);
        }
      }
    } catch (error) {
      if (editingSchool) {
        const fresh = await api.schools.list().catch(() => null);
        if (fresh) setSchools(fresh);
      }
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
      setSchools((items) =>
        items.map((item) =>
          item.id === school.id ? { ...item, credentials: creds.credentials } : item,
        ),
      );
      setCredentialsData({
        schoolName: school.name,
        loginId: creds.credentials.loginId,
        password: creds.credentials.password,
        email: school.email,
        phone: school.phone,
        address: school.address,
        shortCode: school.shortCode,
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
    if (authenticatedUser.role !== "SUPER_ADMIN") {
      return toast.error("Only administrators can create users");
    }
    setEditingUser(null);
    setUserNameInput("");
    setUserEmailInput("");
    setUserPasswordInput("");
    setUserRoleInput("SCHOOL_ADMIN");
    setUserSchoolIdInput(activeSchoolId ? String(activeSchoolId) : schools[0] ? String(schools[0].id) : "");
    setUserFormErrors({});
    setUserModalOpen(true);
  };

  const openEditUser = (user: ApiUser) => {
    if (authenticatedUser.role !== "SUPER_ADMIN") {
      return toast.error("Only administrators can edit users");
    }
    setEditingUser(user);
    setUserNameInput(user.name || "");
    setUserEmailInput(user.email || "");
    setUserPasswordInput(""); // Blank = keep existing password
    setUserRoleInput(
      user.role === "SUPER_ADMIN" || user.role === "SCHOOL_ADMIN" || user.role === "MARKETING_ADMIN"
        ? user.role
        : "SCHOOL_ADMIN"
    );
    setUserSchoolIdInput(user.schoolId ? String(user.schoolId) : schools[0] ? String(schools[0].id) : "");
    setUserFormErrors({});
    setUserModalOpen(true);
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: typeof userFormErrors = {};
    const email = userEmailInput.trim();

    if (!userNameInput.trim()) errors.name = "Full name is required.";
    if (!email) {
      errors.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Enter a valid email address.";
    }
    if (!editingUser) {
      if (!userPasswordInput) {
        errors.password = "Temporary password is required.";
      } else if (userPasswordInput.length < 8) {
        errors.password = "Password must be at least 8 characters.";
      }
    } else if (userPasswordInput && userPasswordInput.length < 8) {
      errors.password = "Password must be at least 8 characters.";
    }
    if (userRoleInput === "SCHOOL_ADMIN" && (!userSchoolIdInput || !Number(userSchoolIdInput))) {
      errors.schoolId = "Select a school for the School Admin.";
    }

    setUserFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      if (editingUser) {
        const payload: any = {
          name: userNameInput.trim(),
          email: userEmailInput.trim().toLowerCase(),
          role: userRoleInput,
          schoolId: userRoleInput === "SCHOOL_ADMIN" ? Number(userSchoolIdInput) : null,
        };
        if (userPasswordInput) {
          payload.password = userPasswordInput;
        }
        const updated = await api.users.update(editingUser.id, payload);
        setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? { ...u, ...updated } : u)));
        setUserModalOpen(false);
        setEditingUser(null);
        toast.success(`User ${updated.name || updated.email} updated successfully`);
      } else {
        const created = await api.users.create({
          name: userNameInput.trim(),
          email: userEmailInput.trim().toLowerCase(),
          password: userPasswordInput,
          role: userRoleInput,
          schoolId: userRoleInput === "SCHOOL_ADMIN" ? Number(userSchoolIdInput) : undefined,
        });
        setUsers((prev) => [created, ...prev]);
        setUserModalOpen(false);
        toast.success(`User ${created.name || created.email} created successfully`);
      }
    } catch (error) {
      toast.error(editingUser ? "Could not update user" : "Could not create user", {
        description: error instanceof Error ? error.message : "Request failed",
      });
    }
  };

  const handleDeleteUser = (user: ApiUser) => {
    if (authenticatedUser.role !== "SUPER_ADMIN") {
      return toast.error("Only administrators can delete users");
    }
    if (authenticatedUser.id === user.id) {
      return toast.error("You cannot delete your own account");
    }
    setUserPendingDelete(user);
  };

  const confirmDeleteUser = async () => {
    if (!userPendingDelete) return;
    try {
      setDeletingUser(true);
      await api.users.delete(userPendingDelete.id);
      setUsers((prev) => prev.filter((u) => u.id !== userPendingDelete.id));
      toast.success(`User ${userPendingDelete.name || userPendingDelete.openId} deleted successfully`);
      setUserPendingDelete(null);
    } catch (error) {
      toast.error("Could not delete user", {
        description: error instanceof Error ? error.message : "Request failed",
      });
    } finally {
      setDeletingUser(false);
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

  const handleDeleteCard = async (cardId: number, num: string, status?: string) => {
    const isRejected = status === "REJECTED";
    const promptMsg = isRejected
      ? `Are you sure you want to permanently delete rejected card ${num}? It will be removed from both the admin and school sides.`
      : `Are you sure you want to delete draft card ${num}?`;
    if (!confirm(promptMsg)) return;
    try {
      await api.idCards.delete(cardId);
      toast.success(isRejected ? `Rejected card ${num} deleted` : `Draft card ${num} deleted`);
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

  const handleRemoveApprovedCards = async (cardIds: number[]) => {
    const res = await api.idCards.bulkRemoveApproved(cardIds);
    setIdCards((prev) => prev.filter((c) => !cardIds.includes(c.id)));
    setSelectedApprovedCardIds((prev) => prev.filter((id) => !cardIds.includes(id)));
    toast.success(
      portal === "admin"
        ? `Removed ${res.removedCount} card(s) from Approved cards. Moved to Reports history.`
        : `Removed ${res.removedCount} card(s) from Approved cards.`
    );
  };

  const handleToggleSelectRequest = (cardId: number) => {
    setSelectedRequestCardIds((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId],
    );
  };

  const handleSelectAllRequests = (allIds: number[]) => {
    setSelectedRequestCardIds((prev) =>
      prev.length === allIds.length ? [] : [...allIds],
    );
  };

  const handleBulkApproveRequests = async () => {
    if (selectedRequestCardIds.length === 0) {
      return toast.error("Please select at least one card to approve");
    }
    if (!window.confirm(`Are you sure you want to approve ${selectedRequestCardIds.length} selected ID card(s)?`)) {
      return;
    }
    setBulkActionLoading(true);
    try {
      const res = await api.approvals.bulkApprove(selectedRequestCardIds);
      toast.success(`${res.processed} ID card(s) approved successfully!`);
      setSelectedRequestCardIds([]);
      reloadWorkspace();
    } catch (e) {
      toast.error("Bulk approval failed", {
        description: e instanceof Error ? e.message : "Request failed",
      });
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkRejectRequestsSubmit = async () => {
    if (selectedRequestCardIds.length === 0) {
      return toast.error("Please select at least one card to reject");
    }
    if (!bulkRejectReason.trim()) {
      return toast.error("Please provide a rejection reason");
    }
    setBulkActionLoading(true);
    try {
      const res = await api.approvals.bulkReject(selectedRequestCardIds, bulkRejectReason.trim());
      toast.success(`${res.processed} ID card(s) rejected successfully`);
      setBulkRejectModalOpen(false);
      setBulkRejectReason("");
      setSelectedRequestCardIds([]);
      reloadWorkspace();
    } catch (e) {
      toast.error("Bulk rejection failed", {
        description: e instanceof Error ? e.message : "Request failed",
      });
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleClearAuditLogs = async () => {
    if (activity.length === 0) return;
    if (!window.confirm("Are you sure you want to clear all audit logs?")) return;
    try {
      await api.auditLogs.clear();
      setActivity([]);
      toast.success("Audit logs cleared successfully");
    } catch (err) {
      toast.error("Failed to clear audit logs", {
        description: err instanceof Error ? err.message : "Request failed",
      });
    }
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

  const handleUnselectTemplate = async () => {
    if (authenticatedUser.role === "VIEWER") {
      return toast.error("Viewer accounts are read-only");
    }
    const schoolId = activeSchoolId;
    if (!schoolId) {
      return toast.error("No school selected");
    }
    try {
      await api.schoolTemplates.unselect(schoolId);
      toast.success(`Template unselected for ${currentActiveSchool?.name ?? `School #${schoolId}`}`);
      const freshSchools = await api.schools.list();
      setSchools(freshSchools);
    } catch (error) {
      toast.error("Could not unselect template", {
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
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="min-h-screen app-shell bg-background text-foreground">
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[244px] flex-col bg-[#102728] text-[#dfecea] transition-transform duration-200 lg:translate-x-0 overflow-y-auto overflow-x-hidden [scrollbar-width:thin] [scrollbar-color:#294344_transparent] ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="flex h-[76px] shrink-0 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white p-1 shadow-sm">
              <img
                src="/insight-education-logo.png"
                alt="Insight Education"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <div className="text-[15.5px] font-bold tracking-tight leading-tight select-none font-serif drop-shadow-sm">
                <span className="bg-gradient-to-r from-[#007a3d] via-[#109648] to-[#22ab55] bg-clip-text text-transparent font-extrabold">
                  Insight{" "}
                </span>
                <span className="bg-gradient-to-r from-[#ea580c] via-[#f97316] to-[#fb923c] bg-clip-text text-transparent font-extrabold">
                  Education
                </span>
              </div>
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#7fa09c] mt-0.5">
                {portal === "admin" ? "admin console" : portal === "marketing" ? "marketing portal" : "school portal"}
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

        <div className="px-5 pt-2 shrink-0">
          <div className="mb-3 px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#6e928d]">
            workspace
          </div>
          <nav className="space-y-1">
            {visibleNavItems.map(({ label, icon: Icon }) => {
              if (label === "Orders") {
                const isOrderActive = activeNav === "Create Order" || activeNav === "Order List";
                return (
                  <div key="Orders" className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setOrderMenuOpen((prev) => !prev)}
                      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[12px] font-semibold transition-colors ${
                        isOrderActive
                          ? "bg-[#1b3a3a] text-white"
                          : "text-[#99b6b2] hover:bg-[#1b3a3a] hover:text-white"
                      }`}
                    >
                      <ShoppingCart
                        className={`h-[17px] w-[17px] ${isOrderActive ? "text-[#0f7f79]" : "text-[#779b96]"}`}
                        strokeWidth={isOrderActive ? 2.3 : 1.8}
                      />
                      <span className="flex-1">Order</span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform text-[#779b96] ${orderMenuOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {orderMenuOpen && (
                      <div className="pl-6 space-y-1">
                        <button
                          type="button"
                          onClick={() => goTo("Create Order")}
                          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-semibold transition-colors ${
                            activeNav === "Create Order"
                              ? "bg-[#dff3ee] text-[#123b3b]"
                              : "text-[#8ea9a5] hover:bg-[#183434] hover:text-white"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              activeNav === "Create Order" ? "bg-[#0f7f79]" : "bg-[#597874]"
                            }`}
                          />
                          <span>Create Order</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => goTo("Order List")}
                          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-semibold transition-colors ${
                            activeNav === "Order List"
                              ? "bg-[#dff3ee] text-[#123b3b]"
                              : "text-[#8ea9a5] hover:bg-[#183434] hover:text-white"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              activeNav === "Order List" ? "bg-[#0f7f79]" : "bg-[#597874]"
                            }`}
                          />
                          <span>Order List</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

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
            {/* About Us directly above Settings */}
            <button
              onClick={() => goTo("About Us")}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[12px] font-semibold transition-colors ${activeNav === "About Us"
                ? "bg-[#dff3ee] text-[#123b3b]"
                : "text-[#99b6b2] hover:bg-[#1b3a3a] hover:text-white"
                }`}
            >
              <Info
                className={`h-[17px] w-[17px] ${activeNav === "About Us" ? "text-[#0f7f79]" : "text-[#779b96]"
                  }`}
                strokeWidth={activeNav === "About Us" ? 2.3 : 1.8}
              />
              <span className="flex-1 text-left">About Us</span>
            </button>

            <button
              onClick={() => goTo("Settings")}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[12px] font-semibold transition-colors ${activeNav === "Settings"
                ? "bg-[#dff3ee] text-[#123b3b]"
                : "text-[#99b6b2] hover:bg-[#1b3a3a] hover:text-white"
                }`}
            >
              <Settings2
                className={`h-[17px] w-[17px] ${activeNav === "Settings" ? "text-[#0f7f79]" : "text-[#779b96]"
                  }`}
                strokeWidth={activeNav === "Settings" ? 2.3 : 1.8}
              />
              <span className="flex-1 text-left">Settings</span>
            </button>
          </nav>
          <div className="flex items-center justify-between border-t border-[#294344] py-4">
            <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#6e928d]">
              Insight Education v2.0
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
        <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-border bg-background/90 px-3 sm:px-8 lg:px-11 backdrop-blur-xl">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-card lg:hidden shrink-0"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              {activeNav === "Overview" && (
                <h1 className="text-base sm:text-[22px] font-extrabold tracking-[-0.05em] truncate">
                  {`${getGreeting()}, ${authenticatedUser.name?.split(" ")[0] ?? "there"}`}
                </h1>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Super Admin School Dropdown Selector */}
            {authenticatedUser.role === "SUPER_ADMIN" && schools.length > 0 && (
              <div className="flex items-center gap-1.5 sm:gap-2 rounded-xl border border-border bg-card px-2 sm:px-3 py-1.5 shadow-sm max-w-[150px] xs:max-w-[180px] sm:max-w-none">
                <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="hidden md:inline text-[11px] font-bold text-muted-foreground">School:</span>
                <Select
                  value={selectedSchoolId ? String(selectedSchoolId) : ""}
                  onValueChange={(val) => {
                    const id = Number(val);
                    setSelectedSchoolId(id);
                    const sch = schools.find((s) => s.id === id);
                    toast.success(`Active school set to ${sch?.name ?? `School #${id}`}`);
                  }}
                >
                  <SelectTrigger className="h-7 border-0 bg-transparent px-1 sm:px-2 text-xs font-extrabold text-foreground shadow-none focus-visible:ring-0 max-w-[100px] xs:max-w-[130px] sm:max-w-[200px] truncate">
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
            {portal !== "marketing" &&
              authenticatedUser.role === "SCHOOL_ADMIN" &&
              (authenticatedUser.schoolName || authenticatedUser.schoolId) && (
                <div className="hidden items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-extrabold text-primary sm:flex">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>
                    {authenticatedUser.schoolName ??
                      `School #${authenticatedUser.schoolId}`}
                  </span>
                </div>
              )}


            <div ref={profileMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setProfileMenuOpen((prev) => !prev)}
                title="Profile Menu"
                aria-label="Profile Menu"
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                className="flex items-center gap-2 rounded-xl border border-border bg-card p-1.5 pr-2.5 text-xs font-bold text-foreground shadow-sm transition hover:border-primary/50 hover:bg-accent cursor-pointer"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#f5c87b] text-xs font-extrabold text-[#5c4523]">
                  {authenticatedUser.avatarUrl ? (
                    <img
                      src={authenticatedUser.avatarUrl}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initialsFor(
                      authenticatedUser.name ??
                      authenticatedUser.email ??
                      (authenticatedUser.role === "SUPER_ADMIN" ? "Admin" : "User"),
                    )
                  )}
                </div>
                <span className="hidden sm:inline font-bold text-xs">
                  {authenticatedUser.name?.split(" ")[0] ?? (authenticatedUser.role === "SUPER_ADMIN" ? "Admin" : "User")}
                </span>
                <ChevronDown
                  className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${profileMenuOpen ? "rotate-180" : ""
                    }`}
                />
              </button>

              {profileMenuOpen && (
                <div
                  role="menu"
                  aria-orientation="vertical"
                  className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-border bg-popover text-popover-foreground p-1.5 shadow-[0_12px_32px_rgba(31,55,51,0.12)] z-50 animate-in fade-in zoom-in-95 duration-100"
                >
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      if (authenticatedUser.role === "SUPER_ADMIN" || authenticatedUser.role === "MARKETING_ADMIN") {
                        setProfileModalOpen(true);
                      } else {
                        toast.info("Profile details are managed by your administrator.");
                      }
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-semibold text-foreground transition hover:bg-accent hover:text-primary cursor-pointer"
                  >
                    <User className="h-3.5 w-3.5 text-primary" />
                    <span>Edit Profile</span>
                  </button>
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      void logout();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-semibold text-destructive transition hover:bg-destructive/10 cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5 text-destructive" />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] px-4 pb-12 pt-6 sm:px-6 lg:px-9">
          {activeNav === "Overview" ? (
            portal === "marketing" ? (
              <MarketingOverview
                user={authenticatedUser}
                onNavigate={(tab) => goTo(tab)}
                onViewOrder={() => goTo("Order List")}
              />
            ) : (
            <>
              <section className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-primary">
                    <Sparkles className="h-3.5 w-3.5" /> Your platform at a glance
                  </div>
                  <h2 className="max-w-xl text-3xl font-extrabold leading-[1.05] tracking-[-0.06em] sm:text-[38px]">
                    Keep every card moving{" "}
                    <span className="text-primary">forward.</span>
                  </h2>
                  <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
                    Manage school identity, approvals, and print-ready cards from
                    one calm workspace.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {authenticatedUser.role === "SUPER_ADMIN" && (
                    <Button
                      onClick={openCreateSchool}
                      className="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground shadow-[0_8px_18px_rgba(15,127,121,0.18)] hover:bg-primary/90"
                    >
                      <Building2 className="mr-2 h-4 w-4" /> Add school
                    </Button>
                  )}
                  {authenticatedUser.role === "SUPER_ADMIN" && (
                    <Button
                      onClick={openCreateTemplate}
                      variant="outline"
                      className="h-10 rounded-xl border-border bg-card px-4 text-xs font-bold text-foreground shadow-sm hover:bg-accent"
                    >
                      <Palette className="mr-2 h-4 w-4" /> New template
                    </Button>
                  )}
                  {authenticatedUser.role === "SUPER_ADMIN" ? (
                    <Button
                      onClick={openCreateCard}
                      className="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                    >
                      <FilePlus2 className="mr-2 h-4 w-4" /> Create card
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={() => goTo("ID card templates")}
                        variant="outline"
                        className="h-10 rounded-xl border-border bg-card px-4 text-xs font-bold text-foreground shadow-sm hover:bg-accent"
                      >
                        <Palette className="mr-2 h-4 w-4" /> Select Template
                      </Button>
                      <Button
                        onClick={() => goTo("ID card requests")}
                        className="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                      >
                        <ClipboardCheck className="mr-2 h-4 w-4" /> Review ID Cards
                      </Button>
                    </>
                  )}
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label={authenticatedUser.role === "SUPER_ADMIN" ? "Active schools" : "My School"}
                  value={
                    authenticatedUser.role === "SUPER_ADMIN"
                      ? String(schools.filter((school) => school.isActive).length)
                      : (currentActiveSchool?.shortCode || "Connected")
                  }
                  change="Click to view"
                  icon={Building2}
                  tone="teal"
                  onClick={() => {
                    if (authenticatedUser.role === "SUPER_ADMIN") {
                      goTo("Schools");
                    } else {
                      goTo("ID card requests");
                    }
                  }}
                />
                <MetricCard
                  label="Cards in review"
                  value={String(pendingRequests.length)}
                  change="Click to view"
                  icon={Clock3}
                  tone="coral"
                  onClick={() => goTo("ID card requests")}
                />
                <MetricCard
                  label="Approved cards"
                  value={String(
                    schoolApprovals.filter((request) => request.status === "APPROVED").length,
                  )}
                  change="Click to view"
                  icon={FileCheck2}
                  tone="indigo"
                  onClick={() => goTo("Approved cards")}
                />
                <MetricCard
                  label="Templates"
                  value={String(templates.length)}
                  change="Click to view"
                  icon={Palette}
                  tone="yellow"
                  onClick={() => goTo("ID card templates")}
                />
              </section>

              <section
                className={`mt-6 grid gap-5 ${authenticatedUser.role === "SUPER_ADMIN"
                    ? "xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]"
                    : "grid-cols-1"
                  }`}
              >
                <Card className="overflow-hidden ui-card rounded-2xl border-border bg-card text-card-foreground shadow-[0_14px_40px_rgba(38,71,65,0.05)]">
                  <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 pb-3 pt-5 sm:pt-6">
                    <div>
                      <CardTitle className="text-[15px] font-extrabold tracking-[-0.02em]">
                        Approval queue
                      </CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Cards waiting for your review
                      </p>
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1 sm:pb-0 [scrollbar-width:none]">
                      <div className="flex rounded-lg border border-border bg-muted/40 p-0.5 shrink-0">
                        {(["All", "Pending", "Changes required", "Rejected"] as const).map(
                          (item) => (
                            <button
                              key={item}
                              onClick={() => setFilter(item)}
                              className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold whitespace-nowrap ${filter === item
                                ? "bg-card text-primary shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                              {item}
                            </button>
                          ),
                        )}
                      </div>
                      <button
                        onClick={() => toast("Filters opened")}
                        className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-accent shrink-0"
                        title="Filter options"
                        aria-label="Filter options"
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="px-0">
                    {approvalsLoading ? (
                      <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                        Loading requests…
                      </div>
                    ) : Boolean(apiError) ? (
                      <div className="px-6 py-10 text-center text-sm text-[#c65c3d]">
                        Couldn't load requests: {apiError}
                      </div>
                    ) : (
                      <>
                        <div className="overflow-x-auto [scrollbar-width:thin] max-w-full">
                          <table className="w-full min-w-[620px] text-left">
                            <thead>
                              <tr className="border-y border-border bg-muted/40 text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
                                <th className="px-6 py-3 font-bold">Card holder</th>
                                <th className="px-4 py-3 font-bold">School</th>
                                <th className="px-4 py-3 font-bold">Submitted</th>
                                <th className="px-4 py-3 font-bold">Status</th>
                                <th className="px-6 py-3 text-right font-bold">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredApprovals.slice(0, 4).map((item) => (
                                <tr
                                  key={item.id}
                                  className="group border-b border-border last:border-0 hover:bg-muted/30"
                                >
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                      <div
                                        className={`flex h-9 w-9 items-center justify-center rounded-xl text-[10px] font-extrabold ${toneStyles[item.tone].bg} ${toneStyles[item.tone].fg}`}
                                      >
                                        {item.initials}
                                      </div>
                                      <div>
                                        <div className="text-xs font-extrabold text-foreground">
                                          {item.studentName}
                                        </div>
                                        <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                                          {item.admissionCode}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 text-xs font-semibold text-muted-foreground">
                                    {item.schoolName}
                                  </td>
                                  <td className="px-4 py-4 text-[11px] text-muted-foreground">
                                    {item.submitted}
                                  </td>
                                  <td className="px-4 py-4">
                                    {item.status === "SUBMITTED" ? (
                                      <StatusPill tone="yellow">Pending review</StatusPill>
                                    ) : item.status === "UNDER_REVIEW" ? (
                                      <StatusPill tone="yellow">Under review</StatusPill>
                                    ) : item.status === "RESUBMITTED" ? (
                                      <StatusPill tone="yellow">Resubmitted</StatusPill>
                                    ) : item.status === "CHANGES_REQUIRED" ? (
                                      <div>
                                        <StatusPill tone="coral">Changes requested</StatusPill>
                                        {item.reviewNote && (
                                          <p className="mt-1 text-[10px] text-[#b35338] max-w-[160px] truncate" title={item.reviewNote}>
                                            {item.reviewNote}
                                          </p>
                                        )}
                                      </div>
                                    ) : item.status === "REJECTED" ? (
                                      <div>
                                        <StatusPill tone="coral">Rejected</StatusPill>
                                        {item.reviewNote && (
                                          <p className="mt-1 text-[10px] text-[#c65c3d] max-w-[160px] truncate" title={item.reviewNote}>
                                            {item.reviewNote}
                                          </p>
                                        )}
                                      </div>
                                    ) : item.status === "APPROVED" ? (
                                      <StatusPill tone="teal">Approved</StatusPill>
                                    ) : (
                                      <StatusPill tone="indigo">{item.status.replace(/_/g, " ")}</StatusPill>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    {(authenticatedUser.role === "SUPER_ADMIN" ||
                                      authenticatedUser.schoolId === item.schoolId) &&
                                      (item.status === "SUBMITTED" ||
                                        item.status === "UNDER_REVIEW" ||
                                        item.status === "RESUBMITTED") && (
                                        <button
                                          disabled={approveLoading}
                                          onClick={() => approve(item.id, item.studentName)}
                                          className="rounded-lg bg-primary/15 px-3 py-2 text-[10px] font-extrabold text-primary transition-colors hover:bg-primary/25 disabled:opacity-50"
                                        >
                                          Approve
                                        </button>
                                      )}
                                    <button
                                      onClick={() => handleOpenReview(item.cardId || item.id)}
                                      className="ml-1 rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
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
                          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                            No cards match your search.
                          </div>
                        )}
                        <div className="flex items-center justify-between border-t border-border px-6 py-4">
                          <span className="font-mono text-[10px] text-muted-foreground">
                            Showing {Math.min(filteredApprovals.length, 4)} of {pendingRequests.length} requests
                          </span>
                          <button
                            onClick={() => goTo("ID card requests")}
                            className="flex items-center gap-1 text-[11px] font-extrabold text-primary hover:underline"
                          >
                            View all requests <ArrowUpRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {authenticatedUser.role === "SUPER_ADMIN" && (
                  <Card className="ui-card rounded-2xl border-border bg-card text-card-foreground shadow-[0_14px_40px_rgba(38,71,65,0.05)]">
                    <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 pb-2 pt-6">
                      <div>
                        <CardTitle className="text-[15px] font-extrabold tracking-[-0.02em]">
                          Recent activity
                        </CardTitle>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Showing {displayedRecentActivity.length} of {activity.length} actions
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <label htmlFor="overview-activity-limit" className="text-xs font-semibold text-muted-foreground">
                            Show:
                          </label>
                          <select
                            id="overview-activity-limit"
                            aria-label="Display count for recent activity"
                            value={overviewRecentActivityLimit}
                            onChange={(e) => setOverviewRecentActivityLimit(Number(e.target.value))}
                            className="h-8 rounded-xl border border-border bg-card px-2.5 text-xs font-bold text-foreground shadow-sm hover:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                          >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                          </select>
                        </div>
                        {activity.length > 0 && authenticatedUser.role === "SUPER_ADMIN" && (
                          <button
                            onClick={() => void handleClearActivity()}
                            className="text-[10px] font-extrabold text-[#dc2626] hover:underline cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                        <button
                          onClick={() => goTo("Audit logs")}
                          className="text-[10px] font-extrabold text-primary hover:underline cursor-pointer"
                        >
                          View log
                        </button>
                      </div>
                    </CardHeader>
                    <CardContent className="px-6 pb-6 pt-4">
                      {displayedRecentActivity.length === 0 ? (
                        <div className="py-8 text-center text-xs text-muted-foreground">
                          No recent activity entries.
                        </div>
                      ) : (
                        <div className="space-y-5">
                          {displayedRecentActivity.map((item) => (
                            <div key={item.id} className="flex gap-3">
                              <ToneIcon icon={BookOpenCheck} tone="teal" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="text-xs font-extrabold text-foreground">
                                    {item.action.replaceAll("_", " ")}
                                  </div>
                                  <span className="whitespace-nowrap font-mono text-[9px] text-muted-foreground">
                                    {formatDistanceToNow(new Date(item.createdAt), {
                                      addSuffix: true,
                                    })}
                                  </span>
                                </div>
                                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                                  {item.schoolName ? <span className="font-semibold text-primary">{item.schoolName}: </span> : null}
                                  {(item.newValues as any)?.templateName ? `Template "${(item.newValues as any).templateName}"` : null}
                                  {(item.newValues as any)?.studentName ? `Card ${(item.newValues as any)?.cardNumber || ""} for ${(item.newValues as any).studentName}` : null}
                                  {!((item.newValues as any)?.templateName) && !((item.newValues as any)?.studentName) ? `${item.entityType} #${item.entityId ?? "-"}` : ""}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {apiError ? (
                        <div className="mt-6 rounded-xl border border-dashed border-[#fca5a5] bg-[#fff5f5] dark:bg-destructive/10 p-3 text-center">
                          <div className="text-[10px] text-destructive">{apiError}</div>
                        </div>
                      ) : (
                        <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/30 p-3 text-center">
                          <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                            All systems operational
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </section>

              <section className="mt-7 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <Card className="ui-card rounded-2xl border-border bg-card text-card-foreground shadow-[0_14px_40px_rgba(38,71,65,0.05)]">
                  <CardHeader className="flex flex-row items-start justify-between px-6 pb-3 pt-6">
                    <div>
                      <CardTitle className="text-[15px] font-extrabold tracking-[-0.02em]">
                        Template library
                      </CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Active designs across your network
                      </p>
                    </div>
                    <button
                      onClick={() => goTo("ID card templates")}
                      className="text-[10px] font-extrabold text-primary hover:underline"
                    >
                      Manage templates
                    </button>
                  </CardHeader>
                  <CardContent className="space-y-3 px-6 pb-6">
                    {templates.slice(0, 3).map((template) => (
                      <div
                        key={template.name}
                        className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3"
                      >
                        <CardPreview
                          accent={template.accent as Tone}
                          mini
                          cardType={template.cardType}
                          templateName={template.name}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="truncate text-xs font-extrabold text-foreground">
                              {template.name}
                            </div>
                            {template.status === "ACTIVE" ? (
                              <StatusPill tone="teal">Active</StatusPill>
                            ) : (
                              <StatusPill tone="indigo">Draft</StatusPill>
                            )}
                          </div>
                          <div className="mt-1 text-[10px] text-muted-foreground">
                            {template.meta ??
                              template.description ??
                              "No description"}
                          </div>
                          <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
                            {template.status}
                          </div>
                        </div>
                        <button
                          onClick={() => void handlePreviewTemplate(template)}
                          className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-primary cursor-pointer"
                          title={`Preview ${template.name}`}
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {(() => {
                  const approved = schoolApprovals.filter((r) => r.status === "APPROVED").length;
                  const pending = schoolApprovals.filter((r) => r.status === "SUBMITTED" || r.status === "UNDER_REVIEW" || r.status === "RESUBMITTED").length;
                  const changesReq = schoolApprovals.filter((r) => r.status === "CHANGES_REQUIRED").length;
                  const rejected = schoolApprovals.filter((r) => r.status === "REJECTED").length;
                  const printed = schoolApprovals.filter((r) => r.status === "PRINTED").length;
                  const total = approved + pending + changesReq + rejected + printed;

                  const segments = [
                    { label: "Approved", value: approved, color: "#40c8bb" },
                    { label: "Pending", value: pending, color: "#f2c94c" },
                    { label: "Changes Req.", value: changesReq, color: "#f28a63" },
                    { label: "Rejected", value: rejected, color: "#e55c5c" },
                    ...(printed > 0 ? [{ label: "Printed", value: printed, color: "#8a94e8" }] : []),
                  ].filter((s) => s.value > 0);

                  const radius = 54;
                  const stroke = 14;
                  const circumference = 2 * Math.PI * radius;
                  let cumulative = 0;

                  return (
                    <Card className="ui-card rounded-2xl border-border bg-card text-card-foreground shadow-[0_14px_40px_rgba(38,71,65,0.05)]">
                      <CardHeader className="flex flex-row items-center justify-between px-6 pb-2 pt-6">
                        <div>
                          <CardTitle className="text-[15px] font-extrabold tracking-[-0.02em]">
                            Overall report
                          </CardTitle>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Card status breakdown
                          </p>
                        </div>
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Grid2X2 className="h-5 w-5" />
                        </div>
                      </CardHeader>
                      <CardContent className="flex flex-col items-center gap-5 px-6 pb-6 pt-2">
                        {/* Donut Chart */}
                        <div className="relative">
                          <svg width="148" height="148" viewBox="0 0 148 148" className="drop-shadow-sm">
                            {/* Background track */}
                            <circle
                              cx="74"
                              cy="74"
                              r={radius}
                              fill="none"
                              stroke="currentColor"
                              className="text-muted/30"
                              strokeWidth={stroke}
                            />
                            {total > 0 ? (
                              segments.map((seg) => {
                                const pct = seg.value / total;
                                const dashLen = pct * circumference;
                                const dashGap = circumference - dashLen;
                                const offset = -(cumulative / total) * circumference;
                                cumulative += seg.value;
                                return (
                                  <circle
                                    key={seg.label}
                                    cx="74"
                                    cy="74"
                                    r={radius}
                                    fill="none"
                                    stroke={seg.color}
                                    strokeWidth={stroke}
                                    strokeDasharray={`${dashLen} ${dashGap}`}
                                    strokeDashoffset={offset}
                                    strokeLinecap="round"
                                    className="transition-all duration-500 hover:opacity-80"
                                    style={{ transform: "rotate(-90deg)", transformOrigin: "74px 74px" }}
                                  />
                                );
                              })
                            ) : (
                              <circle
                                cx="74"
                                cy="74"
                                r={radius}
                                fill="none"
                                stroke="currentColor"
                                className="text-muted-foreground/20"
                                strokeWidth={stroke}
                              />
                            )}
                          </svg>
                          {/* Center label */}
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-extrabold tracking-[-0.04em] text-foreground">
                              {total}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                              Total
                            </span>
                          </div>
                        </div>

                        {/* Legend */}
                        <div className="grid w-full grid-cols-2 gap-x-4 gap-y-2.5">
                          {[
                            { label: "Approved", value: approved, color: "#40c8bb" },
                            { label: "Pending", value: pending, color: "#f2c94c" },
                            { label: "Changes Req.", value: changesReq, color: "#f28a63" },
                            { label: "Rejected", value: rejected, color: "#e55c5c" },
                            ...(printed > 0 ? [{ label: "Printed", value: printed, color: "#8a94e8" }] : []),
                          ].map((item) => (
                            <div key={item.label} className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: item.color }}
                              />
                              <span className="text-[11px] font-bold text-foreground">{item.label}</span>
                              <span className="ml-auto font-mono text-[10px] font-bold text-muted-foreground">
                                {item.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                {authenticatedUser.role === "SUPER_ADMIN" && (
                  <Card className="ui-card xl:col-span-2 rounded-2xl border-border bg-card text-card-foreground shadow-[0_14px_40px_rgba(38,71,65,0.05)]">
                    <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 pb-3 pt-6 border-b border-border">
                      <div>
                        <CardTitle className="text-[15px] font-extrabold tracking-[-0.02em]">
                          Active Schools ({displayedActiveSchools.length})
                        </CardTitle>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Showing {displayedActiveSchools.length} of {activeSchools.length} active schools
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <label htmlFor="overview-schools-limit" className="text-xs font-semibold text-muted-foreground">
                            Show:
                          </label>
                          <select
                            id="overview-schools-limit"
                            aria-label="Display count for active schools"
                            value={overviewActiveSchoolsLimit}
                            onChange={(e) => setOverviewActiveSchoolsLimit(Number(e.target.value))}
                            className="h-8 rounded-xl border border-border bg-card px-2.5 text-xs font-bold text-foreground shadow-sm hover:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                          >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                          </select>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="divide-y divide-border p-0">
                      {displayedActiveSchools.length === 0 ? (
                        <div className="p-6 text-center text-xs text-muted-foreground">
                          {activeSchools.length === 0
                            ? "No active schools found."
                            : "No active schools to display."}
                        </div>
                      ) : (
                        displayedActiveSchools.map((school) => (
                          <div key={school.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 px-6 gap-3 hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                                <Building2 className="h-5 w-5" />
                              </div>
                              <div>
                                <div className="text-sm font-extrabold text-foreground flex flex-wrap items-center gap-2">
                                  {school.name}
                                  {school.templateSelectionStatus === "Selected" ? (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                                      <CheckCircle2 className="h-3 w-3 text-primary" />
                                      Template: {school.selectedTemplateName || "Selected"}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                                      <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                                      Template: Not Selected
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                  <span>Code: <b className="text-foreground">{school.shortCode}</b></span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                              <div className="flex items-center gap-2 mr-1">
                                <Switch
                                  checked={school.isActive}
                                  onCheckedChange={() => handleToggleSchoolStatus(school)}
                                  className="data-[state=checked]:bg-primary"
                                  aria-label={`Toggle active status for ${school.name}`}
                                />
                                <span
                                  className={`text-xs font-bold ${school.isActive ? "text-primary" : "text-muted-foreground"
                                    }`}
                                >
                                  {school.isActive ? "Active" : "Inactive"}
                                </span>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-sm hover:border-primary hover:bg-accent hover:text-primary focus:outline-none"
                                    title="Actions"
                                    aria-label={`Actions for ${school.name}`}
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-36 bg-popover text-popover-foreground p-1 rounded-xl shadow-lg border border-border">
                                  <DropdownMenuItem
                                    onClick={() => handleGenerateCredentials(school)}
                                    className="flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-primary hover:bg-accent rounded-lg cursor-pointer"
                                  >
                                    <KeyRound className="h-3.5 w-3.5" />
                                    View
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleEditSchool(school)}
                                    className="flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-foreground hover:bg-accent rounded-lg cursor-pointer"
                                  >
                                    <FileEdit className="h-3.5 w-3.5" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteSchool(school.id, school.name)}
                                    className="flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                )}
              </section>
            </>
            )
          ) : activeNav === "About Us" ? (
            <AboutUsSection />
          ) : activeNav === "Settings" ? (
            <SettingsSection />
          ) : activeNav === "Create Order" ? (
            <CreateOrderView
              user={authenticatedUser}
              schools={schools}
              activeSchool={currentActiveSchool}
              onSuccess={() => goTo("Order List")}
              onCancel={() => goTo(portal === "marketing" ? "Overview" : "Order List")}
            />
          ) : activeNav === "Order List" ? (
            <OrderListView
              user={authenticatedUser}
              schools={schools}
              onCreateNew={() => goTo("Create Order")}
            />
          ) : activeNav === "Notifications" ? (
            <NotificationsView />
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
              activity={activity}
              onSelectTemplate={handleSelectTemplate}
              onUnselectTemplate={handleUnselectTemplate}
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
              onClearAuditLogs={handleClearAuditLogs}
              onEditSchool={handleEditSchool}
              onDeleteSchool={handleDeleteSchool}
              onEditUser={openEditUser}
              onDeleteUser={handleDeleteUser}
              onToggleSchoolStatus={handleToggleSchoolStatus}
              onDeleteTemplate={handleDeleteTemplate}
              activeSchool={currentActiveSchool}
              onGenerateCredentials={handleGenerateCredentials}
              selectedRequestCardIds={selectedRequestCardIds}
              onToggleSelectRequest={handleToggleSelectRequest}
              onSelectAllRequests={handleSelectAllRequests}
              onBulkApproveRequests={handleBulkApproveRequests}
              onBulkRejectRequests={() => setBulkRejectModalOpen(true)}
              bulkActionLoading={bulkActionLoading}
              onApproveCardDirect={async (id: number, num: string) => {
                try {
                  await api.approvals.approve(id);
                  toast.success(`Card #${num} approved!`);
                  reloadWorkspace();
                } catch (e) {
                  toast.error("Approval failed", {
                    description: e instanceof Error ? e.message : "Request failed",
                  });
                }
              }}
              onRejectCardDirect={(id: number) => handleOpenReview(id)}
              onOpenExcelUpload={() => setExcelUploadOpen(true)}
              onOpenBulkPhotoUpload={() => setBulkPhotoUploadOpen(true)}
              onDownloadExampleExcel={handleDownloadExampleExcel}
              onRemoveApproved={handleRemoveApprovedCards}
            />
          )}
        </div>
      </main>

      {/* Super Admin & Marketing Admin Profile Management Dialog */}
      {(authenticatedUser.role === "SUPER_ADMIN" || authenticatedUser.role === "MARKETING_ADMIN") && (
        <SuperAdminProfileDialog
          open={profileModalOpen}
          onOpenChange={setProfileModalOpen}
          currentUser={authenticatedUser}
          onProfileUpdated={(updated) => setAuthenticatedUser(updated)}
        />
      )}

      {/* Dialog for Creating / Editing School */}
      <Dialog open={schoolModalOpen} onOpenChange={setSchoolModalOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border">
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
                  <label className="text-xs font-bold text-foreground">
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
                  <label className="text-xs font-bold text-foreground">
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
                  <label className="text-xs font-bold text-foreground">
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
                  <label className="text-xs font-bold text-foreground">
                    Phone Number
                  </label>
                  <div className="mt-1 flex items-center gap-1.5">
                    <div className="h-10 w-14 flex items-center justify-center rounded-xl border border-border bg-muted text-xs font-bold text-foreground select-none shrink-0">
                      +91
                    </div>
                    <div className="flex-1">
                      <Input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        placeholder={INDIAN_MOBILE_PLACEHOLDER}
                        value={schoolPhoneInput}
                        onChange={(e) => {
                          const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10);
                          setSchoolPhoneInput(digitsOnly);
                        }}
                        className={`h-10 rounded-xl text-xs transition-colors ${schoolPhoneInput.length > 0 && schoolPhoneInput.length < 10
                            ? "border-red-500 bg-red-50/15 text-red-900 focus-visible:ring-red-400 focus-visible:border-red-500"
                            : ""
                          }`}
                      />
                    </div>
                  </div>
                  {schoolPhoneInput.length > 0 && schoolPhoneInput.length < 10 && (
                    <p className="mt-1 text-[11px] font-medium text-red-500">
                      Phone number must be 10 digits ({schoolPhoneInput.length}/10)
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground">
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
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-white font-bold">
                {editingSchool ? "Update School" : "Create School"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog for Creating Template */}
      <Dialog open={templateModalOpen} onOpenChange={setTemplateModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <form onSubmit={handleCreateTemplateSubmit}>
            <DialogHeader>
              <DialogTitle>New ID Card Template</DialogTitle>
              <DialogDescription>
                Create a draft template definition in the system.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-xs font-bold text-foreground">
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
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-white font-bold">
                Create Template
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog for Creating / Editing User */}
      <Dialog open={userModalOpen} onOpenChange={(open) => {
        setUserModalOpen(open);
        if (!open) setEditingUser(null);
      }}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <form onSubmit={handleUserSubmit} noValidate autoComplete="off">
            <DialogHeader>
              <DialogTitle>{editingUser ? `Edit User: ${editingUser.name || editingUser.email || "User"}` : "Add New User"}</DialogTitle>
              <DialogDescription>
                {editingUser
                  ? "Update user details, role assignment, or change password."
                  : "Create an administrator, school administrator, or marketing admin account."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-xs font-bold text-foreground">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <Input
                  className="mt-1 aria-invalid:border-red-500 aria-invalid:ring-red-200"
                  placeholder="e.g., Sarah Connor"
                  value={userNameInput}
                  onChange={(e) => {
                    setUserNameInput(e.target.value);
                    setUserFormErrors((current) => ({ ...current, name: undefined }));
                  }}
                  aria-invalid={Boolean(userFormErrors.name)}
                  aria-describedby={userFormErrors.name ? "user-name-error" : undefined}
                  autoComplete="off"
                  autoFocus
                />
                {userFormErrors.name && (
                  <p id="user-name-error" className="mt-1 text-xs font-medium text-red-600">
                    {userFormErrors.name}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-foreground">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  className="mt-1 aria-invalid:border-red-500 aria-invalid:ring-red-200"
                  placeholder="e.g., sarah@school.edu"
                  value={userEmailInput}
                  onChange={(e) => {
                    setUserEmailInput(e.target.value);
                    setUserFormErrors((current) => ({ ...current, email: undefined }));
                  }}
                  aria-invalid={Boolean(userFormErrors.email)}
                  aria-describedby={userFormErrors.email ? "user-email-error" : undefined}
                  autoComplete="off"
                  name="user_email_no_autofill"
                  data-lpignore="true"
                  data-1p-ignore="true"
                />
                {userFormErrors.email && (
                  <p id="user-email-error" className="mt-1 text-xs font-medium text-red-600">
                    {userFormErrors.email}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-foreground">
                  {editingUser ? "New Password (leave blank to keep current)" : "Temporary Password (min 8 chars)"} {!editingUser && <span className="text-red-500">*</span>}
                </label>
                <Input
                  type="password"
                  className="mt-1 aria-invalid:border-red-500 aria-invalid:ring-red-200"
                  placeholder={editingUser ? "Leave blank to keep unchanged" : "••••••••"}
                  value={userPasswordInput}
                  onChange={(e) => {
                    setUserPasswordInput(e.target.value);
                    setUserFormErrors((current) => ({ ...current, password: undefined }));
                  }}
                  aria-invalid={Boolean(userFormErrors.password)}
                  aria-describedby={userFormErrors.password ? "user-password-error" : undefined}
                  autoComplete="new-password"
                  name="user_password_no_autofill"
                  data-lpignore="true"
                  data-1p-ignore="true"
                />
                {userFormErrors.password && (
                  <p id="user-password-error" className="mt-1 text-xs font-medium text-red-600">
                    {userFormErrors.password}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-foreground">
                  Role
                </label>
                <Select
                  value={userRoleInput}
                  onValueChange={(val: any) => {
                    setUserRoleInput(val);
                    if (val !== "SCHOOL_ADMIN") {
                      setUserFormErrors((current) => ({ ...current, schoolId: undefined }));
                    }
                  }}
                >
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SUPER_ADMIN">Admin (SUPER_ADMIN)</SelectItem>
                    <SelectItem value="SCHOOL_ADMIN">School Admin (SCHOOL_ADMIN)</SelectItem>
                    <SelectItem value="MARKETING_ADMIN">Marketing Admin (MARKETING_ADMIN)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {userRoleInput === "SCHOOL_ADMIN" && (
                <div>
                  <label className="text-xs font-bold text-foreground">
                    Assign School <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={userSchoolIdInput}
                    onValueChange={(val: string) => {
                      setUserSchoolIdInput(val);
                      setUserFormErrors((current) => ({ ...current, schoolId: undefined }));
                    }}
                  >
                    <SelectTrigger
                      className="mt-1 w-full aria-invalid:border-red-500 aria-invalid:ring-red-200"
                      aria-invalid={Boolean(userFormErrors.schoolId)}
                      aria-describedby={userFormErrors.schoolId ? "user-school-error" : undefined}
                    >
                      <SelectValue placeholder="Select school for School Admin" />
                    </SelectTrigger>
                    <SelectContent>
                      {schools.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name} ({s.shortCode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {userFormErrors.schoolId && (
                    <p id="user-school-error" className="mt-1 text-xs font-medium text-red-600">
                      {userFormErrors.schoolId}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    The School Admin will manage cards, orders, and approvals for this school.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setUserModalOpen(false);
                  setEditingUser(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-white font-bold">
                {editingUser ? "Save Changes" : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog
        open={Boolean(userPendingDelete)}
        onOpenChange={(open) => {
          if (!open) setUserPendingDelete(null);
        }}
      >
        <AlertDialogContent className="max-w-md bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Delete User
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm text-muted-foreground">
              <p>
                Are you sure you want to permanently delete user{" "}
                <b className="text-foreground">{userPendingDelete?.name || userPendingDelete?.openId}</b> ({userPendingDelete?.role})?
              </p>
              <p className="text-xs text-red-500 font-medium">
                This action cannot be undone. All audit log assignments and notifications for this account will be cleaned up.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingUser}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDeleteUser();
              }}
              disabled={deletingUser}
              className="bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              {deletingUser ? "Deleting..." : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* School Credentials & ID Pass Modal */}
      <Dialog open={credentialsModalOpen} onOpenChange={setCredentialsModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border border-border rounded-2xl shadow-xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-extrabold text-foreground">
                  School ID Pass & Credentials
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {credentialsData?.schoolName ? `Login credentials for ${credentialsData.schoolName}` : "School login credentials"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* School Details */}
            <div className="rounded-xl border border-border bg-muted/40 p-3.5 text-xs text-foreground space-y-2">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="font-bold text-primary flex items-center gap-1.5">
                  <Building2 className="h-4 w-4" /> {credentialsData?.schoolName || "School Details"}
                </span>
                {credentialsData?.shortCode && (
                  <span className="font-mono text-[10px] font-bold bg-primary/15 text-primary px-2 py-0.5 rounded-full">
                    {credentialsData.shortCode}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-0.5">
                <div>
                  <span className="text-muted-foreground font-medium block">Email:</span>
                  <span className="font-semibold text-foreground break-all">
                    {credentialsData?.email || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground font-medium block">Phone:</span>
                  <span className="font-semibold text-foreground">
                    {credentialsData?.phone || "—"}
                  </span>
                </div>
              </div>
              <div className="text-[11px] pt-1 border-t border-border">
                <span className="text-muted-foreground font-medium block">Address:</span>
                <span className="font-semibold text-foreground">
                  {credentialsData?.address || "—"}
                </span>
              </div>
            </div>

            {/* Login ID field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">School Login ID</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 font-mono text-sm font-bold text-foreground bg-muted px-3 py-2 rounded-xl border border-border select-all break-all">
                  {credentialsData?.loginId || "—"}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 h-9 rounded-xl border-border text-xs font-bold hover:bg-muted hover:text-primary"
                  onClick={() => {
                    if (credentialsData?.loginId) {
                      navigator.clipboard.writeText(credentialsData.loginId);
                      toast.success("Login ID copied to clipboard");
                    }
                  }}
                >
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                </Button>
              </div>
            </div>

            {/* Password / ID Pass field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Password / ID Pass</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 font-mono text-sm font-bold text-foreground bg-muted px-3 py-2 rounded-xl border border-border select-all break-all">
                  {credentialsData?.password || "••••••••••••"}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 h-9 rounded-xl border-border text-xs font-bold hover:bg-muted hover:text-primary"
                  onClick={() => {
                    if (credentialsData?.password) {
                      navigator.clipboard.writeText(credentialsData.password);
                      toast.success("Password copied to clipboard");
                    }
                  }}
                >
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between sm:items-center pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl border-border text-xs font-bold text-primary hover:bg-muted"
              onClick={() => {
                if (credentialsData) {
                  const lines = [
                    `School: ${credentialsData.schoolName}`,
                    credentialsData.shortCode ? `Code: ${credentialsData.shortCode}` : null,
                    credentialsData.email ? `Email: ${credentialsData.email}` : null,
                    credentialsData.phone ? `Phone: ${credentialsData.phone}` : null,
                    credentialsData.address ? `Address: ${credentialsData.address}` : null,
                    `Login ID: ${credentialsData.loginId}`,
                    `Password: ${credentialsData.password || ""}`,
                    `Portal URL: ${window.location.origin}`,
                  ].filter(Boolean);
                  navigator.clipboard.writeText(lines.join("\n"));
                  toast.success("All credentials and school details copied to clipboard");
                }
              }}
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy All Details
            </Button>
            <Button
              type="button"
              className="rounded-xl bg-primary text-xs font-bold text-white hover:bg-primary/90"
              onClick={() => setCredentialsModalOpen(false)}
            >
              Done
            </Button>
          </DialogFooter>
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

      {/* Delete School confirmation */}
      <DeleteSchoolDialog
        school={schoolPendingDelete}
        onClose={() => setSchoolPendingDelete(null)}
        onConfirm={confirmDeleteSchool}
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

      {/* Excel Upload Modal */}
      <ExcelUploadModal
        open={excelUploadOpen}
        onOpenChange={setExcelUploadOpen}
        schools={schools}
        activeSchoolId={currentActiveSchool?.id ?? (authenticatedUser.schoolId ?? undefined)}
        templates={templates}
        userRole={authenticatedUser.role}
        onUploadSuccess={() => {
          reloadWorkspace();
        }}
      />

      {/* Bulk Image Upload Modal */}
      <BulkImageUploadModal
        open={bulkPhotoUploadOpen}
        onOpenChange={setBulkPhotoUploadOpen}
        schools={schools}
        activeSchoolId={currentActiveSchool?.id ?? (authenticatedUser.schoolId ?? undefined)}
        userRole={authenticatedUser.role}
        onUploadSuccess={() => {
          reloadWorkspace();
        }}
      />

      {/* Admin Card Review & Detail Modal */}
      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-5xl xl:max-w-6xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 bg-card border-border">
          {reviewingCard && (
            <div>
              <DialogHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pr-2 sm:pr-6">
                  <div>
                    <DialogTitle className="text-lg sm:text-xl font-bold flex flex-wrap items-center gap-2">
                      <span>Card Review: #{reviewingCard.cardNumber}</span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold ${
                        reviewingCard.status === "PRINTED"
                          ? "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
                          : reviewingCard.status === "APPROVED"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                          : "bg-primary/10 text-primary border border-primary/20"
                      }`}>
                        {reviewingCard.status}
                      </span>
                    </DialogTitle>
                    <DialogDescription className="mt-1">
                      School: {reviewingCard.schoolName || currentActiveSchool?.name || "School"} · Template: {reviewingCard.templateName || reviewingCard.template?.name || "Standard Template"}
                    </DialogDescription>
                  </div>
                  {/* Side switcher */}
                  <div className="flex gap-1.5 bg-muted p-1 rounded-xl shrink-0 self-start sm:self-auto">
                    {(["FRONT", "BACK"] as const).map((side) => (
                      <button
                        key={side}
                        onClick={() => setReviewSide(side)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${reviewSide === side
                          ? "bg-primary text-white shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                          }`}
                      >
                        {side}
                      </button>
                    ))}
                  </div>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-6 border-b border-border">
                {/* Visual Card Preview */}
                <div className="flex flex-col items-center justify-center p-3 sm:p-4 bg-muted/40 rounded-2xl border border-border overflow-x-auto max-w-full [scrollbar-width:thin]">
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
                  <div className="mt-3 text-xs text-muted-foreground">
                    Card dimensions: {reviewingCard.template?.cardWidth ?? 324} × {reviewingCard.template?.cardHeight ?? 204}px
                  </div>
                </div>

                {/* Form Data & Details */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                      Card Fields & Data
                    </h4>
                    <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                      {[
                        {
                          label: "Student Name",
                          value:
                            reviewingCard.studentName ||
                            reviewingCard.dataMap?.student_name ||
                            reviewingCard.request?.studentName ||
                            "",
                        },
                        {
                          label: "Admission / Roll No",
                          value:
                            reviewingCard.dataMap?.admission_number ||
                            reviewingCard.request?.admissionCode ||
                            reviewingCard.cardNumber ||
                            "",
                        },
                        {
                          label: "Card Number",
                          value: reviewingCard.cardNumber || "",
                        },
                        {
                          label: "School",
                          value:
                            reviewingCard.schoolName ||
                            reviewingCard.dataMap?.school_name ||
                            currentActiveSchool?.name ||
                            "",
                        },
                        // Additional custom dynamic fields from dataMap
                        ...Object.entries(reviewingCard.dataMap || {})
                          .filter(([key, val]) => {
                            if (!val || typeof val !== "string") return false;
                            const isImage =
                              key === "photo" ||
                              key === "student_photo" ||
                              key === "signature" ||
                              key === "logo" ||
                              val.startsWith("data:image/") ||
                              val.length > 500;
                            const isCore =
                              key === "student_name" ||
                              key === "studentName" ||
                              key === "admission_number" ||
                              key === "admissionCode" ||
                              key === "school_name";
                            return !isImage && !isCore;
                          })
                          .map(([key, val]) => ({
                            label:
                              DYNAMIC_FIELDS.find((f) => f.key === key)?.label ||
                              key.replace(/_/g, " "),
                            value: String(val),
                          })),
                      ]
                        .filter((field): field is { label: string; value: string } => Boolean(field.value && field.value.trim()))
                        .map(({ label, value }) => (
                          <div key={label} className="flex justify-between items-center px-3 py-2 text-xs">
                            <span className="font-semibold text-muted-foreground">
                              {label}
                            </span>
                            <span className="font-mono text-foreground truncate max-w-[220px]" title={value}>
                              {value}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Attached files */}
                  {reviewingCard.files && reviewingCard.files.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                        Uploaded Assets
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {reviewingCard.files.map((file) => (
                          <a
                            key={file.id}
                            href={file.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-card text-xs text-primary hover:bg-muted"
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
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
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
              <DialogFooter className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-border">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setReviewModalOpen(false)}
                    className="text-xs"
                  >
                    Close
                  </Button>
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

                <div className="flex flex-wrap items-center gap-2">
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
                          className="border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 dark:text-amber-400 dark:border-amber-500/60 text-xs"
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
                          className="bg-primary hover:bg-primary/90 text-white text-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve Card
                        </Button>
                      </>
                    )}

                  {authenticatedUser.role === "SUPER_ADMIN" && reviewingCard.status === "REJECTED" && (
                    <Button
                      variant="destructive"
                      onClick={() => {
                        const id = reviewingCard.id;
                        const num = reviewingCard.cardNumber;
                        const stat = reviewingCard.status;
                        setReviewModalOpen(false);
                        void handleDeleteCard(id, num, stat);
                      }}
                      className="text-xs flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete Rejected Card
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Request Changes Sub-Modal */}
      <Dialog open={requestChangesOpen} onOpenChange={setRequestChangesOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Request Changes</DialogTitle>
            <DialogDescription>
              Explain what the school operator needs to correct before this card can be approved.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-xs font-bold text-foreground">
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
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Card Sub-Modal */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Reject ID Card</DialogTitle>
            <DialogDescription>
              Provide a clear reason for rejecting this card. This will mark the card as REJECTED.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-xs font-bold text-foreground">
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

      {/* Bulk Reject Cards Dialog */}
      <Dialog open={bulkRejectModalOpen} onOpenChange={setBulkRejectModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Reject Selected ID Cards</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting the {selectedRequestCardIds.length} selected ID card(s). This will mark them as REJECTED.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-xs font-bold text-foreground">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <Textarea
              className="mt-1.5"
              placeholder="e.g., Incomplete student information or photos do not meet criteria."
              rows={4}
              value={bulkRejectReason}
              onChange={(e) => setBulkRejectReason(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setBulkRejectModalOpen(false);
                setBulkRejectReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleBulkRejectRequestsSubmit}
              disabled={bulkActionLoading || !bulkRejectReason.trim()}
            >
              Reject {selectedRequestCardIds.length} Cards
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for Template Preview */}
      <Dialog open={!!previewModalTemplate} onOpenChange={(open) => !open && setPreviewModalTemplate(null)}>
        <DialogContent className="max-w-[700px] bg-card border-border">
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
                      ? "bg-primary text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                  >
                    {side}
                  </button>
                ))}
              </div>
              <div className="flex flex-col items-center justify-center p-3 sm:p-4 bg-muted/40 rounded-2xl border border-border overflow-x-auto max-w-full [scrollbar-width:thin]">
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
                  cardData={
                    previewModalTemplate.cardType === "staff" || /staff|teacher|faculty|employee/i.test(previewModalTemplate.name)
                      ? SAMPLE_STAFF_CARD_DATA
                      : SAMPLE_CARD_DATA
                  }
                  scale={Math.min(
                    1.75,
                    520 / (previewModalTemplate.cardWidth ?? 324),
                    420 / (previewModalTemplate.cardHeight ?? 204),
                  )}
                />
              </div>
              <div className="text-center text-xs text-muted-foreground">
                {previewModalTemplate.elements && previewModalTemplate.elements.length > 0
                  ? `Live preview with designer layout and realistic ${
                      previewModalTemplate.cardType === "staff" || /staff|teacher|faculty|employee/i.test(previewModalTemplate.name)
                        ? "staff"
                        : "student"
                    } data.`
                  : "This template has no custom elements yet. Super Admins can open the designer to add layout elements."}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const metricGradientStyles: Record<
  Tone,
  {
    bg: string;
    border: string;
    shadow: string;
    shadowHover: string;
    glow: string;
    iconBg: string;
    badgeBg: string;
  }
> = {
  teal: {
    bg: "bg-gradient-to-br from-[#0a5853] via-[#0f7f79] to-[#1eb5ab]",
    border: "border-teal-300/30",
    shadow: "shadow-[0_14px_34px_rgba(15,127,121,0.22)]",
    shadowHover: "hover:shadow-[0_20px_45px_rgba(15,127,121,0.36)]",
    glow: "bg-teal-300/25",
    iconBg: "bg-white/20 border-white/30 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]",
    badgeBg: "bg-white/15 border-white/25 text-white hover:bg-white/25",
  },
  coral: {
    bg: "bg-gradient-to-br from-[#b33318] via-[#d95232] to-[#f47352]",
    border: "border-orange-300/30",
    shadow: "shadow-[0_14px_34px_rgba(217,82,50,0.22)]",
    shadowHover: "hover:shadow-[0_20px_45px_rgba(217,82,50,0.36)]",
    glow: "bg-orange-300/25",
    iconBg: "bg-white/20 border-white/30 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]",
    badgeBg: "bg-white/15 border-white/25 text-white hover:bg-white/25",
  },
  indigo: {
    bg: "bg-gradient-to-br from-[#3730a3] via-[#4f46e5] to-[#7c75f5]",
    border: "border-indigo-300/30",
    shadow: "shadow-[0_14px_34px_rgba(79,70,229,0.24)]",
    shadowHover: "hover:shadow-[0_20px_45px_rgba(79,70,229,0.40)]",
    glow: "bg-indigo-300/25",
    iconBg: "bg-white/20 border-white/30 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]",
    badgeBg: "bg-white/15 border-white/25 text-white hover:bg-white/25",
  },
  yellow: {
    bg: "bg-gradient-to-br from-[#92400e] via-[#d97706] to-[#f59e0b]",
    border: "border-amber-300/30",
    shadow: "shadow-[0_14px_34px_rgba(217,119,6,0.24)]",
    shadowHover: "hover:shadow-[0_20px_45px_rgba(217,119,6,0.40)]",
    glow: "bg-amber-300/25",
    iconBg: "bg-white/20 border-white/30 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]",
    badgeBg: "bg-white/15 border-white/25 text-white hover:bg-white/25",
  },
};

function MetricCard({
  label,
  value,
  change,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  change: string;
  icon: LucideIcon;
  tone: Tone;
  onClick?: () => void;
}) {
  const g = metricGradientStyles[tone];

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onClick();
            }
          }
          : undefined
      }
      className={`group relative overflow-hidden rounded-2xl border ${g.border} ${g.bg} p-5 ${g.shadow} transition-all duration-300 ${onClick
          ? `cursor-pointer hover:-translate-y-1 ${g.shadowHover}`
          : ""
        }`}
    >
      {/* Decorative ambient glow circle in background */}
      <div
        className={`pointer-events-none absolute -right-6 -bottom-6 h-32 w-32 rounded-full ${g.glow} blur-2xl transition-all duration-500 group-hover:scale-125 group-hover:opacity-90`}
      />

      {/* Subtle watermark icon in background */}
      <Icon
        className="pointer-events-none absolute -right-2 -bottom-2 h-24 w-24 text-white/[0.08] transition-all duration-500 group-hover:scale-110 group-hover:text-white/[0.14]"
        strokeWidth={1.5}
      />

      {/* Top row: Label & Glassmorphic Icon */}
      <div className="relative z-10 flex items-start justify-between gap-2">
        <div className="space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/85">
            {label}
          </span>
          <div className="text-3xl sm:text-[34px] font-extrabold tracking-[-0.05em] text-white drop-shadow-sm">
            {value}
          </div>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border backdrop-blur-md transition-transform duration-300 group-hover:scale-105 ${g.iconBg}`}
        >
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </div>
      </div>

      {/* Bottom row: Clickable Action Badge / Pill */}
      <div className="relative z-10 mt-4 flex items-center">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold backdrop-blur-sm transition-all duration-200 ${g.badgeBg}`}
        >
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          <span>{change}</span>
        </span>
      </div>
    </div>
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
  activity,
  onSelectTemplate,
  onUnselectTemplate,
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
  selectedRequestCardIds = [],
  onToggleSelectRequest,
  onSelectAllRequests,
  onBulkApproveRequests,
  onBulkRejectRequests,
  bulkActionLoading = false,
  onClearAuditLogs,
  onEditSchool,
  onDeleteSchool,
  onEditUser,
  onDeleteUser,
  onToggleSchoolStatus,
  onDeleteTemplate,
  activeSchool,
  onGenerateCredentials,
  onApproveCardDirect,
  onRejectCardDirect,
  onOpenExcelUpload,
  onOpenBulkPhotoUpload,
  onDownloadExampleExcel,
  onRemoveApproved,
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
  activity: ApiActivity[];
  onSelectTemplate: (template: ApiTemplate) => void;
  onUnselectTemplate: () => void;
  onLockTemplate: (template: ApiTemplate) => void;
  onPreviewTemplate: (template: ApiTemplate) => void;
  onToggleTemplateStatus: (template: ApiTemplate) => void;
  onEditCard: (cardId: number) => void;
  onSubmitCard: (cardId: number, num: string) => void;
  onDeleteCard: (cardId: number, num: string, status?: string) => void;
  onOpenReview: (cardId: number) => void;
  onPrintCard: (cardId: number) => void;
  onBulkPrint: () => void;
  onBulkPdf: () => void;
  selectedApprovedCardIds: number[];
  onToggleSelectApproved: (cardId: number) => void;
  onSelectAllApproved: (ids: number[]) => void;
  selectedRequestCardIds?: number[];
  onToggleSelectRequest?: (cardId: number) => void;
  onSelectAllRequests?: (ids: number[]) => void;
  onBulkApproveRequests?: () => void;
  onBulkRejectRequests?: () => void;
  bulkActionLoading?: boolean;
  onClearAuditLogs?: () => void;
  onEditSchool?: (school: ApiSchool) => void;
  onDeleteSchool?: (schoolId: number, schoolName: string) => void;
  onEditUser?: (user: ApiUser) => void;
  onDeleteUser?: (user: ApiUser) => void;
  onToggleSchoolStatus?: (school: ApiSchool) => void;
  onDeleteTemplate?: (templateId: number, templateName: string) => void;
  activeSchool?: ApiSchool;
  onGenerateCredentials?: (school: ApiSchool) => void;
  onApproveCardDirect?: (cardId: number, num: string) => void;
  onRejectCardDirect?: (cardId: number) => void;
  onOpenExcelUpload?: () => void;
  onOpenBulkPhotoUpload?: () => void;
  onDownloadExampleExcel?: (templateId?: number, cardType?: string) => void;
  onRemoveApproved?: (cardIds: number[]) => Promise<void>;
}) {
  const [, navigate] = useLocation();
  const [cardStatusFilter, setCardStatusFilter] = useState<string>("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [cardsPendingRemove, setCardsPendingRemove] = useState<number[]>([]);
  const [removingCards, setRemovingCards] = useState(false);
  const [reportsTab, setReportsTab] = useState<"student_removed" | "staff_removed">("student_removed");

  const getSchoolLoginId = (school: ApiSchool) =>
    school.credentials?.loginId ??
    users.find((user) => user.schoolId === school.id && user.role === "SCHOOL_ADMIN")?.openId ??
    "";

  const copySchoolDetail = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}`);
    }
  };

  const isTemplates = label === "ID card templates";
  const isSchools = label === "Schools";
  const isUsers = label === "Users";
  const isRequests = label === "ID card requests";
  const isApproved = label === "Approved cards";
  const isAudit = label === "Audit logs";

  const [userRoleFilter, setUserRoleFilter] = useState<string>("All");
  const [usersPage, setUsersPage] = useState<number>(1);
  const USERS_PAGE_SIZE = 20;

  // Schools table pagination & status filtering
  const [schoolsStatusFilter, setSchoolsStatusFilter] = useState<"All" | "Active" | "Inactive">("All");
  const [schoolsPage, setSchoolsPage] = useState<number>(1);
  const SCHOOLS_PAGE_SIZE = 20;

  // ID Card Requests pagination
  const [requestsPage, setRequestsPage] = useState<number>(1);
  const REQUESTS_PAGE_SIZE = 20;

  // Approved Cards pagination
  const [approvedPage, setApprovedPage] = useState<number>(1);
  const APPROVED_PAGE_SIZE = 20;

  useEffect(() => {
    setSchoolsPage(1);
    setUsersPage(1);
    setRequestsPage(1);
    setApprovedPage(1);
  }, [searchTerm, schoolsStatusFilter, userRoleFilter, cardStatusFilter]);

  const filteredSchools = useMemo(() => {
    return schools
      .filter((s) => {
        if (schoolsStatusFilter === "Active") return s.isActive;
        if (schoolsStatusFilter === "Inactive") return !s.isActive;
        return true;
      })
      .filter(
        (s) =>
          !searchTerm ||
          s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.shortCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
          (s.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
          (s.address?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false),
      );
  }, [schools, schoolsStatusFilter, searchTerm]);

  // Templates status filtering and search
  const [templateStatusFilter, setTemplateStatusFilter] = useState<"All" | "ACTIVE" | "INACTIVE">("All");

  const filteredTemplates = useMemo(() => {
    return templates
      .filter((t) => {
        if (authenticatedUser.role !== "SUPER_ADMIN") {
          return t.status === "ACTIVE";
        }
        if (templateStatusFilter === "ACTIVE") return t.status === "ACTIVE";
        if (templateStatusFilter === "INACTIVE") return t.status !== "ACTIVE";
        return true;
      })
      .filter(
        (t) =>
          !searchTerm ||
          t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (t.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
          (t.meta?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false),
      );
  }, [templates, authenticatedUser.role, templateStatusFilter, searchTerm]);

  const totalSchoolPages = Math.ceil(filteredSchools.length / SCHOOLS_PAGE_SIZE) || 1;
  const paginatedSchools = useMemo(() => {
    const start = (schoolsPage - 1) * SCHOOLS_PAGE_SIZE;
    return filteredSchools.slice(start, start + SCHOOLS_PAGE_SIZE);
  }, [filteredSchools, schoolsPage]);

  // Filtered lists for ID cards (filtered by active school if selected)
  const schoolFilteredCards = useMemo(() => {
    if (!activeSchool?.id) return idCards;
    return idCards.filter((c) => c.schoolId === activeSchool.id);
  }, [idCards, activeSchool?.id]);

  const requestCards = useMemo(() => {
    return schoolFilteredCards
      .filter((c) => c.status !== "APPROVED" && c.status !== "PRINTED")
      .filter((c) => cardStatusFilter === "All" || c.status === cardStatusFilter)
      .filter(
        (c) =>
          !searchTerm ||
          c.cardNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (c.schoolName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
          (c.templateName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false),
      );
  }, [schoolFilteredCards, cardStatusFilter, searchTerm]);

  const totalRequestPages = Math.ceil(requestCards.length / REQUESTS_PAGE_SIZE) || 1;
  const paginatedRequestCards = useMemo(() => {
    const start = (requestsPage - 1) * REQUESTS_PAGE_SIZE;
    return requestCards.slice(start, start + REQUESTS_PAGE_SIZE);
  }, [requestCards, requestsPage]);

  const approvedCards = useMemo(() => {
    return schoolFilteredCards
      .filter((c) => c.status === "APPROVED" || c.status === "PRINTED")
      .filter(
        (c) =>
          !searchTerm ||
          c.cardNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (c.schoolName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
          (c.templateName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false),
      );
  }, [schoolFilteredCards, searchTerm]);

  const totalApprovedPages = Math.ceil(approvedCards.length / APPROVED_PAGE_SIZE) || 1;
  const paginatedApprovedCards = useMemo(() => {
    const start = (approvedPage - 1) * APPROVED_PAGE_SIZE;
    return approvedCards.slice(start, start + APPROVED_PAGE_SIZE);
  }, [approvedCards, approvedPage]);

  const allApprovedCardIds = useMemo(() => approvedCards.map((c) => c.id), [approvedCards]);
  const allRequestCardIds = useMemo(() => requestCards.map((c) => c.id), [requestCards]);

  const filteredUsers = useMemo(() => {
    return users
      .filter((u) => userRoleFilter === "All" || u.role === userRoleFilter)
      .filter(
        (u) =>
          !searchTerm ||
          (u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
          (u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
          (u.openId?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false),
      );
  }, [users, userRoleFilter, searchTerm]);

  const totalUserPages = Math.ceil(filteredUsers.length / USERS_PAGE_SIZE) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (usersPage - 1) * USERS_PAGE_SIZE;
    return filteredUsers.slice(start, start + USERS_PAGE_SIZE);
  }, [filteredUsers, usersPage]);

  const getStatusTone = (status: string): Tone => {
    switch (status) {
      case "APPROVED":
        return "teal";
      case "PRINTED":
        return "indigo";
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
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-extrabold tracking-[-0.05em] sm:text-3xl">
            {authenticatedUser.role !== "SUPER_ADMIN"
              ? label === "ID card templates"
                ? "Templates"
                : label === "ID card requests"
                  ? "My ID Cards"
                  : label
              : label}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {isRequests
              ? authenticatedUser.role === "SUPER_ADMIN"
                ? activeSchool
                  ? `Showing ID cards for ${activeSchool.name} (${activeSchool.shortCode}).`
                  : "Create, edit, submit, and manage student ID cards for all schools."
                : "View and approve or reject student ID cards created for your school."
              : isApproved
                ? activeSchool
                  ? `Showing verified, production-ready ID cards for ${activeSchool.name} (${activeSchool.shortCode}).`
                  : "Print and export batch production-ready verified ID cards."
                : isTemplates
                  ? authenticatedUser.role === "SUPER_ADMIN"
                    ? "Manage customizable front and back ID card templates."
                    : "Browse available templates and select your school's final preferred template."
                  : "A focused workspace for managing your school identity operations."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {isTemplates && (
            <a
              href="/demo-templates/Update-Catalog-ID-Card-and-Ribbon.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 text-xs font-bold text-primary shadow-sm transition-all hover:border-primary hover:bg-primary/15"
              data-testid="button-view-demo-templates"
            >
              <FileText className="h-4 w-4" /> View Demo Templates and Lanyards
            </a>
          )}

          {isRequests && authenticatedUser.role !== "VIEWER" && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-10 rounded-xl border-border text-primary hover:bg-primary/10 text-xs font-bold shadow-sm"
                  >
                    <Download className="mr-2 h-4 w-4" /> Download Example Excel <ChevronDown className="ml-1.5 h-3.5 w-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 rounded-xl border-border bg-card p-1.5 shadow-lg">
                  <DropdownMenuItem
                    onClick={() => onDownloadExampleExcel?.(activeSchool?.selectedTemplateId ?? undefined, "student")}
                    className="cursor-pointer rounded-lg px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10 focus:bg-primary/10 focus:text-primary"
                  >
                    <Download className="mr-2 h-4 w-4 text-primary" />
                    <span>Student Excel Template</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDownloadExampleExcel?.(activeSchool?.selectedTemplateId ?? undefined, "staff")}
                    className="cursor-pointer rounded-lg px-3 py-2 text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 focus:bg-purple-50 focus:text-purple-600"
                  >
                    <Download className="mr-2 h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <span>Staff Excel Template</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                onClick={onOpenExcelUpload}
                className="h-10 rounded-xl border-primary text-primary hover:bg-primary/10 text-xs font-bold shadow-sm"
              >
                <Upload className="mr-2 h-4 w-4" /> Upload Excel
              </Button>
              <Button
                variant="outline"
                onClick={onOpenBulkPhotoUpload}
                className="h-10 rounded-xl border-primary text-primary hover:bg-primary/10 text-xs font-bold shadow-sm"
              >
                <Camera className="mr-2 h-4 w-4" /> Bulk Upload Images
              </Button>
            </>
          )}

          {((isRequests && authenticatedUser.role === "SUPER_ADMIN") ||
            (isSchools && authenticatedUser.role === "SUPER_ADMIN") ||
            (isTemplates && authenticatedUser.role === "SUPER_ADMIN") ||
            (isUsers && authenticatedUser.role === "SUPER_ADMIN")) && (
              <Button
                onClick={onCreate}
                className="h-10 rounded-xl bg-primary text-xs font-bold text-white hover:bg-primary/90"
              >
                <FilePlus2 className="mr-2 h-4 w-4" />{" "}
                {isRequests ? "New ID Card Draft" : isUsers ? "New User" : "Create new"}
              </Button>
            )}
        </div>
      </div>

      {/* 1. Templates Tab */}
      {isTemplates && (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search templates by name, description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 rounded-xl border-border bg-background pl-9 text-xs shadow-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
              {authenticatedUser.role === "SUPER_ADMIN" && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-muted-foreground mr-1">Status:</span>
                  {(["All", "ACTIVE", "INACTIVE"] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setTemplateStatusFilter(status)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all ${templateStatusFilter === status
                          ? "bg-primary text-white shadow-xs"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                    >
                      {status === "All" ? "All" : status === "ACTIVE" ? "Active" : "Inactive"}
                    </button>
                  ))}
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                Showing <b>{filteredTemplates.length}</b> {filteredTemplates.length === 1 ? "template" : "templates"}
              </div>
            </div>
          </div>

          {filteredTemplates.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground shadow-sm">
              <Palette className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="font-semibold text-foreground">
                {searchTerm || templateStatusFilter !== "All"
                  ? "No templates matching your search or filter"
                  : "No templates available"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {searchTerm
                  ? "Try adjusting your search terms or resetting the filter."
                  : "Create a new template to get started."}
              </p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredTemplates.map((template) => (
                <Card
                  key={template.id}
                  className="overflow-hidden rounded-2xl border-border bg-card shadow-[0_12px_35px_rgba(38,71,65,0.05)]"
                >
                  <div className="flex h-44 items-center justify-center bg-muted/50">
                    <CardPreview
                      accent={template.accent as Tone}
                      cardType={template.cardType}
                      templateName={template.name}
                    />
                  </div>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-extrabold text-foreground truncate">
                        {template.name}
                      </h3>
                      {authenticatedUser.role === "SUPER_ADMIN" ? (
                        <button
                          onClick={() => onToggleTemplateStatus(template)}
                          className={`rounded-lg px-2.5 py-1 text-[10px] font-extrabold transition-colors shrink-0 ${template.status === "ACTIVE"
                            ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100"
                            : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100"
                            }`}
                        >
                          {template.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </button>
                      ) : template.status === "ACTIVE" ? (
                        <StatusPill tone="teal">Active</StatusPill>
                      ) : (
                        <StatusPill tone="yellow">Inactive</StatusPill>
                      )}
                    </div>
                    {Boolean(template.description || template.meta) && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {template.description || template.meta}
                      </p>
                    )}
                    <div className="mt-5 flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {template.status}
                      </span>
                      <div className="flex flex-1 items-center justify-end gap-2">
                        <button
                          onClick={() => onPreviewTemplate(template)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-muted px-3.5 py-2 text-xs font-bold text-foreground shadow-2xs hover:bg-muted/80 transition-all"
                        >
                          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>Preview</span>
                        </button>

                        {authenticatedUser.role === "SUPER_ADMIN" && (
                          <button
                            onClick={() => navigate(`/admin/templates/${template.id}/design`)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 px-3.5 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 shadow-2xs hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all"
                          >
                            <Palette className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>Design</span>
                          </button>
                        )}

                        {/* Final template badge + unselect button if this is school's selected template */}
                        {activeSchool?.selectedTemplateId === template.id && (
                          <span className="inline-flex items-center gap-1 rounded-xl bg-primary px-1.5 pl-3 py-1.5 text-xs font-bold text-white shadow-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Final Selected
                            {authenticatedUser.role !== "SUPER_ADMIN" && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onUnselectTemplate(); }}
                                className="ml-1 rounded-lg p-1 hover:bg-white/20 transition-colors"
                                title="Unselect this template"
                                aria-label="Unselect template"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </span>
                        )}

                        {/* Select as Final Template button for School users when not currently selected */}
                        {authenticatedUser.role !== "SUPER_ADMIN" &&
                          template.status === "ACTIVE" &&
                          activeSchool?.selectedTemplateId !== template.id && (
                            <button
                              onClick={() => onSelectTemplate(template)}
                              className="inline-flex items-center justify-center gap-1 rounded-xl bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition-all"
                            >
                              Select as Final Template
                            </button>
                          )}

                        {/* Delete button for Super Admin - smaller and compact */}
                        {authenticatedUser.role === "SUPER_ADMIN" && (
                          <button
                            onClick={() => onDeleteTemplate?.(template.id, template.name)}
                            className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors"
                            title={`Delete ${template.name}`}
                            aria-label={`Delete ${template.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. ID Card Requests / LifeCycle Queue */}
      {isRequests && (
        <Card className="rounded-2xl border-border bg-card shadow-[0_12px_35px_rgba(38,71,65,0.05)]">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto">
              <div className="relative w-full sm:w-64 shrink-0">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search card #, student, or school..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-10 rounded-xl border-border bg-background pl-9 text-xs shadow-none w-full"
                />
              </div>
              {/* Status Filter dropdown */}
              <div className="flex items-center gap-2 shrink-0">
                <label htmlFor="id-card-request-status-filter" className="text-xs font-semibold text-muted-foreground shrink-0">
                  Status:
                </label>
                <Select
                  value={cardStatusFilter}
                  onValueChange={(val) => setCardStatusFilter(val)}
                >
                  <SelectTrigger
                    id="id-card-request-status-filter"
                    aria-label="Status Filter"
                    className="h-10 w-[170px] rounded-xl border-border bg-background text-xs font-medium"
                  >
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All</SelectItem>
                    <SelectItem value="DRAFT">DRAFT</SelectItem>
                    <SelectItem value="SUBMITTED">SUBMITTED</SelectItem>
                    <SelectItem value="UNDER_REVIEW">UNDER REVIEW</SelectItem>
                    <SelectItem value="CHANGES_REQUIRED">CHANGES REQUIRED</SelectItem>
                    <SelectItem value="REJECTED">REJECTED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Bulk Approval & Rejection Toolbar for both Admin and School */}
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-end lg:self-center shrink-0">
              {selectedRequestCardIds.length > 0 && (
                <span className="text-xs font-semibold text-muted-foreground mr-1">
                  {selectedRequestCardIds.length} of {requestCards.length} selected
                </span>
              )}
              <Button
                onClick={onBulkApproveRequests}
                disabled={selectedRequestCardIds.length === 0 || bulkActionLoading}
                className="h-9 sm:h-10 rounded-xl bg-primary hover:bg-primary/90 text-xs font-bold text-white shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" /> Approve all
              </Button>
              <Button
                variant="outline"
                onClick={onBulkRejectRequests}
                disabled={selectedRequestCardIds.length === 0 || bulkActionLoading}
                className="h-9 sm:h-10 rounded-xl border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-bold shadow-sm"
              >
                <XCircle className="w-4 h-4 mr-1.5" /> Reject all
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto [scrollbar-width:thin] max-w-full">
            <table className="w-full text-left text-xs min-w-[680px]">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-3.5 w-12 text-center">
                    <Checkbox
                      checked={
                        allRequestCardIds.length > 0 &&
                        selectedRequestCardIds.length === allRequestCardIds.length
                      }
                      onCheckedChange={() => onSelectAllRequests?.(allRequestCardIds)}
                      aria-label="Select all request cards"
                    />
                  </th>
                  <th className="px-5 py-3.5">Card Number</th>
                  <th className="px-5 py-3.5">School</th>
                  <th className="px-5 py-3.5">Template</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Updated</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedRequestCards.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                      No ID card requests found matching the current filters.
                    </td>
                  </tr>
                ) : (
                  paginatedRequestCards.map((card) => (
                    <tr key={card.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-5 py-4 text-center">
                        <Checkbox
                          checked={selectedRequestCardIds.includes(card.id)}
                          onCheckedChange={() => onToggleSelectRequest?.(card.id)}
                          aria-label={`Select card ${card.cardNumber}`}
                        />
                      </td>
                      <td className="px-5 py-4 font-mono font-bold text-foreground">
                        {card.cardNumber}
                      </td>
                      <td className="px-5 py-4 font-medium text-foreground">
                        {card.schoolName}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {card.templateName}
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill tone={getStatusTone(card.status)}>
                          {card.status.replace(/_/g, " ")}
                        </StatusPill>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {card.updatedAt
                          ? formatDistanceToNow(new Date(card.updatedAt), { addSuffix: true })
                          : "Recently"}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Review/Detail for all */}
                          <button
                            onClick={() => onOpenReview(card.id)}
                            className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-primary hover:bg-primary/20"
                          >
                            <Eye className="inline w-3 h-3 mr-1" />
                            {authenticatedUser.role === "SUPER_ADMIN" ? "Review" : "View"}
                          </button>

                          {/* Admin actions: Edit, Submit, Delete draft / rejected */}
                          {(card.status === "DRAFT" || card.status === "CHANGES_REQUIRED") &&
                            authenticatedUser.role === "SUPER_ADMIN" && (
                              <>
                                <button
                                  onClick={() => onEditCard(card.id)}
                                  className="rounded-lg bg-muted px-2.5 py-1.5 text-[11px] font-bold text-foreground hover:bg-muted/80"
                                >
                                  <FileEdit className="inline w-3 h-3 mr-1" /> Edit
                                </button>
                                <button
                                  onClick={() => onSubmitCard(card.id, card.cardNumber)}
                                  className="rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-primary/90"
                                >
                                  <Send className="inline w-3 h-3 mr-1" /> Submit
                                </button>
                                {card.status === "DRAFT" && (
                                  <button
                                    onClick={() => onDeleteCard(card.id, card.cardNumber, card.status)}
                                    className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                                    title="Delete draft"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            )}

                          {/* Admin action: Delete rejected card */}
                          {card.status === "REJECTED" && authenticatedUser.role === "SUPER_ADMIN" && (
                            <button
                              onClick={() => onDeleteCard(card.id, card.cardNumber, card.status)}
                              className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 px-2.5 py-1.5 text-[11px] font-bold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 flex items-center gap-1"
                              title="Delete rejected card (removes from both admin and school sides)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          )}

                          {/* Approval actions: When card is SUBMITTED, UNDER_REVIEW, or RESUBMITTED, School user can Approve or Reject */}
                          {(card.status === "SUBMITTED" || card.status === "UNDER_REVIEW" || card.status === "RESUBMITTED") && (
                            <>
                              <button
                                onClick={() => onApproveCardDirect?.(card.id, card.cardNumber)}
                                className="rounded-lg bg-primary/10 border border-primary/30 px-2.5 py-1.5 text-[11px] font-bold text-primary hover:bg-primary/20"
                              >
                                <CheckCircle2 className="inline w-3 h-3 mr-1" /> Approve
                              </button>
                              <button
                                onClick={() => onRejectCardDirect?.(card.id)}
                                className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 px-2.5 py-1.5 text-[11px] font-bold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50"
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

          {totalRequestPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-border bg-muted/30">
              <div className="text-xs text-muted-foreground">
                Page {requestsPage} of {totalRequestPages} ({requestCards.length} {requestCards.length === 1 ? "card" : "cards"})
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={requestsPage <= 1}
                  onClick={() => setRequestsPage((p) => Math.max(1, p - 1))}
                  className="h-8 rounded-lg text-xs font-bold"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={requestsPage >= totalRequestPages}
                  onClick={() => setRequestsPage((p) => Math.min(totalRequestPages, p + 1))}
                  className="h-8 rounded-lg text-xs font-bold"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* 3. Approved Cards Tab with Bulk Actions */}
      {isApproved && (
        <Card className="rounded-2xl border-border bg-card shadow-[0_12px_35px_rgba(38,71,65,0.05)]">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search approved cards..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 rounded-xl border-border bg-background pl-9 text-xs shadow-none w-full"
              />
            </div>

            {/* Bulk Actions Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              {selectedApprovedCardIds.length > 0 && (
                <span className="text-xs font-semibold text-muted-foreground mr-1">
                  {selectedApprovedCardIds.length} card(s) selected
                </span>
              )}
              {selectedApprovedCardIds.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setCardsPendingRemove(selectedApprovedCardIds);
                    setRemoveConfirmOpen(true);
                  }}
                  className="h-9 sm:h-10 rounded-xl text-xs font-bold border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                >
                  <Trash2 className="w-4 h-4 mr-1.5" /> Remove ({selectedApprovedCardIds.length})
                </Button>
              )}
              {authenticatedUser.role === "SUPER_ADMIN" && (
                <>
                  <Button
                    variant="outline"
                    onClick={onBulkPrint}
                    disabled={selectedApprovedCardIds.length === 0}
                    className="h-9 sm:h-10 rounded-xl text-xs font-bold border-border"
                  >
                    <Printer className="w-4 h-4 mr-1.5 text-primary" /> Bulk Print
                  </Button>
                  <Button
                    onClick={onBulkPdf}
                    disabled={selectedApprovedCardIds.length === 0}
                    className="h-9 sm:h-10 rounded-xl bg-primary hover:bg-primary/90 text-xs font-bold text-white"
                  >
                    <Download className="w-4 h-4 mr-1.5" /> Download PDF
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="overflow-x-auto [scrollbar-width:thin] max-w-full">
            <table className="w-full text-left text-xs min-w-[640px]">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-3.5 w-12 text-center">
                    <Checkbox
                      checked={
                        paginatedApprovedCards.length > 0 &&
                        paginatedApprovedCards.every((c) => selectedApprovedCardIds.includes(c.id))
                      }
                      onCheckedChange={() => {
                        const pageIds = paginatedApprovedCards.map((c) => c.id);
                        const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedApprovedCardIds.includes(id));
                        if (allSelected) {
                          onSelectAllApproved(selectedApprovedCardIds.filter((id) => !pageIds.includes(id)));
                        } else {
                          const union = Array.from(new Set([...selectedApprovedCardIds, ...pageIds]));
                          onSelectAllApproved(union);
                        }
                      }}
                    />
                  </th>
                  <th className="px-5 py-3.5">Card Number</th>
                  <th className="px-5 py-3.5">School</th>
                  <th className="px-5 py-3.5">Template</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedApprovedCards.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                      No approved cards found. Submit cards and approve them to view here.
                    </td>
                  </tr>
                ) : (
                  paginatedApprovedCards.map((card) => (
                    <tr key={card.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-5 py-4 text-center">
                        <Checkbox
                          checked={selectedApprovedCardIds.includes(card.id)}
                          onCheckedChange={() => onToggleSelectApproved(card.id)}
                        />
                      </td>
                      <td className="px-5 py-4 font-mono font-bold text-foreground">
                        {card.cardNumber}
                      </td>
                      <td className="px-5 py-4 font-medium text-foreground">
                        {card.schoolName}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {card.templateName}
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill tone={getStatusTone(card.status)}>
                          {card.status}
                        </StatusPill>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {authenticatedUser.role === "SUPER_ADMIN" && (
                            <button
                              onClick={() => onPrintCard(card.id)}
                              className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-primary hover:bg-primary/20"
                            >
                              <Printer className="inline w-3 h-3 mr-1" /> Print / PDF
                            </button>
                          )}
                          <button
                            onClick={() => onOpenReview(card.id)}
                            className="rounded-lg bg-muted px-2.5 py-1.5 text-[11px] font-bold text-foreground hover:bg-muted/80"
                          >
                            <Eye className="inline w-3 h-3 mr-1" /> View
                          </button>
                          <button
                            onClick={() => {
                              setCardsPendingRemove([card.id]);
                              setRemoveConfirmOpen(true);
                            }}
                            className="rounded-lg bg-red-50 dark:bg-red-950/40 px-2.5 py-1.5 text-[11px] font-bold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50"
                            title="Remove from approved cards"
                          >
                            <Trash2 className="inline w-3 h-3 mr-1" /> Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Plain confirmation dialog for card removal */}
          <AlertDialog open={removeConfirmOpen} onOpenChange={setRemoveConfirmOpen}>
            <AlertDialogContent className="bg-card border-border">
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Remove {cardsPendingRemove.length} card{cardsPendingRemove.length === 1 ? "" : "s"} from Approved cards?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  They will be archived from active approved cards into history.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={removingCards}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    try {
                      setRemovingCards(true);
                      await onRemoveApproved?.(cardsPendingRemove);
                      setRemoveConfirmOpen(false);
                    } catch (err) {
                      toast.error("Failed to remove cards", {
                        description: err instanceof Error ? err.message : "Error",
                      });
                    } finally {
                      setRemovingCards(false);
                    }
                  }}
                  disabled={removingCards}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold"
                >
                  {removingCards ? "Removing..." : "Remove"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {totalApprovedPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-border bg-muted/30">
              <div className="text-xs text-muted-foreground">
                Page {approvedPage} of {totalApprovedPages} ({approvedCards.length} {approvedCards.length === 1 ? "card" : "cards"})
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={approvedPage <= 1}
                  onClick={() => setApprovedPage((p) => Math.max(1, p - 1))}
                  className="h-8 rounded-lg text-xs font-bold"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={approvedPage >= totalApprovedPages}
                  onClick={() => setApprovedPage((p) => Math.min(totalApprovedPages, p + 1))}
                  className="h-8 rounded-lg text-xs font-bold"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}


      {/* 5. Audit Logs Tab */}
      {isAudit && (
        <AuditLogsSection
          activity={activity}
          authenticatedUser={authenticatedUser}
          portal={authenticatedUser.role === "SUPER_ADMIN" ? "admin" : "school"}
          schools={schools}
          onClearAuditLogs={onClearAuditLogs}
        />
      )}

      {/* 6. Schools Table View */}
      {isSchools && (
        <Card className="rounded-2xl border-border bg-card shadow-[0_12px_35px_rgba(38,71,65,0.05)] overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search schools by name, code, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 rounded-xl border-border bg-background pl-9 text-xs shadow-none"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-muted-foreground mr-1">Status:</span>
                {(["All", "Active", "Inactive"] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => {
                      setSchoolsStatusFilter(status);
                      setSchoolsPage(1);
                    }}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${schoolsStatusFilter === status
                      ? "bg-primary text-white shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                  >
                    {status === "All" ? "All Schools" : status}
                  </button>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">
                Showing <b>{filteredSchools.length}</b> {filteredSchools.length === 1 ? "school" : "schools"}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[1120px]">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">School Name</th>
                  <th className="px-5 py-3.5">School Code / ID</th>
                  <th className="px-5 py-3.5">Phone</th>
                  <th className="px-5 py-3.5">School Login ID</th>
                  <th className="px-5 py-3.5">Password / ID Pass</th>
                  <th className="px-5 py-3.5">Template</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedSchools.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-sm text-muted-foreground">
                      <Building2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                      <p className="font-semibold text-foreground">
                        {searchTerm || schoolsStatusFilter !== "All"
                          ? "No schools matching your search or filter"
                          : "No schools registered yet"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {searchTerm || schoolsStatusFilter !== "All"
                          ? "Try changing your search term or filter options."
                          : 'Click "Create new" above to add a new school and generate its credentials.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedSchools.map((school) => (
                    <tr key={school.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-extrabold text-foreground flex items-center gap-2">
                              {school.name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <div>
                            <span className="font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded text-xs">
                              {school.shortCode}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            ID: #{school.id}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {school.phone ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground">{school.phone}</span>
                            <button
                              type="button"
                              onClick={() => void copySchoolDetail(school.phone!, "Phone number")}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-primary hover:bg-primary/10"
                              title="Copy phone number"
                              aria-label={`Copy phone number for ${school.name}`}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not added</span>
                        )}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {getSchoolLoginId(school) ? (
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-md bg-primary/10 px-2 py-1 font-mono font-bold text-primary">
                              {getSchoolLoginId(school)}
                            </span>
                            <button
                              type="button"
                              onClick={() => void copySchoolDetail(getSchoolLoginId(school), "School Login ID")}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-primary hover:bg-primary/10"
                              title="Copy School Login ID"
                              aria-label={`Copy School Login ID for ${school.name}`}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not generated</span>
                        )}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {authenticatedUser.role === "SUPER_ADMIN" && school.credentials?.password ? (
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-md border border-border bg-muted px-2 py-1 font-mono font-bold text-foreground">
                              {school.credentials.password}
                            </span>
                            <button
                              type="button"
                              onClick={() => void copySchoolDetail(school.credentials!.password, "ID Pass")}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-primary hover:bg-primary/10"
                              title="Copy ID Pass"
                              aria-label={`Copy ID Pass for ${school.name}`}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : authenticatedUser.role === "SUPER_ADMIN" ? (
                          <button
                            type="button"
                            onClick={() => onGenerateCredentials?.(school)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-primary hover:bg-primary/15"
                            title="Generate a new ID Pass to display and copy"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            Generate to view
                          </button>
                        ) : (
                          <span className="text-muted-foreground">Restricted</span>
                        )}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {school.templateSelectionStatus === "Selected" ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 dark:border-teal-900/50 bg-teal-50 dark:bg-teal-950/40 px-2.5 py-0.5 text-[10px] font-bold text-teal-800 dark:text-teal-300">
                            <CheckCircle2 className="h-3 w-3 text-teal-600 dark:text-teal-400" />
                            {school.selectedTemplateName || "Selected"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                            <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                            Not Selected
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {authenticatedUser.role === "SUPER_ADMIN" ? (
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={school.isActive}
                              onCheckedChange={() => onToggleSchoolStatus?.(school)}
                              className="data-[state=checked]:bg-primary"
                              aria-label={`Toggle active status for ${school.name}`}
                            />
                            <span
                              className={`text-xs font-bold ${school.isActive ? "text-primary" : "text-muted-foreground"
                                }`}
                            >
                              {school.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                        ) : (
                          <StatusPill tone={school.isActive ? "teal" : "coral"}>
                            {school.isActive ? "Active" : "Inactive"}
                          </StatusPill>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {authenticatedUser.role === "SUPER_ADMIN" && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-sm hover:border-primary hover:bg-primary/10 hover:text-primary focus:outline-none"
                                  title="Actions"
                                  aria-label={`Actions for ${school.name}`}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-36 bg-card p-1 rounded-xl shadow-lg border border-border">
                                <DropdownMenuItem
                                  onClick={() => onGenerateCredentials?.(school)}
                                  className="flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-primary hover:bg-primary/10 rounded-lg cursor-pointer"
                                >
                                  <KeyRound className="h-3.5 w-3.5" />
                                  View
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => onEditSchool?.(school)}
                                  className="flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-foreground hover:bg-muted rounded-lg cursor-pointer"
                                >
                                  <FileEdit className="h-3.5 w-3.5" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => onDeleteSchool?.(school.id, school.name)}
                                  className="flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalSchoolPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-border bg-muted/30">
              <div className="text-xs text-muted-foreground">
                Page {schoolsPage} of {totalSchoolPages} ({filteredSchools.length} {filteredSchools.length === 1 ? "school" : "schools"})
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={schoolsPage <= 1}
                  onClick={() => setSchoolsPage((p) => Math.max(1, p - 1))}
                  className="h-8 rounded-lg text-xs font-bold"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={schoolsPage >= totalSchoolPages}
                  onClick={() => setSchoolsPage((p) => Math.min(totalSchoolPages, p + 1))}
                  className="h-8 rounded-lg text-xs font-bold"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* 7. Reports module */}
      {label === "Reports" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <button
              onClick={() => setReportsTab("student_removed")}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                reportsTab === "student_removed"
                  ? "bg-primary text-white shadow-2xs"
                  : "bg-card text-muted-foreground border border-border hover:bg-muted/50"
              }`}
            >
              Removed Cards History
            </button>
            <button
              onClick={() => setReportsTab("staff_removed")}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                reportsTab === "staff_removed"
                  ? "bg-primary text-white shadow-2xs"
                  : "bg-card text-muted-foreground border border-border hover:bg-muted/50"
              }`}
            >
              Removed Cards History for staff id cards
            </button>
          </div>

          {reportsTab === "student_removed" ? (
            <RemovedCardsHistorySection user={authenticatedUser} schools={schools} cardType="student" />
          ) : (
            <RemovedCardsHistorySection user={authenticatedUser} schools={schools} cardType="staff" />
          )}
        </div>
      )}

      {/* 8. Users Standard Table */}
      {isUsers && (
        <Card className="rounded-2xl border-border bg-card shadow-[0_12px_35px_rgba(38,71,65,0.05)]">
          <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 rounded-xl border-border bg-background pl-9 text-xs shadow-none"
              />
            </div>
          </div>
          <div className="divide-y divide-border">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-muted/30 border-b border-border">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-muted-foreground mr-1">Role:</span>
                {["All", "SUPER_ADMIN", "SCHOOL_ADMIN", "MARKETING_ADMIN", "VIEWER"].map((role) => (
                  <button
                    key={role}
                    onClick={() => {
                      setUserRoleFilter(role);
                      setUsersPage(1);
                    }}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${userRoleFilter === role
                      ? "bg-primary text-white shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                  >
                    {role === "All" ? "All Roles" : role === "MARKETING_ADMIN" ? "Marketing Admin" : role.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">
                Showing <b>{filteredUsers.length}</b> {filteredUsers.length === 1 ? "user" : "users"}
              </div>
            </div>

            {paginatedUsers.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No users matching the selected filter or search term.
              </div>
            ) : (
              paginatedUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold text-xs shrink-0">
                      {user.name ? user.name[0]?.toUpperCase() : "U"}
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-foreground flex items-center gap-2">
                        {user.name || user.email || "User"}
                        {user.schoolId && (
                          <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                            School #{user.schoolId}
                          </span>
                        )}
                      </div>
                      {user.email && (
                        <div className="text-[11px] text-muted-foreground">
                          {user.email}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill
                      tone={
                        user.role === "SUPER_ADMIN"
                          ? "indigo"
                          : user.role === "MARKETING_ADMIN"
                          ? "yellow"
                          : "teal"
                      }
                    >
                      {user.role === "MARKETING_ADMIN" ? "Marketing Admin" : user.role.replace(/_/g, " ")}
                    </StatusPill>

                    {authenticatedUser.role === "SUPER_ADMIN" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-2xs hover:border-primary hover:bg-primary/10 hover:text-primary focus:outline-none"
                            title="Actions"
                            aria-label={`Actions for user ${user.name || user.openId}`}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36 bg-card p-1 rounded-xl shadow-lg border border-border">
                          <DropdownMenuItem
                            onClick={() => onEditUser?.(user)}
                            className="flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-foreground hover:bg-muted rounded-lg cursor-pointer"
                          >
                            <FileEdit className="h-3.5 w-3.5" />
                            Edit
                          </DropdownMenuItem>
                          {user.id !== authenticatedUser.id && (
                            <DropdownMenuItem
                              onClick={() => onDeleteUser?.(user)}
                              className="flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))
            )}

            {totalUserPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-border bg-muted/30">
                <div className="text-xs text-muted-foreground">
                  Page {usersPage} of {totalUserPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={usersPage <= 1}
                    onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                    className="h-8 rounded-lg text-xs font-bold"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={usersPage >= totalUserPages}
                    onClick={() => setUsersPage((p) => Math.min(totalUserPages, p + 1))}
                    className="h-8 rounded-lg text-xs font-bold"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </section>
  );
}

