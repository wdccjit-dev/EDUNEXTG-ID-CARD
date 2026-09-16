import {
  Type,
  Image,
  Camera,
  School,
  PenTool,
  QrCode,
  Barcode,
  Square,
  Minus,
  Braces,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DesignerElementType } from "@shared/templateDesigner";
import type { DesignerAction } from "./useDesignerState";

const elementItems: { type: DesignerElementType; label: string; icon: typeof Type; group: string }[] = [
  { type: "TEXT", label: "Text", icon: Type, group: "Content" },
  { type: "DYNAMIC_FIELD", label: "Dynamic Field", icon: Braces, group: "Content" },
  { type: "IMAGE", label: "Image", icon: Image, group: "Media" },
  { type: "PHOTO", label: "Student Photo", icon: Camera, group: "Media" },
  { type: "LOGO", label: "School Logo", icon: School, group: "Media" },
  { type: "SIGNATURE", label: "Signature", icon: PenTool, group: "Media" },
  { type: "QR_CODE", label: "QR Code", icon: QrCode, group: "Codes" },
  { type: "BARCODE", label: "Barcode", icon: Barcode, group: "Codes" },
  { type: "RECTANGLE", label: "Rectangle", icon: Square, group: "Shapes" },
  { type: "LINE", label: "Line", icon: Minus, group: "Shapes" },
];

const groups = ["Content", "Media", "Codes", "Shapes"] as const;

interface ElementPaletteProps {
  dispatch: React.Dispatch<DesignerAction>;
}

export default function ElementPalette({ dispatch }: ElementPaletteProps) {
  return (
    <div className="flex w-[72px] flex-col border-r border-[#e0e6e1] bg-[#fafaf8]">
      <div className="px-2 pb-1 pt-3 text-center text-[9px] font-bold uppercase tracking-[0.14em] text-[#98a4a1]">
        Elements
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 pb-3">
        {groups.map((group) => (
          <div key={group} className="mt-2">
            <div className="mb-1 text-center text-[8px] font-semibold uppercase tracking-[0.12em] text-[#b0b8b6]">
              {group}
            </div>
            <div className="grid grid-cols-1 gap-1">
              {elementItems
                .filter((item) => item.group === group)
                .map((item) => (
                  <Tooltip key={item.type}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => dispatch({ type: "ADD_ELEMENT", elementType: item.type })}
                        className="flex flex-col items-center gap-0.5 rounded-lg border border-transparent px-1 py-2 text-[#778381] transition-all hover:border-[#d6e4dc] hover:bg-white hover:text-[#0f7f79] hover:shadow-sm"
                      >
                        <item.icon className="h-4 w-4" strokeWidth={1.8} />
                        <span className="text-[8px] font-semibold leading-tight">{item.label}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Add {item.label}</TooltipContent>
                  </Tooltip>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
