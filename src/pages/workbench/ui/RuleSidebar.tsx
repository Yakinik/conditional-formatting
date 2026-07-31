import { useState } from 'preact/hooks';

import { Icon } from '@/shared/ui';

import { matchesRule } from '../model/condition-engine';
import { compileRuleFormula, formulaSetupSteps } from '../model/formula-compiler';
import { parseRange } from '../model/a1-range';
import { RULE_PRESETS } from '../model/rule-presets';
import type { RulePresetId } from '../model/rule-presets';
import type { ConditionalRule } from '../model/workbook';
import {
  activeRules,
  activeSheet,
  addBlankRule,
  addRule,
  applySelectionToRule,
  deleteRule,
  formulaTarget,
  lensEnabled,
  moveRule,
  selectedRange,
  selectedRule,
  selectRule,
  sidebarOpen,
  toast,
  updateRule,
  workbook
} from '../model/workbench-store';
import { ConditionGroupEditor } from './ConditionGroupEditor';

const palettes = [
  { name: '警告', fill: '#fee7e5', text: '#8f211a' },
  { name: '注意', fill: '#fff0c9', text: '#744b00' },
  { name: '情報', fill: '#e6efff', text: '#174b9e' },
  { name: '完了', fill: '#ddf3e9', text: '#155c47' },
  { name: '分類', fill: '#eee8ff', text: '#50358d' },
  { name: '補助', fill: '#eef1f0', text: '#56605c' }
];

const matchCountForRule = (rule: ConditionalRule): number => {
  const sheet = activeSheet.value;
  const range = parseRange(rule.appliesTo);
  if (!sheet || !range) return 0;
  const lastRow = Math.min(range.end.row, sheet.rows.length - 1);
  const dataColumns = Math.max(...sheet.rows.map((row) => row.length), 1);
  const lastColumn = Math.min(range.end.column, dataColumns - 1);
  let count = 0;
  const now = new Date();
  for (let row = range.start.row; row <= lastRow; row += 1) {
    for (let column = range.start.column; column <= lastColumn; column += 1) {
      if (matchesRule(rule, workbook.value, sheet, row, column, now)) count += 1;
    }
  }
  return count;
};

interface RuleCardProps {
  rule: ConditionalRule;
  index: number;
  total: number;
}

const RuleCard = ({ rule, index, total }: RuleCardProps) => (
  <article
    class={`rule-card ${selectedRule.value?.id === rule.id ? 'rule-card--selected' : ''} ${!rule.enabled ? 'rule-card--disabled' : ''}`}
    onClick={() => selectRule(rule.id)}
  >
    <button type="button" class="rule-card__main" aria-pressed={selectedRule.value?.id === rule.id}>
      <span class="rule-card__priority">{index + 1}</span>
      <span class="rule-card__swatch" style={{ background: rule.format.fill, color: rule.format.text }}>Aa</span>
      <span class="rule-card__copy">
        <strong>{rule.name}</strong>
        <small>{rule.appliesTo} · {rule.when.children.length}条件</small>
      </span>
      <Icon name="chevron" size={15} />
    </button>
    <div class="rule-card__actions">
      <label class="switch switch--small" title={rule.enabled ? 'ルールを無効化' : 'ルールを有効化'} onClick={(event) => event.stopPropagation()}>
        <input type="checkbox" checked={rule.enabled} onChange={(event) => updateRule(rule.id, { enabled: event.currentTarget.checked })} />
        <span />
      </label>
      <button type="button" class="icon-button icon-button--quiet" disabled={index === 0} aria-label="優先順位を上げる" onClick={(event) => { event.stopPropagation(); moveRule(rule.id, -1); }}>
        <Icon name="arrowUp" size={14} />
      </button>
      <button type="button" class="icon-button icon-button--quiet" disabled={index === total - 1} aria-label="優先順位を下げる" onClick={(event) => { event.stopPropagation(); moveRule(rule.id, 1); }}>
        <Icon name="arrowDown" size={14} />
      </button>
    </div>
  </article>
);

