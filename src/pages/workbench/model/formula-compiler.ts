import { columnIndexToName, parseQualifiedRange, parseRange } from './a1-range';
import type { ConditionNode, ConditionPredicate, ConditionalRule } from './workbook';

export type FormulaTarget = 'sheets' | 'excel';

const quoteText = (value: unknown): string => `"${String(value ?? '').replaceAll('"', '""')}"`;

const quoteSheet = (name: string): string => `'${name.replaceAll("'", "''")}'`;

const referenceFor = (predicate: ConditionPredicate, rule: ConditionalRule): string => {
  const range = parseRange(rule.appliesTo);
  if (!range) return 'A1';
  const row = range.start.row + 1;
  if (predicate.reference.mode === 'column' && predicate.reference.column) {
    return `$${predicate.reference.column.toUpperCase()}${row}`;
  }
  return `${columnIndexToName(range.start.column)}${row}`;
};

const listReference = (input: string, target: FormulaTarget): string => {
  const parsed = parseQualifiedRange(input);
  if (!parsed) return input;
  const start = `$${columnIndexToName(parsed.range.start.column)}$${parsed.range.start.row + 1}`;
  const end = `$${columnIndexToName(parsed.range.end.column)}$${parsed.range.end.row + 1}`;
  const range = start === end ? start : `${start}:${end}`;
  const qualified = parsed.sheetName ? `${quoteSheet(parsed.sheetName)}!${range}` : range;
  return target === 'sheets' && parsed.sheetName ? `INDIRECT(${quoteText(qualified)})` : qualified;
};

const timeValue = (input: unknown): string => {
  const [hours, minutes] = String(input ?? '00:00').split(':').map(Number);
  return `TIME(${hours || 0},${minutes || 0},0)`;
};

