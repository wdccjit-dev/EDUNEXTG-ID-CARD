import { useState, useMemo } from "react";
import {
  Building2,
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Palette,
  Eye,
  Send,
  Printer,
  FileText,
  User,
  Trash2,
  Download,
  Calendar,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow, format } from "date-fns";
import type { ApiActivity, ApiAuthUser, ApiSchool } from "@/lib/api";

interface AuditLogsSectionProps {
  activity: ApiActivity[];
  authenticatedUser: ApiAuthUser;
  portal: "admin" | "school";
  schools: ApiSchool[];
  onClearAuditLogs?: () => void;
}

export default function AuditLogsSection({
  activity,
  authenticatedUser,
  portal,
  schools,
  onClearAuditLogs,
}: AuditLogsSectionProps) {
  const isAdmin = authenticatedUser.role === "SUPER_ADMIN" || portal === "admin";

  // Mode: "school" or "admin". School users can ONLY view "school" logs.
  const [activeMode, setActiveMode] = useState<"school" | "admin">("school");

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [schoolFilter, setSchoolFilter] = useState<string>("ALL");
  const [schoolActionFilter, setSchoolActionFilter] = useState<string>("ALL");
  const [adminActionFilter, setAdminActionFilter] = useState<string>("ALL");

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Helper to identify admin vs school activities
  const isDedicatedAdminActivity = (act: ApiActivity): boolean => {
    const adminActions = [
      "CREATE_TEMPLATE",
      "UPDATE_TEMPLATE",
      "UPDATE_TEMPLATE_STATUS",
      "DELETE_TEMPLATE",
      "CREATE_SCHOOL",
      "UPDATE_SCHOOL",
      "UPDATE_SCHOOL_STATUS",
      "DELETE_SCHOOL",
      "GENERATE_SCHOOL_CREDENTIALS",
      "CREATE_USER",
      "UPDATE_USER",
      "UPDATE_USER_STATUS",
      "DELETE_USER",
      "PRINT_ID_CARD",
      "BULK_PRINT",
      "RESUBMIT_ID_CARD",
      "CLEAR_AUDIT_LOGS",
      "UPDATE_PROFILE",
      "UPDATE_PROFILE_PICTURE",
      "REMOVE_PROFILE_PICTURE",
      "CHANGE_PASSWORD",
    ];

    if (adminActions.includes(act.action)) return true;
    if (act.userRole === "SUPER_ADMIN" && !act.schoolId) return true;
    return false;
  };

  // Partition all activities
  const { schoolLogs, adminLogs } = useMemo(() => {
    const sLogs: ApiActivity[] = [];
    const aLogs: ApiActivity[] = [];

    for (const act of activity) {
      if (isDedicatedAdminActivity(act)) {
        aLogs.push(act);
      } else {
        sLogs.push(act);
      }

      // If an admin performed an action on behalf of a school (like template select or approval),
      // we also record it in aLogs so admin activities show everything the admin did
      if (act.userRole === "SUPER_ADMIN" && !isDedicatedAdminActivity(act)) {
        aLogs.push(act);
      }
    }

    return { schoolLogs: sLogs, adminLogs: aLogs };
  }, [activity]);

  // Current working dataset based on mode
  const currentDataset = (!isAdmin || activeMode === "school") ? schoolLogs : adminLogs;

  // Filtered dataset
  const filteredDataset = useMemo(() => {
    let result = currentDataset;

    // School selector filter (applicable in school mode or admin view)
    if (isAdmin && activeMode === "school" && schoolFilter !== "ALL") {
      const sid = Number(schoolFilter);
      result = result.filter((item) => item.schoolId === sid);
    }

    // Action filter for School Logs
    if (activeMode === "school" && schoolActionFilter !== "ALL") {
      if (schoolActionFilter === "TEMPLATE_SELECTION") {
        result = result.filter(
          (i) => i.action === "SELECT_TEMPLATE" || i.action === "UNSELECT_TEMPLATE" || i.action === "LOCK_TEMPLATE" || i.action === "UNLOCK_TEMPLATE"
        );
      } else if (schoolActionFilter === "APPROVED") {
        result = result.filter((i) => i.action === "APPROVE_ID_CARD");
      } else if (schoolActionFilter === "REJECTED") {
        result = result.filter((i) => i.action === "REJECT_ID_CARD");
      } else if (schoolActionFilter === "CHANGES_REQUIRED") {
        result = result.filter((i) => i.action === "REQUEST_CHANGES");
      } else if (schoolActionFilter === "OTHER_CARDS") {
        result = result.filter(
          (i) =>
            i.action !== "SELECT_TEMPLATE" &&
            i.action !== "UNSELECT_TEMPLATE" &&
            i.action !== "APPROVE_ID_CARD" &&
            i.action !== "REJECT_ID_CARD" &&
            i.action !== "REQUEST_CHANGES"
        );
      }
    }

    // Action filter for Admin Logs
    if (activeMode === "admin" && adminActionFilter !== "ALL") {
      if (adminActionFilter === "TEMPLATES") {
        result = result.filter((i) => i.action.includes("TEMPLATE"));
      } else if (adminActionFilter === "SCHOOLS") {
        result = result.filter((i) => i.action.includes("SCHOOL"));
      } else if (adminActionFilter === "USERS") {
        result = result.filter((i) => i.action.includes("USER"));
      } else if (adminActionFilter === "PRINT") {
        result = result.filter((i) => i.action.includes("PRINT") || i.action.includes("PDF"));
      } else if (adminActionFilter === "SYSTEM") {
        result = result.filter(
          (i) =>
            i.action.includes("PASSWORD") ||
            i.action.includes("PROFILE") ||
            i.action.includes("CLEAR")
        );
      }
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((item) => {
        const actionMatch = item.action.toLowerCase().includes(q);
        const schoolNameMatch = item.schoolName?.toLowerCase().includes(q);
        const schoolCodeMatch = item.schoolCode?.toLowerCase().includes(q);
        const userMatch = item.userName?.toLowerCase().includes(q) || item.userEmail?.toLowerCase().includes(q);
        const nv = item.newValues as Record<string, any> | undefined;
        const templateMatch = nv?.templateName?.toLowerCase().includes(q);
        const studentMatch = nv?.studentName?.toLowerCase().includes(q);
        const cardNumMatch = nv?.cardNumber?.toLowerCase().includes(q);
        const commentMatch = nv?.comment?.toLowerCase().includes(q) || nv?.reason?.toLowerCase().includes(q);

        return (
          actionMatch ||
          schoolNameMatch ||
          schoolCodeMatch ||
          userMatch ||
          templateMatch ||
          studentMatch ||
          cardNumMatch ||
          commentMatch
        );
      });
    }

    return result;
  }, [
    currentDataset,
    isAdmin,
    activeMode,
    schoolFilter,
    schoolActionFilter,
    adminActionFilter,
    searchQuery,
  ]);

  // Paginated items
  const totalPages = Math.max(1, Math.ceil(filteredDataset.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDataset.slice(start, start + pageSize);
  }, [filteredDataset, currentPage, pageSize]);

  // Stats calculation for School Logs
  // CSV Export handler
  const handleExportCSV = () => {
    const headers = [
      "ID",
      "Timestamp",
      "Scope",
      "Action",
      "School Name",
      "School Code",
      "User Name",
      "User Role",
      "Template Name",
      "Card Number",
      "Student Name",
      "Comment/Reason",
    ];

    const rows = filteredDataset.map((item) => {
      const nv = (item.newValues as Record<string, any>) || {};
      return [
        item.id,
        new Date(item.createdAt).toISOString(),
        activeMode === "admin" ? "Admin" : "School",
        item.action,
        item.schoolName || "",
        item.schoolCode || "",
        item.userName || "",
        item.userRole || "",
        nv.templateName || "",
        nv.cardNumber || "",
        nv.studentName || "",
        `"${(nv.comment || nv.reason || "").replace(/"/g, '""')}"`,
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `audit-logs-${activeMode}-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Main Filter & Action Bar */}
      <Card className="rounded-2xl border-[#e2e8e3] bg-[#fffefa] shadow-[0_12px_35px_rgba(38,71,65,0.05)] overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#edf0ed] space-y-3">
          {/* Top Row: School Logs <-> Admin Logs Slider Toggle + Actions */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* School Logs vs Admin Logs Toggle Slider */}
            <div
              role="radiogroup"
              aria-label="Audit Log Scope Selector"
              className="relative flex items-center p-1 rounded-2xl bg-[#e3eae5] border border-[#cbd8d0] shadow-inner"
            >
              {/* School Logs Button */}
              <button
                type="button"
                onClick={() => {
                  setActiveMode("school");
                  setPage(1);
                }}
                className={`relative z-10 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                  activeMode === "school"
                    ? "bg-[#0f7f79] text-white shadow-md font-extrabold scale-[1.02]"
                    : "text-[#475753] hover:text-[#182326] hover:bg-black/5"
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>School Logs</span>
                <span
                  className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-bold ${
                    activeMode === "school" ? "bg-white/25 text-white" : "bg-[#cfdbd3] text-[#34423f]"
                  }`}
                >
                  {schoolLogs.length}
                </span>
              </button>

              {/* Admin Logs Button (Slider) */}
              <button
                type="button"
                onClick={() => {
                  setActiveMode("admin");
                  setPage(1);
                }}
                className={`relative z-10 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                  activeMode === "admin"
                    ? "bg-[#0f7f79] text-white shadow-md font-extrabold scale-[1.02]"
                    : "text-[#475753] hover:text-[#182326] hover:bg-black/5"
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Admin Logs</span>
                <span
                  className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-bold ${
                    activeMode === "admin" ? "bg-white/25 text-white" : "bg-[#cfdbd3] text-[#34423f]"
                  }`}
                >
                  {adminLogs.length}
                </span>
              </button>
            </div>

            {/* Top Action Buttons: Export CSV & Clear logs */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 rounded-xl border border-[#d2ddd5] bg-white px-3 py-2 text-xs font-bold text-[#445652] hover:bg-[#f6f9f7] transition-all cursor-pointer shadow-2xs"
                title="Export filtered logs to CSV"
              >
                <Download className="h-3.5 w-3.5 text-[#0f7f79]" />
                <span>Export CSV</span>
              </button>

              {activity.length > 0 && onClearAuditLogs && (
                <button
                  type="button"
                  onClick={onClearAuditLogs}
                  className="flex items-center gap-1.5 rounded-xl border border-[#fecaca] bg-[#fff5f5] px-3 py-2 text-xs font-bold text-[#dc2626] hover:bg-[#fee2e2] transition-all cursor-pointer shadow-2xs"
                  title="Clear all audit logs"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Clear logs</span>
                </button>
              )}
            </div>
          </div>

          {/* Search Row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1 border-t border-[#f0f4f1]">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a4a1]" />
              <Input
                placeholder={
                  activeMode === "school"
                    ? "Search school, template, student name, card #, comments..."
                    : "Search admin action, admin user, target entity..."
                }
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="h-10 rounded-xl border-[#dce5e0] pl-9 text-xs shadow-none focus-visible:ring-1 focus-visible:ring-[#0f7f79]"
              />
            </div>
          </div>

          {/* Filter Pills row */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#f0f4f1]">
            {/* School selector dropdown for Admin viewing School Logs */}
            {isAdmin && activeMode === "school" && schools.length > 0 && (
              <div className="flex items-center gap-1.5 mr-2">
                <span className="text-xs font-bold text-[#4e5c59]">School:</span>
                <select
                  value={schoolFilter}
                  onChange={(e) => {
                    setSchoolFilter(e.target.value);
                    setPage(1);
                  }}
                  className="h-8 rounded-lg border border-[#dce5e0] bg-white px-2.5 text-xs font-medium text-[#2d3b38] focus:outline-none focus:ring-1 focus:ring-[#0f7f79]"
                >
                  <option value="ALL">All Schools ({schools.length})</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.shortCode})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* School Activity Filter Pills */}
            {activeMode === "school" ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-[#4e5c59] mr-1">Activity:</span>
                {[
                  { key: "ALL", label: "All Activities" },
                  { key: "TEMPLATE_SELECTION", label: "Template Selected / Changed" },
                  { key: "APPROVED", label: "Approved Cards" },
                  { key: "REJECTED", label: "Rejected Cards" },
                  { key: "CHANGES_REQUIRED", label: "Changes Requested" },
                  { key: "OTHER_CARDS", label: "Other Operations" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setSchoolActionFilter(item.key);
                      setPage(1);
                    }}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                      schoolActionFilter === item.key
                        ? "bg-[#0f7f79] text-white shadow-xs"
                        : "bg-[#eef3f0] text-[#55605d] hover:bg-[#e2ebe6]"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : (
              /* Admin Activity Filter Pills */
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-[#4e5c59] mr-1">Admin Domain:</span>
                {[
                  { key: "ALL", label: "All Admin Activity" },
                  { key: "TEMPLATES", label: "Templates" },
                  { key: "SCHOOLS", label: "Schools" },
                  { key: "USERS", label: "Users" },
                  { key: "PRINT", label: "Printing / PDF" },
                  { key: "SYSTEM", label: "Security & System" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setAdminActionFilter(item.key);
                      setPage(1);
                    }}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                      adminActionFilter === item.key
                        ? "bg-[#0f7f79] text-white shadow-xs"
                        : "bg-[#eef3f0] text-[#55605d] hover:bg-[#e2ebe6]"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Audit Log Entries List */}
        <div className="divide-y divide-[#edf0ed]">
          {paginatedLogs.length === 0 ? (
            <div className="px-5 py-16 text-center text-[#98a4a1]">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4f7f5] text-[#718580]">
                <Search className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-[#50615d]">No logs found</p>
              <p className="text-xs text-[#82928e] mt-1">Try clearing your search or switching categories.</p>
            </div>
          ) : (
            paginatedLogs.map((log) => {
              const nv = (log.newValues as Record<string, any>) || {};

              return (
                <div
                  key={log.id}
                  className="p-4 sm:p-4.5 hover:bg-[#fafbfa] transition-colors duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  {/* Left: Icon, Action Title & Clear Simple Details */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="mt-0.5 shrink-0">
                      <ActionStatusIcon action={log.action} />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      {/* Main readable statement */}
                      <div className="text-xs sm:text-[13px] font-semibold text-[#1f2d2a] leading-snug">
                        <RenderActionNarrative log={log} />
                      </div>

                      {/* Comment / Reason if available */}
                      {(nv.comment || nv.reason || nv.reviewNote) && (
                        <div className="inline-block mt-1 text-[11px] text-[#475753] bg-[#f0f4f1] border border-[#dce5e0] px-2.5 py-0.5 rounded-md italic">
                          "{nv.comment || nv.reason || nv.reviewNote}"
                        </div>
                      )}

                      {/* Actor & School metadata tags */}
                      <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] text-[#788884]">
                        {log.schoolName && (
                          <span className="font-semibold text-[#0f7f79]">
                            {log.schoolName}
                          </span>
                        )}
                        {log.schoolName && <span>•</span>}
                        <span>By {log.userName || "System"}</span>
                        {log.userRole && (
                          <span className="text-[#95a3a0]">({log.userRole.replace("_", " ")})</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Clean Timestamp & Badges */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-[#f2f4f2]">
                    <RenderActionBadge action={log.action} />
                    <span className="text-[11px] text-[#849490] font-medium whitespace-nowrap">
                      {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#edf0ed] px-5 py-3 text-xs text-[#637571]">
            <div>
              Showing <b>{(currentPage - 1) * pageSize + 1}</b> to{" "}
              <b>{Math.min(currentPage * pageSize, filteredDataset.length)}</b> of{" "}
              <b>{filteredDataset.length}</b> events
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-[#dce5e0] px-3 py-1 font-bold text-[#354643] hover:bg-[#f2f7f4] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="font-mono text-xs">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-[#dce5e0] px-3 py-1 font-bold text-[#354643] hover:bg-[#f2f7f4] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/** Renders colorful, distinct action badges */
function RenderActionBadge({ action }: { action: string }) {
  switch (action) {
    case "SELECT_TEMPLATE":
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-[#dcfce7] border border-[#86efac] px-2 py-0.5 text-xs font-bold text-[#15803d]">
          <Palette className="h-3 w-3" />
          Template Selected
        </span>
      );
    case "UNSELECT_TEMPLATE":
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-[#fef3c7] border border-[#fde047] px-2 py-0.5 text-xs font-bold text-[#a16207]">
          <Palette className="h-3 w-3" />
          Template Unselected
        </span>
      );
    case "APPROVE_ID_CARD":
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-[#dcfce7] border border-[#86efac] px-2 py-0.5 text-xs font-bold text-[#15803d]">
          <CheckCircle2 className="h-3 w-3" />
          ID Card Approved
        </span>
      );
    case "REJECT_ID_CARD":
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-[#fee2e2] border border-[#fca5a5] px-2 py-0.5 text-xs font-bold text-[#b91c1c]">
          <XCircle className="h-3 w-3" />
          ID Card Rejected
        </span>
      );
    case "REQUEST_CHANGES":
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-[#ffedd5] border border-[#fdba74] px-2 py-0.5 text-xs font-bold text-[#c2410c]">
          <AlertTriangle className="h-3 w-3" />
          Changes Requested
        </span>
      );
    case "START_REVIEW":
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-[#e0e7ff] border border-[#a5b4fc] px-2 py-0.5 text-xs font-bold text-[#4338ca]">
          <Eye className="h-3 w-3" />
          Under Review
        </span>
      );
    case "SUBMIT_ID_CARD":
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-[#cffafe] border border-[#67e8f9] px-2 py-0.5 text-xs font-bold text-[#0e7490]">
          <Send className="h-3 w-3" />
          Card Submitted
        </span>
      );
    case "PRINT_ID_CARD":
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-[#dcfce7] border border-[#86efac] px-2 py-0.5 text-xs font-bold text-[#166534]">
          <Printer className="h-3 w-3" />
          Card Printed
        </span>
      );
    case "CREATE_SCHOOL":
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-[#e0f2fe] border border-[#7dd3fc] px-2 py-0.5 text-xs font-bold text-[#0369a1]">
          <Building2 className="h-3 w-3" />
          School Created
        </span>
      );
    case "UPDATE_SCHOOL":
    case "UPDATE_SCHOOL_STATUS":
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-[#f1f5f9] border border-[#cbd5e1] px-2 py-0.5 text-xs font-bold text-[#334155]">
          <Building2 className="h-3 w-3" />
          School Updated
        </span>
      );
    case "CREATE_TEMPLATE":
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-[#fdf4ff] border border-[#f0abfc] px-2 py-0.5 text-xs font-bold text-[#a21caf]">
          <Palette className="h-3 w-3" />
          Template Created
        </span>
      );
    case "UPDATE_TEMPLATE":
    case "UPDATE_TEMPLATE_STATUS":
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-[#f5f3ff] border border-[#ddd6fe] px-2 py-0.5 text-xs font-bold text-[#6d28d9]">
          <Palette className="h-3 w-3" />
          Template Modified
        </span>
      );
    case "GENERATE_SCHOOL_CREDENTIALS":
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-[#fef9c3] border border-[#fde047] px-2 py-0.5 text-xs font-bold text-[#854d0e]">
          Credentials Issued
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-[#f1f5f9] border border-[#cbd5e1] px-2 py-0.5 font-mono text-xs font-bold text-[#475569]">
          {action}
        </span>
      );
  }
}

/** Renders a clear circular icon indicating action tone */
function ActionStatusIcon({ action }: { action: string }) {
  if (action === "SELECT_TEMPLATE") {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e8f6f0] text-[#16a34a]">
        <Palette className="h-3.5 w-3.5" />
      </div>
    );
  }
  if (action === "UNSELECT_TEMPLATE") {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#fef3c7] text-[#d97706]">
        <Palette className="h-3.5 w-3.5" />
      </div>
    );
  }
  if (action === "APPROVE_ID_CARD") {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#dcfce7] text-[#16a34a]">
        <CheckCircle2 className="h-3.5 w-3.5" />
      </div>
    );
  }
  if (action === "REJECT_ID_CARD") {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#fee2e2] text-[#dc2626]">
        <XCircle className="h-3.5 w-3.5" />
      </div>
    );
  }
  if (action === "REQUEST_CHANGES") {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ffedd5] text-[#ea580c]">
        <AlertTriangle className="h-3.5 w-3.5" />
      </div>
    );
  }
  if (action.includes("PRINT")) {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e0f2fe] text-[#0284c7]">
        <Printer className="h-3.5 w-3.5" />
      </div>
    );
  }
  if (action.includes("SCHOOL")) {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f0fdf4] text-[#0f7f79]">
        <Building2 className="h-3.5 w-3.5" />
      </div>
    );
  }
  if (action.includes("TEMPLATE")) {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#fdf4ff] text-[#a21caf]">
        <Palette className="h-3.5 w-3.5" />
      </div>
    );
  }

  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f1f5f9] text-[#64748b]">
      <FileText className="h-3.5 w-3.5" />
    </div>
  );
}

/** Renders simple, plain-English statements that anyone can understand instantly */
function RenderActionNarrative({ log }: { log: ApiActivity }) {
  const nv = (log.newValues as Record<string, any>) || {};
  const schoolName = log.schoolName || "School";

  switch (log.action) {
    case "SELECT_TEMPLATE":
      return (
        <span>
          <span className="font-bold text-[#14532d]">{schoolName}</span> chose{" "}
          <span className="font-bold text-[#0f7f79]">
            {nv.templateName ? `"${nv.templateName}"` : `Template #${nv.templateId || log.entityId}`}
          </span>{" "}
          as their ID card template
        </span>
      );

    case "UNSELECT_TEMPLATE":
      return (
        <span>
          <span className="font-bold text-[#78350f]">{schoolName}</span> unselected template{" "}
          <span className="font-semibold">"{nv.templateName || "default"}"</span>
        </span>
      );

    case "APPROVE_ID_CARD":
      return (
        <span>
          <span className="font-bold text-[#14532d]">{schoolName}</span> approved card{" "}
          <span className="font-bold text-[#0f7f79]">
            {nv.cardNumber ? `#${nv.cardNumber}` : log.entityId ? `#${log.entityId}` : ""}
          </span>
          {nv.studentName ? <> for <b>{nv.studentName}</b></> : null}
        </span>
      );

    case "REJECT_ID_CARD":
      return (
        <span>
          <span className="font-bold text-[#7f1d1d]">{schoolName}</span> rejected card{" "}
          <span className="font-bold text-[#dc2626]">
            {nv.cardNumber ? `#${nv.cardNumber}` : log.entityId ? `#${log.entityId}` : ""}
          </span>
          {nv.studentName ? <> for <b>{nv.studentName}</b></> : null}
        </span>
      );

    case "REQUEST_CHANGES":
      return (
        <span>
          <span className="font-bold text-[#7c2d12]">{schoolName}</span> asked for changes on card{" "}
          <span className="font-bold text-[#ea580c]">
            {nv.cardNumber ? `#${nv.cardNumber}` : log.entityId ? `#${log.entityId}` : ""}
          </span>
          {nv.studentName ? <> for <b>{nv.studentName}</b></> : null}
        </span>
      );

    case "START_REVIEW":
      return (
        <span>
          <span className="font-bold text-[#312e81]">{schoolName}</span> started reviewing card{" "}
          <span className="font-bold">{nv.cardNumber || `#${log.entityId}`}</span>
          {nv.studentName ? <> for <b>{nv.studentName}</b></> : null}
        </span>
      );

    case "SUBMIT_ID_CARD":
      return (
        <span>
          Submitted card <span className="font-bold">{nv.cardNumber || `#${log.entityId}`}</span> for review
          {nv.studentName ? <> ({nv.studentName})</> : null}
        </span>
      );

    case "PRINT_ID_CARD":
      return (
        <span>
          Printed card <span className="font-bold text-[#0f7f79]">{nv.cardNumber || `#${log.entityId}`}</span>
          {nv.studentName ? <> for <b>{nv.studentName}</b></> : null}
        </span>
      );

    case "CREATE_SCHOOL":
      return (
        <span>
          Created new school <span className="font-bold text-[#0369a1]">"{nv.name || schoolName}"</span>
        </span>
      );

    case "UPDATE_SCHOOL":
    case "UPDATE_SCHOOL_STATUS":
      return (
        <span>
          Updated school <span className="font-bold text-[#1e293b]">"{schoolName}"</span>
          {nv.isActive !== undefined ? ` (${nv.isActive ? "Active" : "Inactive"})` : ""}
        </span>
      );

    case "GENERATE_SCHOOL_CREDENTIALS":
      return (
        <span>
          Generated login credentials for <span className="font-bold text-[#854d0e]">"{schoolName}"</span>
        </span>
      );

    case "CREATE_TEMPLATE":
      return (
        <span>
          Created template <span className="font-bold text-[#86198f]">"{nv.name || `Template #${log.entityId}`}"</span>
        </span>
      );

    case "UPDATE_TEMPLATE":
    case "UPDATE_TEMPLATE_STATUS":
      return (
        <span>
          Updated template <span className="font-bold text-[#5b21b6]">"{nv.name || `Template #${log.entityId}`}"</span>
        </span>
      );

    default:
      return (
        <span>
          <span className="font-medium text-[#0f7f79]">{log.action.replaceAll("_", " ")}</span>
          {log.entityType ? ` on ${log.entityType.toLowerCase().replaceAll("_", " ")}` : ""}
          {log.schoolName ? ` for ${log.schoolName}` : ""}
        </span>
      );
  }
}
