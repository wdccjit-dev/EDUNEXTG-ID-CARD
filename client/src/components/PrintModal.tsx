import { useState } from "react";
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
import type { DesignerElement } from "@shared/templateDesigner";

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
  const [sidePreview, setSidePreview] = useState<"BOTH" | "FRONT" | "BACK">("BOTH");

  const handlePrint = async () => {
    if (cards.length === 0) return;
    setPrinting(true);
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

      // Trigger standard browser print
      window.print();
    } catch (err) {
      toast.error("Failed to record print status", {
        description: err instanceof Error ? err.message : "Print operation failed",
      });
    } finally {
      setPrinting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (cards.length === 0) return;
    setDownloading(true);
    try {
      if (cards.length === 1) {
        const link = document.createElement("a");
        link.href = api.idCards.pdfUrl(cards[0].id);
        link.download = `id_card_${cards[0].cardNumber}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const blob = await api.idCards.bulkPdf(cards.map((c) => c.id));
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `bulk_id_cards_${Date.now()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      toast.success("PDF generated successfully");
    } catch (err) {
      toast.error("Failed to generate PDF", {
        description: err instanceof Error ? err.message : "Download failed",
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
          }
          .print-page-card {
            page-break-after: always;
            break-after: page;
            margin-bottom: 20mm;
          }
        }
      `}</style>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[96vw] max-w-4xl max-h-[92vh] flex flex-col p-4 sm:p-6">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pr-2 sm:pr-6">
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold">
                  Print Preview {cards.length > 1 ? `(${cards.length} Cards)` : ""}
                </DialogTitle>
                <div className="text-xs text-gray-500 mt-0.5">
                  High-fidelity output directly from template designer layout.
                </div>
              </div>
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg text-xs font-semibold shrink-0 self-start sm:self-auto">
                {(["BOTH", "FRONT", "BACK"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSidePreview(s)}
                    className={`px-2.5 sm:px-3 py-1 rounded-md transition-all text-xs ${
                      sidePreview === s
                        ? "bg-white text-teal-800 shadow-xs"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </DialogHeader>

          {/* Printable Container & Interactive Preview */}
          <div
            id="print-area"
            className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-8 bg-gray-50/50 rounded-xl border border-gray-100"
          >
            {cards.map((card) => {
              const tmpl = card.template;
              const width = tmpl?.cardWidth || 324;
              const height = tmpl?.cardHeight || 204;
              const elements: DesignerElement[] = (tmpl?.elements || []).map((el, i) => ({
                elementKey: el.elementKey,
                elementType: el.elementType as any,
                label: el.label ?? null,
                config: (el.config as any) ?? {
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

              return (
                <div key={card.id} className="print-page-card flex flex-col items-center gap-4">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Card #{card.cardNumber} · {card.studentName || "Student"}
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-6 max-w-full overflow-x-auto [scrollbar-width:thin] p-1">
                    {(sidePreview === "BOTH" || sidePreview === "FRONT") && (
                      <div className="flex flex-col items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          Front
                        </span>
                        <CardRenderer
                          cardWidth={width}
                          cardHeight={height}
                          elements={elements}
                          side="FRONT"
                          cardData={{ ...card.dataMap, cardNumber: card.cardNumber }}
                          scale={1}
                        />
                      </div>
                    )}

                    {(sidePreview === "BOTH" || sidePreview === "BACK") && (
                      <div className="flex flex-col items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          Back
                        </span>
                        <CardRenderer
                          cardWidth={width}
                          cardHeight={height}
                          elements={elements}
                          side="BACK"
                          cardData={{ ...card.dataMap, cardNumber: card.cardNumber }}
                          scale={1}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t">
            <div className="text-[11px] sm:text-xs text-gray-500">
              Only approved cards are eligible for printing. Status will update to <strong>PRINTED</strong>.
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Button
                variant="outline"
                onClick={handleDownloadPdf}
                disabled={downloading}
                className="gap-2 w-full sm:w-auto"
              >
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Download PDF
              </Button>
              <Button
                onClick={handlePrint}
                disabled={printing}
                className="gap-2 bg-[#0f7f79] hover:bg-[#0b6560] text-white w-full sm:w-auto"
              >
                {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                Print {cards.length > 1 ? `(${cards.length})` : "Card"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
