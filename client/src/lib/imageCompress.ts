/**
 * Browser-side photo resize and compression utility.
 * Targets 75 to 100 KB with pure mathematical and search helpers
 * that can be tested in Node/Vitest without a DOM canvas.
 */

export interface CompressImageOptions {
  targetMinBytes?: number;
  targetMaxBytes?: number;
  maxLongSide?: number;
  minLongSide?: number;
  outputType?: "image/jpeg" | "image/webp";
}

export interface CompressImageResult {
  dataUrl: string;
  blob: Blob;
  originalBytes: number;
  finalBytes: number;
  width: number;
  height: number;
}

/**
 * Pure helper: Computes target width and height keeping aspect ratio.
 * - Long side is at most maxLongSide.
 * - Never enlarges images smaller than maxLongSide.
 * - Scale factor reduces dimensions further down to minLongSide.
 */
export function computeTargetSize(
  width: number,
  height: number,
  maxLongSide = 640,
  minLongSide = 320,
  scaleFactor = 1.0,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    return { width: 0, height: 0 };
  }

  const longSide = Math.max(width, height);
  // Never enlarge: if longSide is less than maxLongSide, keep it
  let targetLong = Math.min(longSide, maxLongSide);

  if (scaleFactor < 1.0) {
    const scaled = Math.round(targetLong * scaleFactor);
    // Do not scale below minLongSide unless original was already smaller
    targetLong = Math.max(Math.min(longSide, minLongSide), scaled);
  }

  const ratio = targetLong / longSide;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/**
 * Pure helper: Binary search for the HIGHEST quality factor in [minQuality, maxQuality]
 * such that sizeEvaluator(quality) <= targetMaxBytes.
 */
export function pickQuality(
  sizeEvaluator: (quality: number) => number,
  minQuality = 0.5,
  maxQuality = 0.92,
  targetMaxBytes = 100 * 1024,
  maxIterations = 7,
): { quality: number; size: number } {
  let low = minQuality;
  let high = maxQuality;

  const minSize = sizeEvaluator(minQuality);
  if (minSize > targetMaxBytes) {
    return { quality: minQuality, size: minSize };
  }

  const maxSize = sizeEvaluator(maxQuality);
  if (maxSize <= targetMaxBytes) {
    return { quality: maxQuality, size: maxSize };
  }

  let bestQuality = minQuality;
  let bestSize = minSize;

  for (let i = 0; i < maxIterations; i++) {
    const mid = Number(((low + high) / 2).toFixed(3));
    const size = sizeEvaluator(mid);

    if (size <= targetMaxBytes) {
      bestQuality = mid;
      bestSize = size;
      // Search higher quality
      low = mid;
    } else {
      // Too large, search lower quality
      high = mid;
    }
  }

  return { quality: bestQuality, size: bestSize };
}

/**
 * Converts a Blob to a base64 Data URL.
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to convert blob to data URL"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Formats byte size to human readable KB/MB string.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Main compression function for browser environments.
 */
export async function compressImage(
  file: File,
  opts?: CompressImageOptions,
): Promise<CompressImageResult> {
  const targetMinBytes = opts?.targetMinBytes ?? 75 * 1024;
  const targetMaxBytes = opts?.targetMaxBytes ?? 100 * 1024;
  const maxLongSide = opts?.maxLongSide ?? 640;
  const minLongSide = opts?.minLongSide ?? 320;
  const outputType = opts?.outputType ?? "image/jpeg";

  // Reject files larger than 15 MB before processing
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("File exceeds 15 MB limit. Please select a smaller photo.");
  }

  // Attempt decoding via createImageBitmap with EXIF orientation handling
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (err) {
    throw new Error(
      "Unable to process this image format. If uploading HEIC from iPhone, please use JPEG or PNG.",
    );
  }

  // If already <= targetMaxBytes, within maxLongSide, and already JPEG, avoid unnecessary re-encoding
  if (
    file.size <= targetMaxBytes &&
    Math.max(bitmap.width, bitmap.height) <= maxLongSide &&
    (file.type === "image/jpeg" || file.type === "image/jpg")
  ) {
    const dataUrl = await blobToDataUrl(file);
    return {
      dataUrl,
      blob: file,
      originalBytes: file.size,
      finalBytes: file.size,
      width: bitmap.width,
      height: bitmap.height,
    };
  }

  let scale = 1.0;
  let canvas = document.createElement("canvas");
  let ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not initialize canvas context for photo optimization.");

  let bestBlob: Blob | null = null;
  let bestQuality = 0.85;

  const toBlobPromise = (c: HTMLCanvasElement, q: number, type: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      c.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error("Canvas toBlob failed"));
        },
        type,
        q,
      );
    });
  };

  // Outer loop: if even quality 0.5 exceeds 100 KB, reduce dimensions by 10% down to minLongSide
  while (scale > 0.3) {
    const dims = computeTargetSize(bitmap.width, bitmap.height, maxLongSide, minLongSide, scale);
    canvas.width = dims.width;
    canvas.height = dims.height;

    // Fill white background so transparent PNGs do not turn black in JPEG
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, dims.width, dims.height);
    ctx.drawImage(bitmap, 0, 0, dims.width, dims.height);

    // Synchronous test or binary search for quality
    let low = 0.5;
    let high = 0.92;
    let foundBlob: Blob | null = null;

    // First check high
    try {
      const highBlob = await toBlobPromise(canvas, high, outputType);
      if (highBlob.size <= targetMaxBytes) {
        bestBlob = highBlob;
        bestQuality = high;
        break;
      }
    } catch {
      // Fallback to webp if jpeg fails
      if (outputType !== "image/webp") {
        return compressImage(file, { ...opts, outputType: "image/webp" });
      }
    }

    // Binary search quality in 5 steps
    for (let i = 0; i < 5; i++) {
      const mid = Number(((low + high) / 2).toFixed(2));
      const blob = await toBlobPromise(canvas, mid, outputType);
      if (blob.size <= targetMaxBytes) {
        foundBlob = blob;
        bestQuality = mid;
        low = mid; // search for higher quality
      } else {
        high = mid; // reduce quality
      }
    }

    if (foundBlob) {
      bestBlob = foundBlob;
      break;
    }

    // Even quality 0.5 is > targetMaxBytes, reduce long side by 10%
    const currentLong = Math.max(dims.width, dims.height);
    if (currentLong <= minLongSide) {
      // Cannot downscale further; take the lowest quality
      bestBlob = await toBlobPromise(canvas, 0.5, outputType);
      break;
    }
    scale *= 0.9;
  }

  if (!bestBlob) {
    bestBlob = await toBlobPromise(canvas, 0.5, outputType);
  }

  // Never make an already small file bigger
  if (file.size <= targetMaxBytes && bestBlob.size >= file.size && file.type === outputType) {
    const dataUrl = await blobToDataUrl(file);
    return {
      dataUrl,
      blob: file,
      originalBytes: file.size,
      finalBytes: file.size,
      width: bitmap.width,
      height: bitmap.height,
    };
  }

  const dataUrl = await blobToDataUrl(bestBlob);
  return {
    dataUrl,
    blob: bestBlob,
    originalBytes: file.size,
    finalBytes: bestBlob.size,
    width: canvas.width,
    height: canvas.height,
  };
}
