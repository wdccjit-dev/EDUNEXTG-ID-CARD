import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { api, type ApiSchoolDeletionSummary } from "@/lib/api";

interface DeleteSchoolDialogProps {
  /** School to delete; the dialog is open whenever this is set. */
  school: { id: number; name: string; shortCode?: string } | null;
  /** Called when the user cancels or the dialog is dismissed (never while deleting). */
  onClose: () => void;
  /** Performs the deletion. Should throw on failure so the dialog can stay open. */
  onConfirm: (school: { id: number; name: string }, summary: ApiSchoolDeletionSummary | null) => Promise<void>;
}

const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

export default function DeleteSchoolDialog({ school, onClose, onConfirm }: DeleteSchoolDialogProps) {
  const [summary, setSummary] = useState<ApiSchoolDeletionSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const schoolId = school?.id ?? null;

  useEffect(() => {
    setTypedName("");
    setSummary(null);
    setSummaryFailed(false);
    if (schoolId === null) return;

    let cancelled = false;
    setLoadingSummary(true);
    api.schools
      .deletionSummary(schoolId)
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .catch(() => {
        if (!cancelled) setSummaryFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingSummary(false);
      });

    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  if (!school) return null;

  const expectedNames = [school.name, school.shortCode].filter((v): v is string => Boolean(v && v.trim()));
  const confirmed = expectedNames.some((name) => normalize(name) === normalize(typedName));
  const canDelete = confirmed && !deleting && !loadingSummary;

  const handleConfirm = async () => {
    if (!canDelete) return;
    setDeleting(true);
    try {
      await onConfirm({ id: school.id, name: school.name }, summary);
    } catch {
      // The caller shows the error toast; keep the dialog open so the user can retry or cancel.
    } finally {
      setDeleting(false);
    }
  };

  const requestClose = () => {
    if (!deleting) onClose();
  };

  const cardText = summary ? `${summary.cards} ID card${summary.cards === 1 ? "" : "s"}` : "ALL ID cards";

  return (
    <AlertDialog open onOpenChange={(open) => !open && requestClose()}>
      <AlertDialogContent className="max-w-md rounded-2xl border border-red-100 bg-white p-6 shadow-xl">
        <AlertDialogHeader className="items-center text-center sm:text-center">
          <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertTriangle className="h-7 w-7" aria-hidden="true" />
          </div>
          <AlertDialogTitle className="text-xl font-extrabold text-[#182326]">Delete school?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm leading-relaxed text-[#55605d]">
              <p>
                You are about to permanently delete <strong className="text-[#182326]">{school.name}</strong>.{" "}
                <strong className="text-red-600">{cardText} associated with this school will be deleted</strong>, along
                with their photos, data and approval history, plus all user accounts, template selections, requests,
                notifications and audit logs for this school.
              </p>

              {loadingSummary && (
                <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Counting records…
                </div>
              )}

              {summary && (
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    ["ID cards", summary.cards],
                    ["Users", summary.users],
                    ["Requests", summary.requests],
                    ["Orders", summary.orders ?? 0],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-xl border border-red-100 bg-red-50 px-2 py-2">
                      <div className="text-lg font-extrabold text-red-600">{value}</div>
                      <div className="text-[11px] font-semibold text-red-500">{label}</div>
                    </div>
                  ))}
                </div>
              )}

              {summaryFailed && (
                <p className="text-xs text-amber-600">Could not load record counts, but the deletion still applies to everything above.</p>
              )}

              <p className="font-semibold text-red-600">This action cannot be undone.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="mt-2 space-y-1.5">
          <label htmlFor="delete-school-confirm" className="text-xs font-semibold text-[#45544f]">
            Type <span className="font-extrabold text-[#182326]">{school.name}</span> to confirm
          </label>
          <input
            id="delete-school-confirm"
            value={typedName}
            onChange={(event) => setTypedName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleConfirm();
            }}
            disabled={deleting}
            autoComplete="off"
            spellCheck={false}
            className="h-10 w-full rounded-xl border border-[#d3ded8] bg-white px-3 text-sm text-[#182326] focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400 disabled:opacity-60"
          />
        </div>

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            autoFocus
            onClick={requestClose}
            disabled={deleting}
            className="h-10 rounded-xl px-4 text-xs font-bold"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={!canDelete}
            className="h-10 rounded-xl bg-red-600 px-4 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {deleting ? "Deleting…" : "Delete school"}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
