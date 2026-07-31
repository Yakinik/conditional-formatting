import { describe, expect, it } from 'vitest';

import {
  columnIndexToName,
  columnNameToIndex,
  formatRange,
  parseQualifiedRange,
  parseRange,
  rangeContains,
  rangeFromPoints
} from './a1-range';

describe('A1 range', () => {
  it('converts columns in both directions', () => {
    expect(columnNameToIndex('A')).toBe(0);
    expect(columnNameToIndex('$AA')).toBe(26);
    expect(columnIndexToName(0)).toBe('A');
    expect(columnIndexToName(701)).toBe('ZZ');
  });

  it('normalizes reversed ranges', () => {
    const range = parseRange('$H$11:A2');
    expect(range).toEqual({ start: { row: 1, column: 0 }, end: { row: 10, column: 7 } });
    expect(range && formatRange(range)).toBe('A2:H11');
    expect(range && rangeContains(range, 5, 3)).toBe(true);
  });

  it('creates a range from drag endpoints', () => {
    expect(formatRange(rangeFromPoints({ row: 8, column: 5 }, { row: 2, column: 1 }))).toBe('B3:F9');
  });

  it('parses a quoted sheet reference', () => {
    expect(parseQualifiedRange("'祝日 マスタ'!$A$2:$A$10")).toEqual({
      sheetName: '祝日 マスタ',
      range: { start: { row: 1, column: 0 }, end: { row: 9, column: 0 } }
    });
  });
});