const compilePredicate = (
  predicate: ConditionPredicate,
  rule: ConditionalRule,
  target: FormulaTarget
): string => {
  const ref = referenceFor(predicate, rule);
  const value = quoteText(predicate.value);
  switch (predicate.kind) {
    case 'text':
      if (predicate.operator === 'equals') return `${ref}=${value}`;
      if (predicate.operator === 'startsWith') return `LEFT(${ref},LEN(${value}))=${value}`;
      if (predicate.operator === 'endsWith') return `RIGHT(${ref},LEN(${value}))=${value}`;
      if (predicate.operator === 'notContains') return `ISERROR(SEARCH(${value},${ref}))`;
      if (String(predicate.value ?? '') === '') return 'FALSE';
      return `ISNUMBER(SEARCH(${value},${ref}))`;
    case 'keywords': {
      const keywords = (predicate.values ?? []).filter(Boolean);
      if (keywords.length === 0) return 'FALSE';
      if (target === 'sheets' && predicate.operator !== 'all') {
        const pattern = keywords.map((keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
        return `REGEXMATCH(TO_TEXT(${ref}),${quoteText(pattern)})`;
      }
      const tests = keywords.map((keyword) => `ISNUMBER(SEARCH(${quoteText(keyword)},${ref}))`);
      return `${predicate.operator === 'all' ? 'AND' : 'OR'}(${tests.join(',')})`;
    }
    case 'number': {
      const operators: Record<string, string> = {
        lessThan: '<', lessOrEqual: '<=', equal: '=', greaterOrEqual: '>=', greaterThan: '>'
      };
      return `${ref}${operators[predicate.operator] ?? '>'}${Number(predicate.value) || 0}`;
    }
    case 'between':
      return `AND(${ref}>=${Number(predicate.value) || 0},${ref}<=${Number(predicate.secondValue) || 0})`;
    case 'date':
      if (predicate.operator === 'overdue') return `AND(${ref}<>"",${ref}<TODAY())`;
      if (predicate.operator === 'today') return `${ref}=TODAY()`;
      if (predicate.operator === 'dueSoon') {
        return `AND(${ref}>=TODAY(),${ref}<=TODAY()+${Math.max(0, Number(predicate.value) || 0)})`;
      }
      return `${ref}${predicate.operator === 'before' ? '<' : '>'}DATEVALUE(${value})`;
    case 'weekday': {
      const days = (predicate.values ?? []).map((day) => Number(day) + 1).join(',');
      return `ISNUMBER(MATCH(WEEKDAY(${ref},1),{${days}},0))`;
    }
    case 'time':
      if (predicate.operator === 'before') return `MOD(${ref},1)<${timeValue(predicate.value)}`;
      if (predicate.operator === 'between') {
        return `AND(MOD(${ref},1)>=${timeValue(predicate.value)},MOD(${ref},1)<=${timeValue(predicate.secondValue)})`;
      }
      return `MOD(${ref},1)>${timeValue(predicate.value)}`;
    case 'business': {
      const days = predicate.values?.length ? predicate.values : ['0', '6'];
      const dayTests = days.map((day) => `WEEKDAY(${ref},1)<>${Number(day) + 1}`);
      const holidayTest = predicate.listRange
        ? `COUNTIF(${listReference(predicate.listRange, target)},INT(${ref}))=0`
        : 'TRUE';
      const business = `AND(${ref}<>"",${dayTests.join(',')},${holidayTest})`;
      return predicate.operator === 'nonbusiness' ? `NOT(${business})` : business;
    }
    case 'blank':
      return predicate.operator === 'nonblank' ? `${ref}<>""` : `${ref}=""`;
    case 'checkbox':
      return `${ref}=${predicate.operator === 'unchecked' ? 'FALSE' : 'TRUE'}`;
    case 'duplicate': {
      const range = listReference(rule.appliesTo, target);
      if (predicate.operator === 'afterFirst') {
        const parsed = parseRange(rule.appliesTo);
        const start = parsed ? `$${columnIndexToName(parsed.start.column)}$${parsed.start.row + 1}` : '$A$1';
        return `AND(${ref}<>"",COUNTIF(${start}:${ref},${ref})>1)`;
      }
      return `AND(${ref}<>"",COUNTIF(${range},${ref})>1)`;
    }
    case 'stripes': {
      const startRow = parseRange(rule.appliesTo)?.start.row ?? 0;
      const parity = predicate.operator === 'odd' ? 1 : 0;
      return `MOD(ROW()-${startRow},2)=${parity}`;
    }
    case 'inList':
      return `AND(${ref}<>"",COUNTIF(${listReference(predicate.listRange ?? 'A1', target)},${ref})>0)`;
    default:
      return 'FALSE';
  }
};

const compileNode = (node: ConditionNode, rule: ConditionalRule, target: FormulaTarget): string => {
  if (node.type === 'predicate') {
    const body = compilePredicate(node, rule, target);
    return node.negate ? `NOT(${body})` : body;
  }
  if (node.children.length === 0) return 'FALSE';
  const body = `${node.operator === 'all' ? 'AND' : 'OR'}(${node.children
    .map((child) => compileNode(child, rule, target))
    .join(',')})`;
  return node.negate ? `NOT(${body})` : body;
};

export const compileRuleFormula = (rule: ConditionalRule, target: FormulaTarget): string =>
  `=${compileNode(rule.when, rule, target)}`;

export const formulaSetupSteps = (rule: ConditionalRule, target: FormulaTarget): string[] =>
  target === 'sheets'
    ? [
        `Google スプレッドシートで ${rule.appliesTo} を選択します。`,
        '表示形式 → 条件付き書式 →「カスタム数式」を選びます。',
        '下の数式と書式色を設定します。'
      ]
    : [
        `Excel で ${rule.appliesTo} を選択します。`,
        'ホーム → 条件付き書式 → 新しいルール →「数式を使用」を選びます。',
        '下の数式と書式色を設定します。'
      ];
