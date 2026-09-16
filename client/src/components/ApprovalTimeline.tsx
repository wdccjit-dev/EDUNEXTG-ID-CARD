import type { ApiApprovalHistoryItem } from "@/lib/api";
import { format } from "date-fns";
import {
  CheckCircle2,
  Clock3,
  AlertTriangle,
  RotateCcw,
  Printer,
  XCircle,
  FileEdit,
  Send,
  Eye,
} from "lucide-react";

interface ApprovalTimelineProps {
  history: ApiApprovalHistoryItem[];
  currentStatus: string;
  reviewNote?: string | null;
  className?: string;
}

const actionIcons: Record<string, typeof CheckCircle2> = {
  CREATE_ID_CARD: FileEdit,
  SUBMIT_ID_CARD: Send,
  START_REVIEW: Eye,
  REQUEST_CHANGES: AlertTriangle,
  RESUBMIT_ID_CARD: RotateCcw,
  APPROVE_ID_CARD: CheckCircle2,
  REJECT_ID_CARD: XCircle,
  PRINT_ID_CARD: Printer,
};

const actionLabels: Record<string, string> = {
  CREATE_ID_CARD: "Draft Created",
  SUBMIT_ID_CARD: "Submitted for Approval",
  START_REVIEW: "Review Started",
  REQUEST_CHANGES: "Changes Requested",
  RESUBMIT_ID_CARD: "Resubmitted with Updates",
  APPROVE_ID_CARD: "Approved & Finalized",
  REJECT_ID_CARD: "Rejected",
  PRINT_ID_CARD: "Printed",
};

const statusTones: Record<string, { bg: string; text: string; border: string }> = {
  DRAFT: { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-300" },
  SUBMITTED: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  UNDER_REVIEW: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  CHANGES_REQUIRED: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-300" },
  RESUBMITTED: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
  APPROVED: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300" },
  REJECTED: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-300" },
  PRINTED: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
};

export default function ApprovalTimeline({
  history,
  currentStatus,
  reviewNote,
  className = "",
}: ApprovalTimelineProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Prominent Banner if changes are required */}
      {currentStatus === "CHANGES_REQUIRED" && reviewNote && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-amber-950">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <span>Action Required: Admin Requested Changes</span>
          </div>
          <div className="mt-2 text-sm text-amber-800 pl-7 leading-relaxed bg-white/70 rounded-lg p-2.5 border border-amber-200">
            "{reviewNote}"
          </div>
          <div className="mt-2 text-xs text-amber-700 pl-7">
            Please edit the draft with the requested changes, save, and click <strong>Resubmit for Approval</strong>.
          </div>
        </div>
      )}

      {/* History Timeline */}
      <div className="relative pl-6 before:absolute before:bottom-0 before:left-2.5 before:top-2 before:w-0.5 before:bg-gray-200">
        {history.length === 0 ? (
          <div className="py-3 text-xs text-gray-400 italic">No activity recorded yet.</div>
        ) : (
          history.map((item) => {
            const Icon = actionIcons[item.action] || Clock3;
            const label = actionLabels[item.action] || item.action.replaceAll("_", " ");
            const tone = statusTones[item.toStatus] || statusTones.DRAFT;

            return (
              <div key={item.id} className="relative mb-5 last:mb-0">
                {/* Node icon */}
                <div
                  className={`absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border bg-white shadow-xs ${tone.border} ${tone.text}`}
                >
                  <Icon className="h-3 w-3" />
                </div>

                {/* Event details */}
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-gray-900">{label}</span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${tone.bg} ${tone.text} ${tone.border}`}
                    >
                      {item.toStatus}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {format(new Date(item.createdAt), "MMM d, yyyy · h:mm a")}
                    </span>
                  </div>

                  <div className="mt-0.5 text-xs text-gray-500">
                    by <span className="font-medium text-gray-700">{item.actorName || "System / User"}</span>
                    {item.actorRole && (
                      <span className="ml-1 text-[10px] text-gray-400">({item.actorRole})</span>
                    )}
                  </div>

                  {item.comments && (
                    <div className="mt-1.5 rounded-lg border border-gray-200 bg-gray-50/80 p-2.5 text-xs text-gray-700 leading-relaxed">
                      "{item.comments}"
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
