import { describe, expect, it } from "vitest";
import {
  computeGridPositions,
  computePageCount,
  computePageSlotIndexes,
  computeSheetLayout,
  DEFAULT_TEMPLATE_CARD_SIZE,
  PRINT_GRID_COLUMNS,
  PRINT_GRID_ROWS,
} from "../shared/printLayout";

const capacity = PRINT_GRID_COLUMNS * PRINT_GRID_ROWS;
const key = (position: { row: number; column: number }) => `${position.row},${position.column}`;

describe("print sheet layout", () => {
  it("places 10 cards on one sheet", () => {
    expect(computePageCount(10)).toBe(1);
  });

  it("places 23 cards on three sheets with seven empty positions on the last sheet", () => {
    expect(computePageCount(23)).toBe(3);
    expect(computePageSlotIndexes(23, 2).filter((cardIndex) => cardIndex === null)).toHaveLength(7);
  });

  it("places 11 cards on two sheets and leaves 9 slots empty on sheet 2", () => {
    expect(computePageCount(11)).toBe(2);

    const secondPageSlots = computePageSlotIndexes(11, 1);
    expect(secondPageSlots.filter((cardIndex) => cardIndex === null)).toHaveLength(9);
    expect(secondPageSlots.filter((cardIndex) => cardIndex !== null)).toEqual([10]);
  });

  it("mirrors every position by reversing its column and keeping its row", () => {
    for (let row = 0; row < PRINT_GRID_ROWS; row++) {
      for (let column = 0; column < PRINT_GRID_COLUMNS; column++) {
        const index = row * PRINT_GRID_COLUMNS + column;
        expect(computeGridPositions(index)).toEqual({ row, column });
        expect(computeGridPositions(index, PRINT_GRID_COLUMNS, PRINT_GRID_ROWS, true)).toEqual({
          row,
          column: PRINT_GRID_COLUMNS - 1 - column,
        });
      }
    }
  });

  it("mirrors both occupied and empty slots on a partial last sheet", () => {
    const lastPageSlots = computePageSlotIndexes(23, 2);
    const lastPageCardCount = lastPageSlots.filter((cardIndex) => cardIndex !== null).length;
    expect(lastPageSlots.slice(0, 3)).toEqual([20, 21, 22]);
    const frontOccupied = new Set(
      Array.from({ length: lastPageCardCount }, (_, index) => key(computeGridPositions(index))),
    );
    const backOccupied = new Set(
      Array.from(
        { length: lastPageCardCount },
        (_, index) => key(computeGridPositions(index, PRINT_GRID_COLUMNS, PRINT_GRID_ROWS, true)),
      ),
    );
    const frontEmpty = new Set(
      Array.from({ length: capacity - lastPageCardCount }, (_, offset) => key(computeGridPositions(offset + lastPageCardCount))),
    );
    const backEmpty = new Set(
      Array.from(
        { length: capacity - lastPageCardCount },
        (_, offset) => key(computeGridPositions(offset + lastPageCardCount, PRINT_GRID_COLUMNS, PRINT_GRID_ROWS, true)),
      ),
    );

    expect(frontOccupied.size).toBe(3);
    expect(backOccupied).toEqual(new Set([...frontOccupied].map((positionKey) => {
      const [row, column] = positionKey.split(",").map(Number);
      return key({ row, column: PRINT_GRID_COLUMNS - 1 - column });
    })));
    expect(frontEmpty.size).toBe(7);
    expect(backEmpty).toEqual(new Set([...frontEmpty].map((positionKey) => {
      const [row, column] = positionKey.split(",").map(Number);
      return key({ row, column: PRINT_GRID_COLUMNS - 1 - column });
    })));
  });

  it("maps the front top-left slot to the back top-right slot", () => {
    expect(computeGridPositions(0, PRINT_GRID_COLUMNS, PRINT_GRID_ROWS, true)).toEqual({ row: 0, column: 4 });
  });

  it("fits the default portrait CR80 template at about 54 x 86 mm with equal margins", () => {
    const layout = computeSheetLayout([DEFAULT_TEMPLATE_CARD_SIZE]);
    expect(layout.scale).toBe(1);
    expect(layout.cellWidthMm).toBeCloseTo(54, 0);
    expect(layout.cellHeightMm).toBeCloseTo(86, 0);
    expect(layout.marginXmm).toBeCloseTo(9.56, 1);
    expect(layout.marginYmm).toBeCloseTo(18.27, 1);
  });
});
