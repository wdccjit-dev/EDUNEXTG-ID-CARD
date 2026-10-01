import path from "node:path";
import AdmZip from "adm-zip";
import sharp from "sharp";
import { eq, inArray, and } from "drizzle-orm";
import {
  idCards,
  idCardRequests,
  idCardData,
  idCardFiles,
  idCardTemplates,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

export interface BulkPhotoMatchResult {
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

export interface BulkUploadPhotosOptions {
  schoolId: number;
  userId: number;
  zipBase64?: string;
  images?: Array<{ filename: string; dataBase64: string; contentType?: string }>;
  dryRun?: boolean;
}

export interface BulkUploadPhotosResult {
  success: true;
  total: number;
  matched: number;
  unmatched: number;
  results: BulkPhotoMatchResult[];
}

const SUPPORTED_IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

/**
 * Compresses an image buffer using sharp to < 100KB,
 * auto-rotating EXIF and resizing to max 640px long-edge.
 */
export async function compressPhotoBuffer(inputBuffer: Buffer): Promise<Buffer> {
  try {
    const metadata = await sharp(inputBuffer).metadata();
    const maxLongSide = 640;
    let targetWidth = metadata.width || 640;
    let targetHeight = metadata.height || 640;

    if (targetWidth > maxLongSide || targetHeight > maxLongSide) {
      if (targetWidth >= targetHeight) {
        targetHeight = Math.round((targetHeight * maxLongSide) / targetWidth);
        targetWidth = maxLongSide;
      } else {
        targetWidth = Math.round((targetWidth * maxLongSide) / targetHeight);
        targetHeight = maxLongSide;
      }
    }

    return await sharp(inputBuffer)
      .rotate()
      .flatten({ background: "#ffffff" })
      .resize(targetWidth, targetHeight, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
  } catch (err) {
    console.warn("[BulkPhotos] Sharp compression fallback:", err);
    return inputBuffer;
  }
}

/**
 * Upsert a field in idCardData table for a specific card.
 */
async function upsertCardDataField(db: any, cardId: number, fieldKey: string, fieldValue: string) {
  const existing = (
    await db
      .select()
      .from(idCardData)
      .where(and(eq(idCardData.idCardId, cardId), eq(idCardData.fieldKey, fieldKey)))
  )[0];

  if (existing) {
    await db.update(idCardData).set({ fieldValue }).where(eq(idCardData.id, existing.id));
  } else {
    await db.insert(idCardData).values({
      idCardId: cardId,
      fieldKey,
      fieldValue,
    });
  }
}

/**
 * Process bulk photo upload from ZIP archive or array of base64 images.
 * Matches images against cards by student admission number or staff employee ID.
 */
export async function processBulkPhotoUpload(
  db: any,
  options: BulkUploadPhotosOptions,
): Promise<BulkUploadPhotosResult> {
  const { schoolId, userId, zipBase64, images, dryRun } = options;

  // 1. Extract image files
  const items: Array<{ filename: string; buffer: Buffer }> = [];

  if (zipBase64) {
    try {
      const cleanZip = zipBase64.includes(",") ? zipBase64.split(",")[1] : zipBase64;
      const zipBuffer = Buffer.from(cleanZip, "base64");
      const zip = new AdmZip(zipBuffer);
      const entries = zip.getEntries();

      for (const entry of entries) {
        if (entry.isDirectory) continue;
        if (entry.entryName.includes("__MACOSX") || path.basename(entry.name).startsWith(".")) continue;

        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_IMAGE_EXTS.has(ext)) {
          items.push({
            filename: path.basename(entry.name),
            buffer: entry.getData(),
          });
        }
      }
    } catch (zipErr: any) {
      throw new Error(`Failed to extract ZIP archive: ${zipErr?.message || "Invalid archive"}`);
    }
  }

  if (images && Array.isArray(images)) {
    for (const img of images) {
      if (!img.filename || !img.dataBase64) continue;
      const ext = path.extname(img.filename).toLowerCase();
      if (ext && !SUPPORTED_IMAGE_EXTS.has(ext)) continue;

      try {
        const cleanB64 = img.dataBase64.includes(",") ? img.dataBase64.split(",")[1] : img.dataBase64;
        items.push({
          filename: path.basename(img.filename),
          buffer: Buffer.from(cleanB64, "base64"),
        });
      } catch {
        // Skip malformed base64
      }
    }
  }

  if (items.length === 0) {
    throw new Error("No valid image files found (supported formats: JPG, PNG, WEBP, GIF, or ZIP archive).");
  }

  // 2. Fetch all cards and requests for this school
  const [schoolCards, schoolRequests, templateList] = await Promise.all([
    db.select().from(idCards).where(eq(idCards.schoolId, schoolId)),
    db.select().from(idCardRequests).where(eq(idCardRequests.schoolId, schoolId)),
    db.select({ id: idCardTemplates.id, cardType: idCardTemplates.cardType, name: idCardTemplates.name }).from(idCardTemplates),
  ]);

  const templateMap = new Map<number, { id: number; cardType?: string | null; name: string }>(
    templateList.map((t: any) => [t.id, t]),
  );
  const requestMap = new Map<number, typeof idCardRequests.$inferSelect>(
    schoolRequests.map((r: any) => [r.id, r]),
  );

  // 3. Fetch all dynamic fields for these cards
  const cardIds = schoolCards.map((c: any) => c.id);
  const cardDataMap = new Map<number, Record<string, string>>();

  if (cardIds.length > 0) {
    const dataRows = await db
      .select({
        idCardId: idCardData.idCardId,
        fieldKey: idCardData.fieldKey,
        fieldValue: idCardData.fieldValue,
      })
      .from(idCardData)
      .where(inArray(idCardData.idCardId, cardIds));

    for (const d of dataRows) {
      const map = cardDataMap.get(d.idCardId) || {};
      map[d.fieldKey] = d.fieldValue || "";
      cardDataMap.set(d.idCardId, map);
    }
  }

  // 4. Build fast lookup index of identifiers -> card
  interface CardIndexEntry {
    card: typeof idCards.$inferSelect;
    name: string;
    isStaff: boolean;
    rawIdentifier: string;
  }

  const lookup = new Map<string, CardIndexEntry>();
  const numericLookup = new Map<number, CardIndexEntry>();

  for (const card of schoolCards) {
    const data = cardDataMap.get(card.id) || {};
    const req = card.requestId ? requestMap.get(card.requestId) : null;
    const tmpl = card.templateId ? templateMap.get(card.templateId) : null;

    const isStaff = tmpl?.cardType === "staff" || Boolean(data["employee_id"] || data["staff_name"]);
    const name =
      (isStaff ? (data["staff_name"] || data["name"]) : (data["student_name"] || data["name"])) ||
      req?.studentName ||
      card.studentName ||
      "Card Holder";

    const identifiers = new Set<string>();

    // Card number
    if (card.cardNumber && card.cardNumber.trim()) {
      identifiers.add(card.cardNumber.trim());
    }

    // Request admission code
    if (req?.admissionCode && req.admissionCode.trim()) {
      identifiers.add(req.admissionCode.trim());
    }

    // Dynamic fields: admission_number, employee_id, roll_number, admission_code
    for (const key of ["admission_number", "employee_id", "roll_number", "admission_code"]) {
      const val = data[key];
      if (val && String(val).trim()) {
        identifiers.add(String(val).trim());
      }
    }

    Array.from(identifiers).forEach((rawId) => {
      const norm = rawId.toUpperCase();
      const noSep = norm.replace(/[\s\-_]/g, "");

      const entry: CardIndexEntry = {
        card,
        name,
        isStaff,
        rawIdentifier: rawId,
      };

      if (!lookup.has(norm)) lookup.set(norm, entry);
      if (!lookup.has(noSep)) lookup.set(noSep, entry);

      // If numeric identifier, index numeric value
      if (/^\d+$/.test(rawId)) {
        const numVal = parseInt(rawId, 10);
        if (!numericLookup.has(numVal)) numericLookup.set(numVal, entry);
      }
    });
  }

  // 5. Match and process each image
  const results: BulkPhotoMatchResult[] = [];
  let matchedCount = 0;
  let unmatchedCount = 0;

  for (const item of items) {
    const ext = path.extname(item.filename);
    const rawId = path.basename(item.filename, ext).trim();
    const normId = rawId.toUpperCase();
    const noSepId = normId.replace(/[\s\-_]/g, "");

    let match = lookup.get(normId) || lookup.get(noSepId);

    // Fallback: check numeric equivalence (e.g. "0042" vs "42")
    if (!match && /^\d+$/.test(rawId)) {
      const numVal = parseInt(rawId, 10);
      match = numericLookup.get(numVal);
    }

    if (!match) {
      unmatchedCount++;
      results.push({
        filename: item.filename,
        identifier: rawId,
        matched: false,
        reason: "No card found with matching Admission Number or Employee ID",
      });
      continue;
    }

    matchedCount++;

    if (dryRun) {
      results.push({
        filename: item.filename,
        identifier: rawId,
        matched: true,
        cardId: match.card.id,
        cardNumber: match.card.cardNumber,
        name: match.name,
        isStaff: match.isStaff,
      });
      continue;
    }

    // Compress & optimize image
    const compressed = await compressPhotoBuffer(item.buffer);
    const safeBase = rawId.replace(/[^a-zA-Z0-9._-]/g, "_");
    const saveName = `${safeBase}.jpg`;

    let photoUrl: string;
    if (ENV.forgeApiUrl && ENV.forgeApiKey) {
      try {
        const { storagePut } = await import("./storage");
        const folder = `schools/${schoolId}/photos`;
        const stored = await storagePut(`${folder}/${saveName}`, compressed, "image/jpeg");
        photoUrl = stored.url;
      } catch (uploadErr) {
        photoUrl = `data:image/jpeg;base64,${compressed.toString("base64")}`;
      }
    } else {
      photoUrl = `data:image/jpeg;base64,${compressed.toString("base64")}`;
    }

    // Update idCardData: photo, and student_photo / staff_photo
    await upsertCardDataField(db, match.card.id, "photo", photoUrl);
    if (match.isStaff) {
      await upsertCardDataField(db, match.card.id, "staff_photo", photoUrl);
    } else {
      await upsertCardDataField(db, match.card.id, "student_photo", photoUrl);
    }

    // Update idCardFiles
    const existingFile = (
      await db
        .select()
        .from(idCardFiles)
        .where(and(eq(idCardFiles.idCardId, match.card.id), eq(idCardFiles.fileType, "PHOTO")))
    )[0];

    if (existingFile) {
      await db
        .update(idCardFiles)
        .set({
          fileUrl: photoUrl,
          fileName: saveName,
          mimeType: "image/jpeg",
          fileSize: compressed.length,
          uploadedByUserId: userId,
        })
        .where(eq(idCardFiles.id, existingFile.id));
    } else {
      await db.insert(idCardFiles).values({
        idCardId: match.card.id,
        fileType: "PHOTO",
        fileName: saveName,
        fileUrl: photoUrl,
        mimeType: "image/jpeg",
        fileSize: compressed.length,
        uploadedByUserId: userId,
      });
    }

    results.push({
      filename: item.filename,
      identifier: rawId,
      matched: true,
      cardId: match.card.id,
      cardNumber: match.card.cardNumber,
      name: match.name,
      isStaff: match.isStaff,
      photoUrl,
    });
  }

  return {
    success: true,
    total: items.length,
    matched: matchedCount,
    unmatched: unmatchedCount,
    results,
  };
}
