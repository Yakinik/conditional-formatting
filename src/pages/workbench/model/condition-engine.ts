import { columnNameToIndex, parseQualifiedRange, parseRange, rangeContains } from './a1-range';
import type {
  CellValue,
  ConditionGroup,
  ConditionNode,
  ConditionPredicate,
  ConditionalRule,
  SheetData,
  WorkbookData
} from './workbook';
import { getCellValue } from './workbook';

export interface EvaluationContext {
  workbook: WorkbookData;
  sheet: SheetData;
  row: number;
  column: number;
  appliesTo: string;
  now?: Date;
}

const comparableText = (value: CellValue): string => {
  if (value === null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim().toLocaleLowerCase('ja-JP');
};

const comparableNumber = (value: CellValue): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replaceAll(',', '').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toDate = (value: CellValue): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value !== 'string' || value.trim() === '') return null;
  const plainDate = value.trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  const date = plainDate
    ? new Date(Number(plainDate[1]), Number(plainDate[2]) - 1, Number(plainDate[3]))
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (value: Date): Date => new Date(value.getFullYear(), value.getMonth(), value.getDate());

const predicateValue = (predicate: ConditionPredicate, context: EvaluationContext): CellValue => {
  if (predicate.reference.mode === 'column' && predicate.reference.column) {
    const referencedColumn = columnNameToIndex(predicate.reference.column);
    return referencedColumn >= 0 ? getCellValue(context.sheet, context.row, referencedColumn) : null;
  }
  return getCellValue(context.sheet, context.row, context.column);
};

const valuesInRange = (workbook: WorkbookData, currentSheet: SheetData, input: string): CellValue[] => {
  const qualified = parseQualifiedRange(input);
  if (!qualified) return [];
  const sheet = qualified.sheetName
    ? workbook.sheets.find((candidate) => candidate.name === qualified.sheetName)
    : currentSheet;
  if (!sheet) return [];
  const values: CellValue[] = [];
  for (let row = qualified.range.start.row; row <= qualified.range.end.row; row += 1) {
    for (let column = qualified.range.start.column; column <= qualified.range.end.column; column += 1) {
      values.push(getCellValue(sheet, row, column));
    }
  }
  return values;
};

const evaluateDuplicate = (
  predicate: ConditionPredicate,
  value: CellValue,
  context: EvaluationContext
): boolean => {
  const range = parseRange(context.appliesTo);
  const needle = comparableText(value);
  if (!range || needle === '') return false;
  let matches = 0;
  for (let row = range.start.row; row <= range.end.row; row += 1) {
    const column = predicate.reference.mode === 'column' && predicate.reference.column
      ? columnNameToIndex(predicate.reference.column)
      : context.column;
    for (
      let candidateColumn = predicate.reference.mode === 'column' ? column : range.start.column;
      candidateColumn <= (predicate.reference.mode === 'column' ? column : range.end.column);
      candidateColumn += 1
    ) {
      if (comparableText(getCellValue(context.sheet, row, candidateColumn)) === needle) {
        if (predicate.operator === 'afterFirst' && (row < context.row || (row === context.row && candidateColumn < context.column))) {
          return true;
        }
        matches += 1;
      }
    }
  }
  return predicate.operator === 'afterFirst' ? false : matches > 1;
};

