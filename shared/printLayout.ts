/** Shared physical sheet layout for browser preview/printing and PDF generation. */

export const A4_LANDSCAPE_MM = { width: 297, height: 210 } as const;
export const PRINT_GRID_COLUMNS = 5;
export const PRINT_GRID_ROWS = 2;
export const PRINT_CARD_GAP_MM = 2;
export const CSS_PIXEL_TO_MM = 25.4 / 96;
export const PDF_POINT_TO_MM = 25.4 / 72;
export const MM_TO_PDF_POINT = 72 / 25.4;

// Template coordinates are CSS pixels. This portrait CR80 canvas is 54 x 86 mm at 96 dpi.
export const DEFAULT_TEMPLATE_CARD_SIZE = { width: 204, height: 324 } as const;

export interface GridPosition {
  row: number;
  column: number;
}

export interface TemplateCardSize {
  width: number;
  height: number;
}

export interface SheetLayout {
  pageWidthMm: number;
  pageHeightMm: number;
  columns: number;
  rows: number;
  gapMm: number;
  scale: number;
  cellWidthMm: number;
  cellHeightMm: number;
  marginXmm: number;
  marginYmm: number;
}

/** Maps a row-major card slot to its sheet position. Mirroring only reverses columns. */
export function computeGridPositions(
  index: number,
  cols: number = PRINT_GRID_COLUMNS,
  rows: number = PRINT_GRID_ROWS,
  mirror = false,
): GridPosition {
  if (!Number.isInteger(cols) || cols <= 0 || !Number.isInteger(rows) || rows <= 0) {
    throw new RangeError("Grid dimensions must be positive integers");
  }
  if (!Number.isInteger(index) || index < 0 || index >= cols * rows) {
    throw new RangeError(`Grid index must be between 0 and ${cols * rows - 1}`);
  }

  const row = Math.floor(index / cols);
  const column = index % cols;
  return { row, column: mirror ? cols - 1 - column : column };
}

export function computePageCount(
  cardCount: number,
  cols: number = PRINT_GRID_COLUMNS,
  rows: number = PRINT_GRID_ROWS,
): number {
  if (!Number.isInteger(cols) || cols <= 0 || !Number.isInteger(rows) || rows <= 0) {
    throw new RangeError("Grid dimensions must be positive integers");
  }
  if (!Number.isInteger(cardCount) || cardCount < 0) {
    throw new RangeError("Card count must be a non-negative integer");
  }
  return Math.ceil(cardCount / (cols * rows));
}

/** Lists global card indexes for a page, leaving unused trailing slots empty. */
export function computePageSlotIndexes(
  cardCount: number,
  pageIndex: number,
  cols: number = PRINT_GRID_COLUMNS,
  rows: number = PRINT_GRID_ROWS,
): Array<number | null> {
  if (!Number.isInteger(cols) || cols <= 0 || !Number.isInteger(rows) || rows <= 0) {
    throw new RangeError("Grid dimensions must be positive integers");
  }
  if (!Number.isInteger(cardCount) || cardCount < 0) {
    throw new RangeError("Card count must be a non-negative integer");
  }
  if (!Number.isInteger(pageIndex) || pageIndex < 0) {
    throw new RangeError("Page index must be a non-negative integer");
  }

  const pageCapacity = cols * rows;
  return Array.from({ length: pageCapacity }, (_, slotIndex) => {
    const cardIndex = pageIndex * pageCapacity + slotIndex;
    return cardIndex < cardCount ? cardIndex : null;
  });
}

/**
 * Computes equal outer margins and a uniform downscale factor for the largest
 * template dimensions in this sheet. Card dimensions are template CSS pixels.
 */
export function computeSheetLayout(
  cardSizes: readonly TemplateCardSize[],
  cols: number = PRINT_GRID_COLUMNS,
  rows: number = PRINT_GRID_ROWS,
  gapMm: number = PRINT_CARD_GAP_MM,
): SheetLayout {
  if (cardSizes.length === 0) throw new RangeError("At least one card size is required");
  if (!Number.isInteger(cols) || cols <= 0 || !Number.isInteger(rows) || rows <= 0) {
    throw new RangeError("Grid dimensions must be positive integers");
  }

  const largestWidthMm = Math.max(...cardSizes.map((size) => Math.max(1, size.width) * CSS_PIXEL_TO_MM));
  const largestHeightMm = Math.max(...cardSizes.map((size) => Math.max(1, size.height) * CSS_PIXEL_TO_MM));
  const maxCellWidthMm = (A4_LANDSCAPE_MM.width - gapMm * (cols - 1)) / cols;
  const maxCellHeightMm = (A4_LANDSCAPE_MM.height - gapMm * (rows - 1)) / rows;
  const scale = Math.min(1, maxCellWidthMm / largestWidthMm, maxCellHeightMm / largestHeightMm);
  const cellWidthMm = largestWidthMm * scale;
  const cellHeightMm = largestHeightMm * scale;

  return {
    pageWidthMm: A4_LANDSCAPE_MM.width,
    pageHeightMm: A4_LANDSCAPE_MM.height,
    columns: cols,
    rows,
    gapMm,
    scale,
    cellWidthMm,
    cellHeightMm,
    marginXmm: (A4_LANDSCAPE_MM.width - (cols * cellWidthMm + gapMm * (cols - 1))) / 2,
    marginYmm: (A4_LANDSCAPE_MM.height - (rows * cellHeightMm + gapMm * (rows - 1))) / 2,
  };
}

/** Returns the physical dimensions of one card at the sheet's uniform scale. */
export function computeCardSizeMm(width: number, height: number, scale: number) {
  return {
    widthMm: width * CSS_PIXEL_TO_MM * scale,
    heightMm: height * CSS_PIXEL_TO_MM * scale,
  };
}

/** Fits a card into a grid cell without changing its aspect ratio. */
export function computeCardScaleInCell(
  width: number,
  height: number,
  layout: SheetLayout,
): number {
  const baseWidthMm = Math.max(1, width) * CSS_PIXEL_TO_MM;
  const baseHeightMm = Math.max(1, height) * CSS_PIXEL_TO_MM;
  return Math.min(layout.scale, layout.cellWidthMm / baseWidthMm, layout.cellHeightMm / baseHeightMm);
}
