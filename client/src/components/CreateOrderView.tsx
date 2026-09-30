import { useEffect, useState } from "react";
import { api, type ApiAuthUser, type ApiSchool } from "@/lib/api";
import {
  HOOK_TYPES,
  CARD_MATERIALS,
  ORDER_TYPES,
  PRINT_SIDES,
  type OrderType,
  type PrintSides,
  type CardMaterial,
} from "@shared/orders";
import { isValidIndianMobileNumber } from "@shared/phoneValidation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  Calendar,
  CreditCard,
  Hash,
  Loader2,
  MapPin,
  Phone,
  Send,
  User,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";

interface CreateOrderViewProps {
  user: ApiAuthUser;
  schools: ApiSchool[];
  activeSchool?: ApiSchool;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function CreateOrderView({
  user,
  schools,
  activeSchool,
  onSuccess,
  onCancel,
}: CreateOrderViewProps) {
  const isSchoolAdmin = user.role === "SCHOOL_ADMIN";
  const [activeSchoolsList, setActiveSchoolsList] = useState<Array<{ id: number; name: string; shortCode?: string | null }>>([]);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [orderType, setOrderType] = useState<OrderType>("STUDENT");
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(
    isSchoolAdmin ? user.schoolId || null : null,
  );
  const [hookType, setHookType] = useState<string>("Lanyard hook");
  const [clip, setClip] = useState<boolean>(true);
  const [className, setClassName] = useState<string>("");
  const [section, setSection] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("100");
  const [printSides, setPrintSides] = useState<PrintSides>("SINGLE");
  const [cardMaterial, setCardMaterial] = useState<CardMaterial>("PVC_STANDARD");
  const [lanyardIncluded, setLanyardIncluded] = useState<boolean>(true);
  const [lanyardColor, setLanyardColor] = useState<string>("Navy Blue");
  const [neededByDate, setNeededByDate] = useState<string>("");
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [contactPerson, setContactPerson] = useState<string>(user.name || "");
  const [contactPhone, setContactPhone] = useState<string>(user.phone || "");
  const [notes, setNotes] = useState<string>("");

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isSchoolAdmin) {
      setLoadingSchools(true);
      api.orders
        .activeSchools()
        .then((res) => {
          setActiveSchoolsList(res);
          if (res.length > 0 && !selectedSchoolId) {
            setSelectedSchoolId(res[0].id);
          }
        })
        .catch(() => {
          setActiveSchoolsList(schools.filter((s) => s.isActive));
        })
        .finally(() => setLoadingSchools(false));
    }
  }, [isSchoolAdmin, schools]);

  const schoolDisplay = isSchoolAdmin
    ? activeSchool?.name || schools.find((s) => s.id === user.schoolId)?.name || `School #${user.schoolId}`
    : null;

  const validate = () => {
    const errs: Record<string, string> = {};

    if (!isSchoolAdmin && !selectedSchoolId) {
      errs.schoolId = "Please select a school";
    }

    if (orderType === "STUDENT") {
      if (!className.trim()) {
        errs.className = "Class is required for Student orders";
      }
      if (!section.trim()) {
        errs.section = "Section is required for Student orders";
      }
    }

    const qtyNum = parseInt(quantity, 10);
    if (isNaN(qtyNum) || qtyNum < 1 || qtyNum > 10000) {
      errs.quantity = "Quantity must be between 1 and 10,000";
    }

    if (!contactPerson.trim()) {
      errs.contactPerson = "Contact person name is required";
    }

    const cleanPhone = contactPhone.replace(/\D/g, "");
    if (!cleanPhone) {
      errs.contactPhone = "Contact phone is required";
    } else if (!isValidIndianMobileNumber(cleanPhone)) {
      errs.contactPhone = "Enter a valid 10-digit Indian mobile number";
    }

    if (!deliveryAddress.trim()) {
      errs.deliveryAddress = "Delivery address is required";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please fill in all required fields correctly");
      return;
    }

    try {
      setSubmitting(true);
      const cleanPhone = contactPhone.replace(/\D/g, "");
      const res = await api.orders.create({
        schoolId: isSchoolAdmin ? (user.schoolId as number) : (selectedSchoolId as number),
        orderType,
        hookType,
        clip,
        className: orderType === "STUDENT" ? className.trim() : null,
        section: orderType === "STUDENT" ? section.trim() : null,
        quantity: parseInt(quantity, 10),
        printSides,
        cardMaterial,
        lanyardIncluded,
        lanyardColor: lanyardIncluded ? (lanyardColor.trim() || null) : null,
        neededByDate: neededByDate.trim() || null,
        deliveryAddress: deliveryAddress.trim(),
        contactPerson: contactPerson.trim(),
        contactPhone: cleanPhone,
        notes: notes.trim() || null,
      });

      toast.success(`Order #${res.orderNumber} created successfully!`, {
        description: `${res.quantity} ${res.orderType.toLowerCase()} ID cards queued for production.`,
      });
      onSuccess();
    } catch (err) {
      toast.error("Failed to create order", {
        description: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="rounded-xl h-9"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-black text-[#152e2c]">Create New ID Card Order</h1>
            <p className="text-xs text-[#788784] mt-0.5">
              Submit requirements for student or staff ID card batch printing & accessories
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Order Type & School */}
        <Card className="rounded-2xl border-[#e2e8e3] bg-white shadow-2xs">
          <CardHeader className="border-b border-[#edf0ed] pb-3">
            <CardTitle className="text-sm font-bold text-[#1f3634] flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#0f7f79]" /> Order Scope & Organization
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {/* Segmented Control for Order Type */}
            <div>
              <Label className="text-xs font-bold text-gray-700">Order Type *</Label>
              <div className="grid grid-cols-2 gap-2 mt-1.5 p-1 bg-gray-100 rounded-xl max-w-sm">
                {ORDER_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      setOrderType(t.value);
                      if (t.value === "STAFF") {
                        setClassName("");
                        setSection("");
                      }
                    }}
                    className={`py-2 text-xs font-bold rounded-lg transition-all ${
                      orderType === t.value
                        ? "bg-white text-[#0f7f79] shadow-xs"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* School selection */}
            <div>
              <Label className="text-xs font-bold text-gray-700">Target School *</Label>
              {isSchoolAdmin ? (
                <div className="mt-1 flex items-center gap-2 p-2.5 rounded-xl border border-gray-200 bg-gray-50 text-xs font-bold text-gray-800">
                  <Building2 className="h-4 w-4 text-teal-700" />
                  {schoolDisplay}
                  <span className="text-[10px] text-gray-400 font-normal ml-auto">(Assigned School)</span>
                </div>
              ) : (
                <div className="mt-1">
                  <Select
                    value={selectedSchoolId ? String(selectedSchoolId) : ""}
                    onValueChange={(val) => setSelectedSchoolId(Number(val))}
                    disabled={loadingSchools}
                  >
                    <SelectTrigger className="h-10 text-xs rounded-xl">
                      <SelectValue placeholder={loadingSchools ? "Loading schools..." : "Select school"} />
                    </SelectTrigger>
                    <SelectContent>
                      {activeSchoolsList.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name} ({s.shortCode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.schoolId && (
                    <p className="text-[11px] text-red-500 font-medium mt-1">{errors.schoolId}</p>
                  )}
                </div>
              )}
            </div>

            {/* Class & Section (Student Only) */}
            {orderType === "STUDENT" && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-gray-100">
                <div>
                  <Label className="text-xs font-bold text-gray-700">Class *</Label>
                  <Input
                    className="mt-1 text-xs rounded-xl"
                    placeholder="e.g. 10th or Grade 5"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                  />
                  {errors.className && (
                    <p className="text-[11px] text-red-500 font-medium mt-1">{errors.className}</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs font-bold text-gray-700">Section *</Label>
                  <Input
                    className="mt-1 text-xs rounded-xl"
                    placeholder="e.g. A or Science"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                  />
                  {errors.section && (
                    <p className="text-[11px] text-red-500 font-medium mt-1">{errors.section}</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 2: Card Specifications & Accessories */}
        <Card className="rounded-2xl border-[#e2e8e3] bg-white shadow-2xs">
          <CardHeader className="border-b border-[#edf0ed] pb-3">
            <CardTitle className="text-sm font-bold text-[#1f3634] flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-[#0f7f79]" /> Card Specifications & Accessories
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Quantity */}
              <div>
                <Label className="text-xs font-bold text-gray-700">Number of ID Cards *</Label>
                <Input
                  type="number"
                  min={1}
                  max={10000}
                  className="mt-1 text-xs rounded-xl font-mono"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
                {errors.quantity && (
                  <p className="text-[11px] text-red-500 font-medium mt-1">{errors.quantity}</p>
                )}
              </div>

              {/* Print Sides */}
              <div>
                <Label className="text-xs font-bold text-gray-700">Print Sides *</Label>
                <Select
                  value={printSides}
                  onValueChange={(val: PrintSides) => setPrintSides(val)}
                >
                  <SelectTrigger className="mt-1 h-10 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRINT_SIDES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Card Material */}
              <div>
                <Label className="text-xs font-bold text-gray-700">Card Material *</Label>
                <Select
                  value={cardMaterial}
                  onValueChange={(val: CardMaterial) => setCardMaterial(val)}
                >
                  <SelectTrigger className="mt-1 h-10 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_MATERIALS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-gray-100">
              {/* Hook Type */}
              <div>
                <Label className="text-xs font-bold text-gray-700">Hook Type *</Label>
                <Select value={hookType} onValueChange={setHookType}>
                  <SelectTrigger className="mt-1 h-10 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOOK_TYPES.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Clip Toggle */}
              <div className="flex items-center justify-between rounded-xl border border-gray-200 p-3 bg-gray-50/50 mt-1">
                <div>
                  <Label className="text-xs font-bold text-gray-800">Clip Included</Label>
                  <p className="text-[11px] text-gray-500">Attach crocodile clip to holder</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-600">{clip ? "Yes" : "No"}</span>
                  <Switch checked={clip} onCheckedChange={setClip} />
                </div>
              </div>
            </div>

            {/* Lanyard Options */}
            <div className="rounded-xl border border-gray-200 p-3 bg-gray-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-bold text-gray-800">Lanyard Included</Label>
                  <p className="text-[11px] text-gray-500">Provide customized neck lanyards</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-600">{lanyardIncluded ? "Yes" : "No"}</span>
                  <Switch checked={lanyardIncluded} onCheckedChange={setLanyardIncluded} />
                </div>
              </div>

              {lanyardIncluded && (
                <div className="pt-2 border-t border-gray-200">
                  <Label className="text-xs font-bold text-gray-700">Lanyard Color</Label>
                  <Input
                    className="mt-1 text-xs rounded-xl bg-white"
                    placeholder="e.g. Navy Blue, Maroon, Dark Green"
                    value={lanyardColor}
                    onChange={(e) => setLanyardColor(e.target.value)}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Delivery & Contact */}
        <Card className="rounded-2xl border-[#e2e8e3] bg-white shadow-2xs">
          <CardHeader className="border-b border-[#edf0ed] pb-3">
            <CardTitle className="text-sm font-bold text-[#1f3634] flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#0f7f79]" /> Delivery & Contact Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Contact Person */}
              <div>
                <Label className="text-xs font-bold text-gray-700">Contact Person *</Label>
                <Input
                  className="mt-1 text-xs rounded-xl"
                  placeholder="Full name"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                />
                {errors.contactPerson && (
                  <p className="text-[11px] text-red-500 font-medium mt-1">{errors.contactPerson}</p>
                )}
              </div>

              {/* Contact Phone */}
              <div>
                <Label className="text-xs font-bold text-gray-700">Contact Phone *</Label>
                <div className="mt-1 flex items-center gap-1.5">
                  <div className="h-10 w-12 flex items-center justify-center rounded-xl border border-gray-300 bg-gray-50 text-xs font-bold text-gray-600 select-none shrink-0">
                    +91
                  </div>
                  <div className="flex-1">
                    <Input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      className="text-xs rounded-xl h-10"
                      placeholder="9876543210"
                      value={contactPhone}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                        setContactPhone(digits);
                      }}
                    />
                  </div>
                </div>
                {errors.contactPhone && (
                  <p className="text-[11px] text-red-500 font-medium mt-1">{errors.contactPhone}</p>
                )}
              </div>

              {/* Needed By Date */}
              <div>
                <Label className="text-xs font-bold text-gray-700">Needed By Date (Optional)</Label>
                <Input
                  type="date"
                  className="mt-1 text-xs rounded-xl h-10"
                  value={neededByDate}
                  onChange={(e) => setNeededByDate(e.target.value)}
                />
              </div>
            </div>

            {/* Delivery Address */}
            <div>
              <Label className="text-xs font-bold text-gray-700">Delivery Address *</Label>
              <Textarea
                rows={2}
                className="mt-1 text-xs rounded-xl"
                placeholder="Complete shipping address for physical card package delivery"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
              />
              {errors.deliveryAddress && (
                <p className="text-[11px] text-red-500 font-medium mt-1">{errors.deliveryAddress}</p>
              )}
            </div>

            {/* Notes */}
            <div>
              <Label className="text-xs font-bold text-gray-700">Notes / Production Instructions (Optional)</Label>
              <Textarea
                rows={2}
                className="mt-1 text-xs rounded-xl"
                placeholder="Any special printing requests, custom barcode requirements, or packaging notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-xl px-5"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="rounded-xl px-6 bg-[#0f7f79] hover:bg-[#0c6b66] text-white font-bold gap-2 shadow-sm"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Placing Order...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> Place Order
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
