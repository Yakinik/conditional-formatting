import { computed, signal } from '@preact/signals';

import { formatRange, parseRange, rangeFromPoints } from './a1-range';
import type { CellPosition } from './a1-range';
import { createEmptyGroup, createEmptyPredicate, createRuleFromPreset } from './rule-presets';
import type { RulePresetId } from './rule-presets';
import { createSampleWorkbook } from './sample-workbook';
import { createId } from './workbook';
import type {
  ConditionGroup,
  ConditionNode,
  ConditionalRule,
  SheetData,
  WorkbookData
} from './workbook';

export type FormulaTarget = 'sheets' | 'excel';

export interface ToastMessage {
  kind: 'success' | 'error' | 'info';
  text: string;
}

export const workbook = signal<WorkbookData>(createSampleWorkbook());
export const activeSheetId = signal(workbook.value.sheets[0].id);
export const selectedRuleId = signal<string | null>(workbook.value.sheets[0].rules[0]?.id ?? null);
export const selectedRange = signal('A2:H11');
export const selectionStart = signal<CellPosition | null>(null);
export const formulaTarget = signal<FormulaTarget>('sheets');
export const lensEnabled = signal(true);
export const sidebarOpen = signal(false);
export const importBusy = signal(false);
export const toast = signal<ToastMessage | null>(null);

export const activeSheet = computed<SheetData>(() =>
  workbook.value.sheets.find((sheet) => sheet.id === activeSheetId.value) ?? workbook.value.sheets[0]
);

export const activeRules = computed(() => activeSheet.value?.rules ?? []);

export const selectedRule = computed(() =>
  activeRules.value.find((rule) => rule.id === selectedRuleId.value) ?? null
);

const updateSheet = (sheetId: string, updater: (sheet: SheetData) => SheetData): void => {
  workbook.value = {
    ...workbook.value,
    sheets: workbook.value.sheets.map((sheet) => (sheet.id === sheetId ? updater(sheet) : sheet))
  };
};

export const setActiveSheet = (sheetId: string): void => {
  const sheet = workbook.value.sheets.find((candidate) => candidate.id === sheetId);
  if (!sheet) return;
  activeSheetId.value = sheetId;
  selectedRuleId.value = sheet.rules[0]?.id ?? null;
  const lastRow = Math.max(1, Math.min(sheet.rows.length, 25));
  const width = Math.max(1, Math.min(Math.max(...sheet.rows.map((row) => row.length), 1), 12));
  selectedRange.value = `A1:${String.fromCharCode(64 + width)}${lastRow}`;
};

export const setSelection = (first: CellPosition, last = first): void => {
  selectedRange.value = formatRange(rangeFromPoints(first, last));
};

export const beginSelection = (position: CellPosition): void => {
  selectionStart.value = position;
  setSelection(position);
};

export const extendSelection = (position: CellPosition): void => {
  if (selectionStart.value) setSelection(selectionStart.value, position);
};

export const endSelection = (): void => {
  selectionStart.value = null;
};

export const setRangeFromInput = (value: string): boolean => {
  const parsed = parseRange(value);
  if (!parsed) return false;
  selectedRange.value = formatRange(parsed);
  return true;
};

export const selectRule = (ruleId: string): void => {
  selectedRuleId.value = ruleId;
  sidebarOpen.value = true;
};

export const addRule = (presetId: RulePresetId): void => {
  const sheet = activeSheet.value;
  if (!sheet) return;
  const rule = createRuleFromPreset(presetId, sheet.id, selectedRange.value);
  updateSheet(sheet.id, (current) => ({ ...current, rules: [rule, ...current.rules] }));
  selectedRuleId.value = rule.id;
  toast.value = { kind: 'success', text: `「${rule.name}」を追加しました。` };
};

export const addBlankRule = (): void => {
  const sheet = activeSheet.value;
  if (!sheet) return;
  const rule: ConditionalRule = {
    id: createId('rule'),
    sheetId: sheet.id,
    name: '新しい複合ルール',
    appliesTo: selectedRange.value,
    enabled: true,
    stopIfTrue: true,
    when: createEmptyGroup(),
    format: { fill: '#e6efff', text: '#174b9e' }
  };
  updateSheet(sheet.id, (current) => ({ ...current, rules: [rule, ...current.rules] }));
  selectedRuleId.value = rule.id;
};

export const updateRule = (ruleId: string, patch: Partial<ConditionalRule>): void => {
  const sheet = activeSheet.value;
  if (!sheet) return;
  updateSheet(sheet.id, (current) => ({
    ...current,
    rules: current.rules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch, id: rule.id, sheetId: rule.sheetId } : rule))
  }));
};

export const deleteRule = (ruleId: string): void => {
  const sheet = activeSheet.value;
  if (!sheet) return;
  const nextRules = sheet.rules.filter((rule) => rule.id !== ruleId);
  updateSheet(sheet.id, (current) => ({ ...current, rules: nextRules }));
  selectedRuleId.value = nextRules[0]?.id ?? null;
  toast.value = { kind: 'info', text: 'ルールを削除しました。' };
};

