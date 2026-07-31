import { useEffect } from 'preact/hooks';

import { matchesRule, matchingRules } from '../model/condition-engine';
import { columnIndexToName, parseRange, rangeContains } from '../model/a1-range';
import {
  activeSheet,
  beginSelection,
  endSelection,
  extendSelection,
  lensEnabled,
  selectedRange,
  selectedRule,
  selectionStart,
  setSelection,
  workbook
} from '../model/workbench-store';
import { formatCellValue, getCellValue } from '../model/workbook';

const MINIMUM_ROWS = 24;
const MINIMUM_COLUMNS = 10;

export const SpreadsheetGrid = () => {
  const sheet = activeSheet.value;
  const currentWorkbook = workbook.value;
  const selected = parseRange(selectedRange.value);
  const ruleInFocus = selectedRule.value;
  const rowCount = Math.max(MINIMUM_ROWS, sheet.rows.length);
  const columnCount = Math.max(
    MINIMUM_COLUMNS,
    Math.min(26, Math.max(...sheet.rows.map((row) => row.length), 1))
  );
  const columnWidth = (column: number) => column === 0 ? 76 : column === 1 ? 212 : 106;
  const gridWidth = 46 + Array.from({ length: columnCount }, (_, column) => columnWidth(column))
    .reduce((total, width) => total + width, 0);
  const now = new Date();

  useEffect(() => {
    window.addEventListener('mouseup', endSelection);
    return () => window.removeEventListener('mouseup', endSelection);
  }, []);

  const moveSelection = (event: KeyboardEvent, row: number, column: number) => {
    const directions: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1]
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    setSelection({
      row: Math.max(0, Math.min(rowCount - 1, row + direction[0])),
      column: Math.max(0, Math.min(columnCount - 1, column + direction[1]))
    });
  };

  return (
    <div class="grid-viewport" role="region" aria-label={`${sheet.name} のプレビュー表`}>
      <table class="sheet-grid" role="grid" aria-label={sheet.name} style={{ width: `${gridWidth}px` }}>
        <colgroup>
          <col class="row-number-column" />
          {Array.from({ length: columnCount }, (_, column) => (
            <col
              key={column}
              style={{ width: `${columnWidth(column)}px` }}
            />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th class="corner-cell" aria-hidden="true" />
            {Array.from({ length: columnCount }, (_, column) => (
              <th key={column} class="column-heading" scope="col">
                {columnIndexToName(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }, (_, row) => (
            <tr key={row}>
              <th class="row-heading" scope="row">{row + 1}</th>
              {Array.from({ length: columnCount }, (_, column) => {
                const value = getCellValue(sheet, row, column);
                const rules = matchingRules(currentWorkbook, sheet, row, column, now);
                const leadingRule = rules[0];
                const isSelected = Boolean(selected && rangeContains(selected, row, column));
                const isAnchor = Boolean(selected && selected.start.row === row && selected.start.column === column);
                const isLensMatch = Boolean(
                  lensEnabled.value &&
                  ruleInFocus &&
                  matchesRule(ruleInFocus, currentWorkbook, sheet, row, column, now)
                );
                const cellClass = [
                  'sheet-cell',
                  row === 0 ? 'sheet-cell--header' : '',
                  isSelected ? 'sheet-cell--selected' : '',
                  isAnchor ? 'sheet-cell--anchor' : '',
                  isLensMatch ? 'sheet-cell--lens-match' : ''
                ].filter(Boolean).join(' ');
                return (
                  <td
                    key={column}
                    class={cellClass}
                    data-cell={`${columnIndexToName(column)}${row + 1}`}
                    role="gridcell"
                    aria-selected={isSelected}
                    tabIndex={isAnchor ? 0 : -1}
                    title={rules.length ? rules.map((rule) => rule.name).join(' → ') : undefined}
                    style={leadingRule ? {
                      '--cell-fill': leadingRule.format.fill,
                      '--cell-text': leadingRule.format.text,
                      '--cell-weight': leadingRule.format.bold ? '700' : '500'
                    } : undefined}
                    onKeyDown={(event) => moveSelection(event, row, column)}
                    onMouseDown={(event) => {
                      if (event.button !== 0) return;
                      event.preventDefault();
                      beginSelection({ row, column });
                    }}
                    onMouseEnter={() => {
                      if (selectionStart.value) extendSelection({ row, column });
                    }}
                  >
                    <span>{formatCellValue(value)}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
