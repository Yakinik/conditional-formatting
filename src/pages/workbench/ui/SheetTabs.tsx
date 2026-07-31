import { Icon } from '@/shared/ui';

import { activeSheetId, setActiveSheet, workbook } from '../model/workbench-store';

export const SheetTabs = () => (
  <div class="sheet-tabs" aria-label="シート一覧">
    <div class="sheet-tabs__lead" title="ワークブック内のシート">
      <Icon name="grid" size={16} />
      <span>{workbook.value.sheets.length}</span>
    </div>
    <div class="sheet-tabs__scroll">
      {workbook.value.sheets.map((sheet) => (
        <button
          key={sheet.id}
          type="button"
          class={`sheet-tab ${activeSheetId.value === sheet.id ? 'sheet-tab--active' : ''}`}
          aria-current={activeSheetId.value === sheet.id ? 'page' : undefined}
          onClick={() => setActiveSheet(sheet.id)}
        >
          {sheet.name}
          {sheet.rules.length > 0 && <span class="sheet-tab__count">{sheet.rules.length}</span>}
        </button>
      ))}
    </div>
    <span class="sheet-tabs__privacy">データはブラウザ内で処理</span>
  </div>
);