const evaluatePredicate = (predicate: ConditionPredicate, context: EvaluationContext): boolean => {
  const value = predicateValue(predicate, context);
  const text = comparableText(value);
  const expected = comparableText((predicate.value ?? '') as CellValue);

  switch (predicate.kind) {
    case 'text':
      if (predicate.operator === 'equals') return text === expected;
      if (predicate.operator === 'startsWith') return text.startsWith(expected);
      if (predicate.operator === 'endsWith') return text.endsWith(expected);
      if (predicate.operator === 'notContains') return !text.includes(expected);
      return expected !== '' && text.includes(expected);
    case 'keywords': {
      const keywords = (predicate.values ?? []).map((item) => item.trim().toLocaleLowerCase('ja-JP')).filter(Boolean);
      if (keywords.length === 0) return false;
      return predicate.operator === 'all'
        ? keywords.every((keyword) => text.includes(keyword))
        : keywords.some((keyword) => text.includes(keyword));
    }
    case 'number': {
      const number = comparableNumber(value);
      const threshold = Number(predicate.value);
      if (number === null || !Number.isFinite(threshold)) return false;
      if (predicate.operator === 'lessThan') return number < threshold;
      if (predicate.operator === 'lessOrEqual') return number <= threshold;
      if (predicate.operator === 'equal') return number === threshold;
      if (predicate.operator === 'greaterOrEqual') return number >= threshold;
      return number > threshold;
    }
    case 'between': {
      const number = comparableNumber(value);
      const minimum = Number(predicate.value);
      const maximum = Number(predicate.secondValue);
      return number !== null && number >= Math.min(minimum, maximum) && number <= Math.max(minimum, maximum);
    }
    case 'date': {
      const date = toDate(value);
      if (!date) return false;
      const target = startOfDay(date).getTime();
      const today = startOfDay(context.now ?? new Date()).getTime();
      if (predicate.operator === 'overdue') return target < today;
      if (predicate.operator === 'today') return target === today;
      if (predicate.operator === 'dueSoon') {
        const days = Math.max(0, Number(predicate.value) || 0);
        return target >= today && target <= today + days * 86_400_000;
      }
      const expectedDate = toDate((predicate.value ?? '') as CellValue);
      if (!expectedDate) return false;
      return predicate.operator === 'before'
        ? target < startOfDay(expectedDate).getTime()
        : target > startOfDay(expectedDate).getTime();
    }
    case 'weekday': {
      const date = toDate(value);
      return Boolean(date && (predicate.values ?? []).includes(String(date.getDay())));
    }
    case 'time': {
      const date = toDate(value);
      const match = typeof value === 'string' ? value.match(/(\d{1,2}):(\d{2})/) : null;
      const minutes = date ? date.getHours() * 60 + date.getMinutes() : match ? Number(match[1]) * 60 + Number(match[2]) : null;
      const parseMinutes = (input: unknown): number => {
        const parts = String(input ?? '00:00').split(':').map(Number);
        return parts[0] * 60 + (parts[1] || 0);
      };
      if (minutes === null) return false;
      if (predicate.operator === 'before') return minutes < parseMinutes(predicate.value);
      if (predicate.operator === 'between') {
        return minutes >= parseMinutes(predicate.value) && minutes <= parseMinutes(predicate.secondValue);
      }
      return minutes > parseMinutes(predicate.value);
    }
    case 'business': {
      const date = toDate(value);
      if (!date) return false;
      const closedDays = predicate.values?.length ? predicate.values : ['0', '6'];
      const isHoliday = predicate.listRange
        ? valuesInRange(context.workbook, context.sheet, predicate.listRange).some(
            (candidate) => toDate(candidate)?.toDateString() === date.toDateString()
          )
        : false;
      const isBusiness = !closedDays.includes(String(date.getDay())) && !isHoliday;
      return predicate.operator === 'nonbusiness' ? !isBusiness : isBusiness;
    }
    case 'blank':
      return predicate.operator === 'nonblank' ? text !== '' : text === '';
    case 'checkbox': {
      const checked = value === true || text === 'true' || text === '1' || text === 'yes' || text === '済';
      return predicate.operator === 'unchecked' ? !checked : checked;
    }
    case 'duplicate':
      return evaluateDuplicate(predicate, value, context);
    case 'stripes': {
      const range = parseRange(context.appliesTo);
      if (!range) return false;
      const visibleRowNumber = context.row - range.start.row + 1;
      return predicate.operator === 'odd' ? visibleRowNumber % 2 === 1 : visibleRowNumber % 2 === 0;
    }
    case 'inList': {
      if (!predicate.listRange || text === '') return false;
      return valuesInRange(context.workbook, context.sheet, predicate.listRange).some(
        (candidate) => comparableText(candidate) === text
      );
    }
    default:
      return false;
  }
};

export const evaluateCondition = (node: ConditionNode, context: EvaluationContext): boolean => {
  if (node.type === 'predicate') {
    const result = evaluatePredicate(node, context);
    return node.negate ? !result : result;
  }
  if (node.children.length === 0) return false;
  const result = node.operator === 'all'
    ? node.children.every((child) => evaluateCondition(child, context))
    : node.children.some((child) => evaluateCondition(child, context));
  return node.negate ? !result : result;
};

export const matchesRule = (
  rule: ConditionalRule,
  workbook: WorkbookData,
  sheet: SheetData,
  row: number,
  column: number,
  now?: Date
): boolean => {
  if (!rule.enabled || rule.sheetId !== sheet.id) return false;
  const range = parseRange(rule.appliesTo);
  if (!range || !rangeContains(range, row, column)) return false;
  return evaluateCondition(rule.when, { workbook, sheet, row, column, appliesTo: rule.appliesTo, now });
};

export const matchingRules = (
  workbook: WorkbookData,
  sheet: SheetData,
  row: number,
  column: number,
  now?: Date
): ConditionalRule[] => {
  const matches: ConditionalRule[] = [];
  for (const rule of sheet.rules) {
    if (matchesRule(rule, workbook, sheet, row, column, now)) {
      matches.push(rule);
      if (rule.stopIfTrue) break;
    }
  }
  return matches;
};
