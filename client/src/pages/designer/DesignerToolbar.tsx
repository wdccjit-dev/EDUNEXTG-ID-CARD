import { ArrowLeft, Grid3X3, Minus, Plus, Redo2, RotateCcw, Save, Eye, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DesignerSide } from "@shared/templateDesigner";
import type { DesignerState, DesignerAction } from "./useDesignerState";

interface DesignerToolbarProps {
  state: DesignerState;
  dispatch: React.Dispatch<DesignerAction>;
  onSave: () => void;
  onPreview: () => void;
  onBack: () => void;
  onReset: () => void;
  saving: boolean;
}

export default function DesignerToolbar({ state, dispatch, onSave, onPreview, onBack, onReset, saving }: DesignerToolbarProps) {
  const sides: DesignerSide[] = ["FRONT", "BACK"];

  return (
    <div className="flex h-14 items-center justify-between border-b border-[#e0e6e1] bg-white px-4 shadow-sm">
      {/* Left section */}
      <div className="flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-[#778381]" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Back to templates</TooltipContent>
        </Tooltip>

        <div className="h-6 w-px bg-[#e0e6e1]" />

        {/* Side toggle */}
        <div className="flex rounded-lg border border-[#e0e6e1] bg-[#f7f6f2] p-0.5">
          {sides.map((side) => (
            <button
              key={side}
              onClick={() => dispatch({ type: "SET_SIDE", side })}
              className={`rounded-md px-3 py-1 text-xs font-bold transition-all ${
                state.activeSide === side
                  ? "bg-[#0f7f79] text-white shadow-sm"
                  : "text-[#778381] hover:text-[#1f3733]"
              }`}
            >
              {side}
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-[#e0e6e1]" />

        {/* Orientation toggle */}
        <div className="flex rounded-lg border border-[#e0e6e1] bg-[#f7f6f2] p-0.5">
          {(["landscape", "portrait"] as const).map((orient) => (
            <button
              key={orient}
              onClick={() => {
                if (state.template.orientation === orient) return;
                const isTargetPortrait = orient === "portrait";
                const isCurrentlyPortrait = state.template.cardHeight > state.template.cardWidth;
                let newWidth = state.template.cardWidth;
                let newHeight = state.template.cardHeight;

                if (isTargetPortrait && !isCurrentlyPortrait) {
                  newWidth = Math.min(state.template.cardWidth, state.template.cardHeight);
                  newHeight = Math.max(state.template.cardWidth, state.template.cardHeight);
                } else if (!isTargetPortrait && isCurrentlyPortrait) {
                  newWidth = Math.max(state.template.cardWidth, state.template.cardHeight);
                  newHeight = Math.min(state.template.cardWidth, state.template.cardHeight);
                }

                dispatch({
                  type: "UPDATE_TEMPLATE",
                  changes: {
                    orientation: orient,
                    cardWidth: newWidth,
                    cardHeight: newHeight,
                  },
                });
              }}
              className={`capitalize rounded-md px-2.5 py-1 text-xs font-bold transition-all ${
                state.template.orientation === orient
                  ? "bg-[#0f7f79] text-white shadow-sm"
                  : "text-[#778381] hover:text-[#1f3733]"
              }`}
            >
              {orient}
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-[#e0e6e1]" />

        {/* Undo / Redo */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[#778381]"
                disabled={state.undoStack.length === 0}
                onClick={() => dispatch({ type: "UNDO" })}
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[#778381]"
                disabled={state.redoStack.length === 0}
                onClick={() => dispatch({ type: "REDO" })}
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Center — Zoom controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-[#778381]"
          onClick={() => dispatch({ type: "SET_ZOOM", zoom: state.zoom - 0.25 })}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <Slider
          value={[state.zoom]}
          min={0.5}
          max={3}
          step={0.25}
          className="w-28"
          onValueChange={([v]) => dispatch({ type: "SET_ZOOM", zoom: v })}
        />
        <span className="w-10 text-center text-xs font-bold text-[#778381]">{Math.round(state.zoom * 100)}%</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-[#778381]"
          onClick={() => dispatch({ type: "SET_ZOOM", zoom: state.zoom + 0.25 })}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>

        <div className="h-6 w-px bg-[#e0e6e1]" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={state.showGrid ? "default" : "ghost"}
              size="icon"
              className={`h-8 w-8 ${state.showGrid ? "bg-[#0f7f79] text-white hover:bg-[#096c67]" : "text-[#778381]"}`}
              onClick={() => dispatch({ type: "TOGGLE_GRID" })}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle grid</TooltipContent>
        </Tooltip>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-[#778381]" onClick={onPreview}>
              <Eye className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Preview card</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-[#778381]"
              disabled={!state.isDirty}
              onClick={onReset}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reset changes</TooltipContent>
        </Tooltip>

        <Button
          className="h-8 rounded-lg bg-[#0f7f79] px-4 text-xs font-bold text-white shadow-sm hover:bg-[#096c67]"
          disabled={!state.isDirty || saving}
          onClick={onSave}
        >
          <Save className="mr-1.5 h-3.5 w-3.5" />
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
