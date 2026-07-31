import { read, utils } from 'xlsx';

import { createId, toCell } from '../model/workbook';
import type { CellData, SheetData, WorkbookData } from '../model/workbook';

export const MAX_IMPORT_ROWS = 200;
export const MAX_IMPORT_COLUMNS = 26;
export const MAX_IMPORT_SHEETS = 20;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export interface ImportResult {
  workbook: WorkbookData;
  warnings: string[];
}

const inferTextValue = (input: string): unknown => {
  const value = input.trim();
  if (value === '') return null;
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === 'true';
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return Number(value);
  const dateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateMatch) {
    const date = new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]));
    if (!Number.isNaN(date.getTime())) return date;
  }
  return input;
};

export const parseDelimitedText = (text: string, delimiter?: ',' | '\t'): unknown[][] => {
  const source = text.replace(/^\uFEFF/, '');
  const separator = delimiter ?? (source.includes('\t') ? '\t' : ',');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === separator && !quoted) {
      row.push(field);
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && source[index + 1] === '\n') index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  row.push(field);
  rows.push(row);

  while (rows.length > 1 && rows.at(-1)?.every((cell) => cell === '')) rows.pop();
  return rows.map((cells) => cells.map(inferTextValue));
};

const trimAndLimitRows = (rows: unknown[][], warnings: string[]): CellData[][] => {
  const wasTooTall = rows.length > MAX_IMPORT_ROWS;
  const wasTooWide = rows.some((row) => row.length > MAX_IMPORT_COLUMNS);
  if (wasTooTall) warnings.push(`先頭 ${MAX_IMPORT_ROWS} 行まで表示しています。`);
  if (wasTooWide) warnings.push(`先頭 ${MAX_IMPORT_COLUMNS} 列まで表示しています。`);

  const limited = rows.slice(0, MAX_IMPORT_ROWS).map((row) => row.slice(0, MAX_IMPORT_COLUMNS));
  const lastPopulatedRow = limited.reduce(
    (last, row, index) => (row.some((value) => value !== null && value !== undefined && value !== '') ? index : last),
    -1
  );
  const visibleRows = limited.slice(0, Math.max(0, lastPopulatedRow + 1));
  return (visibleRows.length ? visibleRows : [[null]]).map((row) => row.map(toCell));
};

const uniqueSheetName = (name: string, usedNames: Set<string>): string => {
  const base = name.trim().slice(0, 31) || 'Sheet';
  let candidate = base;
  let suffix = 2;
  while (usedNames.has(candidate)) {
    candidate = `${base.slice(0, 27)} (${suffix})`;
    suffix += 1;
  }
  usedNames.add(candidate);
  return candidate;
};

const createWorkbook = (
  name: string,
  source: WorkbookData['source'],
  sourceSheets: Array<{ name: string; rows: unknown[][] }>,
  warnings: string[]
): WorkbookData => {
  const usedNames = new Set<string>();
  const sheets: SheetData[] = sourceSheets.slice(0, MAX_IMPORT_SHEETS).map((sheet) => ({
    id: createId('sheet'),
    name: uniqueSheetName(sheet.name, usedNames),
    rows: trimAndLimitRows(sheet.rows, warnings),
    rules: []
  }));
  if (sourceSheets.length > MAX_IMPORT_SHEETS) {
    warnings.push(`先頭 ${MAX_IMPORT_SHEETS} シートまで取り込みました。`);
  }
  return {
    id: createId('workbook'),
    name,
    source,
    sheets: sheets.length
      ? sheets
      : [{ id: createId('sheet'), name: 'Sheet1', rows: [[toCell(null)]], rules: [] }]
  };
};

export const workbookFromText = (text: string, name = '貼り付けデータ'): ImportResult => {
  const warnings: string[] = [];
  const rows = parseDelimitedText(text);
  return {
    workbook: createWorkbook(name, 'paste', [{ name: '貼り付け', rows }], warnings),
    warnings
  };
};

const extensionOf = (filename: string): string => filename.split('.').at(-1)?.toLowerCase() ?? '';

export const workbookFromFile = async (file: File): Promise<ImportResult> => {
  if (file.size > MAX_FILE_BYTES) throw new Error('10MB 以下のファイルを選択してください。');
  const extension = extensionOf(file.name);
  if (!['xlsx', 'csv', 'tsv'].includes(extension)) {
    throw new Error('XLSX・CSV・TSV ファイルを選択してください。');
  }
  const warnings: string[] = [];
  if (extension === 'csv' || extension === 'tsv') {
    const rows = parseDelimitedText(await file.text(), extension === 'tsv' ? '\t' : ',');
    return {
      workbook: createWorkbook(file.name, 'file', [{ name: file.name.replace(/\.[^.]+$/, ''), rows }], warnings),
      warnings
    };
  }

  const parsed = read(await file.arrayBuffer(), {
    type: 'array',
    cellDates: true,
    dense: true,
    cellText: true
  });
  const sourceSheets = parsed.SheetNames.map((name) => ({
    name,
    rows: utils.sheet_to_json<unknown[]>(parsed.Sheets[name], {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false
    })
  }));
  return { workbook: createWorkbook(file.name, 'file', sourceSheets, warnings), warnings };
};
