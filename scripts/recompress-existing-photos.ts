import "dotenv/config";
import sharp from "sharp";
import { getDb } from "../server/db";
import { idCardData, idCardFiles, users } from "../drizzle/schema";
import { eq, like, or } from "drizzle-orm";

async function compressImageBuffer(inputBuffer: Buffer): Promise<Buffer> {
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

  // Binary search quality between 50 and 90 to get under 100 KB
  let bestBuffer = inputBuffer;
  let low = 50;
  let high = 92;

  while (low <= high) {
    const q = Math.floor((low + high) / 2);
    const buf = await sharp(inputBuffer)
      .rotate()
      .flatten({ background: "#ffffff" })
      .resize(targetWidth, targetHeight, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: q })
      .toBuffer();

    if (buf.length <= 100 * 1024) {
      bestBuffer = buf;
      low = q + 1; // Try higher quality
    } else {
      high = q - 1; // Needs lower quality
    }
  }

  // If even quality 50 is > 100 KB, reduce size
  if (bestBuffer.length > 100 * 1024) {
    let currentDim = Math.round(maxLongSide * 0.85);
    while (currentDim >= 320 && bestBuffer.length > 100 * 1024) {
      bestBuffer = await sharp(inputBuffer)
        .rotate()
        .flatten({ background: "#ffffff" })
        .resize(currentDim, currentDim, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 65 })
        .toBuffer();
      currentDim = Math.round(currentDim * 0.9);
    }
  }

  return bestBuffer;
}

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(`Recompression script started. Mode: ${apply ? "APPLY (writing changes)" : "DRY RUN (no database writes)"}`);

  const db = getDb();
  if (!db) {
    console.error("Database connection not available.");
    process.exit(1);
  }

  let totalBefore = 0;
  let totalAfter = 0;
  let recordsProcessed = 0;

  // 1. Process id_card_data
  console.log("Scanning id_card_data...");
  const dataRows = await db
    .select()
    .from(idCardData)
    .where(or(like(idCardData.dataValue, "data:image%"), eq(idCardData.dataKey, "photo"), eq(idCardData.dataKey, "student_photo"), eq(idCardData.dataKey, "signature")));

  for (const row of dataRows) {
    if (!row.dataValue || !row.dataValue.startsWith("data:image")) continue;
    const base64Index = row.dataValue.indexOf(",");
    if (base64Index === -1) continue;

    const mime = row.dataValue.slice(5, base64Index).split(";")[0];
    const base64Data = row.dataValue.slice(base64Index + 1);
    const rawBuffer = Buffer.from(base64Data, "base64");

    if (rawBuffer.length > 100 * 1024) {
      recordsProcessed++;
      totalBefore += rawBuffer.length;
      const compressed = await compressImageBuffer(rawBuffer);
      totalAfter += compressed.length;
      console.log(`id_card_data [id=${row.id}, key=${row.dataKey}]: ${Math.round(rawBuffer.length / 1024)} KB -> ${Math.round(compressed.length / 1024)} KB`);

      if (apply) {
        const newDataUrl = `data:image/jpeg;base64,${compressed.toString("base64")}`;
        await db.update(idCardData).set({ dataValue: newDataUrl }).where(eq(idCardData.id, row.id));
      }
    }
  }

  // 2. Process id_card_files
  console.log("Scanning id_card_files...");
  const fileRows = await db.select().from(idCardFiles);
  for (const file of fileRows) {
    if (!file.dataBase64) continue;
    const rawBuffer = Buffer.from(file.dataBase64, "base64");
    if (rawBuffer.length > 100 * 1024) {
      recordsProcessed++;
      totalBefore += rawBuffer.length;
      const compressed = await compressImageBuffer(rawBuffer);
      totalAfter += compressed.length;
      console.log(`id_card_files [id=${file.id}, name=${file.fileName}]: ${Math.round(rawBuffer.length / 1024)} KB -> ${Math.round(compressed.length / 1024)} KB`);

      if (apply) {
        await db
          .update(idCardFiles)
          .set({
            dataBase64: compressed.toString("base64"),
            fileSize: compressed.length,
            mimeType: "image/jpeg",
          })
          .where(eq(idCardFiles.id, file.id));
      }
    }
  }

  // 3. Process users.avatarUrl
  console.log("Scanning users avatarUrl...");
  const userRows = await db.select().from(users).where(like(users.avatarUrl, "data:image%"));
  for (const u of userRows) {
    if (!u.avatarUrl || !u.avatarUrl.startsWith("data:image")) continue;
    const base64Index = u.avatarUrl.indexOf(",");
    if (base64Index === -1) continue;

    const base64Data = u.avatarUrl.slice(base64Index + 1);
    const rawBuffer = Buffer.from(base64Data, "base64");
    if (rawBuffer.length > 100 * 1024) {
      recordsProcessed++;
      totalBefore += rawBuffer.length;
      const compressed = await compressImageBuffer(rawBuffer);
      totalAfter += compressed.length;
      console.log(`users [id=${u.id}, name=${u.name}]: ${Math.round(rawBuffer.length / 1024)} KB -> ${Math.round(compressed.length / 1024)} KB`);

      if (apply) {
        const newDataUrl = `data:image/jpeg;base64,${compressed.toString("base64")}`;
        await db.update(users).set({ avatarUrl: newDataUrl }).where(eq(users.id, u.id));
      }
    }
  }

  console.log("-----------------------------------------");
  console.log(`Summary:`);
  console.log(`Records processed (> 100 KB): ${recordsProcessed}`);
  console.log(`Total bytes before: ${(totalBefore / 1024).toFixed(1)} KB`);
  console.log(`Total bytes after:  ${(totalAfter / 1024).toFixed(1)} KB`);
  if (totalBefore > 0) {
    const savedPct = (((totalBefore - totalAfter) / totalBefore) * 100).toFixed(1);
    console.log(`Savings: ${((totalBefore - totalAfter) / 1024).toFixed(1)} KB (${savedPct}%)`);
  }
  if (!apply) {
    console.log("This was a DRY RUN. Pass --apply to write changes to the database.");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
