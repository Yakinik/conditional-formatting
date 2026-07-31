import { Icon } from '@/shared/ui';

import type { ConditionGroup, ConditionKind, ConditionPredicate, ConditionalRule } from '../model/workbook';
import {
  addCondition,
  addConditionGroup,
  patchCondition,
  removeCondition,
  replaceCondition
} from '../model/workbench-store';

const conditionKinds: Array<{ value: ConditionKind; label: string }> = [
  { value: 'text', label: '文字' },
  { value: 'keywords', label: '複数キーワード' },
  { value: 'number', label: '数値しきい値' },
  { value: 'between', label: '数値範囲' },
  { value: 'date', label: '日付' },
  { value: 'weekday', label: '曜日' },
  { value: 'time', label: '時刻' },
  { value: 'business', label: '営業日' },
  { value: 'blank', label: '空白' },
  { value: 'checkbox', label: 'チェックボックス' },
  { value: 'duplicate', label: '重複' },
  { value: 'stripes', label: '交互色' },
  { value: 'inList', label: '別リスト一致' }
];

const weekdayOptions = [
  ['1', '月'], ['2', '火'], ['3', '水'], ['4', '木'], ['5', '金'], ['6', '土'], ['0', '日']
] as const;

const predicateForKind = (current: ConditionPredicate, kind: ConditionKind): ConditionPredicate => {
  const base: ConditionPredicate = {
    type: 'predicate',
    id: current.id,
    negate: current.negate,
    kind,
    reference: current.reference,
    operator: 'contains'
  };
  switch (kind) {
    case 'text': return { ...base, operator: 'contains', value: '' };
    case 'keywords': return { ...base, operator: 'any', values: ['至急', '重要'] };
    case 'number': return { ...base, operator: 'greaterThan', value: 100 };
    case 'between': return { ...base, operator: 'between', value: 0, secondValue: 100 };
    case 'date': return { ...base, operator: 'dueSoon', value: 7 };
    case 'weekday': return { ...base, operator: 'in', values: ['0', '6'] };
    case 'time': return { ...base, operator: 'after', value: '09:00', secondValue: '18:00' };
    case 'business': return { ...base, operator: 'business', values: ['0', '6'], listRange: '' };
    case 'blank': return { ...base, operator: 'blank' };
    case 'checkbox': return { ...base, operator: 'checked' };
    case 'duplicate': return { ...base, operator: 'all' };
    case 'stripes': return { ...base, operator: 'even' };
    case 'inList': return { ...base, operator: 'in', listRange: 'Sheet2!A2:A20' };
  }
};

interface WeekdayPickerProps {
  values: string[];
  onChange: (values: string[]) => void;
}

const WeekdayPicker = ({ values, onChange }: WeekdayPickerProps) => (
  <div class="weekday-picker" aria-label="曜日を選択">
    {weekdayOptions.map(([value, label]) => (
      <label key={value} class={`weekday-chip ${values.includes(value) ? 'weekday-chip--active' : ''}`}>
        <input
          type="checkbox"
          checked={values.includes(value)}
          onChange={(event) => {
            const next = event.currentTarget.checked
              ? [...values, value]
              : values.filter((candidate) => candidate !== value);
            onChange(next);
          }}
        />
        {label}
      </label>
    ))}
  </div>
);

interface PredicateFieldsProps {
  predicate: ConditionPredicate;
  ruleId: string;
}

