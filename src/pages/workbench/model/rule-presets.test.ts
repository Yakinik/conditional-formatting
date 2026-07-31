import { describe, expect, it } from 'vitest';

import { compileRuleFormula } from './formula-compiler';
import { createRuleFromPreset, RULE_PRESETS } from './rule-presets';

describe('rule presets', () => {
  it('keeps all fourteen legacy rule families available', () => {
    expect(RULE_PRESETS.map((preset) => preset.id)).toEqual([
      'keyword', 'multiKeyword', 'rowByCell', 'checkbox', 'threshold', 'between', 'overdue',
      'dueSoon', 'weekday', 'datetime', 'blank', 'duplicate', 'stripes', 'inList'
    ]);
  });

  it.each(RULE_PRESETS)('compiles $label for both targets', (preset) => {
    const rule = createRuleFromPreset(preset.id, 'sheet', 'A2:H20');
    for (const target of ['sheets', 'excel'] as const) {
      const formula = compileRuleFormula(rule, target);
      expect(formula).toMatch(/^=/);
      expect(formula).not.toMatch(/undefined|NaN/);
    }
  });
});
