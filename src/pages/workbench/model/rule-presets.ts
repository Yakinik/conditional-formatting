import { createId } from './workbook';
import type { ConditionGroup, ConditionPredicate, ConditionalRule, RuleFormat } from './workbook';

export type RulePresetId =
  | 'keyword'
  | 'multiKeyword'
  | 'rowByCell'
  | 'checkbox'
  | 'threshold'
  | 'between'
  | 'overdue'
  | 'dueSoon'
  | 'weekday'
  | 'datetime'
  | 'blank'
  | 'duplicate'
  | 'stripes'
  | 'inList';

export interface RulePreset {
  id: RulePresetId;
  group: string;
  label: string;
  description: string;
}

export const RULE_PRESETS: RulePreset[] = [
  { id: 'keyword', group: '文字', label: 'キーワード（1つ）', description: '指定した文字を含むセル' },
  { id: 'multiKeyword', group: '文字', label: 'キーワード（複数）', description: '複数語のいずれか・すべて' },
  { id: 'rowByCell', group: '文字', label: '列の値で行全体', description: '同じ行の指定列を判定' },
  { id: 'checkbox', group: '表', label: 'チェックボックス', description: 'オン・オフの行' },
  { id: 'threshold', group: '数値', label: '数値しきい値', description: '指定値より大きい・小さい' },
  { id: 'between', group: '数値', label: '数値範囲', description: '下限から上限まで' },
  { id: 'overdue', group: '日時', label: '期限切れ', description: '今日より前の日付' },
  { id: 'dueSoon', group: '日時', label: '期限が近い', description: '今日から指定日数以内' },
  { id: 'weekday', group: '日時', label: '曜日を指定', description: '複数曜日をまとめて指定' },
  { id: 'datetime', group: '日時', label: '日時を組み合わせる', description: '日付・曜日・時刻を複合' },
  { id: 'blank', group: '表', label: '空白 / 非空白', description: '入力漏れ・入力済み' },
  { id: 'duplicate', group: '表', label: '重複', description: '重複すべて・2件目以降' },
  { id: 'stripes', group: '表', label: '交互の背景色', description: '偶数行・奇数行' },
  { id: 'inList', group: '表', label: '別リストとの一致', description: '別範囲や別シートと照合' }
];

const predicate = (
  kind: ConditionPredicate['kind'],
  operator: string,
  options: Partial<Omit<ConditionPredicate, 'type' | 'id' | 'kind' | 'operator'>> = {}
): ConditionPredicate => ({
  type: 'predicate',
  id: createId('condition'),
  negate: false,
  kind,
  operator,
  reference: { mode: 'currentCell' },
  ...options
});

const group = (children: ConditionGroup['children'], operator: ConditionGroup['operator'] = 'all'): ConditionGroup => ({
  type: 'group',
  id: createId('group'),
  operator,
  negate: false,
  children
});

const palette: Record<string, RuleFormat> = {
  red: { fill: '#fee7e5', text: '#8f211a', bold: true },
  amber: { fill: '#fff0c9', text: '#744b00', bold: true },
  blue: { fill: '#e6efff', text: '#174b9e' },
  green: { fill: '#ddf3e9', text: '#155c47' },
  violet: { fill: '#eee8ff', text: '#50358d' },
  gray: { fill: '#eef1f0', text: '#56605c' }
};

const initialCondition = (presetId: RulePresetId): { when: ConditionGroup; format: RuleFormat } => {
  switch (presetId) {
    case 'keyword':
      return { when: group([predicate('text', 'contains', { value: '至急' })]), format: palette.red };
    case 'multiKeyword':
      return { when: group([predicate('keywords', 'any', { values: ['至急', '重要', '緊急'] })]), format: palette.red };
    case 'rowByCell':
      return {
        when: group([predicate('text', 'equals', { value: '対応中', reference: { mode: 'column', column: 'D' } })]),
        format: palette.blue
      };
    case 'checkbox':
      return {
        when: group([predicate('checkbox', 'checked', { reference: { mode: 'column', column: 'H' } })]),
        format: palette.green
      };
    case 'threshold':
      return { when: group([predicate('number', 'greaterThan', { value: 1000000 })]), format: palette.violet };
    case 'between':
      return { when: group([predicate('between', 'between', { value: 500000, secondValue: 1000000 })]), format: palette.blue };
    case 'overdue':
      return { when: group([predicate('date', 'overdue')]), format: palette.red };
    case 'dueSoon':
      return { when: group([predicate('date', 'dueSoon', { value: 7 })]), format: palette.amber };
    case 'weekday':
      return { when: group([predicate('weekday', 'in', { values: ['0', '6'] })]), format: palette.violet };
    case 'datetime':
      return {
        when: group([
          predicate('date', 'dueSoon', { value: 7 }),
          predicate('weekday', 'in', { values: ['1', '2', '3', '4', '5'] })
        ]),
        format: palette.amber
      };
    case 'blank':
      return { when: group([predicate('blank', 'blank')]), format: palette.red };
    case 'duplicate':
      return { when: group([predicate('duplicate', 'all')]), format: palette.violet };
    case 'stripes':
      return { when: group([predicate('stripes', 'even')]), format: palette.gray };
    case 'inList':
      return { when: group([predicate('inList', 'in', { listRange: '祝日マスタ!A2:A10' })]), format: palette.red };
  }
};

export const createRuleFromPreset = (
  presetId: RulePresetId,
  sheetId: string,
  appliesTo: string
): ConditionalRule => {
  const preset = RULE_PRESETS.find((candidate) => candidate.id === presetId) ?? RULE_PRESETS[0];
  const { when, format } = initialCondition(preset.id);
  return {
    id: createId('rule'),
    sheetId,
    name: preset.label,
    appliesTo,
    enabled: true,
    stopIfTrue: true,
    when,
    format: { ...format }
  };
};

export const createEmptyPredicate = (): ConditionPredicate =>
  predicate('text', 'contains', { value: '' });

export const createEmptyGroup = (): ConditionGroup => group([createEmptyPredicate()]);
