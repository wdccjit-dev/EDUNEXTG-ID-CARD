import * as XLSX from "xlsx";
import {
  DYNAMIC_FIELDS,
  getAvailableDynamicFields,
  matchDynamicField,
  cleanExcelCellValue,
  type DynamicFieldKey,
} from "../shared/templateDesigner";

export interface ParsedExcelRow {
  rowNumber: number;
  studentName?: string;
  admissionCode?: string;
  data: Record<string, string>;
  raw: Record<string, unknown>;
}

export interface ExcelParseResult {
  headers: string[];
  mappedFields: Array<{ originalHeader: string; matchedKey: string; matchedLabel: string }>;
  unmappedHeaders: string[];
  rows: ParsedExcelRow[];
  errors: Array<{ rowNumber: number; reason: string }>;
}

/**
 * Generate a dynamic example Excel file buffer using the template's available dynamic fields.
 */
export function generateExampleExcelBuffer(
  fields: Array<{ key: string; label: string; category?: string }> = [...DYNAMIC_FIELDS],
): Buffer {
  const headers = fields.map((f) => f.label);

  // Example row matching the header columns (for visual guidance only)
  const sampleRow: Record<string, string> = {
    "Student Name": "Rahul Kumar",
    "Class": "10",
    "Section": "A",
    "Roll Number": "15",
    "Admission Number": "ADM-2026-001",
    "Date of Birth": "2010-05-12",
    "Gender": "Male",
    "Blood Group": "B+",
    "Father's Name": "Suresh Kumar",
    "Mother's Name": "Anita Devi",
    "Guardian Name": "Suresh Kumar",
    "Phone": "9876543210",
    "Address": "42 Park Avenue, New Delhi",
    "School Name": "Sample Public School",
  };

  const rowValues = fields.map((f) => sampleRow[f.label] || "");

  const ws = XLSX.utils.aoa_to_sheet([headers, rowValues]);

  // Set nice column widths
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 4, 15) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "ID Card Requests");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/**
 * Parses an uploaded Excel buffer into validated ID card request rows.
 * Implements security checks, empty value pruning, formula sanitization, and graceful validation.
 */
export function parseExcelBuffer(
  buffer: Buffer,
  availableFields: Array<{ key: string; label: string }> = [...DYNAMIC_FIELDS],
): ExcelParseResult {
  // Read workbook safely
  const wb = XLSX.read(buffer, {
    type: "buffer",
    cellFormula: false, // Disallow formula evaluation for security
    cellHTML: false,
    cellText: false,
  });

  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("Uploaded Excel workbook contains no sheets");
  }

  const ws = wb.Sheets[firstSheetName];
  // Parse as 2D array of rows
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });

  if (rawRows.length === 0) {
    throw new Error("The uploaded spreadsheet is completely empty");
  }

  // Row 0 is headers
  const headerRow = rawRows[0];
  if (!Array.isArray(headerRow) || headerRow.length === 0) {
    throw new Error("No header columns found in spreadsheet");
  }

  const headers = headerRow.map((h) => (h !== null && h !== undefined ? String(h).trim() : "")).filter(Boolean);
  if (headers.length === 0) {
    throw new Error("Header row contains no valid column names");
  }

  // Map headers to dynamic fields
  const mappedFields: Array<{ originalHeader: string; matchedKey: string; matchedLabel: string; colIndex: number }> = [];
  const unmappedHeaders: string[] = [];

  for (let c = 0; c < headerRow.length; c++) {
    const rawH = headerRow[c];
    if (rawH === null || rawH === undefined) continue;
    const h = String(rawH).trim();
    if (!h) continue;

    const matched = matchDynamicField(h, availableFields);
    if (matched) {
      mappedFields.push({
        originalHeader: h,
        matchedKey: matched.key,
        matchedLabel: matched.label,
        colIndex: c,
      });
    } else {
      unmappedHeaders.push(h);
    }
  }

  if (mappedFields.length === 0) {
    throw new Error(
      `No recognized dynamic field columns found. Please ensure headers match the template fields (e.g. ${availableFields.slice(0, 5).map((f) => `"${f.label}"`).join(", ")}).`,
    );
  }

  const rows: ParsedExcelRow[] = [];
  const errors: Array<{ rowNumber: number; reason: string }> = [];

  for (let r = 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    const rowNumber = r + 1; // 1-indexed for user display

    if (!Array.isArray(row) || row.every((c) => c === null || c === undefined || String(c).trim() === "")) {
      // Entirely empty row — skip gracefully
      continue;
    }

    const data: Record<string, string> = {};
    const raw: Record<string, unknown> = {};

    for (const mf of mappedFields) {
      const cellVal = row[mf.colIndex];
      raw[mf.originalHeader] = cellVal;

      // CRITICAL RULE: Empty, null, undefined, or whitespace-only cells MUST NOT be added
      const cleaned = cleanExcelCellValue(cellVal);
      if (cleaned !== undefined) {
        // Strip potential dangerous CSV/formula prefix characters for defense-in-depth
        let safeVal = cleaned;
        if (safeVal.startsWith("=") || safeVal.startsWith("+") || safeVal.startsWith("-") || safeVal.startsWith("@")) {
          // If followed by text/formula, prepend single quote or strip
          if (safeVal.length > 1 && !/^-?\d+(\.\d+)?$/.test(safeVal)) {
            safeVal = safeVal.replace(/^[=+\-@]+/, "");
          }
        }
        data[mf.matchedKey] = safeVal;
      }
    }

    // Resolve studentName and admissionCode
    const studentName = data["student_name"] || data["name"] || undefined;
    const admissionCode = data["admission_number"] || data["admission_code"] || data["roll_number"] || undefined;

    if (!studentName && !admissionCode && Object.keys(data).length === 0) {
      // Blank or useless row
      continue;
    }

    if (!studentName && !admissionCode) {
      errors.push({
        rowNumber,
        reason: "Row is missing both Student Name and Admission/Roll Number",
      });
      continue;
    }

    rows.push({
      rowNumber,
      studentName,
      admissionCode,
      data,
      raw,
    });
  }

  return {
    headers,
    mappedFields: mappedFields.map(({ originalHeader, matchedKey, matchedLabel }) => ({
      originalHeader,
      matchedKey,
      matchedLabel,
    })),
    unmappedHeaders,
    rows,
    errors,
  };
}
