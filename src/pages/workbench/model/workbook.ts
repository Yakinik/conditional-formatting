export type CellValue = string | number | boolean | Date | null;

export interface CellData {
  value: CellValue;
}

export type ConditionKind =
  | 'text'
  | 'keywords'
  | 'number'
  | 'between'
  | 'date'
  | 'weekday'
  | 'time'
  | 'business'
  | 'blank'
  | 'checkbox'
  | 'duplicate'
  | 'stripes'
  | 'inList';

export interface CellReference {
  mode: 'currentCell' | 'column';
  column?: string;
}

export interface ConditionPredicate {
  type: 'predicate';
  id: string;
  negate: boolean;
  kind: ConditionKind;
  reference: CellReference;
  operator: string;
  value?: string | number | boolean;
  secondValue?: string | number;
  values?: string[];
  listRange?: string;
}

export interface ConditionGroup {
  type: 'group';
  id: string;
  operator: 'all' | 'any';
  negate: boolean;
  children: ConditionNode[];
}

export type ConditionNode = ConditionPredicate | ConditionGroup;

export interface RuleFormat {
  fill: string;
  text: string;
  bold?: boolean;
}

export interface ConditionalRule {
  id: string;
  sheetId: string;
  name: string;
  appliesTo: string;
  enabled: boolean;
  stopIfTrue: boolean;
  when: ConditionGroup;
  format: RuleFormat;
}

export interface SheetData {
  id: string;
  name: string;
  rows: CellData[][];
  rules: ConditionalRule[];
}

export interface WorkbookData {
  id: string;
  name: string;
  source: 'sample' | 'file' | 'paste';
  sheets: SheetData[];
}

let serial = 0;

export const createId = (prefix: string): string => {
  serial += 1;
  const randomPart = globalThis.crypto?.randomUUID?.().slice(0, 8) ?? serial.toString(36);
  return `${prefix}-${randomPart}`;
};

export const toCell = (value: unknown): CellData => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return { value };
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return { value };
  }
  return { value: null };
};

export const getCellValue = (sheet: SheetData, row: number, column: number): CellValue =>
  sheet.rows[row]?.[column]?.value ?? null;

const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

export const formatCellValue = (value: CellValue): string => {
  if (value === null) return '';
  if (value instanceof Date) return dateFormatter.format(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return new Intl.NumberFormat('ja-JP').format(value);
  return value;
};
