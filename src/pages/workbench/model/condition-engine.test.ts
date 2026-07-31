import { describe, expect, it } from 'vitest';

import { evaluateCondition, matchesRule } from './condition-engine';
import type { ConditionGroup, ConditionPredicate, ConditionalRule, SheetData, WorkbookData } from './workbook';
import { toCell } from './workbook';

const sheet: SheetData = {
  id: 'sheet-main',
  name: '案件',
  rows: [
    ['案件', '状態', '金額', '締切', '完了'],
    ['至急対応', '対応中', 1200, new Date(2026, 6, 30), false],
    ['通常対応', '完了', 500, new Date(2026, 7, 5), true],
    ['至急対応', '未着手', 800, null, false]
  ].map((row) => row.map(toCell)),
  rules: []
};

const listSheet: SheetData = {
  id: 'sheet-list',
  name: 'NGリスト',
  rows: [['値'], ['至急対応']].map((row) => row.map(toCell)),
  rules: []
};

const workbook: WorkbookData = { id: 'book', name: 'test', source: 'sample', sheets: [sheet, listSheet] };

const compound: ConditionGroup = {
  type: 'group',
  id: 'root',
  operator: 'all',
  negate: false,
  children: [
    {
      type: 'predicate', id: 'text', negate: false, kind: 'text', operator: 'contains', value: '至急',
      reference: { mode: 'column', column: 'A' }
    },
    {
      type: 'group', id: 'nested', operator: 'any', negate: false, children: [
        {
          type: 'predicate', id: 'number', negate: false, kind: 'number', operator: 'greaterThan', value: 1000,
          reference: { mode: 'column', column: 'C' }
        },
        {
          type: 'predicate', id: 'checked', negate: true, kind: 'checkbox', operator: 'checked',
          reference: { mode: 'column', column: 'E' }
        }
      ]
    }
  ]
};

describe('condition engine', () => {
  it('evaluates nested AND / OR / NOT against row references', () => {
    const context = { workbook, sheet, row: 1, column: 0, appliesTo: 'A2:E4', now: new Date(2026, 6, 31) };
    expect(evaluateCondition(compound, context)).toBe(true);
    expect(evaluateCondition(compound, { ...context, row: 2 })).toBe(false);
  });

  it('evaluates dates, lists and duplicates', () => {
    const conditions: ConditionGroup = {
      type: 'group', id: 'root-2', operator: 'all', negate: false, children: [
        {
          type: 'predicate', id: 'overdue', negate: false, kind: 'date', operator: 'overdue',
          reference: { mode: 'column', column: 'D' }
        },
        {
          type: 'predicate', id: 'list', negate: false, kind: 'inList', operator: 'in', listRange: 'NGリスト!A2:A5',
          reference: { mode: 'column', column: 'A' }
        },
        {
          type: 'predicate', id: 'duplicate', negate: false, kind: 'duplicate', operator: 'all',
          reference: { mode: 'column', column: 'A' }
        }
      ]
    };
    expect(evaluateCondition(conditions, {
      workbook, sheet, row: 1, column: 0, appliesTo: 'A2:E4', now: new Date(2026, 6, 31)
    })).toBe(true);
  });

  it('respects the rule range and enabled state', () => {
    const rule: ConditionalRule = {
      id: 'rule', sheetId: sheet.id, name: 'test', appliesTo: 'A2:E4', enabled: true, stopIfTrue: true,
      when: compound, format: { fill: '#fff', text: '#000' }
    };
    expect(matchesRule(rule, workbook, sheet, 1, 3, new Date(2026, 6, 31))).toBe(true);
    expect(matchesRule(rule, workbook, sheet, 0, 0, new Date(2026, 6, 31))).toBe(false);
    expect(matchesRule({ ...rule, enabled: false }, workbook, sheet, 1, 0)).toBe(false);
  });

  it('evaluates every remaining predicate category', () => {
    const contextFor = (value: unknown, row = 0) => {
      const isolatedSheet: SheetData = {
        id: 'isolated',
        name: 'isolated',
        rows: Array.from({ length: Math.max(1, row + 1) }, (_, index) => [toCell(index === row ? value : null)]),
        rules: []
      };
      const isolatedWorkbook: WorkbookData = {
        id: 'isolated-book', name: 'isolated', source: 'sample', sheets: [isolatedSheet]
      };
      return { workbook: isolatedWorkbook, sheet: isolatedSheet, row, column: 0, appliesTo: 'A1:A4', now: new Date(2026, 6, 31) };
    };
    const check = (
      kind: ConditionPredicate['kind'],
      operator: string,
      value: unknown,
      options: Partial<ConditionPredicate> = {},
      row = 0
    ) => evaluateCondition({
      type: 'predicate', id: kind, negate: false, kind, operator,
      reference: { mode: 'currentCell' }, ...options
    }, contextFor(value, row));

    expect(check('keywords', 'all', '至急かつ重要', { values: ['至急', '重要'] })).toBe(true);
    expect(check('between', 'between', 75, { value: 50, secondValue: 100 })).toBe(true);
    expect(check('weekday', 'in', new Date(2026, 6, 31), { values: ['5'] })).toBe(true);
    expect(check('time', 'between', '15:30', { value: '09:00', secondValue: '18:00' })).toBe(true);
    expect(check('business', 'business', new Date(2026, 6, 31), { values: ['0', '6'] })).toBe(true);
    expect(check('blank', 'blank', null)).toBe(true);
    expect(check('stripes', 'even', 'value', {}, 1)).toBe(true);
  });
});
