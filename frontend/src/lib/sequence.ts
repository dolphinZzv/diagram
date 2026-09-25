/** Geometry shared by the sequence-diagram lifeline node and message edges. */
export const SEQ_HEADER = 48;
export const SEQ_ROW_GAP = 44;
export const SEQ_ROWS = 16;
export const SEQ_WIDTH = 150;
export const SEQ_HEIGHT = SEQ_HEADER + SEQ_ROWS * SEQ_ROW_GAP;

export type SeqSide = "l" | "r";

export function rowHandleId(side: SeqSide, row: number): string {
  return `${side}${row}`;
}

export function parseRow(handleId: string | null | undefined): number | null {
  const m = /^[lr](\d+)$/.exec(handleId ?? "");
  return m ? Number(m[1]) : null;
}

/** Y position (within the node) of a given row. */
export function rowOffset(row: number): number {
  return SEQ_HEADER + row * SEQ_ROW_GAP + SEQ_ROW_GAP / 2;
}
