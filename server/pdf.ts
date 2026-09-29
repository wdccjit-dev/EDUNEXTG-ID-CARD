import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { DesignerElement, ElementConfig } from "../shared/templateDesigner";
import {
  A4_LANDSCAPE_MM,
  computeCardScaleInCell,
  computeCardSizeMm,
  computeGridPositions,
  computePageCount,
  computePageSlotIndexes,
  computeSheetLayout,
  DEFAULT_TEMPLATE_CARD_SIZE,
  MM_TO_PDF_POINT,
  PRINT_GRID_COLUMNS,
  PRINT_GRID_ROWS,
} from "../shared/printLayout";

export interface CardPdfData {
  cardNumber: string;
  template: {
    cardWidth: number;
    cardHeight: number;
    orientation: "portrait" | "landscape";
    elements?: Array<{
      elementKey: string;
      elementType: string;
      label?: string | null;
      config: unknown;
      sortOrder?: number;
    }>;
  };
  cardData: Record<string, string>;
}

/** True only for PNG, JPEG or WebP bytes (magic-number check, never trusts the declared MIME type). */
export function isSupportedImageBuffer(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isWebp = buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP";
  return isPng || isJpeg || isWebp;
}

/**
 * Extract an image buffer from a data URL or raw base64 string.
 *
 * SECURITY: card field values are user-controlled, so this must never touch the
 * filesystem. Anything that is not inline base64 image data (file paths such as
 * "/etc/passwd" or "../../.env", URLs, etc.) returns null and the caller draws
 * the neutral placeholder instead.
 */
export function bufferFromDataUrl(dataUrl: string): Buffer | null {
  try {
    const trimmed = String(dataUrl ?? "").trim();
    let base64Str: string | null = null;

    if (trimmed.startsWith("data:")) {
      const commaIdx = trimmed.indexOf(",");
      if (commaIdx === -1) return null;
      const header = trimmed.slice(0, commaIdx).toLowerCase();
      if (!header.includes(";base64")) return null;
      base64Str = trimmed.slice(commaIdx + 1);
    } else {
      base64Str = trimmed;
    }

    const clean = base64Str.replace(/[\r\n\s]/g, "");
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(clean) || clean.length < 50) return null;

    const buf = Buffer.from(clean, "base64");
    return isSupportedImageBuffer(buf) ? buf : null;
  } catch (err) {
    console.warn("[PDF] Failed to parse image buffer:", err);
    return null;
  }
}

/** Draw a neutral vector avatar for a missing student or guardian photo. */
function drawPhotoPlaceholder(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number) {
  const radius = Math.min(w, h) / 2;
  const centerX = x + w / 2;
  const centerY = y + h / 2;

  doc.save();
  doc.circle(centerX, centerY, radius).fill("#e5e7eb");
  doc.circle(centerX, centerY - radius * 0.24, radius * 0.23).fill("#9ca3af");
  doc.ellipse(centerX, centerY + radius * 0.56, radius * 0.55, radius * 0.38).fill("#9ca3af");
  doc.restore();
}

