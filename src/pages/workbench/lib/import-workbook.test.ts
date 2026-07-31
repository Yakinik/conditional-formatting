import { describe, expect, it } from 'vitest';
import { utils, write } from 'xlsx';

import { MAX_IMPORT_COLUMNS, MAX_IMPORT_ROWS, parseDelimitedText, workbookFromFile, workbookFromText } from './import-workbook';

describe('delimited data import', () => {
  it('parses quoted CSV fields and escaped quotes', () => {
    expect(parseDelimitedText('name,note\n"佐藤, 太郎","a ""quoted"" note"', ',')).toEqual([
      ['name', 'note'],
      ['佐藤, 太郎', 'a "quoted" note']
    ]);
  });

  it('detects TSV and infers basic scalar values', () => {
    const rows = parseDelimitedText('日付\t金額\t完了\n2026-07-31\t1200\tTRUE');
    expect(rows[1][0]).toBeInstanceOf(Date);
    expect(rows[1].slice(1)).toEqual([1200, true]);
  });

  it('limits oversized pasted tables and returns warnings', () => {
    const row = Array.from({ length: MAX_IMPORT_COLUMNS + 2 }, (_, index) => String(index)).join('\t');
    const text = Array.from({ length: MAX_IMPORT_ROWS + 2 }, () => row).join('\n');
    const result = workbookFromText(text);
    expect(result.workbook.sheets[0].rows).toHaveLength(MAX_IMPORT_ROWS);
    expect(result.workbook.sheets[0].rows[0]).toHaveLength(MAX_IMPORT_COLUMNS);
    expect(result.warnings).toHaveLength(2);
  });

  it('imports sheet names and typed values from XLSX', async () => {
    const source = utils.book_new();
    utils.book_append_sheet(source, utils.aoa_to_sheet([
      ['案件', '金額', '完了'],
      ['Alpha', 1200, true]
    ]), '案件一覧');
    utils.book_append_sheet(source, utils.aoa_to_sheet([['値'], ['NG']]), 'マスタ');
    const bytes = write(source, { type: 'array', bookType: 'xlsx' });
    const file = new File([bytes], 'sample.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const result = await workbookFromFile(file);
    expect(result.workbook.sheets.map((sheet) => sheet.name)).toEqual(['案件一覧', 'マスタ']);
    expect(result.workbook.sheets[0].rows[1].map((cell) => cell.value)).toEqual(['Alpha', 1200, true]);
  });
});
