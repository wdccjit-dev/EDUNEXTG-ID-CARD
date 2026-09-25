import { Copy, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { DYNAMIC_FIELDS } from "@shared/templateDesigner";
import type { DesignerElement, ElementConfig } from "@shared/templateDesigner";
import type { DesignerAction, TemplateMeta } from "./useDesignerState";

interface PropertyPanelProps {
  selectedElement: DesignerElement | null;
  template: TemplateMeta;
  dispatch: React.Dispatch<DesignerAction>;
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[72px_1fr] items-center gap-1.5">
      <Label className="text-[10px] font-semibold text-[#98a4a1]">{label}</Label>
      {children}
    </div>
  );
}

function NumInput({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <Input
      type="number"
      className="h-7 text-xs"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        className="h-7 w-7 cursor-pointer rounded border border-[#e0e6e1]"
        value={value || "#000000"}
        onChange={(e) => onChange(e.target.value)}
      />
      <Input className="h-7 flex-1 text-xs" value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

const FONT_FAMILIES = ["Inter", "Roboto", "Outfit", "Arial", "Georgia", "Courier New", "Verdana", "Times New Roman"];
const FONT_WEIGHTS = ["300", "400", "500", "600", "700", "800", "900"];

export default function PropertyPanel({ selectedElement, template, dispatch }: PropertyPanelProps) {
  if (!selectedElement) {
    return (
      <div className="flex w-[240px] flex-col border-l border-[#e0e6e1] bg-[#fafaf8]">
        {/* Template properties */}
        <div className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#0f7f79]">
          Template
        </div>
        <div className="flex flex-col gap-2 px-3 pb-3">
          <PropRow label="Name">
            <Input
              className="h-7 text-xs"
              value={template.name}
              onChange={(e) => dispatch({ type: "UPDATE_TEMPLATE", changes: { name: e.target.value } })}
            />
          </PropRow>
          <PropRow label="Description">
            <Input
              className="h-7 text-xs"
              value={template.description ?? ""}
              onChange={(e) => dispatch({ type: "UPDATE_TEMPLATE", changes: { description: e.target.value || null } })}
            />
          </PropRow>
          <PropRow label="Orientation">
            <Select
              value={template.orientation}
              onValueChange={(v: "portrait" | "landscape") => {
                const isTargetPortrait = v === "portrait";
                const isCurrentlyPortrait = template.cardHeight > template.cardWidth;
                let newWidth = template.cardWidth;
                let newHeight = template.cardHeight;

                if (isTargetPortrait && !isCurrentlyPortrait) {
                  // Swap dimensions to portrait (height > width)
                  newWidth = Math.min(template.cardWidth, template.cardHeight);
                  newHeight = Math.max(template.cardWidth, template.cardHeight);
                } else if (!isTargetPortrait && isCurrentlyPortrait) {
                  // Swap dimensions to landscape (width > height)
                  newWidth = Math.max(template.cardWidth, template.cardHeight);
                  newHeight = Math.min(template.cardWidth, template.cardHeight);
                }

                dispatch({
                  type: "UPDATE_TEMPLATE",
                  changes: {
                    orientation: v,
                    cardWidth: newWidth,
                    cardHeight: newHeight,
                  },
                });
              }}
            >
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="landscape">Landscape</SelectItem>
                <SelectItem value="portrait">Portrait</SelectItem>
              </SelectContent>
            </Select>
          </PropRow>
          <PropRow label="Width (px)">
            <NumInput value={template.cardWidth} min={100} max={1000} onChange={(v) => dispatch({ type: "UPDATE_TEMPLATE", changes: { cardWidth: v } })} />
          </PropRow>
          <PropRow label="Height (px)">
            <NumInput value={template.cardHeight} min={100} max={1000} onChange={(v) => dispatch({ type: "UPDATE_TEMPLATE", changes: { cardHeight: v } })} />
          </PropRow>
          <PropRow label="Status">
            <Select
              value={template.status}
              onValueChange={(v) => dispatch({ type: "UPDATE_TEMPLATE", changes: { status: v as TemplateMeta["status"] } })}
            >
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>
          </PropRow>
        </div>
        <div className="flex flex-1 items-center justify-center px-3 text-center text-xs text-[#b0b8b6]">
          Select an element on the canvas to edit its properties
        </div>
      </div>
    );
  }

  const c = selectedElement.config;
  const update = (changes: Partial<ElementConfig>) =>
    dispatch({ type: "UPDATE_ELEMENT", key: selectedElement.elementKey, changes });

  const isText = selectedElement.elementType === "TEXT" || selectedElement.elementType === "DYNAMIC_FIELD";
  const isImage = ["IMAGE", "PHOTO", "LOGO", "SIGNATURE"].includes(selectedElement.elementType);
  const isQr = selectedElement.elementType === "QR_CODE";
  const isBarcode = selectedElement.elementType === "BARCODE";
  const isLine = selectedElement.elementType === "LINE";
  const isDynamic = selectedElement.elementType === "DYNAMIC_FIELD";

  return (
    <div className="flex w-[240px] flex-col border-l border-[#e0e6e1] bg-[#fafaf8]">
      <div className="flex items-center justify-between px-3 pb-1 pt-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#0f7f79]">
          {selectedElement.elementType.replace("_", " ")}
        </span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-[#778381] hover:text-[#0f7f79]"
            onClick={() => dispatch({ type: "DUPLICATE_ELEMENT", key: selectedElement.elementKey })}
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-[#778381] hover:text-red-500"
            onClick={() => dispatch({ type: "DELETE_ELEMENT", key: selectedElement.elementKey })}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-2 px-3 pb-3">
          {/* Position & Size */}
          <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#b0b8b6]">Position & Size</div>
          <PropRow label="Side">
            <Select value={c.side} onValueChange={(v) => update({ side: v as "FRONT" | "BACK" })}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="FRONT">Front</SelectItem>
                <SelectItem value="BACK">Back</SelectItem>
              </SelectContent>
            </Select>
          </PropRow>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <Label className="text-[9px] text-[#98a4a1]">X</Label>
              <NumInput value={Math.round(c.x)} onChange={(v) => update({ x: v })} />
            </div>
            <div>
              <Label className="text-[9px] text-[#98a4a1]">Y</Label>
              <NumInput value={Math.round(c.y)} onChange={(v) => update({ y: v })} />
            </div>
            <div>
              <Label className="text-[9px] text-[#98a4a1]">Width</Label>
              <NumInput value={Math.round(c.width)} min={10} onChange={(v) => update({ width: v })} />
            </div>
            <div>
              <Label className="text-[9px] text-[#98a4a1]">Height</Label>
              <NumInput value={Math.round(c.height)} min={10} onChange={(v) => update({ height: v })} />
            </div>
          </div>

          <Separator className="my-1" />

          {/* Rotation & Opacity */}
          <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#b0b8b6]">Transform</div>
          <PropRow label="Rotation">
            <div className="flex items-center gap-1.5">
              <Slider value={[c.rotation]} min={-180} max={180} step={1} className="flex-1" onValueChange={([v]) => update({ rotation: v })} />
              <span className="w-8 text-right text-[10px] text-[#98a4a1]">{c.rotation}°</span>
            </div>
          </PropRow>
          <PropRow label="Opacity">
            <div className="flex items-center gap-1.5">
              <Slider value={[c.opacity]} min={0} max={1} step={0.05} className="flex-1" onValueChange={([v]) => update({ opacity: v })} />
              <span className="w-8 text-right text-[10px] text-[#98a4a1]">{Math.round(c.opacity * 100)}%</span>
            </div>
          </PropRow>

          {/* Dynamic field selector */}
          {isDynamic && (
            <>
              <Separator className="my-1" />
              <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#b0b8b6]">Dynamic Field</div>
              <PropRow label="Field">
                <Select value={c.dynamicField ?? "student_name"} onValueChange={(v) => update({ dynamicField: v as ElementConfig["dynamicField"] })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DYNAMIC_FIELDS.map((f) => (
                      <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </PropRow>
            </>
          )}

          {/* Text properties */}
          {isText && (
            <>
              <Separator className="my-1" />
              <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#b0b8b6]">Typography</div>
              {!isDynamic && (
                <PropRow label="Content">
                  <Input className="h-7 text-xs" value={c.content ?? ""} onChange={(e) => update({ content: e.target.value })} />
                </PropRow>
              )}
              <PropRow label="Font">
                <Select value={c.fontFamily ?? "Inter"} onValueChange={(v) => update({ fontFamily: v })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FONT_FAMILIES.map((f) => (
                      <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </PropRow>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <Label className="text-[9px] text-[#98a4a1]">Size</Label>
                  <NumInput value={c.fontSize ?? 14} min={6} max={72} onChange={(v) => update({ fontSize: v })} />
                </div>
                <div>
                  <Label className="text-[9px] text-[#98a4a1]">Weight</Label>
                  <Select value={c.fontWeight ?? "400"} onValueChange={(v) => update({ fontWeight: v })}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FONT_WEIGHTS.map((w) => (
                        <SelectItem key={w} value={w}>{w}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <PropRow label="Style">
                <Select value={c.fontStyle ?? "normal"} onValueChange={(v) => update({ fontStyle: v })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="italic">Italic</SelectItem>
                  </SelectContent>
                </Select>
              </PropRow>
              <PropRow label="Align">
                <Select value={c.textAlign ?? "left"} onValueChange={(v) => update({ textAlign: v as "left" | "center" | "right" })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </PropRow>
              <PropRow label="Color">
                <ColorInput value={c.textColor ?? "#000000"} onChange={(v) => update({ textColor: v })} />
              </PropRow>
            </>
          )}

          {/* Image properties */}
          {isImage && (
            <>
              <Separator className="my-1" />
              <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#b0b8b6]">Image</div>
              <PropRow label="Upload">
                <div className="flex items-center gap-1.5">
                  <label className="flex h-7 cursor-pointer items-center justify-center rounded border border-[#e0e6e1] bg-white px-2 text-[10px] font-bold text-[#778381] hover:bg-[#f0f0ee] hover:text-[#0f7f79]">
                    <Upload className="mr-1 h-3 w-3" /> Choose file
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = async () => {
                          const base64 = (reader.result as string).split(",")[1];
                          try {
                            const res = await api.upload(file.name, file.type, base64);
                            update({ imageUrl: res.url });
                            toast.success("Image uploaded successfully");
                          } catch (err) {
                            toast.error("Upload failed: " + (err instanceof Error ? err.message : "Unknown error"));
                          }
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                  {c.imageUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-1.5 text-[10px] text-red-500 hover:bg-red-50"
                      onClick={() => update({ imageUrl: undefined })}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </PropRow>
              <PropRow label="URL">
                <Input className="h-7 text-xs" placeholder="https://..." value={c.imageUrl ?? ""} onChange={(e) => update({ imageUrl: e.target.value })} />
              </PropRow>
              <PropRow label="Fit">
                <Select value={c.objectFit ?? "cover"} onValueChange={(v) => update({ objectFit: v as ElementConfig["objectFit"] })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cover">Cover</SelectItem>
                    <SelectItem value="contain">Contain</SelectItem>
                    <SelectItem value="fill">Fill</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </PropRow>
              <PropRow label="Shape">
                <Select value={c.imageShape ?? "square"} onValueChange={(v) => update({ imageShape: v as ElementConfig["imageShape"] })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="square">Square / Rectangle</SelectItem>
                    <SelectItem value="circle">Circle</SelectItem>
                    <SelectItem value="rounded">Rounded Rectangle</SelectItem>
                    <SelectItem value="ellipse">Ellipse</SelectItem>
                  </SelectContent>
                </Select>
              </PropRow>
            </>
          )}

          {/* QR Code */}
          {isQr && (
            <>
              <Separator className="my-1" />
              <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#b0b8b6]">QR Code</div>
              <PropRow label="Data Field">
                <Select value={c.qrField ?? "admission_number"} onValueChange={(v) => update({ qrField: v })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DYNAMIC_FIELDS.map((f) => (
                      <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </PropRow>
            </>
          )}

          {/* Barcode */}
          {isBarcode && (
            <>
              <Separator className="my-1" />
              <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#b0b8b6]">Barcode</div>
              <PropRow label="Data Field">
                <Select value={c.barcodeField ?? "admission_number"} onValueChange={(v) => update({ barcodeField: v })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DYNAMIC_FIELDS.map((f) => (
                      <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </PropRow>
              <PropRow label="Format">
                <Select value={c.barcodeFormat ?? "CODE128"} onValueChange={(v) => update({ barcodeFormat: v as ElementConfig["barcodeFormat"] })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CODE128">CODE128</SelectItem>
                    <SelectItem value="CODE39">CODE39</SelectItem>
                    <SelectItem value="EAN13">EAN-13</SelectItem>
                    <SelectItem value="UPC">UPC</SelectItem>
                  </SelectContent>
                </Select>
              </PropRow>
            </>
          )}

          {/* Line */}
          {isLine && (
            <>
              <Separator className="my-1" />
              <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#b0b8b6]">Line</div>
              <PropRow label="Direction">
                <Select value={c.lineDirection ?? "horizontal"} onValueChange={(v) => update({ lineDirection: v as "horizontal" | "vertical" })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="horizontal">Horizontal</SelectItem>
                    <SelectItem value="vertical">Vertical</SelectItem>
                  </SelectContent>
                </Select>
              </PropRow>
              <PropRow label="Color">
                <ColorInput value={c.lineColor ?? "#cccccc"} onChange={(v) => update({ lineColor: v })} />
              </PropRow>
              <PropRow label="Thickness">
                <NumInput value={c.lineWidth ?? 2} min={1} max={20} onChange={(v) => update({ lineWidth: v })} />
              </PropRow>
            </>
          )}

          {/* Background & Border (for non-line elements) */}
          {!isLine && (
            <>
              <Separator className="my-1" />
              <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#b0b8b6]">Background & Border</div>
              <PropRow label="BG Color">
                <ColorInput value={c.bgColor ?? ""} onChange={(v) => update({ bgColor: v || undefined })} />
              </PropRow>
              <PropRow label="Border">
                <ColorInput value={c.borderColor ?? ""} onChange={(v) => update({ borderColor: v || undefined })} />
              </PropRow>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <Label className="text-[9px] text-[#98a4a1]">B. Width</Label>
                  <NumInput value={c.borderWidth ?? 0} min={0} max={20} onChange={(v) => update({ borderWidth: v })} />
                </div>
                <div>
                  <Label className="text-[9px] text-[#98a4a1]">Radius</Label>
                  <NumInput value={c.borderRadius ?? 0} min={0} max={100} onChange={(v) => update({ borderRadius: v })} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
