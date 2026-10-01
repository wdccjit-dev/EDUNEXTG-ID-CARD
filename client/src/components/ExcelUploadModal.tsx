import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { api, type ApiSchool, type ApiTemplate } from "@/lib/api";
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Info,
  Loader2,
  Upload,
  X,
} from "lucide-react";

interface ExcelUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schools: ApiSchool[];
  activeSchoolId?: number;
  templates: ApiTemplate[];
  userRole: string;
  onUploadSuccess: () => void;
}

interface UploadResult {
  processed: number;
  failed: number;
  total: number;
  errors?: Array<{ rowNumber: number; reason: string }>;
}

export default function ExcelUploadModal({
  open,
  onOpenChange,
  schools,
  activeSchoolId,
  templates,
  userRole,
  onUploadSuccess,
}: ExcelUploadModalProps) {
  const [selectedSchoolId, setSelectedSchoolId] = useState<number>(
    activeSchoolId || (schools.length > 0 ? schools[0].id : 0),
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>(
    templates.length > 0 ? templates[0].id : undefined,
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setSelectedFile(null);
    setResult(null);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["xlsx", "xls", "csv"].includes(ext || "")) {
        return toast.error("Invalid file format. Please upload an Excel (.xlsx, .xls) or CSV file.");
      }
      setSelectedFile(file);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      return toast.error("Please choose an Excel file to upload");
    }

    const schoolId = userRole === "SUPER_ADMIN" ? selectedSchoolId : activeSchoolId || selectedSchoolId;
    if (!schoolId) {
      return toast.error("Please select a target school");
    }

    setUploading(true);
    setResult(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const res = await api.requests.uploadExcel({
            fileBase64: base64Data,
            filename: selectedFile.name,
            schoolId,
            templateId: selectedTemplateId,
          });

          setResult({
            processed: res.processed,
            failed: res.failed,
            total: res.total,
            errors: res.errors,
          });

          if (res.processed > 0) {
            toast.success(
              `Successfully imported ${res.processed} ID card request${res.processed === 1 ? "" : "s"}!`,
            );
            onUploadSuccess();
          } else {
            toast.warning("No rows could be imported. Please review row errors below.");
          }
        } catch (err) {
          toast.error("Excel upload failed", {
            description: err instanceof Error ? err.message : "An unexpected error occurred",
          });
        } finally {
          setUploading(false);
        }
      };

      reader.onerror = () => {
        toast.error("Failed to read file");
        setUploading(false);
      };

      reader.readAsDataURL(selectedFile);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to initiate file upload");
      setUploading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetState();
        onOpenChange(v);
      }}
    >
      <DialogContent className="w-[95vw] sm:max-w-lg p-5 sm:p-6 text-card-foreground">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Upload ID Card Requests
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Bulk create ID card requests from an Excel spreadsheet.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* School Selector (Super Admin only) */}
          {userRole === "SUPER_ADMIN" && schools.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Target School</label>
              <Select
                value={String(selectedSchoolId)}
                onValueChange={(val) => setSelectedSchoolId(Number(val))}
              >
                <SelectTrigger className="h-10 text-xs rounded-xl border-border">
                  <SelectValue placeholder="Select School" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border">
                  {schools.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name} ({s.shortCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Template Selector */}
          {templates.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">ID Card Template</label>
              <Select
                value={selectedTemplateId ? String(selectedTemplateId) : undefined}
                onValueChange={(val) => setSelectedTemplateId(Number(val))}
              >
                <SelectTrigger className="h-10 text-xs rounded-xl border-border">
                  <SelectValue placeholder="Auto-detect School Default Template" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border">
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name} ({t.orientation})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Critical Empty Value Handling Notice */}
          <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-primary">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Empty Field Rule:</strong> Any empty, blank, or whitespace cell in your Excel file will <strong>not</strong> be added to that student&apos;s ID card data.
            </div>
          </div>

          {/* File Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Choose Excel Spreadsheet</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
              id="excel-file-upload-input"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border hover:border-primary p-5 text-center cursor-pointer transition-colors bg-muted/20"
            >
              <Upload className="h-6 w-6 text-muted-foreground" />
              {selectedFile ? (
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  <span>{selectedFile.name}</span>
                  <span className="text-muted-foreground font-normal">
                    ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              ) : (
                <>
                  <div className="text-xs font-bold text-foreground">
                    Click to browse or drop file here
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Supports Microsoft Excel (.xlsx, .xls) and CSV
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Upload Result Summary */}
          {result && (
            <div className="rounded-2xl border border-border bg-card text-card-foreground p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-2 text-primary">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Successfully processed: {result.processed} rows</span>
                </div>
                {result.failed > 0 && (
                  <div className="flex items-center gap-1.5 text-destructive font-semibold">
                    <AlertCircle className="h-4 w-4" />
                    <span>Failed / Skipped: {result.failed} rows</span>
                  </div>
                )}
              </div>

              {result.errors && result.errors.length > 0 && (
                <div className="max-h-36 overflow-y-auto rounded-xl border border-destructive/20 bg-destructive/10 p-2.5 space-y-1.5 text-[11px] text-destructive">
                  <div className="font-bold">Errors & Warnings:</div>
                  {result.errors.map((e, idx) => (
                    <div key={idx} className="flex items-start gap-1">
                      <span className="font-mono font-bold shrink-0">Row {e.rowNumber}:</span>
                      <span>{e.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-xs font-semibold"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-xs"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing spreadsheet…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload & Process
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
