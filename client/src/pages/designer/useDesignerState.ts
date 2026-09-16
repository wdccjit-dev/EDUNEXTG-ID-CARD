import { useReducer, useCallback } from "react";
import type {
  DesignerElement,
  DesignerElementType,
  DesignerSide,
  ElementConfig,
  TemplateOrientation,
  TemplateStatus,
} from "@shared/templateDesigner";
import { defaultElementConfig, generateElementKey } from "@shared/templateDesigner";

// ─── Template Metadata ──────────────────────────────────────────────────────

export interface TemplateMeta {
  id: number;
  name: string;
  description: string | null;
  orientation: TemplateOrientation;
  cardWidth: number;
  cardHeight: number;
  status: TemplateStatus;
  accent: "teal" | "coral" | "indigo" | "yellow";
}

// ─── Designer State ─────────────────────────────────────────────────────────

export interface DesignerState {
  template: TemplateMeta;
  elements: DesignerElement[];
  selectedElementKey: string | null;
  activeSide: DesignerSide;
  zoom: number;
  showGrid: boolean;
  gridSize: number;
  isDirty: boolean;
  // Undo/Redo
  undoStack: DesignerElement[][];
  redoStack: DesignerElement[][];
}

// ─── Actions ────────────────────────────────────────────────────────────────

export type DesignerAction =
  | { type: "LOAD_ELEMENTS"; elements: DesignerElement[] }
  | { type: "ADD_ELEMENT"; elementType: DesignerElementType }
  | { type: "UPDATE_ELEMENT"; key: string; changes: Partial<ElementConfig> }
  | { type: "UPDATE_ELEMENT_LABEL"; key: string; label: string }
  | { type: "DELETE_ELEMENT"; key: string }
  | { type: "DUPLICATE_ELEMENT"; key: string }
  | { type: "SELECT_ELEMENT"; key: string | null }
  | { type: "MOVE_ELEMENT"; key: string; x: number; y: number }
  | { type: "RESIZE_ELEMENT"; key: string; width: number; height: number; x?: number; y?: number }
  | { type: "SET_SIDE"; side: DesignerSide }
  | { type: "SET_ZOOM"; zoom: number }
  | { type: "TOGGLE_GRID" }
  | { type: "SET_GRID_SIZE"; size: number }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "UPDATE_TEMPLATE"; changes: Partial<TemplateMeta> }
  | { type: "MARK_CLEAN" };

// ─── Helpers ────────────────────────────────────────────────────────────────

function pushUndo(state: DesignerState): DesignerState {
  return {
    ...state,
    undoStack: [...state.undoStack.slice(-49), state.elements.map((e) => ({ ...e, config: { ...e.config } }))],
    redoStack: [],
  };
}

function snapToGrid(value: number, gridSize: number, enabled: boolean): number {
  if (!enabled || gridSize <= 1) return Math.round(value);
  return Math.round(value / gridSize) * gridSize;
}

// ─── Reducer ────────────────────────────────────────────────────────────────