const PredicateFields = ({ predicate, ruleId }: PredicateFieldsProps) => {
  const patch = (next: Partial<ConditionPredicate>) => patchCondition(ruleId, predicate.id, next);
  const numericInput = (key: 'value' | 'secondValue', fallback = 0) => (
    <input
      class="field-control field-control--number"
      type="number"
      value={String(predicate[key] ?? fallback)}
      onInput={(event) => patch({ [key]: Number(event.currentTarget.value) })}
    />
  );

  switch (predicate.kind) {
    case 'text':
      return <div class="condition-fields condition-fields--pair">
        <select class="field-control" value={predicate.operator} onChange={(event) => patch({ operator: event.currentTarget.value })}>
          <option value="contains">含む</option><option value="equals">等しい</option>
          <option value="startsWith">で始まる</option><option value="endsWith">で終わる</option>
          <option value="notContains">含まない</option>
        </select>
        <input class="field-control" value={String(predicate.value ?? '')} placeholder="文字を入力" onInput={(event) => patch({ value: event.currentTarget.value })} />
      </div>;
    case 'keywords':
      return <div class="condition-fields">
        <select class="field-control" value={predicate.operator} onChange={(event) => patch({ operator: event.currentTarget.value })}>
          <option value="any">いずれかを含む</option><option value="all">すべてを含む</option>
        </select>
        <input
          class="field-control"
          value={(predicate.values ?? []).join(', ')}
          placeholder="至急, 重要, 緊急"
          onInput={(event) => patch({ values: event.currentTarget.value.split(',').map((value) => value.trim()) })}
        />
      </div>;
    case 'number':
      return <div class="condition-fields condition-fields--pair">
        <select class="field-control" value={predicate.operator} onChange={(event) => patch({ operator: event.currentTarget.value })}>
          <option value="greaterThan">より大きい</option><option value="greaterOrEqual">以上</option>
          <option value="equal">等しい</option><option value="lessOrEqual">以下</option><option value="lessThan">より小さい</option>
        </select>
        {numericInput('value')}
      </div>;
    case 'between':
      return <div class="condition-fields condition-fields--range">
        {numericInput('value')}<span>〜</span>{numericInput('secondValue', 100)}
      </div>;
    case 'date':
      return <div class="condition-fields condition-fields--pair">
        <select class="field-control" value={predicate.operator} onChange={(event) => patch({ operator: event.currentTarget.value })}>
          <option value="overdue">期限切れ</option><option value="dueSoon">今日から指定日以内</option>
          <option value="today">今日</option><option value="before">指定日より前</option><option value="after">指定日より後</option>
        </select>
        {predicate.operator === 'dueSoon' && numericInput('value', 7)}
        {(predicate.operator === 'before' || predicate.operator === 'after') && (
          <input class="field-control" type="date" value={String(predicate.value ?? '')} onInput={(event) => patch({ value: event.currentTarget.value })} />
        )}
      </div>;
    case 'weekday':
      return <WeekdayPicker values={predicate.values ?? []} onChange={(values) => patch({ values })} />;
    case 'time':
      return <div class="condition-fields condition-fields--range">
        <select class="field-control" value={predicate.operator} onChange={(event) => patch({ operator: event.currentTarget.value })}>
          <option value="after">より後</option><option value="before">より前</option><option value="between">範囲内</option>
        </select>
        <input class="field-control" type="time" value={String(predicate.value ?? '09:00')} onInput={(event) => patch({ value: event.currentTarget.value })} />
        {predicate.operator === 'between' && <input class="field-control" type="time" value={String(predicate.secondValue ?? '18:00')} onInput={(event) => patch({ secondValue: event.currentTarget.value })} />}
      </div>;
    case 'business':
      return <div class="condition-fields">
        <select class="field-control" value={predicate.operator} onChange={(event) => patch({ operator: event.currentTarget.value })}>
          <option value="business">営業日</option><option value="nonbusiness">休業日</option>
        </select>
        <span class="field-caption">休業曜日</span>
        <WeekdayPicker values={predicate.values ?? []} onChange={(values) => patch({ values })} />
        <input class="field-control" value={predicate.listRange ?? ''} placeholder="祝日マスタ!A2:A20（任意）" onInput={(event) => patch({ listRange: event.currentTarget.value })} />
      </div>;
    case 'blank':
      return <select class="field-control" value={predicate.operator} onChange={(event) => patch({ operator: event.currentTarget.value })}>
        <option value="blank">空白</option><option value="nonblank">空白ではない</option>
      </select>;
    case 'checkbox':
      return <select class="field-control" value={predicate.operator} onChange={(event) => patch({ operator: event.currentTarget.value })}>
        <option value="checked">オン</option><option value="unchecked">オフ</option>
      </select>;
    case 'duplicate':
      return <select class="field-control" value={predicate.operator} onChange={(event) => patch({ operator: event.currentTarget.value })}>
        <option value="all">重複しているすべて</option><option value="afterFirst">2件目以降</option>
      </select>;
    case 'stripes':
      return <select class="field-control" value={predicate.operator} onChange={(event) => patch({ operator: event.currentTarget.value })}>
        <option value="even">偶数行</option><option value="odd">奇数行</option>
      </select>;
    case 'inList':
      return <input class="field-control" value={predicate.listRange ?? ''} placeholder="マスタ!A2:A20" onInput={(event) => patch({ listRange: event.currentTarget.value })} />;
  }
};

