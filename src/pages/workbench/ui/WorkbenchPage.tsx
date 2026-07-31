import { useEffect, useRef, useState } from 'preact/hooks';

import { Icon } from '@/shared/ui';

import { workbookFromFile, workbookFromText } from '../lib/import-workbook';
import { compileRuleFormula } from '../model/formula-compiler';
import {
  activeSheet,
  formulaTarget,
  importBusy,
  replaceWorkbook,
  restoreSample,
  selectedRange,
  selectedRule,
  sidebarOpen,
  toast,
  workbook
} from '../model/workbench-store';
import { RuleSidebar } from './RuleSidebar';
import { SheetTabs } from './SheetTabs';
import { SpreadsheetGrid } from './SpreadsheetGrid';

import './workbench.css';

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
};

export const WorkbenchPage = () => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const currentFormula = selectedRule.value
    ? compileRuleFormula(selectedRule.value, formulaTarget.value)
    : 'ルールを選ぶと数式が表示されます';

  useEffect(() => {
    if (!toast.value) return;
    const timer = window.setTimeout(() => { toast.value = null; }, 5200);
    return () => window.clearTimeout(timer);
  }, [toast.value?.text]);

  const importFile = async (file: File) => {
    importBusy.value = true;
    try {
      const result = await workbookFromFile(file);
      replaceWorkbook(result.workbook, result.warnings);
    } catch (error) {
      toast.value = {
        kind: 'error',
        text: error instanceof Error ? error.message : 'ファイルを取り込めませんでした。'
      };
    } finally {
      importBusy.value = false;
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const importText = (text: string) => {
    if (!text.trim()) {
      toast.value = { kind: 'info', text: '表形式のテキストが見つかりませんでした。' };
      return;
    }
    const result = workbookFromText(text);
    replaceWorkbook(result.workbook, result.warnings);
  };

  const readClipboard = async () => {
    try {
      importText(await navigator.clipboard.readText());
    } catch {
      toast.value = { kind: 'info', text: '表をコピーして、この画面上で ⌘V / Ctrl+V を押してください。' };
    }
  };

  return (
    <div
      class="workbench"
      onDragEnter={(event) => {
        event.preventDefault();
        if (event.dataTransfer?.types.includes('Files')) setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer?.files[0];
        if (file) void importFile(file);
      }}
      onPaste={(event) => {
        if (isEditableTarget(event.target)) return;
        const text = event.clipboardData?.getData('text/plain');
        if (text) {
          event.preventDefault();
          importText(text);
        }
      }}
    >
      <header class="app-header">
        <div class="brand">
          <span class="brand__mark"><span>C</span><span>F</span></span>
          <div class="brand__copy">
            <strong>Format Lab</strong>
            <span>条件付き書式ワークベンチ</span>
          </div>
        </div>

        <div class="workbook-identity">
          <span class={`source-badge source-badge--${workbook.value.source}`}>
            {workbook.value.source === 'sample' ? 'SAMPLE' : workbook.value.source === 'paste' ? 'PASTE' : 'FILE'}
          </span>
          <strong title={workbook.value.name}>{workbook.value.name}</strong>
          <span>{activeSheet.value.name}</span>
        </div>

        <div class="header-actions">
          <div class="target-switch" aria-label="出力先を選択">
            <button type="button" class={formulaTarget.value === 'sheets' ? 'active' : ''} aria-pressed={formulaTarget.value === 'sheets'} onClick={() => { formulaTarget.value = 'sheets'; }}>Sheets</button>
            <button type="button" class={formulaTarget.value === 'excel' ? 'active' : ''} aria-pressed={formulaTarget.value === 'excel'} onClick={() => { formulaTarget.value = 'excel'; }}>Excel</button>
          </div>
          <button class="toolbar-button" type="button" disabled={importBusy.value} onClick={() => fileInput.current?.click()}>
            <Icon name="upload" size={17} /><span>{importBusy.value ? '読込中…' : 'ファイル'}</span>
          </button>
          <button class="toolbar-button" type="button" onClick={() => void readClipboard()}>
            <Icon name="paste" size={17} /><span>貼り付け</span>
          </button>
          <button class="icon-button restore-button" type="button" aria-label="サンプルを復元" title="サンプルを復元" onClick={restoreSample}>
            <Icon name="reset" size={17} />
          </button>
          <button class="toolbar-button panel-button" type="button" onClick={() => { sidebarOpen.value = true; }}>
            <Icon name="panel" size={17} /><span>ルール</span>
          </button>
        </div>
        <input
          ref={fileInput}
          class="visually-hidden"
          type="file"
          accept=".xlsx,.csv,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void importFile(file);
          }}
        />
      </header>

      <div class="formula-bar">
        <div class="name-box" title="選択範囲">{selectedRange.value}</div>
        <div class="formula-bar__fx">fx</div>
        <div class="formula-bar__value" title={currentFormula}>{currentFormula}</div>
        {selectedRule.value && (
          <div class="formula-bar__legend">
            <span style={{ background: selectedRule.value.format.fill, color: selectedRule.value.format.text }}>Aa</span>
            <strong>{selectedRule.value.name}</strong>
          </div>
        )}
      </div>

      <main class="workspace">
        <section class="sheet-stage" aria-label="スプレッドシートプレビュー">
          <div class="sheet-stage__notice">
            <span><Icon name="eye" size={15} /> ルールレンズ</span>
            <p>右のルールを選ぶと、一致セルを点線で確認できます。</p>
          </div>
          <SpreadsheetGrid />
          <SheetTabs />
        </section>
        <RuleSidebar />
      </main>

      {sidebarOpen.value && <button class="sidebar-scrim" type="button" aria-label="サイドバーを閉じる" onClick={() => { sidebarOpen.value = false; }} />}

      {dragging && (
        <div class="drop-overlay" role="status">
          <div class="drop-overlay__card">
            <span><Icon name="file" size={30} /></span>
            <strong>ここに表をドロップ</strong>
            <p>XLSX・CSV・TSV / 10MBまで</p>
          </div>
        </div>
      )}

      {toast.value && (
        <div class={`toast toast--${toast.value.kind}`} role="status" aria-live="polite">
          <Icon name={toast.value.kind === 'success' ? 'check' : 'info'} size={17} />
          <span>{toast.value.text}</span>
          <button type="button" aria-label="通知を閉じる" onClick={() => { toast.value = null; }}><Icon name="close" size={15} /></button>
        </div>
      )}
    </div>
  );
};
