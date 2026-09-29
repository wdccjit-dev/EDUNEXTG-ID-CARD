import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import CardRenderer from "@/components/CardRenderer";
import type { ApiIdCardDetail } from "@/lib/api";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { DesignerElement, ElementConfig } from "@shared/templateDesigner";
import {
  computeCardScaleInCell,
  computeCardSizeMm,
  computeGridPositions,
  computePageCount,
  computePageSlotIndexes,
  computeSheetLayout,
  DEFAULT_TEMPLATE_CARD_SIZE,
  PRINT_GRID_COLUMNS,
  PRINT_GRID_ROWS,
} from "@shared/printLayout";

type PrintMode = "FRONT_ONLY" | "BACK_ONLY" | "DUPLEX";
type CardSide = "FRONT" | "BACK";
type OutputMode = PrintMode | "SEPARATE";

interface PrintModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: ApiIdCardDetail[];
  onPrinted?: () => void;
}

function templateSize(card: ApiIdCardDetail) {
  return {
    width: card.template?.cardWidth || DEFAULT_TEMPLATE_CARD_SIZE.width,
    height: card.template?.cardHeight || DEFAULT_TEMPLATE_CARD_SIZE.height,
  };
}

function dataValue(card: ApiIdCardDetail, keys: string[]) {
  const data = card.dataMap ?? {};
  for (const key of keys) {
    const value = data[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return "";
}

function fileSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase() || "ID_CARDS";
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function PrintModal({ open, onOpenChange, cards, onPrinted }: PrintModalProps) {
  const [printing, setPrinting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [printMode, setPrintMode] = useState<PrintMode>("DUPLEX");
  const [previewSide, setPreviewSide] = useState<CardSide>("FRONT");
  const [separateFiles, setSeparateFiles] = useState(false);
  const orderedCards = cards;

  const pageCount = computePageCount(orderedCards.length);
  const batches = useMemo(() => {
    const result: ApiIdCardDetail[][] = [];
    for (let index = 0; index < orderedCards.length; index += PRINT_GRID_COLUMNS * PRINT_GRID_ROWS) {
      result.push(orderedCards.slice(index, index + PRINT_GRID_COLUMNS * PRINT_GRID_ROWS));
    }
    return result;
  }, [orderedCards]);

  const getCardElements = (card: ApiIdCardDetail): DesignerElement[] =>
    (card.template?.elements || []).map((element, index) => ({
      elementKey: element.elementKey,
      elementType: element.elementType as any,
      label: element.label ?? null,
      config: (element.config as ElementConfig) ?? {
        x: 20,
        y: 20,
        width: 100,
        height: 30,
        side: "FRONT",
        rotation: 0,
        opacity: 1,
      },
      sortOrder: element.sortOrder ?? index,
    }));

  const renderPage = (batch: ApiIdCardDetail[], batchIndex: number, side: CardSide, isForPrint: boolean) => {
    const layout = computeSheetLayout(batch.map(templateSize));
    const pageSlotIndexes = computePageSlotIndexes(orderedCards.length, batchIndex);
    const slots = Array.from({ length: PRINT_GRID_COLUMNS * PRINT_GRID_ROWS }, (_, index) => {
      const position = computeGridPositions(index, PRINT_GRID_COLUMNS, PRINT_GRID_ROWS, side === "BACK");
      const cardIndex = pageSlotIndexes[index];
      const card = cardIndex === null ? undefined : orderedCards[cardIndex];
      const cellXmm = layout.marginXmm + position.column * (layout.cellWidthMm + layout.gapMm);
      const cellYmm = layout.marginYmm + position.row * (layout.cellHeightMm + layout.gapMm);
      const cardSize = card ? templateSize(card) : null;
      const cardScale = cardSize ? computeCardScaleInCell(cardSize.width, cardSize.height, layout) : 1;
      const physicalCard = cardSize ? computeCardSizeMm(cardSize.width, cardSize.height, cardScale) : null;
      const cardLeftPercent = physicalCard
        ? ((layout.cellWidthMm - physicalCard.widthMm) / 2 / layout.cellWidthMm) * 100
        : 0;
      const cardTopPercent = physicalCard
        ? ((layout.cellHeightMm - physicalCard.heightMm) / 2 / layout.cellHeightMm) * 100
        : 0;
      const slotStyle = {
        left: `${(cellXmm / layout.pageWidthMm) * 100}%`,
        top: `${(cellYmm / layout.pageHeightMm) * 100}%`,
        width: `${(layout.cellWidthMm / layout.pageWidthMm) * 100}%`,
        height: `${(layout.cellHeightMm / layout.pageHeightMm) * 100}%`,
      };

      return (
        <div key={`slot-${index}`} className="print-card-slot" style={slotStyle}>
          {card && cardSize && (
            <CardRenderer
              cardWidth={cardSize.width}
              cardHeight={cardSize.height}
              elements={getCardElements(card)}
              side={side}
              cardData={{ ...(card.dataMap ?? {}), cardNumber: card.cardNumber }}
              scale={cardScale}
              style={{
                position: "absolute",
                left: `${cardLeftPercent}%`,
                top: `${cardTopPercent}%`,
                boxShadow: "none",
                borderRadius: 0,
              }}
            />
          )}
        </div>
      );
    });

    return (
      <div key={`${batchIndex}-${side}`} className={isForPrint ? "print-sheet-wrapper" : "space-y-3"}>
        {!isForPrint && (
          <div className="flex items-center justify-between gap-3 px-1 text-xs font-bold text-[#55605d]">
            <span>Page {batchIndex + 1} of {pageCount} · {side === "FRONT" ? "Front" : "Back"}</span>
            <span className="font-medium text-gray-500">{orderedCards.length} total cards</span>
          </div>
        )}
        <div className={`print-page-sheet ${isForPrint ? "print-page-sheet-output" : ""}`}>
          {slots}
        </div>
      </div>
    );
  };

  const renderSheets = (isForPrint = false) => {
    const sides: CardSide[] = isForPrint
      ? printMode === "DUPLEX"
        ? ["FRONT", "BACK"]
        : [printMode === "FRONT_ONLY" ? "FRONT" : "BACK"]
      : [previewSide];

    return batches.flatMap((batch, batchIndex) =>
      sides.map((side) => renderPage(batch, batchIndex, side, isForPrint)),
    );
  };

  const executePrint = async () => {
    if (orderedCards.length === 0) return;
    setPrinting(true);
    try {
      const cardIds = orderedCards.map((card) => card.id);
      if (cardIds.length === 1) {
        await api.idCards.print(cardIds[0], printMode);
      } else {
        await api.idCards.bulkPrint(cardIds, printMode);
      }

      toast.success(
        cardIds.length === 1
          ? `Card #${orderedCards[0].cardNumber} marked as PRINTED`
          : `${cardIds.length} cards marked as PRINTED`,
      );
      onPrinted?.();

      // Let the dedicated 297 x 210 mm sheets finish layout before opening print.
      window.setTimeout(() => {
        window.print();
        window.setTimeout(() => setPrinting(false), 500);
      }, 300);
    } catch (error) {
      toast.error("Failed to record print status", {
        description: error instanceof Error ? error.message : "Print operation failed",
      });
      setPrinting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (orderedCards.length === 0) return;
    setDownloading(true);
    const cardIds = orderedCards.map((card) => card.id);
    const schoolName = dataValue(orderedCards[0], ["school_name", "schoolName"]);
    const baseName = fileSlug(schoolName || "id_cards");

    try {
      if (printMode === "DUPLEX" && separateFiles) {
        const frontPdf = await api.idCards.bulkPdf(cardIds, "FRONT", "SEPARATE", false);
        triggerDownload(frontPdf, `${baseName}_-_Front_PDF.pdf`);
        const backPdf = await api.idCards.bulkPdf(cardIds, "BACK", "SEPARATE", false);
        triggerDownload(backPdf, `${baseName}_-_Back_PDF.pdf`);
      } else {
        const side = printMode === "FRONT_ONLY" ? "FRONT" : printMode === "BACK_ONLY" ? "BACK" : "BOTH";
        const pdf = await api.idCards.bulkPdf(cardIds, side, printMode, false);
        const suffix = printMode === "DUPLEX" ? "Duplex" : printMode === "FRONT_ONLY" ? "Front" : "Back";
        triggerDownload(pdf, `${baseName}_-_${suffix}_PDF.pdf`);
      }
      toast.success(separateFiles ? "Front and back PDFs generated" : "PDF generated successfully");
    } catch (error) {
      toast.error("Failed to generate PDF", {
        description: error instanceof Error ? error.message : "Download failed",
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <style>{`
        @page {
          size: A4 landscape;
          margin: 0;
        }
        @media screen {
          #dedicated-print-portal {
            display: none !important;
          }
        }
        @media print {
          body > :not(#dedicated-print-portal) {
            display: none !important;
          }

          #root,
          [data-slot="dialog-portal"],
          [data-slot="dialog-overlay"],
          header,
          nav,
          aside,
          .no-print {
            display: none !important;
          }

          html, body {
            width: 297mm !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          #dedicated-print-portal {
            display: block !important;
            width: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          #dedicated-print-portal * {
            visibility: visible !important;
          }

          .print-sheet-wrapper {
            width: 297mm !important;
            height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            page-break-after: always;
            break-after: page;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .print-sheet-wrapper:last-child {
            page-break-after: auto;
            break-after: auto;
          }

          .print-page-sheet-output {
            width: 297mm !important;
            height: 210mm !important;
            aspect-ratio: auto !important;
            margin: 0 !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          .print-card-slot {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }

        .print-page-sheet {
          position: relative;
          box-sizing: border-box;
          width: 100%;
          aspect-ratio: 297 / 210;
          overflow: hidden;
          margin: 0 auto;
          background: #fff;
          border-radius: 12px;
          border: 1px solid #e0e5e2;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        }

        .print-card-slot {
          position: absolute;
          overflow: hidden;
          box-sizing: border-box;
        }

        @media print {
          .print-page-sheet {
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {open && typeof document !== "undefined" && createPortal(
        <div id="dedicated-print-portal" aria-hidden="true">
          {renderSheets(true)}
        </div>,
        document.body,
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[98vw] sm:max-w-5xl xl:max-w-6xl max-h-[94vh] flex flex-col rounded-2xl border border-[#e2e8e3] bg-[#fffefa] p-4 shadow-xl sm:p-6">
          <DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3 pr-2 sm:pr-6">
                <div>
                  <DialogTitle className="flex items-center gap-2 text-lg font-extrabold text-[#182326] sm:text-xl">
                    <span>Print Preview</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#eef7f4] text-[#0f7f79] font-semibold">
                      {orderedCards.length} {orderedCards.length === 1 ? "Card" : "Cards"} · {pageCount}{" "}
                      {pageCount === 1 ? "Page" : "Pages"}
                    </span>
                  </DialogTitle>
                  <div className="mt-1 text-xs text-[#84918e]">
                    A4 landscape · 5 columns × 2 rows · 2 mm gap · cards stay in the same slots on both sides.
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1 rounded-xl border border-[#e4e9e5] bg-[#f8faf8] p-1 text-xs font-semibold">
                  {(["FRONT", "BACK"] as const).map((side) => (
                    <button
                      key={side}
                      type="button"
                      onClick={() => setPreviewSide(side)}
                      className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f7f79] focus-visible:ring-offset-1 ${
                        previewSide === side
                          ? "bg-white text-[#0f7f79] shadow-sm"
                          : "text-[#8a9793] hover:text-[#55605d]"
                      }`}
                    >
                      {side === "FRONT" ? "Front" : "Back"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-3 text-xs">
                <label className="flex flex-col gap-1 font-semibold text-[#45544f]">
                  Print mode
                  <select
                    value={printMode}
                    onChange={(event) => setPrintMode(event.target.value as PrintMode)}
                    className="h-9 min-w-48 cursor-pointer rounded-xl border border-[#d3ded8] bg-white px-2.5 text-xs font-bold text-[#304541] shadow-sm hover:border-[#0f7f79] focus:outline-none focus:ring-1 focus:ring-[#0f7f79]"
                  >
                    <option value="FRONT_ONLY">Front only</option>
                    <option value="BACK_ONLY">Back only</option>
                    <option value="DUPLEX">Front + Back (duplex)</option>
                  </select>
                </label>

                {printMode === "DUPLEX" && (
                  <label className="flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-[#dfe6e1] bg-white px-3 text-xs font-bold text-[#38514e] shadow-sm transition-colors hover:border-[#0f7f79]">
                    <input
                      type="checkbox"
                      checked={separateFiles}
                      onChange={(event) => setSeparateFiles(event.target.checked)}
                      className="accent-[#0f7f79]"
                    />
                    Separate files
                  </label>
                )}
              </div>
            </div>
          </DialogHeader>

          <div
            id="print-area"
            className="max-h-[62vh] flex-1 space-y-8 overflow-y-auto rounded-2xl border border-[#e2e8e3] bg-[#f7f6f2] p-3 sm:p-5"
          >
            {batches.map((batch, index) => renderPage(batch, index, previewSide, false))}
            {orderedCards.length === 0 && (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
                No cards selected for printing.
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-3 border-t border-[#edf0ed]">
            <div className="text-[11px] text-[#84918e]">
              Only approved cards are eligible for printing. Status updates to <strong>PRINTED</strong> when you print.
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloading || orderedCards.length === 0}
                className="h-10 rounded-xl border-[#dce5df] bg-white px-4 text-xs font-bold text-[#38514e] shadow-sm hover:bg-[#edf5f0]"
              >
                {downloading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Download className="h-4 w-4 mr-1.5" />}
                {downloading ? "Preparing PDF…" : separateFiles && printMode === "DUPLEX" ? "Download PDFs" : "Download PDF"}
              </Button>

              <Button
                type="button"
                onClick={executePrint}
                disabled={printing || orderedCards.length === 0}
                className="h-10 rounded-xl bg-[#0f7f79] px-4 text-xs font-bold text-white shadow-[0_8px_18px_rgba(15,127,121,0.18)] hover:bg-[#096c67]"
              >
                {printing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Printer className="h-4 w-4 mr-1.5" />}
                {printing ? "Preparing…" : printMode === "FRONT_ONLY" ? "Print Front" : printMode === "BACK_ONLY" ? "Print Back" : "Print Duplex"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
