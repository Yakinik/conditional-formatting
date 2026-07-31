import { describe, expect, it } from 'vitest';

import { compileRuleFormula } from './formula-compiler';
import type { ConditionalRule } from './workbook';

const rule: ConditionalRule = {
  id: 'rule',
  sheetId: 'sheet',
  name: '期限 × 未完了',
  appliesTo: 'A2:H20',
  enabled: true,
  stopIfTrue: true,
  format: { fill: '#fff', text: '#000' },
  when: {
    type: 'group', id: 'root', operator: 'all', negate: false, children: [
      {
        type: 'predicate', id: 'date', negate: false, kind: 'date', operator: 'dueSoon', value: 7,
        reference: { mode: 'column', column: 'F' }
      },
      {
        type: 'predicate', id: 'checkbox', negate: false, kind: 'checkbox', operator: 'unchecked',
        reference: { mode: 'column', column: 'H' }
      }
    ]
  }
};

describe('formula compiler', () => {
  it('compiles a compound formula with relative row references', () => {
    expect(compileRuleFormula(rule, 'sheets')).toBe(
      '=AND(AND($F2>=TODAY(),$F2<=TODAY()+7),$H2=FALSE)'
    );
  });

  it('uses INDIRECT for cross-sheet lists in Sheets only', () => {
    const listRule: ConditionalRule = {
      ...rule,
      appliesTo: 'B2:B20',
      when: {
        type: 'group', id: 'root-list', operator: 'all', negate: false, children: [{
          type: 'predicate', id: 'list', negate: false, kind: 'inList', operator: 'in',
          reference: { mode: 'currentCell' }, listRange: 'マスタ!A2:A20'
        }]
      }
    };
    expect(compileRuleFormula(listRule, 'sheets')).toContain('INDIRECT("\'マスタ\'!$A$2:$A$20")');
    expect(compileRuleFormula(listRule, 'excel')).toContain("COUNTIF('マスタ'!$A$2:$A$20,B2)");
  });

  it('wraps negated groups and predicates with NOT', () => {
    const negated = structuredClone(rule);
    negated.when.negate = true;
    negated.when.children[0].negate = true;
    expect(compileRuleFormula(negated, 'excel')).toMatch(/^=NOT\(AND\(NOT\(/);
  });
});