export const moveRule = (ruleId: string, direction: -1 | 1): void => {
  const sheet = activeSheet.value;
  if (!sheet) return;
  const index = sheet.rules.findIndex((rule) => rule.id === ruleId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= sheet.rules.length) return;
  const rules = [...sheet.rules];
  [rules[index], rules[target]] = [rules[target], rules[index]];
  updateSheet(sheet.id, (current) => ({ ...current, rules }));
};

const updateNode = (
  node: ConditionNode,
  nodeId: string,
  updater: (current: ConditionNode) => ConditionNode
): ConditionNode => {
  if (node.id === nodeId) return updater(node);
  if (node.type === 'predicate') return node;
  return { ...node, children: node.children.map((child) => updateNode(child, nodeId, updater)) };
};

const updateRuleTree = (ruleId: string, updater: (group: ConditionGroup) => ConditionGroup): void => {
  const rule = activeRules.value.find((candidate) => candidate.id === ruleId);
  if (rule) updateRule(ruleId, { when: updater(rule.when) });
};

export const patchCondition = (ruleId: string, nodeId: string, patch: Partial<ConditionNode>): void => {
  updateRuleTree(ruleId, (root) =>
    updateNode(root, nodeId, (node) => ({ ...node, ...patch, id: node.id, type: node.type } as ConditionNode)) as ConditionGroup
  );
};

export const replaceCondition = (ruleId: string, nodeId: string, node: ConditionNode): void => {
  updateRuleTree(ruleId, (root) => updateNode(root, nodeId, () => ({ ...node, id: nodeId })) as ConditionGroup);
};

export const addCondition = (ruleId: string, groupId: string): void => {
  updateRuleTree(ruleId, (root) =>
    updateNode(root, groupId, (node) =>
      node.type === 'group' ? { ...node, children: [...node.children, createEmptyPredicate()] } : node
    ) as ConditionGroup
  );
};

export const addConditionGroup = (ruleId: string, groupId: string): void => {
  updateRuleTree(ruleId, (root) =>
    updateNode(root, groupId, (node) =>
      node.type === 'group' ? { ...node, children: [...node.children, createEmptyGroup()] } : node
    ) as ConditionGroup
  );
};

const removeNode = (node: ConditionNode, nodeId: string): ConditionNode => {
  if (node.type === 'predicate') return node;
  return {
    ...node,
    children: node.children.filter((child) => child.id !== nodeId).map((child) => removeNode(child, nodeId))
  };
};

export const removeCondition = (ruleId: string, nodeId: string): void => {
  updateRuleTree(ruleId, (root) => removeNode(root, nodeId) as ConditionGroup);
};

export const applySelectionToRule = (ruleId: string): void => {
  updateRule(ruleId, { appliesTo: selectedRange.value });
  toast.value = { kind: 'success', text: `${selectedRange.value} を対象範囲に設定しました。` };
};

const cloneRuleForSheet = (rule: ConditionalRule, sheetId: string): ConditionalRule => ({
  ...structuredClone(rule),
  id: createId('rule'),
  sheetId
});

export const replaceWorkbook = (nextWorkbook: WorkbookData, warnings: string[] = []): void => {
  const previousWorkbook = workbook.value;
  const previousActiveRules = activeSheet.value?.rules ?? [];
  const sheets = nextWorkbook.sheets.map((sheet, index) => {
    const matchingSheet = previousWorkbook.sheets.find((candidate) => candidate.name === sheet.name);
    const sourceRules = matchingSheet?.rules.length ? matchingSheet.rules : index === 0 ? previousActiveRules : [];
    return { ...sheet, rules: sourceRules.map((rule) => cloneRuleForSheet(rule, sheet.id)) };
  });
  workbook.value = { ...nextWorkbook, sheets };
  activeSheetId.value = sheets[0].id;
  selectedRuleId.value = sheets[0].rules[0]?.id ?? null;
  const rowCount = Math.max(1, Math.min(sheets[0].rows.length, 25));
  const columnCount = Math.max(1, Math.min(Math.max(...sheets[0].rows.map((row) => row.length), 1), 12));
  selectedRange.value = `A1:${String.fromCharCode(64 + columnCount)}${rowCount}`;
  const ruleMessage = sheets[0].rules.length ? ` 既存の書式 ${sheets[0].rules.length} 件を適用しました。` : '';
  toast.value = {
    kind: warnings.length ? 'info' : 'success',
    text: `${nextWorkbook.name} を取り込みました。${ruleMessage}${warnings.join(' ')}`.trim()
  };
};

export const restoreSample = (): void => {
  const sample = createSampleWorkbook();
  workbook.value = sample;
  activeSheetId.value = sample.sheets[0].id;
  selectedRuleId.value = sample.sheets[0].rules[0]?.id ?? null;
  selectedRange.value = 'A2:H11';
  toast.value = { kind: 'success', text: 'サンプルを復元しました。' };
};
