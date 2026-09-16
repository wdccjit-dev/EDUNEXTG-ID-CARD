import { useRef, useState, useCallback, useEffect } from "react";
import CardRenderer from "@/components/CardRenderer";
import { SAMPLE_CARD_DATA } from "@shared/templateDesigner";
import type { DesignerElement } from "@shared/templateDesigner";
import type { DesignerState, DesignerAction } from "./useDesignerState";

type HandleType = "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";

const HANDLES: { type: HandleType; cursor: string; style: React.CSSProperties }[] = [
  { type: "nw", cursor: "nwse-resize", style: { top: -4, left: -4 } },
  { type: "ne", cursor: "nesw-resize", style: { top: -4, right: -4 } },
  { type: "sw", cursor: "nesw-resize", style: { bottom: -4, left: -4 } },
  { type: "se", cursor: "nwse-resize", style: { bottom: -4, right: -4 } },
  { type: "n", cursor: "ns-resize", style: { top: -4, left: "50%", transform: "translateX(-50%)" } },
  { type: "s", cursor: "ns-resize", style: { bottom: -4, left: "50%", transform: "translateX(-50%)" } },
  { type: "e", cursor: "ew-resize", style: { top: "50%", right: -4, transform: "translateY(-50%)" } },
  { type: "w", cursor: "ew-resize", style: { top: "50%", left: -4, transform: "translateY(-50%)" } },
];

interface DesignerCanvasProps {
  state: DesignerState;
  dispatch: React.Dispatch<DesignerAction>;
  visibleElements: DesignerElement[];
}

export default function DesignerCanvas({ state, dispatch, visibleElements }: DesignerCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ key: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [resizing, setResizing] = useState<{
    key: string;
    handle: HandleType;
    startMX: number;
    startMY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  const { zoom, template, showGrid, gridSize, selectedElementKey } = state;

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("[data-element-key]")) return;
      dispatch({ type: "SELECT_ELEMENT", key: null });
    },
    [dispatch],
  );

  const handleElementMouseDown = useCallback(
    (e: React.MouseEvent, el: DesignerElement) => {
      if ((e.target as HTMLElement).closest("[data-handle]")) return;
      e.stopPropagation();
      e.preventDefault();
      dispatch({ type: "SELECT_ELEMENT", key: el.elementKey });
      setDragging({
        key: el.elementKey,
        startX: e.clientX,
        startY: e.clientY,
        origX: el.config.x,
        origY: el.config.y,
      });
    },
    [dispatch],
  );

  const handleHandleMouseDown = useCallback(
    (e: React.MouseEvent, el: DesignerElement, handle: HandleType) => {
      e.stopPropagation();
      e.preventDefault();
      setResizing({
        key: el.elementKey,
        handle,
        startMX: e.clientX,
        startMY: e.clientY,
        origX: el.config.x,
        origY: el.config.y,
        origW: el.config.width,
        origH: el.config.height,
      });
    },
    [],
  );

  useEffect(() => {
    if (!dragging && !resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (dragging) {
        const dx = (e.clientX - dragging.startX) / zoom;
        const dy = (e.clientY - dragging.startY) / zoom;
        dispatch({
          type: "MOVE_ELEMENT",
          key: dragging.key,
          x: dragging.origX + dx,
          y: dragging.origY + dy,
        });
      }

      if (resizing) {
        const dx = (e.clientX - resizing.startMX) / zoom;
        const dy = (e.clientY - resizing.startMY) / zoom;
        const { handle, origX, origY, origW, origH } = resizing;

        let newX = origX;
        let newY = origY;
        let newW = origW;
        let newH = origH;

        if (handle.includes("e")) newW = origW + dx;
        if (handle.includes("w")) { newW = origW - dx; newX = origX + dx; }
        if (handle.includes("s")) newH = origH + dy;
        if (handle.includes("n")) { newH = origH - dy; newY = origY + dy; }

        dispatch({
          type: "RESIZE_ELEMENT",
          key: resizing.key,
          width: Math.max(10, newW),
          height: Math.max(10, newH),
          x: newX,
          y: newY,
        });
      }
    };

    const handleMouseUp = () => {
      setDragging(null);
      setResizing(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, resizing, zoom, dispatch]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedElementKey) {
          e.preventDefault();
          dispatch({ type: "DELETE_ELEMENT", key: selectedElementKey });
        }
      }
      if (e.ctrlKey && e.key === "z") { e.preventDefault(); dispatch({ type: "UNDO" }); }
      if (e.ctrlKey && e.key === "y") { e.preventDefault(); dispatch({ type: "REDO" }); }
      if (e.ctrlKey && e.key === "d" && selectedElementKey) { e.preventDefault(); dispatch({ type: "DUPLICATE_ELEMENT", key: selectedElementKey }); }
      if (e.key === "Escape") dispatch({ type: "SELECT_ELEMENT", key: null });
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedElementKey, dispatch]);

  return (
    <div
      ref={containerRef}
      className="flex flex-1 items-center justify-center overflow-auto bg-[#eeeeea]"
      style={{ cursor: dragging ? "grabbing" : resizing ? "default" : "default" }}
      onClick={handleCanvasClick}
    >
      <div className="relative" style={{ margin: 40 }}>
        {/* Label above card */}
        <div className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-[#98a4a1]">
          {state.activeSide} · {template.cardWidth}×{template.cardHeight}px
        </div>

        {/* The card surface */}
        <div className="relative">
          <CardRenderer
            cardWidth={template.cardWidth}
            cardHeight={template.cardHeight}
            elements={state.elements}
            side={state.activeSide}
            cardData={SAMPLE_CARD_DATA}
            scale={zoom}
            showGrid={showGrid}
            gridSize={gridSize}
          />

          {/* Interactive overlay for selection, drag, resize */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: template.cardWidth * zoom,
              height: template.cardHeight * zoom,
              zIndex: 10,
            }}
          >
            {visibleElements.map((el) => {
              const c = el.config;
              const isSelected = selectedElementKey === el.elementKey;
              return (
                <div
                  key={el.elementKey}
                  data-element-key={el.elementKey}
                  style={{
                    position: "absolute",
                    left: c.x * zoom,
                    top: c.y * zoom,
                    width: c.width * zoom,
                    height: c.height * zoom,
                    cursor: dragging?.key === el.elementKey ? "grabbing" : "grab",
                    outline: isSelected ? "2px solid #3b82f6" : "1px dashed transparent",
                    outlineOffset: 1,
                    transform: c.rotation ? `rotate(${c.rotation}deg)` : undefined,
                    zIndex: isSelected ? 100 : 10 + el.sortOrder,
                  }}
                  onMouseDown={(e) => handleElementMouseDown(e, el)}
                >
                  {/* Hover border */}
                  {!isSelected && (
                    <div
                      className="pointer-events-none absolute inset-0 rounded-sm opacity-0 transition-opacity hover:opacity-100"
                      style={{ border: "1px dashed rgba(59,130,246,0.4)" }}
                    />
                  )}

                  {/* Resize handles */}
                  {isSelected &&
                    HANDLES.map((h) => (
                      <div
                        key={h.type}
                        data-handle={h.type}
                        style={{
                          position: "absolute",
                          width: 8,
                          height: 8,
                          backgroundColor: "#3b82f6",
                          borderRadius: 2,
                          cursor: h.cursor,
                          zIndex: 200,
                          ...h.style,
                        }}
                        onMouseDown={(e) => handleHandleMouseDown(e, el, h.type)}
                      />
                    ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