interface PredicateEditorProps {
  predicate: ConditionPredicate;
  rule: ConditionalRule;
}

const PredicateEditor = ({ predicate, rule }: PredicateEditorProps) => (
  <article class="condition-card">
    <div class="condition-card__topline">
      <select
        class="condition-kind"
        aria-label="条件の種類"
        value={predicate.kind}
        onChange={(event) => replaceCondition(rule.id, predicate.id, predicateForKind(predicate, event.currentTarget.value as ConditionKind))}
      >
        {conditionKinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
      </select>
      <label class="mini-check" title="条件の結果を反転します">
        <input type="checkbox" checked={predicate.negate} onChange={(event) => patchCondition(rule.id, predicate.id, { negate: event.currentTarget.checked })} />
        NOT
      </label>
      <button class="icon-button icon-button--quiet" type="button" aria-label="条件を削除" onClick={() => removeCondition(rule.id, predicate.id)}>
        <Icon name="trash" size={15} />
      </button>
    </div>
    {predicate.kind !== 'stripes' && (
      <div class="reference-row">
        <span>判定する値</span>
        <select
          class="field-control field-control--compact"
          value={predicate.reference.mode}
          onChange={(event) => patchCondition(rule.id, predicate.id, {
            reference: event.currentTarget.value === 'column'
              ? { mode: 'column', column: predicate.reference.column || 'A' }
              : { mode: 'currentCell' }
          })}
        >
          <option value="currentCell">各セル自身</option>
          <option value="column">同じ行の列</option>
        </select>
        {predicate.reference.mode === 'column' && (
          <input
            class="column-input"
            aria-label="参照する列"
            value={predicate.reference.column ?? 'A'}
            maxLength={2}
            onInput={(event) => patchCondition(rule.id, predicate.id, {
              reference: { mode: 'column', column: event.currentTarget.value.toUpperCase().replace(/[^A-Z]/g, '') }
            })}
          />
        )}
      </div>
    )}
    <PredicateFields predicate={predicate} ruleId={rule.id} />
  </article>
);

interface GroupEditorProps {
  group: ConditionGroup;
  rule: ConditionalRule;
  depth?: number;
  root?: boolean;
}

export const ConditionGroupEditor = ({ group, rule, depth = 0, root = false }: GroupEditorProps) => (
  <section class={`condition-group ${depth > 0 ? 'condition-group--nested' : ''}`}>
    <div class="condition-group__header">
      <span class="condition-group__label">{root ? '次の条件を' : 'グループ内を'}</span>
      <select
        class="logic-select"
        aria-label="条件の組み合わせ"
        value={group.operator}
        onChange={(event) => patchCondition(rule.id, group.id, { operator: event.currentTarget.value as 'all' | 'any' })}
      >
        <option value="all">すべて満たす（AND）</option>
        <option value="any">いずれか満たす（OR）</option>
      </select>
      <label class="mini-check">
        <input type="checkbox" checked={group.negate} onChange={(event) => patchCondition(rule.id, group.id, { negate: event.currentTarget.checked })} />
        NOT
      </label>
      {!root && (
        <button class="icon-button icon-button--quiet" type="button" aria-label="条件グループを削除" onClick={() => removeCondition(rule.id, group.id)}>
          <Icon name="trash" size={15} />
        </button>
      )}
    </div>
    <div class="condition-group__body">
      {group.children.length === 0 && <p class="empty-condition">条件を追加してください。</p>}
      {group.children.map((child, index) => (
        <div key={child.id} class="condition-node">
          {index > 0 && <span class="logic-connector">{group.operator === 'all' ? 'かつ' : 'または'}</span>}
          {child.type === 'group'
            ? <ConditionGroupEditor group={child} rule={rule} depth={depth + 1} />
            : <PredicateEditor predicate={child} rule={rule} />}
        </div>
      ))}
    </div>
    <div class="condition-group__actions">
      <button type="button" class="text-button" onClick={() => addCondition(rule.id, group.id)}>
        <Icon name="plus" size={15} /> 条件
      </button>
      <button type="button" class="text-button" onClick={() => addConditionGroup(rule.id, group.id)}>
        <Icon name="plus" size={15} /> 条件グループ
      </button>
    </div>
  </section>
);
