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
] as const;

export type DynamicFieldKey = (typeof DYNAMIC_FIELDS)[number]["key"];

/**
 * Resolves the dynamic fields available for a given template configuration,
 * or returns all designer DYNAMIC_FIELDS if no specific template elements are provided.
 */
export function getAvailableDynamicFields(
  templateElements?: Array<any>,
): Array<{ key: string; label: string; category: string }> {
  if (!templateElements || templateElements.length === 0) {
    return [...DYNAMIC_FIELDS];
  }

  const usedKeys = new Set<string>();
  for (const el of templateElements) {
    const type = String(el.elementType || el.type || "").toUpperCase();
    const dynamicField = el.config?.dynamicField || el.dynamicField;
    const qrField = el.config?.qrField || el.qrField;
    const barcodeField = el.config?.barcodeField || el.barcodeField;

    if (type.includes("DYNAMIC") && dynamicField) {
      usedKeys.add(String(dynamicField));
    }
    if (type.includes("QR") && qrField) {
      usedKeys.add(String(qrField));
    }
    if (type.includes("BARCODE") && barcodeField) {
      usedKeys.add(String(barcodeField));
    }
  }

  // Always ensure essential student, academic, family, and contact fields are available in the Excel schema:
  // Student Name, Class, Section, Roll Number, Admission Number, Date of Birth, Gender, Blood Group,
  // Father's Name, Mother's Name, Guardian Name, Phone, Address
  const defaultStandardKeys = [
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
  ];

  for (const k of defaultStandardKeys) {
    usedKeys.add(k);
  }

  const matched = DYNAMIC_FIELDS.filter((f) => {
    if (usedKeys.has(f.key)) return true;
    // Map roll_no to roll_number
    if (f.key === "roll_number" && usedKeys.has("roll_no")) return true;
    return false;
  });
  return matched.length > 0 ? matched : [...DYNAMIC_FIELDS];
}

/**
 * Normalizes a header or key for robust matching (ignores case, spaces, symbols).
 */
export function normalizeFieldHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Matches an Excel column header against dynamic field definitions.
 */
export function matchDynamicField(
  header: string,
  availableFields: readonly { key: string; label: string }[] = DYNAMIC_FIELDS,
): { key: string; label: string } | undefined {
  const norm = normalizeFieldHeader(header);
  if (!norm) return undefined;

  // 1. Direct match on key or label
  const direct = availableFields.find(
    (f) => normalizeFieldHeader(f.key) === norm || normalizeFieldHeader(f.label) === norm,
  );
  if (direct) return direct;

  // 2. Common aliases/variations
  const aliases: Record<string, string> = {
    studentname: "student_name",
    name: "student_name",
    student: "student_name",
    fullname: "student_name",
    admissionno: "admission_number",
    admissionnum: "admission_number",
    admissionnumber: "admission_number",
    admissioncode: "admission_number",
    admno: "admission_number",
    rollno: "roll_number",
    rollnum: "roll_number",
    rollnumber: "roll_number",
    roll: "roll_number",
    fathername: "father_name",
    fathersname: "father_name",
    father: "father_name",
    mothername: "mother_name",
    mothersname: "mother_name",
    mother: "mother_name",
    guardianname: "guardian_name",
    guardiansname: "guardian_name",
    guardian: "guardian_name",
    dob: "dob",
    dateofbirth: "dob",
    birthdate: "dob",
    gender: "gender",
    sex: "gender",
    bloodgroup: "blood_group",
    bloodgrp: "blood_group",
    blood: "blood_group",
    phone: "phone",
    phoneno: "phone",
    phonenumber: "phone",
    mobile: "phone",
    mobileno: "phone",
    mobilenumber: "phone",
    contact: "phone",
    contactno: "phone",
    address: "address",
    addr: "address",
    residentialaddress: "address",
    schoolname: "school_name",
    schoolcode: "school_code",
    class: "class",
    grade: "class",
    standard: "class",
    section: "section",
    sec: "section",
  };

  const targetKey = aliases[norm];
  if (targetKey) {
    return availableFields.find((f) => f.key === targetKey) || DYNAMIC_FIELDS.find((f) => f.key === targetKey);
  }

  return undefined;
}

/**
 * Cleans a cell value from Excel.
 * CRITICAL RULE: If a cell is blank or whitespace-only, returns undefined so it is NOT added to card data.
 * Does NOT convert empty cells to "null", "undefined", or placeholders.
 * Preserves valid 0 values. Trims whitespace.
 */
export function cleanExcelCellValue(val: unknown): string | undefined {
  if (val === null || val === undefined) return undefined;
  if (typeof val === "number" || typeof val === "boolean") {
    return String(val).trim();
  }
  let str = String(val).trim();
  if (str === "") return undefined;
  const lower = str.toLowerCase();
  if (lower === "null" || lower === "undefined" || lower === "n/a") {
    return undefined;
  }
  // Strip formula prefixes (=, +, @, or - when not a valid number)
  if (str.startsWith("=") || str.startsWith("+") || str.startsWith("@")) {
    str = str.slice(1).trim();
  } else if (str.startsWith("-") && isNaN(Number(str))) {
    str = str.slice(1).trim();
  }
  if (str === "") return undefined;
  return str;
}

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
  imageShape?: "square" | "circle" | "rounded" | "ellipse";

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
