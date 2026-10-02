import { useEffect, useMemo, useState } from "react";
import CardRenderer from "@/components/CardRenderer";
import type { ApiIdCard, ApiIdCardDetail, ApiSchool, ApiTemplate, ApiTemplateElement } from "@/lib/api";
import { api } from "@/lib/api";
import { DYNAMIC_FIELDS, type DesignerElement } from "@shared/templateDesigner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Building2,
  Camera,
  CheckCircle2,
  FileSignature,
  Loader2,
  Lock,
  RotateCcw,
  Save,
  Send,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { compressImage } from "@/lib/imageCompress";

interface IdCardFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: number;
  schoolName?: string;
  schoolCode?: string;
  initialCard?: ApiIdCardDetail | null;
  availableTemplates: ApiTemplate[];
  schools?: ApiSchool[];
  onSaved: (card: ApiIdCard, submitted: boolean) => void;
}

export default function IdCardFormModal({
  open,
  onOpenChange,
  schoolId,
  schoolName = "",
  schoolCode = "",
  initialCard,
  availableTemplates,
  schools,
  onSaved,
}: IdCardFormModalProps) {
  const [currentSchoolId, setCurrentSchoolId] = useState(schoolId);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [fullTemplate, setFullTemplate] = useState<ApiTemplate | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [isLockedTemplate, setIsLockedTemplate] = useState(false);

  const [cardNumber, setCardNumber] = useState("");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingSig, setUploadingSig] = useState(false);
  const [photoOptNote, setPhotoOptNote] = useState<string | null>(null);
  const [sigOptNote, setSigOptNote] = useState<string | null>(null);
  const [customOptNotes, setCustomOptNotes] = useState<Record<string, string>>({});
  const [customOptimizing, setCustomOptimizing] = useState<Record<string, boolean>>({});

  const [activeSide, setActiveSide] = useState<"FRONT" | "BACK">("FRONT");
  const [zoomScale, setZoomScale] = useState(1);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Sync currentSchoolId if schoolId prop changes
  useEffect(() => {
    setCurrentSchoolId(schoolId);
  }, [schoolId]);

  const effectiveSchool = useMemo(() => {
    return schools?.find((s) => s.id === currentSchoolId);
  }, [schools, currentSchoolId]);

  const loadTemplatesForSchool = (targetSchoolId: number) => {
    api.schoolTemplates
      .list(targetSchoolId)
      .then((assigned) => {
        const locked = assigned.find((t) => t.isLocked);
        if (locked) {
          setIsLockedTemplate(true);
          setSelectedTemplateId(locked.templateId);
          return;
        }
        const defaultTmpl = assigned.find((t) => t.isDefault);
        if (defaultTmpl) {
          setIsLockedTemplate(false);
          setSelectedTemplateId(defaultTmpl.templateId);
          return;
        }
        if (availableTemplates.length > 0) {
          setIsLockedTemplate(false);
          setSelectedTemplateId(availableTemplates[0].id);
        }
      })
      .catch(() => {
        if (availableTemplates.length > 0) {
          setSelectedTemplateId(availableTemplates[0].id);
        }
      });
  };

  const handleSchoolChange = (newSchoolId: number) => {
    setCurrentSchoolId(newSchoolId);
    const targetSchool = schools?.find((s) => s.id === newSchoolId);
    setFormData((prev) => ({
      ...prev,
      school_name: targetSchool?.name || "",
      school_code: targetSchool?.shortCode || "",
    }));
    loadTemplatesForSchool(newSchoolId);
  };

  // Track template fetch version to force re-fetch when modal opens
  const [fetchSeq, setFetchSeq] = useState(0);

  // Initialize or reset form data whenever dialog opens or initialCard changes
  useEffect(() => {
    if (!open) return;

    // Trigger fresh load of the active template whenever modal opens
    setFetchSeq((s) => s + 1);

    if (initialCard) {
      setCardNumber(initialCard.cardNumber);
      setSelectedTemplateId(initialCard.templateId);
      const dataMap = initialCard.dataMap || {};
      setFormData({ ...dataMap });
      setPhotoUrl(dataMap["photo"] || dataMap["student_photo"] || null);
      setSignatureUrl(dataMap["signature"] || null);
    } else {
      setCardNumber("");
      const initial: Record<string, string> = {
        school_name: effectiveSchool?.name || schoolName,
        school_code: effectiveSchool?.shortCode || schoolCode,
        gender: "Male",
        blood_group: "B+",
      };
      setFormData(initial);
      setPhotoUrl(null);
      setSignatureUrl(null);

      // Automatically determine school's locked or default template
      loadTemplatesForSchool(currentSchoolId);
    }
  }, [open, initialCard, currentSchoolId, schoolName, schoolCode, availableTemplates]);

  // Load full template details & elements whenever selected template or modal open version changes
  useEffect(() => {
    if (!selectedTemplateId) {
      setFullTemplate(null);
      return;
    }

    // Immediately seed with availableTemplates elements if present to avoid blank flicker
    const matchedAvailable = availableTemplates.find((t) => t.id === selectedTemplateId);
    if (matchedAvailable && matchedAvailable.elements && matchedAvailable.elements.length > 0) {
      setFullTemplate((prev) => (prev?.id === selectedTemplateId ? prev : matchedAvailable));
    }

    setLoadingTemplate(true);
    api.templates
      .get(selectedTemplateId)
      .then((tmpl) => setFullTemplate(tmpl))
      .catch((err) => {
        console.error("Failed to load template", err);
        // Fall back to availableTemplates if network error
        if (matchedAvailable) {
          setFullTemplate(matchedAvailable);
        } else {
          toast.error("Could not load template details");
        }
      })
      .finally(() => setLoadingTemplate(false));
  }, [selectedTemplateId, fetchSeq]);

  // Helper to safely extract elements list from template (elements array or meta)
  const templateElementList = useMemo(() => {
    if (fullTemplate?.elements && Array.isArray(fullTemplate.elements) && fullTemplate.elements.length > 0) {
      return fullTemplate.elements;
    }
    // Check fallback in availableTemplates
    const fallbackTmpl = availableTemplates.find((t) => t.id === selectedTemplateId);
    if (fallbackTmpl?.elements && Array.isArray(fallbackTmpl.elements) && fallbackTmpl.elements.length > 0) {
      return fallbackTmpl.elements;
    }
    // Check if elements are stored in meta
    if (fullTemplate?.meta) {
      try {
        const metaObj = typeof fullTemplate.meta === "string" ? JSON.parse(fullTemplate.meta) : fullTemplate.meta;
        if (Array.isArray(metaObj?.elements)) {
          return metaObj.elements as ApiTemplateElement[];
        }
      } catch {
        /* ignore parse error */
      }
    }
    return fullTemplate?.elements ?? [];
  }, [fullTemplate, availableTemplates, selectedTemplateId]);

  // Determine required dynamic fields from template elements
  const requiredDynamicFields = useMemo(() => {
    if (!templateElementList || templateElementList.length === 0) return [];
    const fields = new Set<string>();

    for (const el of templateElementList) {
      const rawType = (el.elementType || (el as any).type || "").toUpperCase();

      // Safely parse config if it's a string
      let cfg: Record<string, any> = {};
      if (typeof el.config === "string") {
        try {
          cfg = JSON.parse(el.config);
        } catch {
          cfg = {};
        }
      } else if (el.config && typeof el.config === "object") {
        cfg = el.config as Record<string, any>;
      }

      if (rawType === "DYNAMIC_FIELD") {
        const fieldKey =
          cfg.dynamicField ||
          (el as any).dynamicField ||
          (el.label && el.label.startsWith("{{") && el.label.endsWith("}}")
            ? el.label.slice(2, -2).trim()
            : undefined);

        if (fieldKey && typeof fieldKey === "string" && fieldKey.trim()) {
          fields.add(fieldKey.trim());
        }
      } else if (rawType === "QR_CODE" && cfg.qrField) {
        if (typeof cfg.qrField === "string" && cfg.qrField.trim()) {
          fields.add(cfg.qrField.trim());
        }
      } else if (rawType === "BARCODE" && cfg.barcodeField) {
        if (typeof cfg.barcodeField === "string" && cfg.barcodeField.trim()) {
          fields.add(cfg.barcodeField.trim());
        }
      }
    }
    return Array.from(fields);
  }, [templateElementList]);

  const templateHasPhoto = useMemo(() => {
    return templateElementList.some((el) => {
      const t = (el.elementType || (el as any).type || "").toUpperCase();
      return t === "PHOTO";
    });
  }, [templateElementList]);

  const templateHasSignature = useMemo(() => {
    return templateElementList.some((el) => {
      const t = (el.elementType || (el as any).type || "").toUpperCase();
      return t === "SIGNATURE";
    });
  }, [templateElementList]);

  // Helper to update field values
  const handleFieldChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  // Upload file helper with browser-side resize & compression
  const handleFileUpload = async (
    file: File,
    type: "photo" | "signature" | string,
  ) => {
    if (file.size > 15 * 1024 * 1024) {
      return toast.error("File is too large (> 15MB). Please select an image under 15MB.");
    }
    const isSig = type === "signature";

    if (type === "photo") {
      setUploadingPhoto(true);
      setPhotoOptNote(null);
    } else if (isSig) {
      setUploadingSig(true);
      setSigOptNote(null);
    } else {
      setCustomOptimizing((p) => ({ ...p, [type]: true }));
      setCustomOptNotes((p) => ({ ...p, [type]: "" }));
    }

    try {
      const compressed = await compressImage(file, {
        maxLongSide: isSig ? 400 : 640,
        targetMaxBytes: 100 * 1024,
        targetMinBytes: 25 * 1024,
      });

      const origStr =
        compressed.originalBytes >= 1024 * 1024
          ? `${(compressed.originalBytes / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.round(compressed.originalBytes / 1024)} KB`;
      const finalStr = `${Math.round(compressed.finalBytes / 1024)} KB`;
      const optMessage = `Optimized ${origStr} to ${finalStr}`;

      if (type === "photo") {
        setPhotoOptNote(optMessage);
      } else if (isSig) {
        setSigOptNote(optMessage);
      } else {
        setCustomOptNotes((p) => ({ ...p, [type]: optMessage }));
      }

      const base64 = compressed.dataUrl.split(",")[1];
      const uploadName = file.name.replace(/\.[^.]+$/, ".jpg");
      const res = await api.upload(uploadName, "image/jpeg", base64);
      const uploadedUrl = res.url || compressed.dataUrl;

      if (type === "photo") {
        setPhotoUrl(uploadedUrl);
        setFormData((prev) => ({ ...prev, photo: uploadedUrl, student_photo: uploadedUrl }));
      } else if (isSig) {
        setSignatureUrl(uploadedUrl);
        setFormData((prev) => ({ ...prev, signature: uploadedUrl }));
      } else {
        setFormData((prev) => ({ ...prev, [type]: uploadedUrl }));
      }
      toast.success(`${type === "photo" ? "Student photo" : isSig ? "Signature" : "Photo"} uploaded successfully`, {
        description: optMessage,
      });
    } catch (err: any) {
      const nameLower = file.name.toLowerCase();
      if (nameLower.endsWith(".heic") || nameLower.endsWith(".heif") || (err?.message && err.message.toLowerCase().includes("heic"))) {
        toast.error("HEIC format not supported by browser. Please choose JPEG or PNG.");
      } else {
        toast.error("Upload failed", {
          description: err instanceof Error ? err.message : "Image processing error",
        });
      }
    } finally {
      if (type === "photo") setUploadingPhoto(false);
      else if (isSig) setUploadingSig(false);
      else setCustomOptimizing((p) => ({ ...p, [type]: false }));
    }
  };

  // Save card (either as draft or save & submit)
  const handleSave = async (submitAfterSave: boolean) => {
    if (!schoolId) {
      return toast.error("Please select a valid school");
    }

    if (!selectedTemplateId) {
      return toast.error("Please select a template");
    }

    // If submitting, validate required fields client-side
    if (submitAfterSave) {
      for (const field of requiredDynamicFields) {
        // Resolve field with alias fallback
        let val = formData[field]?.trim();
        if (!val) {
          if (field === "admission_number" || field === "admission_no") {
            val = (formData["admission_number"] || formData["admission_no"])?.trim();
          } else if (field === "roll_number" || field === "roll_no") {
            val = (formData["roll_number"] || formData["roll_no"])?.trim();
          } else if (field === "phone" || field === "mobile" || field === "contact") {
            val = (formData["phone"] || formData["mobile"] || formData["contact"])?.trim();
          }
        }
        if (!val) {
          const fieldDef = DYNAMIC_FIELDS.find((f) => f.key === field);
          return toast.error(`Please fill in required field: ${fieldDef?.label || field.replaceAll("_", " ")}`);
        }
      }
      if (templateHasPhoto && !photoUrl && !formData["photo"] && !formData["student_photo"]) {
        return toast.error("Student photo is required before submitting for approval");
      }
    }

    try {
      if (submitAfterSave) setSubmitting(true);
      else setSaving(true);

      const payload = {
        schoolId: currentSchoolId,
        templateId: selectedTemplateId,
        cardNumber: cardNumber.trim() || undefined,
        data: {
          ...formData,
          ...(photoUrl ? { photo: photoUrl, student_photo: photoUrl } : {}),
          ...(signatureUrl ? { signature: signatureUrl } : {}),
        },
      };

      let cardId: number;
      let cardResult: ApiIdCard;

      if (initialCard) {
        await api.idCards.update(initialCard.id, payload);
        cardId = initialCard.id;
        cardResult = {
          ...initialCard,
          templateId: selectedTemplateId,
          dataMap: payload.data,
        };
      } else {
        cardResult = await api.idCards.create(payload);
        cardId = cardResult.id;
      }

      if (submitAfterSave) {
        const subRes = await api.idCards.submit(cardId);
        cardResult.status = subRes.status;
        toast.success(`ID Card #${cardResult.cardNumber} submitted for approval!`);
      } else {
        toast.success(`ID Card draft #${cardResult.cardNumber} saved successfully`);
      }

      onSaved(cardResult, submitAfterSave);
      onOpenChange(false);
    } catch (err) {
      toast.error("Operation failed", {
        description: err instanceof Error ? err.message : "Could not save card",
      });
    } finally {
      setSaving(false);
      setSubmitting(false);
    }
  };

  // Convert elements for CardRenderer
  const rendererElements: DesignerElement[] = useMemo(() => {
    if (!templateElementList || templateElementList.length === 0) return [];
    return templateElementList.map((el, i) => {
      let cfg: any = el.config;
      if (typeof cfg === "string") {
        try {
          cfg = JSON.parse(cfg);
        } catch {
          cfg = {};
        }
      }
      return {
        elementKey: el.elementKey,
        elementType: (el.elementType || (el as any).type) as any,
        label: el.label ?? null,
        config: cfg ?? {
          x: 20,
          y: 20,
          width: 100,
          height: 30,
          side: "FRONT",
          rotation: 0,
          opacity: 1,
        },
        sortOrder: el.sortOrder ?? i,
      };
    });
  }, [templateElementList]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-[96vw] sm:max-w-[96vw] md:max-w-[94vw] lg:max-w-[92vw] xl:max-w-[1450px] 2xl:max-w-[1600px] max-h-[92vh] h-[92vh] flex flex-col gap-0 p-4 sm:p-6 sm:rounded-2xl border-border bg-card text-card-foreground">
        <DialogHeader className="border-b border-border pb-3 shrink-0">
          <div className="flex flex-col items-start justify-between gap-3 pr-2 sm:flex-row sm:items-center sm:pr-6">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                {initialCard
                  ? initialCard.status === "DRAFT"
                    ? "Edit ID Card Draft"
                    : "Edit ID Card"
                  : "New ID Card Draft"}
                {isLockedTemplate && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md">
                    <Lock className="h-3 w-3" /> Locked Template
                  </span>
                )}
              </DialogTitle>
              <div className="text-xs text-muted-foreground mt-0.5">
                School: <strong>{effectiveSchool?.name || schoolName || `School #${currentSchoolId}`}</strong> · Form is dynamically driven by the selected template.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* School selector if admin has multiple schools */}
              {schools && schools.length > 1 && !initialCard && (
                <div className="w-full sm:w-56">
                  <Select
                    value={String(currentSchoolId)}
                    onValueChange={(val) => handleSchoolChange(Number(val))}
                  >
                    <SelectTrigger className="h-8 text-xs font-semibold">
                      <Building2 className="h-3.5 w-3.5 mr-1 text-primary" />
                      <SelectValue placeholder="Select target school" />
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

              {/* Template selector if not locked */}
              {!isLockedTemplate && !initialCard && (
                <div className="w-full sm:w-56">
                  <Select
                    value={selectedTemplateId ? String(selectedTemplateId) : ""}
                    onValueChange={(val) => setSelectedTemplateId(Number(val))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTemplates.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Two-Column Split Layout */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-y-auto lg:overflow-hidden pt-4 lg:grid-cols-12">
          {/* LEFT: Dynamic Template-Driven Form */}
          <div className="min-h-0 overflow-y-auto pr-1 space-y-5 sm:pr-4 lg:col-span-7">
            {loadingTemplate ? (
              <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading template fields…
              </div>
            ) : (
              <>
                {/* Photo & Signature Section */}
                <div className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-muted/30 p-4 sm:grid-cols-2">
                  {/* Student Photo */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Camera className="h-3.5 w-3.5 text-primary" />
                      Student Photo {templateHasPhoto && <span className="text-red-500">*</span>}
                    </Label>
                    <div className="flex items-center gap-3">
                      <div className="relative h-16 w-14 rounded-lg border border-border bg-card overflow-hidden flex items-center justify-center shadow-2xs">
                        {photoUrl ? (
                          <img src={photoUrl} alt="Photo" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-[10px] text-muted-foreground font-medium">Photo</span>
                        )}
                        {uploadingPhoto && (
                          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center p-1 text-center">
                            <Loader2 className="h-4 w-4 animate-spin text-white mb-0.5" />
                            <span className="text-[8px] text-white font-medium leading-tight">Optimizing...</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="cursor-pointer inline-flex items-center rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent shadow-2xs w-fit">
                          Upload
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleFileUpload(f, "photo");
                            }}
                          />
                        </label>
                        {uploadingPhoto ? (
                          <span className="flex items-center gap-1 text-[11px] font-medium text-primary">
                            <Loader2 className="h-3 w-3 animate-spin" /> Optimizing photo...
                          </span>
                        ) : photoOptNote ? (
                          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">{photoOptNote}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Signature */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <FileSignature className="h-3.5 w-3.5 text-primary" />
                      Signature {templateHasSignature && <span className="text-muted-foreground font-normal">(Optional)</span>}
                    </Label>
                    <div className="flex items-center gap-3">
                      <div className="relative h-16 w-20 rounded-lg border border-border bg-card overflow-hidden flex items-center justify-center shadow-2xs">
                        {signatureUrl ? (
                          <img src={signatureUrl} alt="Signature" className="h-full w-full object-contain p-1" />
                        ) : (
                          <span className="text-[10px] text-muted-foreground font-medium">Signature</span>
                        )}
                        {uploadingSig && (
                          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center p-1 text-center">
                            <Loader2 className="h-4 w-4 animate-spin text-white mb-0.5" />
                            <span className="text-[8px] text-white font-medium leading-tight">Optimizing...</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="cursor-pointer inline-flex items-center rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent shadow-2xs w-fit">
                          Upload
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleFileUpload(f, "signature");
                            }}
                          />
                        </label>
                        {uploadingSig ? (
                          <span className="flex items-center gap-1 text-[11px] font-medium text-primary">
                            <Loader2 className="h-3 w-3 animate-spin" /> Optimizing signature...
                          </span>
                        ) : sigOptNote ? (
                          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">{sigOptNote}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Number */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs font-bold text-foreground">Card Number</Label>
                    <Input
                      disabled={!!initialCard}
                      className="mt-1 font-mono text-xs bg-muted/40"
                      placeholder="Auto-generated (e.g. IDC-2026-000001)"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {initialCard ? "Persistent ID card identifier." : "Leave blank to auto-generate."}
                    </span>
                  </div>

                  <div>
                    <Label className="text-xs font-bold text-foreground">
                      Admission Code / Number {(requiredDynamicFields.includes("admission_number") || requiredDynamicFields.includes("admission_no")) && <span className="text-red-500">*</span>}
                    </Label>
                    <Input
                      className="mt-1 text-xs"
                      placeholder="e.g. ADM-2026-001"
                      value={formData.admission_number ?? ""}
                      onChange={(e) => handleFieldChange("admission_number", e.target.value)}
                    />
                  </div>
                </div>

                {/* Student Details Section */}
                <div className="space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border pb-1">
                    Student Details
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs font-bold text-foreground">
                        Student Full Name {requiredDynamicFields.includes("student_name") && <span className="text-red-500">*</span>}
                      </Label>
                      <Input
                        className="mt-1 text-xs"
                        placeholder="e.g. Rahul Kumar"
                        value={formData.student_name ?? ""}
                        onChange={(e) => handleFieldChange("student_name", e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <Label className="text-xs font-bold text-foreground">
                          Class {requiredDynamicFields.includes("class") && <span className="text-red-500">*</span>}
                        </Label>
                        <Input
                          className="mt-1 text-xs"
                          placeholder="e.g. 10"
                          value={formData.class ?? ""}
                          onChange={(e) => handleFieldChange("class", e.target.value)}
                        />
                      </div>

                      <div>
                        <Label className="text-xs font-bold text-foreground">
                          Section {requiredDynamicFields.includes("section") && <span className="text-red-500">*</span>}
                        </Label>
                        <Input
                          className="mt-1 text-xs"
                          placeholder="e.g. A"
                          value={formData.section ?? ""}
                          onChange={(e) => handleFieldChange("section", e.target.value)}
                        />
                      </div>

                      <div>
                        <Label className="text-xs font-bold text-foreground">
                          Roll Number {(requiredDynamicFields.includes("roll_number") || requiredDynamicFields.includes("roll_no")) && <span className="text-red-500">*</span>}
                        </Label>
                        <Input
                          className="mt-1 text-xs"
                          placeholder="e.g. 15"
                          value={formData.roll_number ?? ""}
                          onChange={(e) => handleFieldChange("roll_number", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <Label className="text-xs font-bold text-foreground">Date of Birth</Label>
                        <Input
                          className="mt-1 text-xs"
                          placeholder="DD/MM/YYYY"
                          value={formData.dob ?? ""}
                          onChange={(e) => handleFieldChange("dob", e.target.value)}
                        />
                      </div>

                      <div>
                        <Label className="text-xs font-bold text-foreground">Gender</Label>
                        <Select
                          value={formData.gender || "Male"}
                          onValueChange={(val) => handleFieldChange("gender", val)}
                        >
                          <SelectTrigger className="mt-1 text-xs h-9">
                            <SelectValue placeholder="Gender" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Male">Male</SelectItem>
                            <SelectItem value="Female">Female</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs font-bold text-foreground">Blood Group</Label>
                        <Select
                          value={formData.blood_group || "B+"}
                          onValueChange={(val) => handleFieldChange("blood_group", val)}
                        >
                          <SelectTrigger className="mt-1 text-xs h-9">
                            <SelectValue placeholder="Blood group" />
                          </SelectTrigger>
                          <SelectContent>
                            {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((bg) => (
                              <SelectItem key={bg} value={bg}>
                                {bg}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Family & Contact Section */}
                <div className="space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border pb-1">
                    Family & Contact
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs font-bold text-foreground">Father's Name</Label>
                      <Input
                        className="mt-1 text-xs"
                        placeholder="e.g. Suresh Kumar"
                        value={formData.father_name ?? ""}
                        onChange={(e) => handleFieldChange("father_name", e.target.value)}
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-bold text-foreground">Mother's Name</Label>
                      <Input
                        className="mt-1 text-xs"
                        placeholder="e.g. Anita Devi"
                        value={formData.mother_name ?? ""}
                        onChange={(e) => handleFieldChange("mother_name", e.target.value)}
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-bold text-foreground">Guardian Name</Label>
                      <Input
                        className="mt-1 text-xs"
                        placeholder="Guardian name"
                        value={formData.guardian_name ?? ""}
                        onChange={(e) => handleFieldChange("guardian_name", e.target.value)}
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-bold text-foreground">Contact Phone</Label>
                      <div className="mt-1 flex items-center gap-1.5">
                        <div className="h-9 w-12 flex items-center justify-center rounded-lg border border-border bg-muted text-xs font-bold text-muted-foreground select-none shrink-0">
                          +91
                        </div>
                        <div className="flex-1">
                          <Input
                            type="tel"
                            inputMode="numeric"
                            maxLength={10}
                            className={`text-xs transition-colors ${
                              formData.phone && formData.phone.length > 0 && formData.phone.length < 10
                                ? "border-red-500 bg-red-50/15 text-red-900 dark:text-red-200 focus-visible:ring-red-400 focus-visible:border-red-500"
                                : ""
                            }`}
                            placeholder="9876543210"
                            value={formData.phone ?? ""}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                              handleFieldChange("phone", digits);
                            }}
                          />
                        </div>
                      </div>
                      {formData.phone && formData.phone.length > 0 && formData.phone.length < 10 && (
                        <p className="mt-1 text-[11px] font-medium text-red-500">
                          Phone number must be 10 digits ({formData.phone.length}/10)
                        </p>
                      )}
                    </div>

                    <div className="col-span-2">
                      <Label className="text-xs font-bold text-foreground">Residential Address</Label>
                      <Textarea
                        rows={2}
                        className="mt-1 text-xs"
                        placeholder="Full home address"
                        value={formData.address ?? ""}
                        onChange={(e) => handleFieldChange("address", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Extra dynamic fields discovered from template */}
                {(() => {
                  const standardKeys = new Set([
                    "student_name",
                    "class",
                    "section",
                    "roll_number",
                    "roll_no",
                    "admission_number",
                    "admission_no",
                    "dob",
                    "gender",
                    "blood_group",
                    "father_name",
                    "mother_name",
                    "guardian_name",
                    "phone",
                    "mobile",
                    "contact",
                    "address",
                    "school_name",
                    "school_code",
                    "photo",
                    "student_photo",
                    "signature",
                  ]);
                  const extraFields = requiredDynamicFields.filter(
                    (f) => !standardKeys.has(f.toLowerCase().trim()),
                  );
                  if (extraFields.length === 0) return null;
                  return (
                    <div className="space-y-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border pb-1">
                        Additional Template Fields
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {extraFields.map((customField) => {
                          const isPhoneField =
                            customField.toLowerCase().includes("phone") ||
                            customField.toLowerCase().includes("mobile");
                          const isPhotoField =
                            customField.toLowerCase().includes("photo") ||
                            customField.toLowerCase().includes("image") ||
                            customField.toLowerCase().includes("pic");
                          const currentVal = formData[customField] ?? "";

                          return (
                            <div key={customField} className="space-y-1">
                              <Label className="text-xs font-bold text-foreground capitalize">
                                {customField.replaceAll("_", " ")} <span className="text-red-500">*</span>
                              </Label>
                              {isPhoneField ? (
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <div className="h-9 w-12 flex items-center justify-center rounded-lg border border-border bg-muted text-xs font-bold text-muted-foreground select-none shrink-0">
                                      +91
                                    </div>
                                    <div className="flex-1">
                                      <Input
                                        type="tel"
                                        inputMode="numeric"
                                        maxLength={10}
                                        placeholder="9876543210"
                                        className={`text-xs transition-colors ${
                                          currentVal.length > 0 && currentVal.length < 10
                                            ? "border-red-500 bg-red-50/15 text-red-900 dark:text-red-200 focus-visible:ring-red-400 focus-visible:border-red-500"
                                            : ""
                                        }`}
                                        value={currentVal}
                                        onChange={(e) => {
                                          const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                                          handleFieldChange(customField, digits);
                                        }}
                                      />
                                    </div>
                                  </div>
                                  {currentVal.length > 0 && currentVal.length < 10 && (
                                    <p className="mt-1 text-[11px] font-medium text-red-500">
                                      Phone number must be 10 digits ({currentVal.length}/10)
                                    </p>
                                  )}
                                </div>
                              ) : isPhotoField ? (
                                <div className="flex items-center gap-3">
                                  <div className="relative h-14 w-14 rounded-lg border border-border bg-card overflow-hidden flex items-center justify-center shadow-2xs">
                                    {currentVal ? (
                                      <img src={currentVal} alt={customField} className="h-full w-full object-cover" />
                                    ) : (
                                      <span className="text-[10px] text-muted-foreground font-medium">Image</span>
                                    )}
                                    {customOptimizing[customField] && (
                                      <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center p-1 text-center">
                                        <Loader2 className="h-4 w-4 animate-spin text-white mb-0.5" />
                                        <span className="text-[8px] text-white font-medium leading-tight">Optimizing...</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="cursor-pointer inline-flex items-center rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent shadow-2xs w-fit">
                                      Upload
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          const f = e.target.files?.[0];
                                          if (f) handleFileUpload(f, customField);
                                        }}
                                      />
                                    </label>
                                    {customOptimizing[customField] ? (
                                      <span className="flex items-center gap-1 text-[11px] font-medium text-primary">
                                        <Loader2 className="h-3 w-3 animate-spin" /> Optimizing photo...
                                      </span>
                                    ) : customOptNotes[customField] ? (
                                      <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">{customOptNotes[customField]}</span>
                                    ) : null}
                                  </div>
                                </div>
                              ) : (
                                <Input
                                  className="text-xs"
                                  value={currentVal}
                                  onChange={(e) => handleFieldChange(customField, e.target.value)}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>

          {/* RIGHT: Live Interactive CardRenderer Preview */}
          <div className="lg:col-span-5 bg-muted/40 rounded-2xl p-4 flex flex-col items-center justify-between border border-border">
            {/* Toolbar */}
            <div className="w-full flex items-center justify-between pb-3 border-b border-border">
              {/* Side toggle */}
              <div className="flex gap-1 bg-card p-1 rounded-lg border border-border shadow-2xs">
                {(["FRONT", "BACK"] as const).map((side) => (
                  <button
                    key={side}
                    type="button"
                    onClick={() => setActiveSide(side)}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                      activeSide === side
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {side}
                  </button>
                ))}
              </div>

              {/* Zoom controls */}
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0"
                  onClick={() => setZoomScale((s) => Math.max(0.7, s - 0.15))}
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[11px] font-mono font-medium text-muted-foreground w-12 text-center">
                  {Math.round(zoomScale * 100)}%
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0"
                  onClick={() => setZoomScale((s) => Math.min(2.0, s + 0.15))}
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground"
                  onClick={() => setZoomScale(1)}
                  title="Reset Zoom"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Live Card Canvas */}
            <div className="flex-1 w-full flex items-center justify-center p-2 sm:p-4 overflow-x-auto [scrollbar-width:thin] max-w-full">
              {fullTemplate ? (
                <div
                  className="shrink-0"
                  style={{
                    transform: `scale(${zoomScale})`,
                    transformOrigin: "center center",
                    transition: "transform 0.15s ease-out",
                  }}
                >
                  <CardRenderer
                    cardWidth={fullTemplate.cardWidth || 324}
                    cardHeight={fullTemplate.cardHeight || 204}
                    elements={rendererElements}
                    side={activeSide}
                    cardData={{
                      ...formData,
                      cardNumber: cardNumber || "IDC-2026-000001",
                      photo: photoUrl || formData.photo || "",
                      signature: signatureUrl || formData.signature || "",
                    }}
                    scale={1}
                  />
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">Select a template to view card preview.</div>
              )}
            </div>

            {/* Live Indicator */}
            <div className="w-full text-center text-[11px] text-muted-foreground pt-2 border-t border-border">
              Live CardRenderer output. Updates instantly as you type.
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="border-t border-border pt-3 sm:pt-4 mt-2 shrink-0 w-full flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving || submitting}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={saving || submitting}
              className="gap-2 w-full sm:w-auto"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Draft
            </Button>
            <Button
              type="button"
              onClick={() => handleSave(true)}
              disabled={saving || submitting}
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold w-full sm:w-auto"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit for Approval
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
