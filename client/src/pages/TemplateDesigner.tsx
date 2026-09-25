import { useEffect, useState, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import CardRenderer from "@/components/CardRenderer";
import { SAMPLE_CARD_DATA } from "@shared/templateDesigner";
import type { DesignerElement, ElementConfig } from "@shared/templateDesigner";
import { useDesignerState, type TemplateMeta } from "./designer/useDesignerState";
import DesignerToolbar from "./designer/DesignerToolbar";
import DesignerCanvas from "./designer/DesignerCanvas";
import ElementPalette from "./designer/ElementPalette";
import PropertyPanel from "./designer/PropertyPanel";

const DEFAULT_TEMPLATE: TemplateMeta = {
  id: 0,
  name: "New Template",
  description: null,
  orientation: "landscape",
  cardWidth: 324,
  cardHeight: 204,
  status: "DRAFT",
  accent: "teal",
};

export default function TemplateDesigner() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/admin/templates/:id/design");
  const templateId = match ? Number(params.id) : 0;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSide, setPreviewSide] = useState<"FRONT" | "BACK">("FRONT");

  const [initialTemplate, setInitialTemplate] = useState<TemplateMeta>(DEFAULT_TEMPLATE);
  const [initialElements, setInitialElements] = useState<DesignerElement[]>([]);
  const { state, dispatch, selectedElement, visibleElements } = useDesignerState(initialTemplate);

  // Load template from API
  useEffect(() => {
    if (!templateId) {
      setLoading(false);
      return;
    }

    api.templates
      .get(templateId)
      .then((tmpl) => {
        const meta: TemplateMeta = {
          id: tmpl.id,
          name: tmpl.name,
          description: tmpl.description,
          orientation: tmpl.orientation ?? "landscape",
          cardWidth: tmpl.cardWidth ?? 324,
          cardHeight: tmpl.cardHeight ?? 204,
          status: (tmpl.status as TemplateMeta["status"]) ?? "DRAFT",
          accent: tmpl.accent ?? "teal",
        };
        setInitialTemplate(meta);
        dispatch({ type: "UPDATE_TEMPLATE", changes: meta });

        // Load elements
        if (tmpl.elements && tmpl.elements.length > 0) {
          const designerElements: DesignerElement[] = tmpl.elements.map((el, idx) => ({
            id: el.id,
            elementKey: el.elementKey,
            elementType: el.elementType as DesignerElement["elementType"],
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
            sortOrder: el.sortOrder ?? idx,
          }));
          setInitialElements(designerElements);
          dispatch({ type: "LOAD_ELEMENTS", elements: designerElements });
        } else {
          setInitialElements([]);
        }
      })
      .catch((err) => {
        toast.error("Failed to load template: " + (err instanceof Error ? err.message : "Unknown error"));
        navigate("/admin/templates");
      })
      .finally(() => setLoading(false));
  }, [templateId, navigate, dispatch]);

  // Reset handler (reverts unsaved changes to initially loaded state)
  const handleReset = useCallback(() => {
    dispatch({ type: "UPDATE_TEMPLATE", changes: initialTemplate });
    dispatch({ type: "LOAD_ELEMENTS", elements: initialElements });
    dispatch({ type: "MARK_CLEAN" });
    toast.info("Changes reset to last saved state");
  }, [initialTemplate, initialElements, dispatch]);

  // Save handler with comprehensive validation
  const handleSave = useCallback(async () => {
    const t = state.template;
    if (!t.name.trim()) {
      toast.error("Template name is required");
      return;
    }
    if (t.cardWidth < 100 || t.cardWidth > 1000 || t.cardHeight < 100 || t.cardHeight > 1000) {
      toast.error("Card dimensions must be between 100 and 1000 pixels");
      return;
    }

    // Validate element positions & images
    for (const el of state.elements) {
      const c = el.config;
      // Check if element is completely out of card bounds
      if (c.x + c.width < -50 || c.y + c.height < -50 || c.x > t.cardWidth + 50 || c.y > t.cardHeight + 50) {
        toast.warning(`Element "${el.label || el.elementType}" is positioned outside the card boundaries`);
      }
      // Check for broken image URL format
      if (["IMAGE", "PHOTO", "LOGO", "SIGNATURE"].includes(el.elementType) && c.imageUrl) {
        if (!c.imageUrl.startsWith("http://") && !c.imageUrl.startsWith("https://") && !c.imageUrl.startsWith("data:") && !c.imageUrl.startsWith("/")) {
          toast.error(`Element "${el.label || el.elementType}" has an invalid image URL`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const elementsPayload = state.elements.map((el, idx) => ({
        elementKey: el.elementKey,
        elementType: el.elementType,
        label: el.label,
        config: el.config,
        sortOrder: idx,
      }));

      await api.templates.update(templateId, {
        name: t.name,
        description: t.description,
        orientation: t.orientation,
        cardWidth: t.cardWidth,
        cardHeight: t.cardHeight,
        status: t.status,
        accent: t.accent,
        elements: elementsPayload,
      });

      setInitialTemplate(t);
      setInitialElements(state.elements);
      dispatch({ type: "MARK_CLEAN" });
      toast.success("Template saved successfully");
    } catch (err) {
      toast.error("Save failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setSaving(false);
    }
  }, [state, templateId, dispatch]);

  const handleBack = useCallback(() => {
    if (state.isDirty) {
      if (!window.confirm("You have unsaved changes. Leave anyway?")) return;
    }
    navigate("/admin/templates");
  }, [state.isDirty, navigate]);

  const handlePreview = useCallback(() => {
    setPreviewSide("FRONT");
    setPreviewOpen(true);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f6f2] text-sm text-[#778381]">
        Loading template…
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#f7f6f2]">
      {/* Toolbar */}
      <DesignerToolbar
        state={state}
        dispatch={dispatch}
        onSave={handleSave}
        onPreview={handlePreview}
        onBack={handleBack}
        onReset={handleReset}
        saving={saving}
      />

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden min-w-0">
        {/* Left — Element palette */}
        <ElementPalette dispatch={dispatch} />

        {/* Center — Canvas */}
        <DesignerCanvas state={state} dispatch={dispatch} visibleElements={visibleElements} />

        {/* Right — Property panel */}
        <PropertyPanel selectedElement={selectedElement} template={state.template} dispatch={dispatch} />
      </div>

      {/* Preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="w-[95vw] max-w-[700px] max-h-[92vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold">Card Preview — {state.template.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="flex gap-2">
              {(["FRONT", "BACK"] as const).map((side) => (
                <button
                  key={side}
                  onClick={() => setPreviewSide(side)}
                  className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
                    previewSide === side
                      ? "bg-[#0f7f79] text-white"
                      : "bg-[#f0efec] text-[#778381] hover:bg-[#e5e4e0]"
                  }`}
                >
                  {side}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto max-w-full flex justify-center py-1 [scrollbar-width:thin]">
              <CardRenderer
                cardWidth={state.template.cardWidth}
                cardHeight={state.template.cardHeight}
                elements={state.elements}
                side={previewSide}
                cardData={SAMPLE_CARD_DATA}
                scale={Math.min(
                  1.75,
                  520 / (state.template.cardWidth || 324),
                  420 / (state.template.cardHeight || 204),
                )}
              />
            </div>
            <div className="max-w-md text-center text-xs text-[#98a4a1]">
              Preview with sample data. Actual card data will replace dynamic fields during ID card generation.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