const RuleList = () => {
  const [preset, setPreset] = useState<RulePresetId | ''>('');
  const grouped = RULE_PRESETS.reduce<Record<string, typeof RULE_PRESETS>>((groups, item) => {
    (groups[item.group] ??= []).push(item);
    return groups;
  }, {});
  return (
    <section class="sidebar-section rule-list-section">
      <div class="section-heading">
        <div>
          <span class="eyebrow">{activeSheet.value.name}</span>
          <h2>書式ルール</h2>
        </div>
        <span class="count-badge">{activeRules.value.length}</span>
      </div>
      <div class="preset-picker">
        <select
          class="field-control"
          aria-label="追加するルール"
          value={preset}
          onChange={(event) => setPreset(event.currentTarget.value as RulePresetId | '')}
        >
          <option value="">プリセットを選択…</option>
          {Object.entries(grouped).map(([group, items]) => (
            <optgroup key={group} label={group}>
              {items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </optgroup>
          ))}
        </select>
        <button
          class="primary-button primary-button--square"
          type="button"
          aria-label="選択したプリセットを追加"
          disabled={!preset}
          onClick={() => {
            if (!preset) return;
            addRule(preset);
            setPreset('');
          }}
        >
          <Icon name="plus" size={18} />
        </button>
      </div>
      <button class="text-button text-button--full" type="button" onClick={addBlankRule}>
        <Icon name="rules" size={16} /> 空の複合ルールから作る
      </button>
      <div class="rule-list">
        {activeRules.value.length === 0 && (
          <div class="empty-state">
            <span class="empty-state__icon"><Icon name="rules" /></span>
            <strong>まだルールがありません</strong>
            <p>範囲を選び、プリセットまたは空のルールを追加してください。</p>
          </div>
        )}
        {activeRules.value.map((rule, index) => (
          <RuleCard key={rule.id} rule={rule} index={index} total={activeRules.value.length} />
        ))}
      </div>
    </section>
  );
};

interface RuleEditorProps {
  rule: ConditionalRule;
}

const RuleEditor = ({ rule }: RuleEditorProps) => {
  const formula = compileRuleFormula(rule, formulaTarget.value);
  const rangeIsValid = Boolean(parseRange(rule.appliesTo));
  const matchCount = matchCountForRule(rule);
  const copyFormula = async () => {
    try {
      await navigator.clipboard.writeText(formula);
      toast.value = { kind: 'success', text: '数式をコピーしました。' };
    } catch {
      toast.value = { kind: 'error', text: 'コピーできませんでした。数式を選択してコピーしてください。' };
    }
  };

  return (
    <section class="sidebar-section rule-editor">
      <div class="rule-breadcrumb" aria-label="現在の編集位置">
        <span>{activeSheet.value.name}</span><Icon name="chevron" size={12} />
        <span>{rule.appliesTo}</span><Icon name="chevron" size={12} />
        <strong>条件</strong>
      </div>

      <div class="rule-title-row">
        <input
          class="rule-name-input"
          aria-label="ルール名"
          value={rule.name}
          onInput={(event) => updateRule(rule.id, { name: event.currentTarget.value })}
        />
        <div class="lens-stat" title="選択ルールに一致するセル数">
          <span class="lens-stat__dot" />
          {matchCount}セル
        </div>
      </div>

      <div class="editor-block">
        <div class="editor-block__heading">
          <span class="step-number">01</span>
          <div><strong>対象範囲</strong><small>このルールを評価するセル</small></div>
        </div>
        <div class="range-editor">
          <input
            class="field-control field-control--mono"
            aria-label="対象範囲"
            aria-invalid={!rangeIsValid}
            value={rule.appliesTo}
            onInput={(event) => updateRule(rule.id, { appliesTo: event.currentTarget.value.toUpperCase() })}
          />
          <button class="secondary-button" type="button" onClick={() => applySelectionToRule(rule.id)}>
            選択中の {selectedRange.value} を使う
          </button>
        </div>
        {!rangeIsValid && <p class="field-error">A2:H20 の形式で入力してください。</p>}
      </div>

      <div class="editor-block editor-block--conditions">
        <div class="editor-block__heading">
          <span class="step-number">02</span>
          <div><strong>条件</strong><small>AND・OR・NOTで自由に組み合わせ</small></div>
        </div>
        <ConditionGroupEditor group={rule.when} rule={rule} root />
      </div>

      <div class="editor-block">
        <div class="editor-block__heading">
          <span class="step-number">03</span>
          <div><strong>書式</strong><small>一致したセルの見た目</small></div>
        </div>
        <div class="palette-grid" aria-label="書式カラーパレット">
          {palettes.map((palette) => {
            const active = rule.format.fill === palette.fill && rule.format.text === palette.text;
            return (
              <button
                key={palette.name}
                class={`palette-button ${active ? 'palette-button--active' : ''}`}
                type="button"
                aria-label={palette.name}
                aria-pressed={active}
                style={{ background: palette.fill, color: palette.text }}
                onClick={() => updateRule(rule.id, { format: { ...rule.format, fill: palette.fill, text: palette.text } })}
              >
                Aa
                {active && <span><Icon name="check" size={12} /></span>}
              </button>
            );
          })}
        </div>
        <div class="custom-colors">
          <label>背景 <input type="color" value={rule.format.fill} onInput={(event) => updateRule(rule.id, { format: { ...rule.format, fill: event.currentTarget.value } })} /></label>
          <label>文字 <input type="color" value={rule.format.text} onInput={(event) => updateRule(rule.id, { format: { ...rule.format, text: event.currentTarget.value } })} /></label>
          <label class="mini-check"><input type="checkbox" checked={rule.format.bold ?? false} onChange={(event) => updateRule(rule.id, { format: { ...rule.format, bold: event.currentTarget.checked } })} />太字</label>
        </div>
      </div>

      <div class="editor-block editor-block--formula">
        <div class="editor-block__heading editor-block__heading--spread">
          <div><strong>生成された数式</strong><small>{formulaTarget.value === 'sheets' ? 'Google スプレッドシート' : 'Microsoft Excel'}</small></div>
          <button class="icon-button" type="button" aria-label="数式をコピー" onClick={copyFormula}><Icon name="copy" size={16} /></button>
        </div>
        <code class="formula-output">{formula}</code>
        <details class="setup-steps">
          <summary>設定手順を見る</summary>
          <ol>{formulaSetupSteps(rule, formulaTarget.value).map((step) => <li key={step}>{step}</li>)}</ol>
        </details>
      </div>

      <div class="rule-options">
        <label class="switch-row">
          <span><strong>一致後に次のルールを止める</strong><small>優先順位の高い書式を保持します</small></span>
          <span class="switch"><input type="checkbox" checked={rule.stopIfTrue} onChange={(event) => updateRule(rule.id, { stopIfTrue: event.currentTarget.checked })} /><span /></span>
        </label>
        <label class="switch-row">
          <span><strong>ルールレンズ</strong><small>一致セルを点線リングで強調</small></span>
          <span class="switch"><input type="checkbox" checked={lensEnabled.value} onChange={(event) => { lensEnabled.value = event.currentTarget.checked; }} /><span /></span>
        </label>
      </div>

      <button class="danger-button" type="button" onClick={() => deleteRule(rule.id)}>
        <Icon name="trash" size={16} /> このルールを削除
      </button>
    </section>
  );
};

export const RuleSidebar = () => (
  <aside class={`rule-sidebar ${sidebarOpen.value ? 'rule-sidebar--open' : ''}`} aria-label="条件付き書式ジェネレーター">
    <header class="sidebar-header">
      <div class="sidebar-header__title"><Icon name="rules" size={18} /><strong>条件付き書式</strong><span>GENERATOR</span></div>
      <button class="icon-button sidebar-close" type="button" aria-label="サイドバーを閉じる" onClick={() => { sidebarOpen.value = false; }}><Icon name="close" /></button>
    </header>
    <div class="sidebar-scroll">
      <RuleList />
      {selectedRule.value ? <RuleEditor rule={selectedRule.value} /> : (
        <section class="sidebar-section"><div class="empty-state"><Icon name="info" /><p>ルールを選ぶと詳細を編集できます。</p></div></section>
      )}
    </div>
  </aside>
);
