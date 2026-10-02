import { useState, useRef, useMemo } from "react";
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
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { api, type ApiSchool } from "@/lib/api";
import {
  AlertCircle,
  CheckCircle2,
  FileArchive,
  Image as ImageIcon,
  Info,
  Loader2,
  Upload,
  UserCheck,
  UserX,
  X,
  Search,
  Sparkles,
  Camera,
} from "lucide-react";

interface BulkImageUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schools: ApiSchool[];
  activeSchoolId?: number;
  userRole: string;
  onUploadSuccess: () => void;
}

interface MatchResultItem {
  filename: string;
  identifier: string;
  matched: boolean;
  cardId?: number;
  cardNumber?: string;
  name?: string;
  isStaff?: boolean;
  photoUrl?: string;
  reason?: string;
}

export default function BulkImageUploadModal({
  open,
  onOpenChange,
  schools,
  activeSchoolId,
  userRole,
  onUploadSuccess,
}: BulkImageUploadModalProps) {
  const [selectedSchoolId, setSelectedSchoolId] = useState<number>(
    activeSchoolId || (schools.length > 0 ? schools[0].id : 0),
  );
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [zipFile, setZipFile] = useState<File | null>(null);

  const [scanning, setScanning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressNote, setProgressNote] = useState<string>("");

  const [scanResults, setScanResults] = useState<MatchResultItem[] | null>(null);
  const [uploadCompleted, setUploadCompleted] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "matched" | "unmatched">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const resetState = () => {
    setSelectedFiles([]);
    setZipFile(null);
    setScanning(false);
    setUploading(false);
    setProgressPercent(0);
    setProgressNote("");
    setScanResults(null);
    setUploadCompleted(false);
    setFilterType("all");
    setSearchQuery("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const schoolIdToUse =
    userRole === "SUPER_ADMIN" ? selectedSchoolId : activeSchoolId || selectedSchoolId;

  // Handle file selection (multiple images or a single zip)
  const handleFilesChosen = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    const zip = files.find(
      (f) =>
        f.name.toLowerCase().endsWith(".zip") ||
        f.type === "application/zip" ||
        f.type === "application/x-zip-compressed",
    );

    if (zip) {
      setZipFile(zip);
      setSelectedFiles([]);
      setScanResults(null);
      setUploadCompleted(false);
      toast.info(`Selected ZIP archive: ${zip.name} (${(zip.size / (1024 * 1024)).toFixed(1)} MB)`);
      return;
    }

    // Filter valid image extensions
    const validExts = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    const imageFiles = files.filter((f) => {
      const ext = f.name.substring(f.name.lastIndexOf(".")).toLowerCase();
      return validExts.includes(ext) || f.type.startsWith("image/");
    });

    if (imageFiles.length === 0) {
      toast.error("No valid image files found. Please choose JPG, PNG, WEBP, GIF, or a ZIP archive.");
      return;
    }

    setZipFile(null);
    setSelectedFiles(imageFiles);
    setScanResults(null);
    setUploadCompleted(false);
    toast.info(`Selected ${imageFiles.length} photo${imageFiles.length === 1 ? "" : "s"}.`);
  };

  // Convert File to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result as string;
        resolve(res);
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  };

  // Dry run: Scan & Match without applying changes
  const handleScanAndPreview = async () => {
    if (!schoolIdToUse) {
      return toast.error("Please select a target school");
    }
    if (!zipFile && selectedFiles.length === 0) {
      return toast.error("Please select photos or a ZIP archive first");
    }

    setScanning(true);
    setProgressNote("Analyzing filenames and matching against school cards...");

    try {
      if (zipFile) {
        const zipBase64 = await fileToBase64(zipFile);
        const res = await api.requests.bulkUploadPhotos({
          schoolId: schoolIdToUse,
          zipBase64,
          dryRun: true,
        });
        setScanResults(res.results);
        toast.success(
          `Analysis complete: ${res.matched} matched, ${res.unmatched} unmatched of ${res.total} photos.`,
        );
      } else {
        // Send in batches of 30 if many, or all at once
        const imagePayloads: Array<{ filename: string; dataBase64: string }> = [];
        for (const file of selectedFiles) {
          const b64 = await fileToBase64(file);
          imagePayloads.push({ filename: file.name, dataBase64: b64 });
        }

        const res = await api.requests.bulkUploadPhotos({
          schoolId: schoolIdToUse,
          images: imagePayloads,
          dryRun: true,
        });
        setScanResults(res.results);
        toast.success(
          `Analysis complete: ${res.matched} matched, ${res.unmatched} unmatched of ${res.total} photos.`,
        );
      }
    } catch (err: any) {
      toast.error("Scanning failed: " + (err instanceof Error ? err.message : "Network error"));
    } finally {
      setScanning(false);
      setProgressNote("");
    }
  };

  // Execute full upload and attachment
  const handleUploadAndAttach = async () => {
    if (!schoolIdToUse) {
      return toast.error("Please select a target school");
    }
    if (!zipFile && selectedFiles.length === 0) {
      return toast.error("Please choose photos or a ZIP archive to upload");
    }

    setUploading(true);
    setProgressPercent(10);
    setProgressNote("Preparing photos for upload and optimization...");

    try {
      if (zipFile) {
        setProgressNote("Uploading ZIP archive and optimizing images...");
        setProgressPercent(40);
        const zipBase64 = await fileToBase64(zipFile);

        setProgressNote("Server optimizing and attaching photos to cards...");
        setProgressPercent(70);
        const res = await api.requests.bulkUploadPhotos({
          schoolId: schoolIdToUse,
          zipBase64,
          dryRun: false,
        });

        setProgressPercent(100);
        setScanResults(res.results);
        setUploadCompleted(true);

        if (res.matched > 0) {
          toast.success(
            `Successfully attached ${res.matched} photo${res.matched === 1 ? "" : "s"} to cards!`,
            {
              description:
                res.unmatched > 0
                  ? `${res.unmatched} photos could not be matched with any card.`
                  : "All photos matched and attached perfectly.",
            },
          );
          onUploadSuccess();
        } else {
          toast.warning("No photos could be matched with existing cards in this school.");
        }
      } else {
        // Upload images (batch if large)
        const BATCH_SIZE = 25;
        const totalFiles = selectedFiles.length;
        let totalMatched = 0;
        let totalUnmatched = 0;
        const combinedResults: MatchResultItem[] = [];

        for (let i = 0; i < totalFiles; i += BATCH_SIZE) {
          const chunk = selectedFiles.slice(i, i + BATCH_SIZE);
          const currentBatchNumber = Math.floor(i / BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(totalFiles / BATCH_SIZE);

          setProgressNote(
            `Processing batch ${currentBatchNumber} of ${totalBatches} (${chunk.length} photos)...`,
          );
          setProgressPercent(Math.round(((i + chunk.length / 2) / totalFiles) * 90));

          const chunkPayload = await Promise.all(
            chunk.map(async (file) => ({
              filename: file.name,
              dataBase64: await fileToBase64(file),
            })),
          );

          const res = await api.requests.bulkUploadPhotos({
            schoolId: schoolIdToUse,
            images: chunkPayload,
            dryRun: false,
          });

          totalMatched += res.matched;
          totalUnmatched += res.unmatched;
          combinedResults.push(...res.results);
        }

        setProgressPercent(100);
        setScanResults(combinedResults);
        setUploadCompleted(true);

        if (totalMatched > 0) {
          toast.success(
            `Successfully attached ${totalMatched} photo${totalMatched === 1 ? "" : "s"} to cards!`,
            {
              description:
                totalUnmatched > 0
                  ? `${totalUnmatched} photos could not be matched.`
                  : "All photos attached successfully.",
            },
          );
          onUploadSuccess();
        } else {
          toast.warning("No photos were matched with existing cards.");
        }
      }
    } catch (err: any) {
      toast.error("Upload failed: " + (err instanceof Error ? err.message : "Network error"));
    } finally {
      setUploading(false);
      setProgressNote("");
    }
  };

  // Filtered preview items
  const filteredResults = useMemo(() => {
    if (!scanResults) return [];
    return scanResults
      .filter((item) => {
        if (filterType === "matched") return item.matched;
        if (filterType === "unmatched") return !item.matched;
        return true;
      })
      .filter((item) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          item.filename.toLowerCase().includes(q) ||
          item.identifier.toLowerCase().includes(q) ||
          (item.name && item.name.toLowerCase().includes(q)) ||
          (item.cardNumber && item.cardNumber.toLowerCase().includes(q))
        );
      });
  }, [scanResults, filterType, searchQuery]);

  const matchedCount = scanResults?.filter((r) => r.matched).length || 0;
  const unmatchedCount = scanResults?.filter((r) => !r.matched).length || 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetState();
        onOpenChange(v);
      }}
    >
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] flex flex-col p-5 sm:p-6 overflow-hidden">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef7f4] text-[#0f7f79]">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Bulk Image Upload
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Upload card photos named by Admission Number (students) or Employee ID (staff).
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1 [scrollbar-width:thin]">
          {/* Target School Selector (Super Admin only) */}
          {userRole === "SUPER_ADMIN" && schools.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Target School</label>
              <Select
                value={String(selectedSchoolId)}
                onValueChange={(val) => {
                  setSelectedSchoolId(Number(val));
                  setScanResults(null);
                }}
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

          {/* Guidelines Box */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs space-y-1.5 text-foreground">
            <div className="flex items-center gap-2 font-bold text-primary">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>Naming Guidelines for Automatic Matching:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px] leading-relaxed">
              <div className="rounded-lg bg-card p-2 border border-border">
                <span className="font-bold text-primary">🎓 Student Cards:</span>
                <p className="text-muted-foreground mt-0.5">
                  Name image as the <strong>Admission Number</strong> or <strong>Roll Number</strong> (e.g.{" "}
                  <code className="text-primary font-mono bg-primary/10 px-1 rounded">ADM001.jpg</code> or{" "}
                  <code className="text-primary font-mono bg-primary/10 px-1 rounded">2024-42.png</code>).
                </p>
              </div>
              <div className="rounded-lg bg-card p-2 border border-border">
                <span className="font-bold text-[#8a94e8]">💼 Staff Cards:</span>
                <p className="text-muted-foreground mt-0.5">
                  Name image as the <strong>Employee ID</strong> (e.g.{" "}
                  <code className="text-[#8a94e8] font-mono bg-indigo-500/10 px-1 rounded">EMP-102.jpg</code> or{" "}
                  <code className="text-[#8a94e8] font-mono bg-indigo-500/10 px-1 rounded">T405.jpeg</code>).
                </p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground pt-1">
              Supports: Multiple loose image files or a single <strong>.ZIP</strong> archive containing the photos. Images are automatically auto-rotated, resized, and optimized.
            </p>
          </div>

          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              handleFilesChosen(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
              isDragOver
                ? "border-primary bg-primary/10"
                : zipFile || selectedFiles.length > 0
                  ? "border-primary/50 bg-primary/5"
                  : "border-border bg-muted/20 hover:border-primary hover:bg-primary/5"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFilesChosen(e.target.files)}
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif,.zip,application/zip"
              className="hidden"
            />

            <div className="flex flex-col items-center justify-center gap-2">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-colors ${
                  zipFile
                    ? "bg-indigo-500/10 text-indigo-400"
                    : selectedFiles.length > 0
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {zipFile ? (
                  <FileArchive className="h-6 w-6" />
                ) : (
                  <ImageIcon className="h-6 w-6" />
                )}
              </div>

              {zipFile ? (
                <div>
                  <p className="text-sm font-bold text-foreground">{zipFile.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ZIP Archive • {(zipFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                  <span className="inline-block mt-2 text-[11px] font-semibold text-primary hover:underline">
                    Click to choose different files
                  </span>
                </div>
              ) : selectedFiles.length > 0 ? (
                <div>
                  <p className="text-sm font-bold text-primary">
                    {selectedFiles.length} photo{selectedFiles.length === 1 ? "" : "s"} selected
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Total size: {(selectedFiles.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(2)} MB
                  </p>
                  <span className="inline-block mt-2 text-[11px] font-semibold text-primary hover:underline">
                    Click or drag more to add or replace
                  </span>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-bold text-foreground">
                    Click to browse or drag & drop files here
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Select multiple photos (.jpg, .png, .webp) or a .zip archive
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Progress / Status banner */}
          {(scanning || uploading) && (
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-primary">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                <span>{progressNote || (scanning ? "Analyzing photos..." : "Uploading & optimizing...")}</span>
              </div>
              {uploading && (
                <div className="w-full bg-primary/20 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-300 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Results Summary & List */}
          {scanResults && (
            <div className="space-y-3 pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">
                    {uploadCompleted ? "Upload Results" : "Matching Preview"}:
                  </span>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold bg-primary/10 text-primary text-[11px]">
                      <CheckCircle2 className="h-3 w-3" /> {matchedCount} Matched
                    </span>
                    {unmatchedCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold bg-destructive/10 text-destructive text-[11px]">
                        <AlertCircle className="h-3 w-3" /> {unmatchedCount} Unmatched
                      </span>
                    )}
                  </div>
                </div>

                {/* Filter buttons */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setFilterType("all")}
                    className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                      filterType === "all"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    All ({scanResults.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType("matched")}
                    className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                      filterType === "matched"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    Matched ({matchedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType("unmatched")}
                    className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                      filterType === "unmatched"
                        ? "bg-destructive text-destructive-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    Unmatched ({unmatchedCount})
                  </button>
                </div>
              </div>

              {/* Search filter in results */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter by filename, name, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs rounded-lg border-border"
                />
              </div>

              {/* Table / List */}
              <div className="max-h-48 overflow-y-auto rounded-xl border border-border bg-card divide-y divide-border text-xs text-card-foreground [scrollbar-width:thin]">
                {filteredResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    No files found matching the search/filter.
                  </div>
                ) : (
                  filteredResults.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {item.matched ? (
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <UserCheck className="h-4 w-4" />
                          </div>
                        ) : (
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                            <UserX className="h-4 w-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate text-xs">
                            {item.filename}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            ID: <span className="font-mono font-medium text-foreground">{item.identifier}</span>
                            {item.matched && item.name && (
                              <span>
                                {" "}
                                • {item.name} {item.isStaff ? "(Staff)" : "(Student)"}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right pl-2">
                        {item.matched ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                            {uploadCompleted ? "Attached" : `Card #${item.cardNumber || item.cardId}`}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-destructive/10 text-destructive">
                            No card found
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 pt-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="text-[11px] text-muted-foreground self-start sm:self-center">
            {zipFile
              ? `ZIP ready to upload`
              : selectedFiles.length > 0
                ? `${selectedFiles.length} photo${selectedFiles.length === 1 ? "" : "s"} chosen`
                : "No files chosen"}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetState();
                onOpenChange(false);
              }}
              disabled={scanning || uploading}
              className="h-9 rounded-xl border-border text-xs font-semibold"
            >
              {uploadCompleted ? "Close" : "Cancel"}
            </Button>

            {!uploadCompleted && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleScanAndPreview}
                  disabled={scanning || uploading || (!zipFile && selectedFiles.length === 0)}
                  className="h-9 rounded-xl border-primary text-primary hover:bg-primary/10 text-xs font-bold"
                >
                  {scanning ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Scanning...
                    </>
                  ) : (
                    <>
                      <Search className="mr-1.5 h-3.5 w-3.5" /> Scan & Match
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  onClick={handleUploadAndAttach}
                  disabled={scanning || uploading || (!zipFile && selectedFiles.length === 0)}
                  className="h-9 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold shadow-sm"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload & Attach Photos
                    </>
                  )}
                </Button>
              </>
            )}

            {uploadCompleted && (
              <Button
                type="button"
                onClick={() => {
                  resetState();
                  onOpenChange(false);
                }}
                className="h-9 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold shadow-sm"
              >
                Done
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