/** Render a single side of an ID card onto the current page of PDFDocument */
async function renderCardSide(
  doc: PDFKit.PDFDocument,
  elements: DesignerElement[],
  side: "FRONT" | "BACK",
  cardData: Record<string, string>,
  cardWidth: number,
  cardHeight: number,
  originX: number = 0,
  originY: number = 0,
  scale: number = 1,
) {
  doc.save();
  if (scale !== 1) {
    doc.scale(scale);
  }
  const effOriginX = originX / scale;
  const effOriginY = originY / scale;

  // Keep every template element, including wrapped text, inside its own card.
  doc.rect(effOriginX, effOriginY, cardWidth, cardHeight).clip();

  // Background canvas fill (white default)
  doc.rect(effOriginX, effOriginY, cardWidth, cardHeight).fill("#ffffff");

  const sideElements = elements
    .filter((el) => el.config.side === side)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  for (const el of sideElements) {
    const c = el.config;
    const x = effOriginX + (c.x ?? 0);
    const y = effOriginY + (c.y ?? 0);
    const w = c.width ?? 100;
    const h = c.height ?? 30;

    doc.save();

    // Opacity
    if (typeof c.opacity === "number" && c.opacity >= 0 && c.opacity <= 1) {
      doc.opacity(c.opacity);
    }

    // Border / Background shapes
    switch (el.elementType) {
      case "RECTANGLE": {
        const bg = c.bgColor || "#eeeeee";
        const border = c.borderColor || null;
        const borderWidth = c.borderWidth || 0;
        const radius = c.borderRadius || 0;

        if (radius > 0) {
          doc.roundedRect(x, y, w, h, radius);
        } else {
          doc.rect(x, y, w, h);
        }

        if (border && borderWidth > 0) {
          doc.lineWidth(borderWidth);
          doc.fillAndStroke(bg, border);
        } else {
          doc.fill(bg);
        }
        break;
      }

      case "LINE": {
        const color = c.lineColor || "#cccccc";
        const lw = c.lineWidth || 2;
        doc.lineWidth(lw).strokeColor(color);
        if (c.lineDirection === "vertical") {
          doc.moveTo(x + w / 2, y).lineTo(x + w / 2, y + h).stroke();
        } else {
          doc.moveTo(x, y + h / 2).lineTo(x + w, y + h / 2).stroke();
        }
        break;
      }

      case "TEXT":
      case "DYNAMIC_FIELD": {
        let text = "";
        if (el.elementType === "TEXT") {
          text = c.content ?? "";
        } else {
          const fieldKey = c.dynamicField ?? "student_name";
          // If field is empty or unpopulated, omit it completely (do not render [fieldKey])
          text = cardData[fieldKey] !== undefined ? String(cardData[fieldKey]) : "";
        }

        if (!text) {
          // Empty dynamic field - omitted
          break;
        }

        // Draw background if configured
        if (c.bgColor) {
          if (c.borderRadius) {
            doc.roundedRect(x, y, w, h, c.borderRadius).fill(c.bgColor);
          } else {
            doc.rect(x, y, w, h).fill(c.bgColor);
          }
        }

        const fontSize = c.fontSize ? Math.max(6, Math.min(72, c.fontSize)) : 10;
        const fontColor = c.textColor || "#000000";
        const align = c.textAlign || "left";

        doc.fillColor(fontColor).fontSize(fontSize);

        // Standard PDFKit fonts: Helvetica, Helvetica-Bold, Helvetica-Oblique
        if (c.fontWeight === "bold" || c.fontWeight === "700" || c.fontWeight === "800") {
          doc.font(c.fontStyle === "italic" ? "Helvetica-BoldOblique" : "Helvetica-Bold");
        } else if (c.fontStyle === "italic") {
          doc.font("Helvetica-Oblique");
        } else {
          doc.font("Helvetica");
        }

        doc.text(text, x, y, {
          width: w,
          height: h,
          align,
          lineBreak: true,
          ellipsis: true,
        });
        break;
      }

      case "IMAGE":
      case "PHOTO":
      case "LOGO":
      case "SIGNATURE": {
        const fieldKey =
          c.dynamicField ||
          (el.elementType === "PHOTO"
            ? "photo"
            : el.elementType === "SIGNATURE"
              ? "signature"
              : el.elementType === "LOGO"
                ? "logo"
                : undefined);

        const imgUrl = (fieldKey && cardData[fieldKey]) ? cardData[fieldKey] : c.imageUrl;
        let imgBuffer: Buffer | null = null;
        if (imgUrl) {
          imgBuffer = bufferFromDataUrl(imgUrl);
        }

        // Apply image shape clipping
        const shape = (c as any).imageShape ?? "square";
        if (shape === "circle") {
          const radius = Math.min(w, h) / 2;
          doc.circle(x + w / 2, y + h / 2, radius).clip();
        } else if (shape === "rounded") {
          const r = Math.min(w, h) * 0.16;
          doc.roundedRect(x, y, w, h, r).clip();
        } else if (shape === "ellipse") {
          doc.ellipse(x + w / 2, y + h / 2, w / 2, h / 2).clip();
        }

        if (imgBuffer) {
          try {
            doc.image(imgBuffer, x, y, {
              fit: [w, h],
              align: "center",
              valign: "center",
            });
          } catch (imgErr) {
            console.warn(`[PDF] Error rendering image for element '${el.elementKey}' (${el.elementType}):`, imgErr);
            // Visual placeholder without any text (never print the word "IMAGE" or element labels)
            doc.rect(x, y, w, h).fill("#f3f4f6");
          }
        } else {
          const isPhotoElement =
            el.elementType === "PHOTO" ||
            Boolean(fieldKey?.toLowerCase().includes("photo")) ||
            (shape === "circle" && el.elementType === "IMAGE");
          if (isPhotoElement) {
            drawPhotoPlaceholder(doc, x, y, w, h);
          } else {
            // Keep non-photo image placeholders neutral and free of labels.
            doc.rect(x, y, w, h).fill("#f3f4f6");
          }
        }
        break;
      }

      case "QR_CODE": {
        const fieldKey = c.qrField || "admission_number";
        const qrValue = cardData[fieldKey] || cardData["cardNumber"] || c.qrField || "N/A";
        try {
          const qrBuf = await QRCode.toBuffer(qrValue, {
            width: Math.min(w, h),
            margin: 1,
            color: { dark: "#000000", light: "#ffffff" },
          });
          doc.image(qrBuf, x, y, {
            fit: [w, h],
            align: "center",
            valign: "center",
          });
        } catch {
          doc.rect(x, y, w, h).fill("#eeeeee");
        }
        break;
      }

      case "BARCODE": {
        const fieldKey = c.barcodeField || "admission_number";
        const barcodeVal = cardData[fieldKey] || cardData["cardNumber"] || c.barcodeField || "N/A";
        // Render simple simulated vector barcode lines if jsbarcode not in node-canvas
        const barCount = Math.floor(w / 3);
        doc.lineWidth(1.2).strokeColor("#000000");
        for (let i = 0; i < barCount; i++) {
          const charCode = barcodeVal.charCodeAt(i % barcodeVal.length) || 50;
          if (charCode % 2 === 0 || i % 3 === 0) {
            const bx = x + i * 3;
            doc.moveTo(bx, y).lineTo(bx, y + h - 8).stroke();
          }
        }
        doc.fontSize(7).fillColor("#000000").text(barcodeVal, x, y + h - 7, {
          width: w,
          align: "center",
        });
        break;
      }

      default:
        break;
    }

    doc.restore();
  }
  doc.restore();
}

