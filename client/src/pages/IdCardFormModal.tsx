import { useEffect, useMemo, useState } from "react";
import CardRenderer from "@/components/CardRenderer";
import type { ApiIdCard, ApiIdCardDetail, ApiTemplate, ApiTemplateElement } from "@/lib/api";
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

interface IdCardFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: number;
  schoolName?: string;
  schoolCode?: string;
  initialCard?: ApiIdCardDetail | null;
  availableTemplates: ApiTemplate[];
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
  onSaved,
}: IdCardFormModalProps) {
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

  const [activeSide, setActiveSide] = useState<"FRONT" | "BACK">("FRONT");
  const [zoomScale, setZoomScale] = useState(1);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Initialize or reset form data whenever dialog opens or initialCard changes
  useEffect(() => {
    if (!open) return;

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
        school_name: schoolName,
        school_code: schoolCode,
        gender: "Male",
        blood_group: "B+",
      };
      setFormData(initial);
      setPhotoUrl(null);
      setSignatureUrl(null);

      // Automatically determine school's locked or default template
      api.schoolTemplates
        .list(schoolId)
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
    }
  }, [open, initialCard, schoolId, schoolName, schoolCode, availableTemplates]);

  // Load full template details & elements whenever selected template changes
  useEffect(() => {
    if (!selectedTemplateId) {
      setFullTemplate(null);
      return;
    }
    setLoadingTemplate(true);
    api.templates
      .get(selectedTemplateId)
      .then((tmpl) => setFullTemplate(tmpl))
      .catch((err) => {
        console.error("Failed to load template", err);
        toast.error("Could not load template details");
      })
      .finally(() => setLoadingTemplate(false));
  }, [selectedTemplateId]);

  // Determine required dynamic fields from template elements
  const requiredDynamicFields = useMemo(() => {
    if (!fullTemplate?.elements) return [];
    const fields = new Set<string>();
    for (const el of fullTemplate.elements) {
      if (el.elementType === "DYNAMIC_FIELD") {
        const cfg = el.config as Record<string, any> | null;
        if (cfg?.dynamicField) {
          fields.add(cfg.dynamicField);
        }
      }
    }
    return Array.from(fields);
  }, [fullTemplate]);

  const templateHasPhoto = useMemo(() => {
    return (fullTemplate?.elements ?? []).some((el) => el.elementType === "PHOTO");
  }, [fullTemplate]);

  const templateHasSignature = useMemo(() => {
    return (fullTemplate?.elements ?? []).some((el) => el.elementType === "SIGNATURE");
  }, [fullTemplate]);

  // Helper to update field values
  const handleFieldChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  // Upload file helper
  const handleFileUpload = async (
    file: File,
    type: "photo" | "signature",
  ) => {
    if (!file.type.startsWith("image/")) {
      return toast.error("Only image files (PNG, JPG, WebP) are allowed");
    }
    if (file.size > 5 * 1024 * 1024) {
      return toast.error("Image file size must be less than 5MB");
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      try {
        if (type === "photo") setUploadingPhoto(true);
        else setUploadingSig(true);

        const res = await api.upload(file.name, file.type, base64);
        const uploadedUrl = res.url || dataUrl;

        if (type === "photo") {
          setPhotoUrl(uploadedUrl);
          setFormData((prev) => ({ ...prev, photo: uploadedUrl, student_photo: uploadedUrl }));
        } else {
          setSignatureUrl(uploadedUrl);
          setFormData((prev) => ({ ...prev, signature: uploadedUrl }));
        }
        toast.success(`${type === "photo" ? "Student photo" : "Signature"} uploaded successfully`);
      } catch (err) {
        toast.error("Upload failed", {
          description: err instanceof Error ? err.message : "Network error",
        });
      } finally {
        if (type === "photo") setUploadingPhoto(false);
        else setUploadingSig(false);
      }
    };
    reader.readAsDataURL(file);
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
        if (!formData[field] || !formData[field].trim()) {
          const fieldDef = DYNAMIC_FIELDS.find((f) => f.key === field);
          return toast.error(`Please fill in required field: ${fieldDef?.label || field}`);
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
        schoolId,
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
    if (!fullTemplate?.elements) return [];
    return fullTemplate.elements.map((el, i) => ({
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
    }));
  }, [fullTemplate]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-[96vw] sm:max-w-[96vw] md:max-w-[94vw] lg:max-w-[92vw] xl:max-w-[1450px] 2xl:max-w-[1600px] max-h-[92vh] h-[92vh] flex flex-col gap-0 p-4 sm:p-6 sm:rounded-2xl">
        <DialogHeader className="border-b pb-3 shrink-0">
          <div className="flex flex-col items-start justify-between gap-3 pr-2 sm:flex-row sm:items-center sm:pr-6">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                {initialCard
                  ? initialCard.status === "DRAFT"
                    ? "Edit ID Card Draft"
                    : "Edit ID Card"
                  : "New ID Card Draft"}
                {isLockedTemplate && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md">
                    <Lock className="h-3 w-3" /> Locked Template
                  </span>
                )}
              </DialogTitle>
              <div className="text-xs text-gray-500 mt-0.5">
                School: <strong>{schoolName || `School #${schoolId}`}</strong> · Form is dynamically driven by the selected template.
              </div>
            </div>

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
        </DialogHeader>

        {/* Two-Column Split Layout */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-hidden pt-4 lg:grid-cols-12">
          {/* LEFT: Dynamic Template-Driven Form */}
          <div className="min-h-0 overflow-y-auto pr-1 space-y-5 sm:pr-4 lg:col-span-7">
            {loadingTemplate ? (
              <div className="flex items-center justify-center py-16 text-sm text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading template fields…
              </div>
            ) : (
              <>
                {/* Photo & Signature Section */}
                <div className="grid grid-cols-1 gap-4 rounded-xl border border-[#dfe7e2] bg-[#f7faf8] p-4 sm:grid-cols-2">
                  {/* Student Photo */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                      <Camera className="h-3.5 w-3.5 text-teal-600" />
                      Student Photo {templateHasPhoto && <span className="text-red-500">*</span>}
                    </Label>
                    <div className="flex items-center gap-3">
                      <div className="relative h-16 w-14 rounded-lg border border-gray-300 bg-white overflow-hidden flex items-center justify-center shadow-2xs">
                        {photoUrl ? (
                          <img src={photoUrl} alt="Photo" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-[10px] text-gray-400 font-medium">Photo</span>
                        )}
                        {uploadingPhoto && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                          </div>
                        )}
                      </div>
                      <label className="cursor-pointer inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-2xs">
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
                    </div>
                  </div>

                  {/* Signature */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                      <FileSignature className="h-3.5 w-3.5 text-teal-600" />
                      Signature {templateHasSignature && <span className="text-gray-400 font-normal">(Optional)</span>}
                    </Label>
                    <div className="flex items-center gap-3">
                      <div className="relative h-16 w-20 rounded-lg border border-gray-300 bg-white overflow-hidden flex items-center justify-center shadow-2xs">
                        {signatureUrl ? (
                          <img src={signatureUrl} alt="Signature" className="h-full w-full object-contain p-1" />
                        ) : (
                          <span className="text-[10px] text-gray-400 font-medium">Signature</span>
                        )}
                        {uploadingSig && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                          </div>
                        )}
                      </div>
                      <label className="cursor-pointer inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-2xs">
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
                    </div>
                  </div>
                </div>

                {/* Card Number */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs font-bold text-gray-700">Card Number</Label>
                    <Input
                      disabled={!!initialCard}
                      className="mt-1 font-mono text-xs bg-gray-50"
                      placeholder="Auto-generated (e.g. IDC-2026-000001)"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                    />
                    <span className="text-[10px] text-gray-400">
                      {initialCard ? "Persistent ID card identifier." : "Leave blank to auto-generate."}
                    </span>
                  </div>

                  <div>
                    <Label className="text-xs font-bold text-gray-700">Admission Code / Number</Label>
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
                  <div className="text-xs font-bold uppercase tracking-wider text-teal-800 border-b pb-1">
                    Student Details
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs font-bold text-gray-700">
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
                        <Label className="text-xs font-bold text-gray-700">Class</Label>
                        <Input
                          className="mt-1 text-xs"
                          placeholder="e.g. 10"
                          value={formData.class ?? ""}
                          onChange={(e) => handleFieldChange("class", e.target.value)}
                        />
                      </div>

                      <div>
                        <Label className="text-xs font-bold text-gray-700">Section</Label>
                        <Input
                          className="mt-1 text-xs"
                          placeholder="e.g. A"
                          value={formData.section ?? ""}
                          onChange={(e) => handleFieldChange("section", e.target.value)}
                        />
                      </div>

                      <div>
                        <Label className="text-xs font-bold text-gray-700">Roll Number</Label>
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
                        <Label className="text-xs font-bold text-gray-700">Date of Birth</Label>
                        <Input
                          className="mt-1 text-xs"
                          placeholder="DD/MM/YYYY"
                          value={formData.dob ?? ""}
                          onChange={(e) => handleFieldChange("dob", e.target.value)}
                        />
                      </div>

                      <div>
                        <Label className="text-xs font-bold text-gray-700">Gender</Label>
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
                        <Label className="text-xs font-bold text-gray-700">Blood Group</Label>
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
                  <div className="text-xs font-bold uppercase tracking-wider text-teal-800 border-b pb-1">
                    Family & Contact
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs font-bold text-gray-700">Father's Name</Label>
                      <Input
                        className="mt-1 text-xs"
                        placeholder="e.g. Suresh Kumar"
                        value={formData.father_name ?? ""}
                        onChange={(e) => handleFieldChange("father_name", e.target.value)}
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-bold text-gray-700">Mother's Name</Label>
                      <Input
                        className="mt-1 text-xs"
                        placeholder="e.g. Anita Devi"
                        value={formData.mother_name ?? ""}
                        onChange={(e) => handleFieldChange("mother_name", e.target.value)}
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-bold text-gray-700">Guardian Name</Label>
                      <Input
                        className="mt-1 text-xs"
                        placeholder="Guardian name"
                        value={formData.guardian_name ?? ""}
                        onChange={(e) => handleFieldChange("guardian_name", e.target.value)}
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-bold text-gray-700">Contact Phone</Label>
                      <Input
                        className="mt-1 text-xs"
                        placeholder="+91 98765 43210"
                        value={formData.phone ?? ""}
                        onChange={(e) => handleFieldChange("phone", e.target.value)}
                      />
                    </div>

                    <div className="col-span-2">
                      <Label className="text-xs font-bold text-gray-700">Residential Address</Label>
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
                  const extraFields = requiredDynamicFields.filter(
                    (f) =>
                      ![
                        "student_name",
                        "class",
                        "section",
                        "roll_number",
                        "admission_number",
                        "dob",
                        "gender",
                        "blood_group",
                        "father_name",
                        "mother_name",
                        "guardian_name",
                        "phone",
                        "address",
                        "school_name",
                        "school_code",
                      ].includes(f),
                  );
                  if (extraFields.length === 0) return null;
                  return (
                    <div className="space-y-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-teal-800 border-b pb-1">
                        Additional Template Fields
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {extraFields.map((customField) => (
                          <div key={customField} className="space-y-1">
                            <Label className="text-xs font-bold text-gray-700 capitalize">
                              {customField.replaceAll("_", " ")} <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              className="text-xs"
                              value={formData[customField] ?? ""}
                              onChange={(e) => handleFieldChange(customField, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>

          {/* RIGHT: Live Interactive CardRenderer Preview */}
          <div className="lg:col-span-5 bg-gray-100/70 rounded-2xl p-4 flex flex-col items-center justify-between border border-gray-200">
            {/* Toolbar */}
            <div className="w-full flex items-center justify-between pb-3 border-b border-gray-200">
              {/* Side toggle */}
              <div className="flex gap-1 bg-white p-1 rounded-lg border shadow-2xs">
                {(["FRONT", "BACK"] as const).map((side) => (
                  <button
                    key={side}
                    type="button"
                    onClick={() => setActiveSide(side)}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                      activeSide === side
                        ? "bg-[#0f7f79] text-white"
                        : "text-gray-500 hover:text-gray-900"
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
                <span className="text-[11px] font-mono font-medium text-gray-500 w-12 text-center">
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
                  className="h-7 w-7 p-0 text-gray-400"
                  onClick={() => setZoomScale(1)}
                  title="Reset Zoom"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Live Card Canvas */}
            <div className="flex-1 w-full flex items-center justify-center p-4 overflow-hidden">
              {fullTemplate ? (
                <div
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
                <div className="text-xs text-gray-400">Select a template to view card preview.</div>
              )}
            </div>

            {/* Live Indicator */}
            <div className="w-full text-center text-[11px] text-gray-400 pt-2 border-t border-gray-200">
              Live CardRenderer output. Updates instantly as you type.
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="border-t pt-4 mt-2 shrink-0 w-full flex items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving || submitting}
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={saving || submitting}
              className="gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Draft
            </Button>
            <Button
              type="button"
              onClick={() => handleSave(true)}
              disabled={saving || submitting}
              className="gap-2 bg-[#0f7f79] hover:bg-[#0b6560] text-white font-semibold"
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
