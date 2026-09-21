import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { DesignerElement, ElementConfig } from "../shared/templateDesigner";

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

import fs from "fs";

/** Helper to extract image buffer from data URL, raw base64, or local file */
function bufferFromDataUrl(dataUrl: string): Buffer | null {
  try {
    const trimmed = dataUrl.trim();
    if (trimmed.startsWith("data:")) {
      const commaIdx = trimmed.indexOf(",");
      if (commaIdx !== -1) {
        const base64Str = trimmed.slice(commaIdx + 1).replace(/[\r\n\s]/g, "");
        return Buffer.from(base64Str, "base64");
      }
    }
    // Check if raw base64 string
    const cleanRaw = trimmed.replace(/[\r\n\s]/g, "");
    if (/^[A-Za-z0-9+/=]{50,}$/.test(cleanRaw)) {
      return Buffer.from(cleanRaw, "base64");
    }
    // Check if local file path
    if (fs.existsSync(trimmed)) {
      return fs.readFileSync(trimmed);
    }
    return null;
  } catch (err) {
    console.warn("[PDF] Failed to parse image buffer:", err);
    return null;
  }
}

/** Render a single side of an ID card onto the current page of PDFDocument */
async function renderCardSide(
  doc: PDFKit.PDFDocument,
  elements: DesignerElement[],
  side: "FRONT" | "BACK",
  cardData: Record<string, string>,
  cardWidth: number,
  cardHeight: number,
) {
  // Background canvas fill (white default)
  doc.rect(0, 0, cardWidth, cardHeight).fill("#ffffff");

  const sideElements = elements
    .filter((el) => el.config.side === side)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  for (const el of sideElements) {
    const c = el.config;
    const x = c.x ?? 0;
    const y = c.y ?? 0;
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
          text = cardData[fieldKey] ?? `[${fieldKey}]`;
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
          // Placeholder box without any text printed into the PDF
          doc.rect(x, y, w, h).fill("#f9fafb");
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
}

/**
 * Generate a PDF Buffer for a single ID card (Page 1: Front, Page 2: Back)
 */
export async function generateSingleCardPdf(card: CardPdfData): Promise<Buffer> {
  const cardWidth = card.template.cardWidth || 324;
  const cardHeight = card.template.cardHeight || 204;

  const elements: DesignerElement[] = (card.template.elements || []).map((el, i) => ({
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
    sortOrder: el.sortOrder ?? i,
  }));

  const doc = new PDFDocument({
    autoFirstPage: false,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  // Front Page
  doc.addPage({ size: [cardWidth, cardHeight], margins: { top: 0, bottom: 0, left: 0, right: 0 } });
  await renderCardSide(doc, elements, "FRONT", card.cardData, cardWidth, cardHeight);

  // Back Page
  doc.addPage({ size: [cardWidth, cardHeight], margins: { top: 0, bottom: 0, left: 0, right: 0 } });
  await renderCardSide(doc, elements, "BACK", card.cardData, cardWidth, cardHeight);

  doc.end();

  return new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

/**
 * Generate a combined PDF Buffer for multiple ID cards
 */
export async function generateBulkCardPdf(cards: CardPdfData[]): Promise<Buffer> {
  if (cards.length === 0) {
    throw new Error("No cards provided for bulk PDF generation");
  }

  const doc = new PDFDocument({
    autoFirstPage: false,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  for (const card of cards) {
    const cardWidth = card.template.cardWidth || 324;
    const cardHeight = card.template.cardHeight || 204;

    const elements: DesignerElement[] = (card.template.elements || []).map((el, i) => ({
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
      sortOrder: el.sortOrder ?? i,
    }));

    // Front
    doc.addPage({ size: [cardWidth, cardHeight], margins: { top: 0, bottom: 0, left: 0, right: 0 } });
    await renderCardSide(doc, elements, "FRONT", card.cardData, cardWidth, cardHeight);

    // Back
    doc.addPage({ size: [cardWidth, cardHeight], margins: { top: 0, bottom: 0, left: 0, right: 0 } });
    await renderCardSide(doc, elements, "BACK", card.cardData, cardWidth, cardHeight);
  }

  doc.end();

  return new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}