export interface PrintPdfOptions {
  side?: "FRONT" | "BACK" | "BOTH";
  layout?: "sheet" | "card";
  mode?: "FRONT_ONLY" | "BACK_ONLY" | "DUPLEX" | "SEPARATE";
  cropMarks?: boolean;
}

/**
 * Generate a PDF Buffer for a single ID card
 */
export async function generateSingleCardPdf(
  card: CardPdfData,
  options: PrintPdfOptions = {},
): Promise<Buffer> {
  return generateBulkCardPdf([card], options);
}

/**
 * Generate a combined PDF Buffer for multiple ID cards using physical 10-up card layout per A4 page.
 * Implements max 10 cards per page, strict card design preservation, and horizontal mirroring for back sides.
 */
export async function generateBulkCardPdf(
  cards: CardPdfData[],
  options: PrintPdfOptions = {},
): Promise<Buffer> {
  if (cards.length === 0) {
    throw new Error("No cards provided for bulk PDF generation");
  }

  const side = options.side ?? (options.mode === "FRONT_ONLY" ? "FRONT" : options.mode === "BACK_ONLY" ? "BACK" : "BOTH");
  const doc = new PDFDocument({
    autoFirstPage: false,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  const cardsPerPage = PRINT_GRID_COLUMNS * PRINT_GRID_ROWS;
  const numPages = computePageCount(cards.length);
  const cropMarks = options.cropMarks !== false;
  const pageWidthPt = A4_LANDSCAPE_MM.width * MM_TO_PDF_POINT;
  const pageHeightPt = A4_LANDSCAPE_MM.height * MM_TO_PDF_POINT;
  const getDimensions = (card: CardPdfData) => ({
    width: card.template.cardWidth || DEFAULT_TEMPLATE_CARD_SIZE.width,
    height: card.template.cardHeight || DEFAULT_TEMPLATE_CARD_SIZE.height,
  });
  const getCardElements = (card: CardPdfData): DesignerElement[] =>
    (card.template.elements || []).map((el, index) => ({
      elementKey: el.elementKey,
      elementType: el.elementType as any,
      label: el.label ?? null,
      config: (el.config as ElementConfig) ?? {
        x: 20,
        y: 20,
        width: 100,
        height: 30,
        side: "FRONT",
        rotation: 0,
        opacity: 1,
      },
      sortOrder: el.sortOrder ?? index,
    }));

  for (let pageIndex = 0; pageIndex < numPages; pageIndex++) {
    const pageCards = cards.slice(pageIndex * cardsPerPage, (pageIndex + 1) * cardsPerPage);
    const pageSlotIndexes = computePageSlotIndexes(cards.length, pageIndex);
    const layout = computeSheetLayout(pageCards.map(getDimensions));
    const sides: Array<"FRONT" | "BACK"> = side === "BOTH" ? ["FRONT", "BACK"] : [side];

    for (const pageSide of sides) {
      doc.addPage({
        size: [pageWidthPt, pageHeightPt],
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });

      for (let index = 0; index < cardsPerPage; index++) {
        const position = computeGridPositions(index, layout.columns, layout.rows, pageSide === "BACK");
        const cellXmm = layout.marginXmm + position.column * (layout.cellWidthMm + layout.gapMm);
        const cellYmm = layout.marginYmm + position.row * (layout.cellHeightMm + layout.gapMm);
        const cardIndex = pageSlotIndexes[index];
        const card = cardIndex === null ? undefined : cards[cardIndex];

        if (card) {
          const { width, height } = getDimensions(card);
          const cardScale = computeCardScaleInCell(width, height, layout);
          const cardSize = computeCardSizeMm(width, height, cardScale);
          const originX = (cellXmm + (layout.cellWidthMm - cardSize.widthMm) / 2) * MM_TO_PDF_POINT;
          const originY = (cellYmm + (layout.cellHeightMm - cardSize.heightMm) / 2) * MM_TO_PDF_POINT;

          await renderCardSide(
            doc,
            getCardElements(card),
            pageSide,
            card.cardData,
            width,
            height,
            originX,
            originY,
            cardScale * 0.75,
          );
        }

        if (cropMarks) {
          doc.save();
          doc.lineWidth(0.25 * MM_TO_PDF_POINT).strokeColor("#b8bec5");
          doc.rect(
            cellXmm * MM_TO_PDF_POINT,
            cellYmm * MM_TO_PDF_POINT,
            layout.cellWidthMm * MM_TO_PDF_POINT,
            layout.cellHeightMm * MM_TO_PDF_POINT,
          ).stroke();
          doc.restore();
        }
      }
    }
  }

  doc.end();

  return new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}
