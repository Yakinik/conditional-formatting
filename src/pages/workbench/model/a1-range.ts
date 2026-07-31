export interface CellPosition {
  row: number;
  column: number;
}

export interface ParsedRange {
  start: CellPosition;
  end: CellPosition;
}

export interface QualifiedRange {
  sheetName?: string;
  range: ParsedRange;
}

export const columnNameToIndex = (name: string): number => {
  const normalized = name.replaceAll('$', '').trim().toUpperCase();
  if (!/^[A-Z]+$/.test(normalized)) return -1;
  return [...normalized].reduce((total, character) => total * 26 + character.charCodeAt(0) - 64, 0) - 1;
};

export const columnIndexToName = (index: number): string => {
  if (!Number.isInteger(index) || index < 0) return '';
  let current = index + 1;
  let name = '';
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
};

export const parseRange = (input: string): ParsedRange | null => {
  const match = input.trim().match(/^\$?([A-Za-z]+)\$?(\d+)(?::\$?([A-Za-z]+)\$?(\d+))?$/);
  if (!match) return null;
  const startColumn = columnNameToIndex(match[1]);
  const startRow = Number(match[2]) - 1;
  const endColumn = columnNameToIndex(match[3] ?? match[1]);
  const endRow = Number(match[4] ?? match[2]) - 1;
  if (startColumn < 0 || startRow < 0 || endColumn < 0 || endRow < 0) return null;
  return {
    start: { row: Math.min(startRow, endRow), column: Math.min(startColumn, endColumn) },
    end: { row: Math.max(startRow, endRow), column: Math.max(startColumn, endColumn) }
  };
};

export const parseQualifiedRange = (input: string): QualifiedRange | null => {
  const trimmed = input.trim();
  const bangIndex = trimmed.lastIndexOf('!');
  if (bangIndex === -1) {
    const range = parseRange(trimmed);
    return range ? { range } : null;
  }
  const range = parseRange(trimmed.slice(bangIndex + 1));
  if (!range) return null;
  let sheetName = trimmed.slice(0, bangIndex).trim();
  if (sheetName.startsWith("'") && sheetName.endsWith("'")) {
    sheetName = sheetName.slice(1, -1).replaceAll("''", "'");
  }
  return sheetName ? { sheetName, range } : null;
};

export const formatRange = (range: ParsedRange): string => {
  const start = `${columnIndexToName(range.start.column)}${range.start.row + 1}`;
  const end = `${columnIndexToName(range.end.column)}${range.end.row + 1}`;
  return start === end ? start : `${start}:${end}`;
};

export const rangeFromPoints = (first: CellPosition, second: CellPosition): ParsedRange => ({
  start: {
    row: Math.min(first.row, second.row),
    column: Math.min(first.column, second.column)
  },
  end: {
    row: Math.max(first.row, second.row),
    column: Math.max(first.column, second.column)
  }
});

export const rangeContains = (range: ParsedRange, row: number, column: number): boolean =>
  row >= range.start.row &&
  row <= range.end.row &&
  column >= range.start.column &&
  column <= range.end.column;

export const rangeSize = (range: ParsedRange): number =>
  (range.end.row - range.start.row + 1) * (range.end.column - range.start.column + 1);
