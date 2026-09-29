import { useState, useMemo } from "react";
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

interface PrintModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: ApiIdCardDetail[];
  onPrinted?: () => void;
}

export default function PrintModal({
  open,
  onOpenChange,
  cards,
  onPrinted,
}: PrintModalProps) {
  const [printing, setPrinting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [previewSide, setPreviewSide] = useState<"BOTH" | "FRONT" | "BACK">("BOTH");
  const [activePrintSide, setActivePrintSide] = useState<"BOTH" | "FRONT" | "BACK">("BOTH");

  // Effective side for layout chunking and rendering
  const currentSide = printing ? activePrintSide : previewSide;

  // Maximum cards per sheet:
  // - When printing FRONT or BACK only: 10 cards per sheet (2 cols x 5 rows)
  // - When printing BOTH sides: 5 cards per sheet (5 front on col 0, 5 back on col 1)
  const cardsPerPage = currentSide === "BOTH" ? 5 : 10;
  const cardBatches = useMemo(() => {
    const batches: ApiIdCardDetail[][] = [];
    for (let i = 0; i < cards.length; i += cardsPerPage) {
      batches.push(cards.slice(i, i + cardsPerPage));
    }
    return batches;
  }, [cards, cardsPerPage]);

  const executePrint = async (targetSide: "BOTH" | "FRONT" | "BACK") => {
    if (cards.length === 0) return;
    setPrinting(true);
    setActivePrintSide(targetSide);

    try {
      if (cards.length === 1) {
        await api.idCards.print(cards[0].id);
      } else {
        await api.idCards.bulkPrint(cards.map((c) => c.id));
      }

      toast.success(
        cards.length === 1
          ? `Card #${cards[0].cardNumber} marked as PRINTED`
          : `${cards.length} cards marked as PRINTED`,
      );
      if (onPrinted) onPrinted();

      // Allow React to re-render DOM and layout to settle before opening browser print dialog
      setTimeout(() => {
        window.print();
        setTimeout(() => {
          setPrinting(false);
        }, 500);
      }, 300);
    } catch (err) {
      toast.error("Failed to record print status", {
        description: err instanceof Error ? err.message : "Print operation failed",
      });
      setPrinting(false);
    }
  };

  const handleDownloadPdf = async (targetSide: "BOTH" | "FRONT" | "BACK") => {
    if (cards.length === 0) return;
    setDownloading(true);
    try {
      if (cards.length === 1) {
        const link = document.createElement("a");
        link.href = api.idCards.pdfUrl(cards[0].id, targetSide);
        link.download = `id_card_${cards[0].cardNumber}_${targetSide.toLowerCase()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const blob = await api.idCards.bulkPdf(
          cards.map((c) => c.id),
          targetSide,
        );
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `id_cards_${targetSide.toLowerCase()}_${Date.now()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      toast.success(`PDF (${targetSide.toLowerCase()}) generated successfully`);
    } catch (err) {
      toast.error("Failed to generate PDF", {
        description: err instanceof Error ? err.message : "Download failed",
      });
    } finally {
      setDownloading(false);
    }
  };

  // Convert card elements for renderer
  const getCardElements = (card: ApiIdCardDetail): DesignerElement[] => {
    return (card.template?.elements || []).map((el, i) => ({
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
  };

  // Render batch sheets content (shared between interactive preview and print)
  const renderSheets = (isForPrint = false) => {
    return cardBatches.map((batchCards, batchIdx) => {
      const sampleCard = batchCards[0];
      const cardW = sampleCard.template?.cardWidth || 324;
      const cardH = sampleCard.template?.cardHeight || 204;
      const previewScale = 0.88;

      // Helper for BOTH sides (5 rows x 2 cols: Col 0 = Front, Col 1 = Back)
      const renderBothSidesGrid = () => {
        const slots = [];
        for (let r = 0; r < 5; r++) {
          const card = r < batchCards.length ? batchCards[r] : null;

          // Column 0: Front
          slots.push(
            <div
              key={`slot-${r}-0-front`}
              className="print-card-slot"
              style={{
                width: `${cardW * previewScale}px`,
                height: `${cardH * previewScale}px`,
              }}
            >
              {card ? (
                <div className="relative shadow-sm print:shadow-none">
                  <CardRenderer
                    cardWidth={cardW}
                    cardHeight={cardH}
                    elements={getCardElements(card)}
                    side="FRONT"
                    cardData={{ ...card.dataMap, cardNumber: card.cardNumber }}
                    scale={previewScale}
                  />
                </div>
              ) : (
                <div className="w-full h-full border border-dashed border-gray-200/50 rounded-lg no-print flex items-center justify-center text-[10px] text-gray-300">
                  Empty slot
                </div>
              )}
            </div>,
          );

          // Column 1: Back
          slots.push(
            <div
              key={`slot-${r}-1-back`}
              className="print-card-slot"
              style={{
                width: `${cardW * previewScale}px`,
                height: `${cardH * previewScale}px`,
              }}
            >
              {card ? (
                <div className="relative shadow-sm print:shadow-none">
                  <CardRenderer
                    cardWidth={cardW}
                    cardHeight={cardH}
                    elements={getCardElements(card)}
                    side="BACK"
                    cardData={{ ...card.dataMap, cardNumber: card.cardNumber }}
                    scale={previewScale}
                  />
                </div>
              ) : (
                <div className="w-full h-full border border-dashed border-gray-200/50 rounded-lg no-print flex items-center justify-center text-[10px] text-gray-300">
                  Empty slot
                </div>
              )}
            </div>,
          );
        }
        return slots;
      };

      // Helper for single side (FRONT or BACK only): 10 cards in 2 columns x 5 rows
      const renderSingleSideGrid = (side: "FRONT" | "BACK") => {
        const slots = [];
        for (let r = 0; r < 5; r++) {
          for (let c = 0; c < 2; c++) {
            const cardIndex = 2 * r + c;
            const card = cardIndex < batchCards.length ? batchCards[cardIndex] : null;

            slots.push(
              <div
                key={`slot-${r}-${c}-${side}`}
                className="print-card-slot"
                style={{
                  width: `${cardW * previewScale}px`,
                  height: `${cardH * previewScale}px`,
                }}
              >
                {card ? (
                  <div className="relative shadow-sm print:shadow-none">
                    <CardRenderer
                      cardWidth={cardW}
                      cardHeight={cardH}
                      elements={getCardElements(card)}
                      side={side}
                      cardData={{ ...card.dataMap, cardNumber: card.cardNumber }}
                      scale={previewScale}
                    />
                  </div>
                ) : (
                  <div className="w-full h-full border border-dashed border-gray-200/50 rounded-lg no-print flex items-center justify-center text-[10px] text-gray-300">
                    Empty slot
                  </div>
                )}
              </div>,
            );
          }
        }
        return slots;
      };

      return (
        <div key={`batch-${batchIdx}`} className={isForPrint ? "print-sheet-wrapper" : "space-y-6"}>
          {currentSide === "BOTH" ? (
            <div className="print-page-sheet bg-white rounded-2xl border border-gray-200 p-4 shadow-sm print:p-0 print:border-none print:shadow-none print:rounded-none">
              {!isForPrint && (
                <div className="col-span-2 text-xs font-bold text-[#55605d] pb-2 border-b border-gray-100 flex items-center justify-between no-print mb-2">
                  <span>
                    Sheet {batchIdx + 1} — Front & Back Side-by-Side (Cards {batchIdx * cardsPerPage + 1}–{Math.min((batchIdx + 1) * cardsPerPage, cards.length)})
                  </span>
                  <span className="text-[11px] font-mono text-gray-400">Max 5 cards (5 Front + 5 Back) / page</span>
                </div>
              )}
              <div className="col-span-2 grid grid-cols-2 gap-3 justify-items-center items-center">
                {renderBothSidesGrid()}
              </div>
            </div>
          ) : (
            <div className="print-page-sheet bg-white rounded-2xl border border-gray-200 p-4 shadow-sm print:p-0 print:border-none print:shadow-none print:rounded-none">
              {!isForPrint && (
                <div className="col-span-2 text-xs font-bold text-[#55605d] pb-2 border-b border-gray-100 flex items-center justify-between no-print mb-2">
                  <span>
                    Sheet {batchIdx + 1} — {currentSide === "FRONT" ? "Front Side Only" : "Back Side Only"} (Cards {batchIdx * cardsPerPage + 1}–{Math.min((batchIdx + 1) * cardsPerPage, cards.length)})
                  </span>
                  <span className="text-[11px] font-mono text-gray-400">Max 10 cards / page</span>
                </div>
              )}
              <div className="col-span-2 grid grid-cols-2 gap-3 justify-items-center items-center">
                {renderSingleSideGrid(currentSide)}
              </div>
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <>
      <style>{`
        @page {
          size: A4 portrait;
          margin: 8mm 6mm;
        }
        @media screen {
          #dedicated-print-portal {
            display: none !important;
          }
        }
        @media print {
          /* Hide standard DOM tree in print */
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
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Ensure dedicated print portal is the ONLY visible block */
          #dedicated-print-portal {
            display: block !important;
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            visibility: visible !important;
          }
          #dedicated-print-portal * {
            visibility: visible !important;
          }

          .print-sheet-wrapper {
            page-break-after: always;
            break-after: page;
            page-break-inside: avoid;
            break-inside: avoid;
            margin: 0 0 0 0;
            padding: 0;
          }
          .print-sheet-wrapper:last-child {
            page-break-after: auto;
            break-after: auto;
          }

          .print-page-sheet {
            width: 100%;
            max-width: 198mm;
            margin: 0 auto;
            padding: 0;
            background: #ffffff !important;
            border: none !important;
            box-shadow: none !important;
          }

          .print-card-slot {
            page-break-inside: avoid;
            break-inside: avoid;
            display: flex;
            justify-content: center;
            align-items: center;
            box-sizing: border-box;
          }
        }
      `}</style>

      {/* Dedicated Portal Rendered Directly at Body Level for Clean, Unclipped Printing */}
      {open && typeof document !== "undefined" && createPortal(
        <div id="dedicated-print-portal" aria-hidden="true">
          {renderSheets(true)}
        </div>,
        document.body,
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[98vw] sm:max-w-5xl xl:max-w-6xl max-h-[94vh] flex flex-col p-4 sm:p-6">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pr-2 sm:pr-6">
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                  <span>Print Preview</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#eef7f4] text-[#0f7f79] font-semibold">
                    {cards.length} {cards.length === 1 ? "Card" : "Cards"} · {cardBatches.length}{" "}
                    {cardBatches.length === 1 ? "Page Sheet" : "Page Sheets"}
                  </span>
                </DialogTitle>
                <div className="text-xs text-gray-500 mt-1">
                  {currentSide === "BOTH"
                    ? "Up to 5 cards per A4 page (5 Front + 5 Back side-by-side)."
                    : currentSide === "FRONT"
                      ? "Up to 10 Front cards per A4 page (2 columns x 5 rows)."
                      : "Up to 10 Back cards per A4 page (2 columns x 5 rows)."}
                </div>
              </div>

              {/* Preview mode switcher (modal only) */}
              <div className="flex items-center gap-1 bg-[#f0efec] p-1 rounded-xl text-xs font-semibold shrink-0">
                {(["BOTH", "FRONT", "BACK"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPreviewSide(s)}
                    className={`px-3 py-1.5 rounded-lg transition-all text-xs font-bold ${
                      previewSide === s
                        ? "bg-[#0f7f79] text-white shadow-xs"
                        : "text-[#55605d] hover:text-[#203734]"
                    }`}
                  >
                    {s === "BOTH" ? "Both Sides" : s === "FRONT" ? "Front Only" : "Back Only"}
                  </button>
                ))}
              </div>
            </div>
          </DialogHeader>

          {/* Interactive Preview in Modal */}
          <div
            id="print-area"
            className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-8 bg-[#f8faf8] rounded-2xl border border-[#e2e8e3] max-h-[62vh]"
          >
            {renderSheets(false)}
          </div>

          <DialogFooter className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-3 border-t border-[#edf0ed]">
            <div className="text-[11px] text-gray-500">
              Only approved cards are eligible for printing. Status will update to <strong>PRINTED</strong> upon printing.
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => handleDownloadPdf(previewSide)}
                disabled={downloading}
                className="h-10 text-xs font-bold border-[#dfe7e2] text-[#203734] hover:bg-[#edf3f0]"
              >
                {downloading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Download className="h-4 w-4 mr-1.5" />}
                Download PDF
              </Button>

              <Button
                type="button"
                onClick={() => executePrint("FRONT")}
                disabled={printing}
                className="h-10 bg-[#0f7f79] hover:bg-[#096c67] text-white text-xs font-bold rounded-xl shadow-xs"
              >
                {printing && activePrintSide === "FRONT" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : (
                  <Printer className="h-4 w-4 mr-1.5" />
                )}
                Print Front
              </Button>

              <Button
                type="button"
                onClick={() => executePrint("BACK")}
                disabled={printing}
                className="h-10 bg-[#0f7f79] hover:bg-[#096c67] text-white text-xs font-bold rounded-xl shadow-xs"
              >
                {printing && activePrintSide === "BACK" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : (
                  <Printer className="h-4 w-4 mr-1.5" />
                )}
                Print Back
              </Button>

              <Button
                type="button"
                onClick={() => executePrint("BOTH")}
                disabled={printing}
                className="h-10 bg-[#1f3733] hover:bg-[#152522] text-white text-xs font-bold rounded-xl shadow-xs"
              >
                {printing && activePrintSide === "BOTH" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : (
                  <Printer className="h-4 w-4 mr-1.5" />
                )}
                Print Both
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