function designerReducer(state: DesignerState, action: DesignerAction): DesignerState {
  switch (action.type) {
    case "LOAD_ELEMENTS":
      return { ...state, elements: action.elements, isDirty: false, undoStack: [], redoStack: [], selectedElementKey: null };

    case "ADD_ELEMENT": {
      const withUndo = pushUndo(state);
      const config = defaultElementConfig(action.elementType, state.activeSide);
      const key = generateElementKey(action.elementType);
      const label = action.elementType === "DYNAMIC_FIELD" ? `{{${config.dynamicField ?? "student_name"}}}` : action.elementType;
      const newElement: DesignerElement = {
        elementKey: key,
        elementType: action.elementType,
        label,
        config,
        sortOrder: state.elements.length,
      };
      return { ...withUndo, elements: [...withUndo.elements, newElement], selectedElementKey: key, isDirty: true };
    }

    case "UPDATE_ELEMENT": {
      const withUndo = pushUndo(state);
      return {
        ...withUndo,
        elements: withUndo.elements.map((el) =>
          el.elementKey === action.key ? { ...el, config: { ...el.config, ...action.changes } } : el,
        ),
        isDirty: true,
      };
    }

    case "UPDATE_ELEMENT_LABEL": {
      return {
        ...state,
        elements: state.elements.map((el) =>
          el.elementKey === action.key ? { ...el, label: action.label } : el,
        ),
        isDirty: true,
      };
    }

    case "DELETE_ELEMENT": {
      const withUndo = pushUndo(state);
      return {
        ...withUndo,
        elements: withUndo.elements.filter((el) => el.elementKey !== action.key),
        selectedElementKey: state.selectedElementKey === action.key ? null : state.selectedElementKey,
        isDirty: true,
      };
    }

    case "DUPLICATE_ELEMENT": {
      const source = state.elements.find((el) => el.elementKey === action.key);
      if (!source) return state;
      const withUndo = pushUndo(state);
      const newKey = generateElementKey(source.elementType);
      const dup: DesignerElement = {
        ...source,
        id: undefined,
        elementKey: newKey,
        config: { ...source.config, x: source.config.x + 15, y: source.config.y + 15 },
        sortOrder: state.elements.length,
      };
      return { ...withUndo, elements: [...withUndo.elements, dup], selectedElementKey: newKey, isDirty: true };
    }

    case "SELECT_ELEMENT":
      return { ...state, selectedElementKey: action.key };

    case "MOVE_ELEMENT": {
      const x = snapToGrid(action.x, state.gridSize, state.showGrid);
      const y = snapToGrid(action.y, state.gridSize, state.showGrid);
      return {
        ...state,
        elements: state.elements.map((el) =>
          el.elementKey === action.key ? { ...el, config: { ...el.config, x, y } } : el,
        ),
        isDirty: true,
      };
    }

    case "RESIZE_ELEMENT": {
      const w = Math.max(10, snapToGrid(action.width, state.gridSize, state.showGrid));
      const h = Math.max(10, snapToGrid(action.height, state.gridSize, state.showGrid));
      const newX = action.x !== undefined ? snapToGrid(action.x, state.gridSize, state.showGrid) : undefined;
      const newY = action.y !== undefined ? snapToGrid(action.y, state.gridSize, state.showGrid) : undefined;
      return {
        ...state,
        elements: state.elements.map((el) => {
          if (el.elementKey !== action.key) return el;
          const update: Partial<ElementConfig> = { width: w, height: h };
          if (newX !== undefined) update.x = newX;
          if (newY !== undefined) update.y = newY;
          return { ...el, config: { ...el.config, ...update } };
        }),
        isDirty: true,
      };
    }

    case "SET_SIDE":
      return { ...state, activeSide: action.side, selectedElementKey: null };

    case "SET_ZOOM":
      return { ...state, zoom: Math.max(0.25, Math.min(3, action.zoom)) };

    case "TOGGLE_GRID":
      return { ...state, showGrid: !state.showGrid };

    case "SET_GRID_SIZE":
      return { ...state, gridSize: action.size };

    case "UNDO": {
      if (state.undoStack.length === 0) return state;
      const prev = state.undoStack[state.undoStack.length - 1];
      return {
        ...state,
        elements: prev,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, state.elements.map((e) => ({ ...e, config: { ...e.config } }))],
        selectedElementKey: null,
        isDirty: true,
      };
    }

    case "REDO": {
      if (state.redoStack.length === 0) return state;
      const next = state.redoStack[state.redoStack.length - 1];
      return {
        ...state,
        elements: next,
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, state.elements.map((e) => ({ ...e, config: { ...e.config } }))],
        selectedElementKey: null,
        isDirty: true,
      };
    }

    case "UPDATE_TEMPLATE":
      return { ...state, template: { ...state.template, ...action.changes }, isDirty: true };

    case "MARK_CLEAN":
      return { ...state, isDirty: false };

    default:
      return state;
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useDesignerState(initialTemplate: TemplateMeta) {
  const initialState: DesignerState = {
    template: initialTemplate,
    elements: [],
    selectedElementKey: null,
    activeSide: "FRONT",
    zoom: 1.5,
    showGrid: true,
    gridSize: 10,
    isDirty: false,
    undoStack: [],
    redoStack: [],
  };

  const [state, dispatch] = useReducer(designerReducer, initialState);

  const selectedElement = state.selectedElementKey
    ? state.elements.find((el) => el.elementKey === state.selectedElementKey) ?? null
    : null;

  const visibleElements = state.elements.filter((el) => el.config.side === state.activeSide);

  const commitMove = useCallback(
    (key: string, x: number, y: number) => {
      // Push undo only once at the end of a drag
      dispatch({ type: "UPDATE_ELEMENT", key, changes: { x, y } });
    },
    [],
  );

  return { state, dispatch, selectedElement, visibleElements, commitMove };
}
