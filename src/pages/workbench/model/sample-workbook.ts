import { createRuleFromPreset } from './rule-presets';
import { createId, toCell } from './workbook';
import type { ConditionalRule, SheetData, WorkbookData } from './workbook';

const dateFromToday = (offset: number): Date => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date;
};

const sampleRows: unknown[][] = [
  ['No.', '案件名', '担当', '状態', '優先度', '締切', '見積金額', '完了'],
  [1001, 'コーポレートサイト刷新', '佐藤', '対応中', '高', dateFromToday(-2), 1800000, false],
  [1002, '採用ページ原稿確認', '田中', 'レビュー待ち', '中', dateFromToday(2), 620000, false],
  [1003, '至急：展示会バナー', '鈴木', '未着手', '高', dateFromToday(5), 320000, false],
  [1004, '月次レポート自動化', '佐藤', '対応中', '中', dateFromToday(9), 1250000, false],
  [1005, 'ブランドガイド更新', '高橋', '完了', '低', dateFromToday(-4), 480000, true],
  [1006, '重要：契約更新', '田中', 'レビュー待ち', '高', dateFromToday(1), 2100000, false],
  [1007, 'アプリ内ヘルプ改善', '伊藤', '未着手', '中', dateFromToday(14), 730000, false],
  [1008, '営業資料テンプレート', '鈴木', '完了', '低', dateFromToday(-8), 290000, true],
  [1009, '顧客インタビュー', '佐藤', '対応中', '中', dateFromToday(4), 540000, false],
  [1010, '緊急：障害報告書', '伊藤', '対応中', '高', dateFromToday(0), 980000, false]
];

const createSampleRules = (sheetId: string): ConditionalRule[] => {
  const overdue = createRuleFromPreset('overdue', sheetId, 'A2:H11');
  overdue.name = '期限切れ × 未完了';
  const overdueDate = overdue.when.children[0];
  if (overdueDate.type === 'predicate') {
    overdue.when.children[0] = { ...overdueDate, reference: { mode: 'column', column: 'F' } };
  }
  overdue.when.children.push({
    type: 'predicate',
    id: createId('condition'),
    negate: false,
    kind: 'checkbox',
    reference: { mode: 'column', column: 'H' },
    operator: 'unchecked'
  });

  const dueSoon = createRuleFromPreset('dueSoon', sheetId, 'A2:H11');
  dueSoon.name = '7日以内 × 未完了';
  const dueSoonDate = dueSoon.when.children[0];
  if (dueSoonDate.type === 'predicate') {
    dueSoon.when.children[0] = { ...dueSoonDate, reference: { mode: 'column', column: 'F' } };
  }
  dueSoon.when.children.push({
    type: 'predicate',
    id: createId('condition'),
    negate: false,
    kind: 'checkbox',
    reference: { mode: 'column', column: 'H' },
    operator: 'unchecked'
  });

  const urgent = createRuleFromPreset('multiKeyword', sheetId, 'B2:B11');
  urgent.name = '至急・重要・緊急';

  const completed = createRuleFromPreset('checkbox', sheetId, 'A2:H11');
  completed.name = '完了した行';

  const amount = createRuleFromPreset('threshold', sheetId, 'G2:G11');
  amount.name = '100万円を超える見積';

  const stripes = createRuleFromPreset('stripes', sheetId, 'A2:H11');
  stripes.name = '読みやすい交互色';
  stripes.stopIfTrue = false;

  return [overdue, dueSoon, urgent, completed, amount, stripes];
};

export const createSampleWorkbook = (): WorkbookData => {
  const projectSheetId = createId('sheet');
  const holidaySheetId = createId('sheet');
  const projectSheet: SheetData = {
    id: projectSheetId,
    name: '案件管理',
    rows: sampleRows.map((row) => row.map(toCell)),
    rules: createSampleRules(projectSheetId)
  };
  const holidaySheet: SheetData = {
    id: holidaySheetId,
    name: '祝日マスタ',
    rows: [
      ['日付', '名称'],
      [new Date(new Date().getFullYear(), 0, 1), '元日'],
      [new Date(new Date().getFullYear(), 1, 11), '建国記念の日'],
      [new Date(new Date().getFullYear(), 3, 29), '昭和の日'],
      [new Date(new Date().getFullYear(), 4, 3), '憲法記念日']
    ].map((row) => row.map(toCell)),
    rules: []
  };
  return {
    id: createId('workbook'),
    name: '条件付き書式サンプル',
    source: 'sample',
    sheets: [projectSheet, holidaySheet]
  };
};
