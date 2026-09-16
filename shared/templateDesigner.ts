/** Shared types and constants for the Visual ID Card Template Designer */

// ─── Element Types ──────────────────────────────────────────────────────────

export const ELEMENT_TYPES = [
  "TEXT",
  "IMAGE",
  "PHOTO",
  "LOGO",
  "SIGNATURE",
  "QR_CODE",
  "BARCODE",
  "RECTANGLE",
  "LINE",
  "DYNAMIC_FIELD",
] as const;

export type DesignerElementType = (typeof ELEMENT_TYPES)[number];

// ─── Sides ──────────────────────────────────────────────────────────────────

export type DesignerSide = "FRONT" | "BACK";

// ─── Dynamic Fields ─────────────────────────────────────────────────────────

export const DYNAMIC_FIELDS = [
  { key: "student_name", label: "Student Name", category: "Student" },
  { key: "class", label: "Class", category: "Student" },
  { key: "section", label: "Section", category: "Student" },
  { key: "roll_number", label: "Roll Number", category: "Student" },
  { key: "admission_number", label: "Admission Number", category: "Student" },
  { key: "dob", label: "Date of Birth", category: "Student" },
  { key: "gender", label: "Gender", category: "Student" },
  { key: "blood_group", label: "Blood Group", category: "Student" },
  { key: "father_name", label: "Father's Name", category: "Family" },
  { key: "mother_name", label: "Mother's Name", category: "Family" },
  { key: "guardian_name", label: "Guardian Name", category: "Family" },
  { key: "phone", label: "Phone", category: "Contact" },
  { key: "address", label: "Address", category: "Contact" },
  { key: "school_name", label: "School Name", category: "School" },
  { key: "school_code", label: "School Code", category: "School" },
] as const;

export type DynamicFieldKey = (typeof DYNAMIC_FIELDS)[number]["key"];

// ─── Sample Card Data (preview only) ────────────────────────────────────────

export const SAMPLE_CARD_DATA: Record<string, string> = {
  student_name: "Rahul Kumar",
  class: "10",
  section: "A",
  roll_number: "15",
  admission_number: "ADM-2026-001",
  dob: "12/05/2010",
  gender: "Male",
  blood_group: "B+",
  father_name: "Suresh Kumar",
  mother_name: "Anita Devi",
  guardian_name: "Suresh Kumar",
  phone: "+91 98765 43210",
  address: "42 Park Avenue, New Delhi",
  school_name: "Greenwood High School",
  school_code: "GWHS",
};

// ─── Element Configuration ──────────────────────────────────────────────────

export interface ElementConfig {
  // Position & size
  x: number;
  y: number;
  width: number;
  height: number;
  side: DesignerSide;

  // Transform
  rotation: number;
  opacity: number;

  // Text
  content?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: "left" | "center" | "right";
  textColor?: string;

  // Background & border
  bgColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;

  // Image
  imageUrl?: string;
  objectFit?: "cover" | "contain" | "fill" | "none";

  // Dynamic field
  dynamicField?: DynamicFieldKey;

  // QR Code
  qrField?: string;
  qrSize?: number;

  // Barcode
  barcodeField?: string;
  barcodeFormat?: "CODE128" | "CODE39" | "EAN13" | "UPC";

  // Line
  lineDirection?: "horizontal" | "vertical";
  lineColor?: string;
  lineWidth?: number;
}

// ─── Designer Element ───────────────────────────────────────────────────────

export interface DesignerElement {
  id?: number;
  elementKey: string;
  elementType: DesignerElementType;
  label: string | null;
  config: ElementConfig;
  sortOrder: number;
}

// ─── Template Definition ────────────────────────────────────────────────────

export type TemplateOrientation = "portrait" | "landscape";
export type TemplateStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";

export interface TemplateDefinition {
  id: number;
  name: string;
  description: string | null;
  orientation: TemplateOrientation;
  cardWidth: number;
  cardHeight: number;
  status: TemplateStatus;
  accent: "teal" | "coral" | "indigo" | "yellow";
}

// ─── Default Element Configs ────────────────────────────────────────────────

export function defaultElementConfig(type: DesignerElementType, side: DesignerSide): ElementConfig {
  const base: ElementConfig = {
    x: 20,
    y: 20,
    width: 120,
    height: 30,
    side,
    rotation: 0,
    opacity: 1,
  };

  switch (type) {
    case "TEXT":
      return { ...base, content: "Text", fontFamily: "Inter", fontSize: 14, fontWeight: "400", fontStyle: "normal", textAlign: "left", textColor: "#1a1a1a" };
    case "IMAGE":
      return { ...base, width: 80, height: 80, objectFit: "cover" };
    case "PHOTO":
      return { ...base, width: 72, height: 90, objectFit: "cover", borderRadius: 4, borderWidth: 1, borderColor: "#d0d0d0" };
    case "LOGO":
      return { ...base, width: 48, height: 48, objectFit: "contain" };
    case "SIGNATURE":
      return { ...base, width: 100, height: 40, objectFit: "contain" };
    case "QR_CODE":
      return { ...base, width: 64, height: 64, qrField: "admission_number", qrSize: 64 };
    case "BARCODE":
      return { ...base, width: 140, height: 44, barcodeField: "admission_number", barcodeFormat: "CODE128" };
    case "RECTANGLE":
      return { ...base, width: 140, height: 60, bgColor: "#f0f0f0", borderRadius: 4 };
    case "LINE":
      return { ...base, width: 200, height: 2, lineDirection: "horizontal", lineColor: "#cccccc", lineWidth: 2 };
    case "DYNAMIC_FIELD":
      return { ...base, dynamicField: "student_name", fontFamily: "Inter", fontSize: 14, fontWeight: "600", fontStyle: "normal", textAlign: "left", textColor: "#1a1a1a" };
    default:
      return base;
  }
}

// ─── Utility ────────────────────────────────────────────────────────────────

let _keyCounter = 0;
export function generateElementKey(type: DesignerElementType): string {
  _keyCounter++;
  return `${type.toLowerCase()}_${Date.now()}_${_keyCounter}`;
}
