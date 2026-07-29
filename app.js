'use strict';

(function () {

  /* ============================================================
     ヘルパー
     ============================================================ */

  function escQ(s) {
    return String(s == null ? '' : s).replace(/"/g, '""');
  }

  function escRe(s) {
    return String(s == null ? '' : s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function absRange(s) {
    return String(s == null ? '' : s).split(':').map(function (part) {
      var m = /^\$?([A-Za-z]{1,3})\$?([0-9]*)$/.exec(part.trim());
      if (!m) return part;
      return '$' + m[1].toUpperCase() + (m[2] ? '$' + m[2] : '');
    }).join(':');
  }

  var RANGE_RE = /^([A-Z]{1,3})([0-9]*)(?::([A-Z]{1,3})([0-9]*))?$/;

  function parseRange(str) {
    var text = String(str == null ? '' : str)
      .trim()
      .replace(/：/g, ':')
      .replace(/[$\s]/g, '')
      .toUpperCase();
    var m = RANGE_RE.exec(text);
    if (!m) return null;
    var row = m[2] ? parseInt(m[2], 10) : 1;
    return { text: text, col: m[1], row: row, cell: m[1] + row, abs: absRange(text) };
  }

  function colToIdx(col) {
    var n = 0;
    for (var i = 0; i < col.length; i++) n = n * 26 + (col.toUpperCase().charCodeAt(i) - 64);
    return n - 1;
  }

  function idxToCol(idx) {
    var s = '';
    var n = idx + 1;
    while (n > 0) {
      var r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  function parseCol(str) {
    var c = String(str == null ? '' : str).trim().replace(/[$\s]/g, '').toUpperCase();
    return /^[A-Z]{1,3}$/.test(c) ? c : null;
  }

  function addDays(n) {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + n);
    return d;
  }

  function fmtDate(d) {
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  var WEEKDAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

  function splitKeywords(s) {
    return String(s == null ? '' : s)
      .split(/[,、，]/)
      .map(function (w) { return w.trim(); })
      .filter(function (w) { return w !== ''; });
  }

  function toNum(s) {
    var t = String(s == null ? '' : s).trim();
    if (t === '') return NaN;
    return Number(t);
  }

  function clearEl(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  /* ============================================================
     色パレット / カテゴリ
     ============================================================ */

  var COLORS = [
    { id: 'red', name: '薄い赤', bg: '#f8d3cd', fg: '#8f2a1c' },
    { id: 'orange', name: '薄いオレンジ', bg: '#fbe3c9', fg: '#8a4c10' },
    { id: 'yellow', name: '薄い黄', bg: '#faeec3', fg: '#7a5b0e' },
    { id: 'green', name: '薄い緑', bg: '#d4e8d9', fg: '#1d5c33' },
    { id: 'blue', name: '薄い青', bg: '#d6e4f7', fg: '#1d4e89' },
    { id: 'purple', name: '薄い紫', bg: '#e6dcf3', fg: '#563387' },
    { id: 'gray', name: '薄いグレー', bg: '#e7e9e7', fg: '#4c554f' }
  ];

  function colorById(id) {
    for (var i = 0; i < COLORS.length; i++) if (COLORS[i].id === id) return COLORS[i];
    return COLORS[0];
  }

  var CATEGORIES = [
    { id: 'text', label: '文字・キーワード', bg: '#f7ecd9' },
    { id: 'row', label: '行全体の色付け', bg: '#e3efe7' },
    { id: 'number', label: '数値', bg: '#e7ecf6' },
    { id: 'date', label: '日付・期限', bg: '#f6e7e2' },
    { id: 'other', label: 'その他の定番', bg: '#eee9f6' }
  ];

  /* ============================================================
     サンプル生成のユーティリティ
     ============================================================ */

  // rows: [[cell, cell, ...], match] 形式から preview 用の構造を作る
  function cellRows(list) {
    return list.map(function (item) {
      var cells = item[0];
      var match = item[1];
      return {
        cells: cells,
        match: Array.isArray(match) ? match : cells.map(function () { return !!match; })
      };
    });
  }

  function compare(a, op, b) {
    switch (op) {
      case '>=': return a >= b;
      case '>': return a > b;
      case '<=': return a <= b;
      case '<': return a < b;
      case '=': return a === b;
      case '<>': return a !== b;
      default: return false;
    }
  }

  /* ============================================================
     ルール定義
     ============================================================ */

  var RULES = [

    /* ---------- 文字・キーワード ---------- */

    {
      id: 'keyword',
      cat: 'text',
      title: 'キーワードに反応して色を付ける',
      desc: '「至急」を含むセルを赤くする、など。部分一致・完全一致・前方/後方一致が選べます。',
      chip: 'SEARCH',
      color: 'red',
      fields: [
        { name: 'range', type: 'range', label: '適用範囲', def: 'A2:A100' },
        {
          name: 'matchType', type: 'select', label: '一致の種類', def: 'contains',
          options: [
            { value: 'contains', label: '部分一致(含む)' },
            { value: 'equals', label: '完全一致' },
            { value: 'starts', label: '前方一致(で始まる)' },
            { value: 'ends', label: '後方一致(で終わる)' }
          ]
        },
        { name: 'keyword', type: 'text', label: 'キーワード', def: '至急' }
      ],
      validate: function (v) {
        if (String(v.keyword).trim() === '') return 'キーワードを入力してください';
        return null;
      },
      formula: function (v, r) {
        var kw = escQ(v.keyword);
        var c = r.cell;
        var f;
        switch (v.matchType) {
          case 'equals': f = '=' + c + '="' + kw + '"'; break;
          case 'starts': f = '=LEFT(' + c + ',LEN("' + kw + '"))="' + kw + '"'; break;
          case 'ends': f = '=RIGHT(' + c + ',LEN("' + kw + '"))="' + kw + '"'; break;
          default: f = '=ISNUMBER(SEARCH("' + kw + '",' + c + '))';
        }
        return { sheets: f, excel: f };
      },
      notes: [
        { app: 'both', html: 'SEARCH や「=」の比較は英字の大文字と小文字を区別しません。区別したい場合は SEARCH を FIND に、完全一致は <code>EXACT(セル,"値")</code> にします。' },
        { app: 'sheets', html: '部分一致だけなら、条件「テキストに次を含む」でも同じ設定ができます。' },
        { app: 'excel', html: '部分一致だけなら「セルの強調表示ルール」→「文字列」でも設定できます。' }
      ],
      sample: function (v) {
        var kw = v.keyword;
        var sets = {
          contains: [
            [[kw + '：見積書を送付'], true],
            [['定例ミーティング'], false],
            [['障害対応(' + kw + ')'], true],
            [['週報の提出'], false]
          ],
          equals: [
            [[kw], true],
            [['対応中'], false],
            [['保留'], false],
            [[kw], true]
          ],
          starts: [
            [[kw + 'のため休業'], true],
            [['メモ：' + kw], false],
            [[kw + '案件'], true],
            [['その他'], false]
          ],
          ends: [
            [['報告書_' + kw], true],
            [[kw + '_報告書'], false],
            [['議事録_' + kw], true],
            [['メモ'], false]
          ]
        };
        return { head: ['メモ'], rows: cellRows(sets[v.matchType] || sets.contains) };
      }
    },

    {
      id: 'multiKeyword',
      cat: 'text',
      title: '複数のキーワードのいずれかに反応',
      desc: '「至急」「重要」「緊急」のどれかを含むセルに色を付けます。',
      chip: 'REGEXMATCH / OR',
      color: 'red',
      fields: [
        { name: 'range', type: 'range', label: '適用範囲', def: 'A2:A100' },
        {
          name: 'keywords', type: 'text', label: 'キーワード', def: '至急, 重要, 緊急',
          help: 'カンマまたは読点区切りで複数指定'
        }
      ],
      validate: function (v) {
        if (splitKeywords(v.keywords).length === 0) return 'キーワードを 1 つ以上入力してください';
        return null;
      },
      formula: function (v, r) {
        var ws = splitKeywords(v.keywords);
        var c = r.cell;
        var pattern = escQ(ws.map(escRe).join('|'));
        var parts = ws.map(function (w) {
          return 'ISNUMBER(SEARCH("' + escQ(w) + '",' + c + '))';
        });
        return {
          sheets: '=REGEXMATCH(TO_TEXT(' + c + '),"' + pattern + '")',
          excel: '=OR(' + parts.join(',') + ')'
        };
      },
      notes: [
        { app: 'sheets', html: 'REGEXMATCH は正規表現で判定します。英字の大文字小文字を無視するには <code>"(?i)至急|重要"</code> のように先頭へ <code>(?i)</code> を付けます。' },
        { app: 'excel', html: 'SEARCH は英字の大文字小文字を区別しません。' }
      ],
      sample: function (v) {
        var ws = splitKeywords(v.keywords);
        var k1 = ws[0] || '';
        var k2 = ws[1] || ws[0] || '';
        return {
          head: ['メモ'],
          rows: cellRows([
            [[k1 + '：契約書の確認'], true],
            [['雑談メモ'], false],
            [[k2 + '度：高'], true],
            [['来週で OK'], false]
          ])
        };
      }
    },

    /* ---------- 行全体の色付け ---------- */

    {
      id: 'rowByCell',
      cat: 'row',
      title: '特定の列の値で行全体を色付け',
      desc: 'ステータス列が「完了」の行全体をグレーにする、など行単位の色付けの定番です。',
      chip: '$C2="完了"',
      color: 'gray',
      fields: [
        { name: 'range', type: 'range', label: '適用範囲', def: 'A2:C100', help: '行全体を含む範囲' },
        { name: 'column', type: 'column', label: '判定する列', def: 'C' },
        {
          name: 'matchType', type: 'select', label: '一致の種類', def: 'equals',
          options: [
            { value: 'equals', label: '値と等しい' },
            { value: 'contains', label: '値を含む' }
          ]
        },
        { name: 'value', type: 'text', label: '値', def: '完了' }
      ],
      validate: function (v) {
        if (!parseCol(v.column)) return '列は A〜Z の列記号で入力してください';
        if (String(v.value).trim() === '') return '値を入力してください';
        return null;
      },
      formula: function (v, r) {
        var ref = '$' + parseCol(v.column) + r.row;
        var val = escQ(v.value);
        var f = v.matchType === 'contains'
          ? '=ISNUMBER(SEARCH("' + val + '",' + ref + '))'
          : '=' + ref + '="' + val + '"';
        return { sheets: f, excel: f };
      },
      notes: [
        { app: 'both', html: '列だけを <code>$</code> で固定した複合参照(<code>$C2</code>)にするのがポイントです。これで行内のどのセルも同じ列を見て判定されます。' },
        { app: 'both', html: '適用範囲には行全体(例: <code>A2:C100</code>)を指定してください。' }
      ],
      sample: function (v) {
        return {
          head: ['タスク', '担当', 'ステータス'],
          rows: cellRows([
            [['資料作成', '田中', v.value], true],
            [['見積送付', '佐藤', '対応中'], false],
            [['請求処理', '鈴木', v.value], true],
            [['受注登録', '高橋', '未着手'], false]
          ])
        };
      }
    },

    {
      id: 'checkbox',
      cat: 'row',
      title: 'チェックボックスがオンの行を色付け',
      desc: 'チェックを入れた行全体に色を付けて、完了タスクを見える化します。',
      chip: '$A2=TRUE',
      color: 'green',
      fields: [
        { name: 'range', type: 'range', label: '適用範囲', def: 'A2:B100' },
        { name: 'column', type: 'column', label: 'チェックボックスの列', def: 'A' }
      ],
      validate: function (v) {
        if (!parseCol(v.column)) return '列は A〜Z の列記号で入力してください';
        return null;
      },
      formula: function (v, r) {
        var f = '=$' + parseCol(v.column) + r.row + '=TRUE';
        return { sheets: f, excel: f };
      },
      notes: [
        { app: 'sheets', html: 'チェックボックスは「挿入」→「チェックボックス」で作成できます。' },
        { app: 'excel', html: 'Microsoft 365 の「挿入」→「チェックボックス」で動作します。従来のフォームコントロールの場合はリンクされたセルの値で判定してください。' }
      ],
      sample: function () {
        return {
          head: ['✓', 'タスク'],
          rows: cellRows([
            [['☑', '牛乳を買う'], true],
            [['☐', '部屋の掃除'], false],
            [['☑', '請求書の支払い'], true],
            [['☐', 'メール返信'], false]
          ])
        };
      }
    },

    /* ---------- 数値 ---------- */

    {
      id: 'threshold',
      cat: 'number',
      title: '数値がしきい値を超えたら色付け',
      desc: '在庫が 10 以下で赤、売上が 100 以上で緑など、数値の大小で判定します。',
      chip: '>= <=',
      color: 'green',
      fields: [
        { name: 'range', type: 'range', label: '適用範囲', def: 'A2:A100' },
        {
          name: 'op', type: 'select', label: '条件', def: '>=',
          options: [
            { value: '>=', label: '以上' },
            { value: '>', label: 'より大きい' },
            { value: '<=', label: '以下' },
            { value: '<', label: 'より小さい' },
            { value: '=', label: '等しい' },
            { value: '<>', label: '等しくない' }
          ]
        },
        { name: 'value', type: 'number', label: 'しきい値', def: 100 }
      ],
      validate: function (v) {
        if (isNaN(toNum(v.value))) return '数値を入力してください';
        return null;
      },
      formula: function (v, r) {
        var c = r.cell;
        var n = toNum(v.value);
        var guard = (v.op === '<' || v.op === '<=' || v.op === '<>');
        var f = guard
          ? '=AND(ISNUMBER(' + c + '),' + c + v.op + n + ')'
          : '=' + c + v.op + n;
        return { sheets: f, excel: f };
      },
      notes: [
        { app: 'both', html: '「以下」「より小さい」「等しくない」は空白セルまで色が付いてしまうため、ISNUMBER で数値かどうかを確認しています。' },
        { app: 'sheets', html: '標準の条件「以上」「次より大きい」でも設定できます。' },
        { app: 'excel', html: '「セルの強調表示ルール」でも同様の設定ができます。' }
      ],
      sample: function (v) {
        var n = toNum(v.value);
        var values = [120, 85, 100, 47, 230];
        return {
          head: ['売上'],
          numCols: [0],
          rows: cellRows(values.map(function (x) {
            return [[String(x)], compare(x, v.op, n)];
          }))
        };
      }
    },

    {
      id: 'between',
      cat: 'number',
      title: '数値が範囲内なら色付け',
      desc: '50 以上 100 以下のセルだけに色を付けます。範囲外の検出にも応用できます。',
      chip: 'AND',
      color: 'green',
      fields: [
        { name: 'range', type: 'range', label: '適用範囲', def: 'A2:A100' },
        { name: 'min', type: 'number', label: '下限', def: 50 },
        { name: 'max', type: 'number', label: '上限', def: 100 }
      ],
      validate: function (v) {
        var mn = toNum(v.min);
        var mx = toNum(v.max);
        if (isNaN(mn) || isNaN(mx)) return '数値を入力してください';
        if (mn > mx) return '下限が上限を超えています';
        return null;
      },
      formula: function (v, r) {
        var c = r.cell;
        var mn = toNum(v.min);
        var mx = toNum(v.max);
        var f = mn <= 0
          ? '=AND(ISNUMBER(' + c + '),' + c + '>=' + mn + ',' + c + '<=' + mx + ')'
          : '=AND(' + c + '>=' + mn + ',' + c + '<=' + mx + ')';
        return { sheets: f, excel: f };
      },
      notes: [
        { app: 'both', html: '「範囲外」に色を付けたい場合は <code>=OR(A2&lt;50,A2&gt;100)</code> のように OR と逆向きの不等号にします(空白除外には ISNUMBER を追加)。' }
      ],
      sample: function (v) {
        var mn = toNum(v.min);
        var mx = toNum(v.max);
        var values = [72, 38, 95, 100, 12];
        return {
          head: ['点数'],
          numCols: [0],
          rows: cellRows(values.map(function (x) {
            return [[String(x)], x >= mn && x <= mx];
          }))
        };
      }
    },

    /* ---------- 日付・期限 ---------- */

    {
      id: 'overdue',
      cat: 'date',
      title: '期限切れの日付を色付け',
      desc: '今日より前の日付(期限切れ)に色を付けます。開くたびに自動で更新されます。',
      chip: 'TODAY()',
      color: 'red',
      fields: [
        { name: 'range', type: 'range', label: '適用範囲', def: 'A2:A100' },
        {
          name: 'includeToday', type: 'select', label: '今日の扱い', def: 'no',
          options: [
            { value: 'no', label: '今日は含めない' },
            { value: 'yes', label: '今日も含める' }
          ]
        }
      ],
      formula: function (v, r) {
        var c = r.cell;
        var op = v.includeToday === 'yes' ? '<=' : '<';
        var f = '=AND(' + c + '<>"",' + c + op + 'TODAY())';
        return { sheets: f, excel: f };
      },
      notes: [
        { app: 'both', html: '空白セルに色が付かないよう <code>A2&lt;&gt;""</code> を入れています。' },
        { app: 'both', html: 'セルには日付として認識される値が必要です(文字列の日付は判定されません)。' }
      ],
      sample: function (v) {
        var withToday = v.includeToday === 'yes';
        var offsets = [-5, 2, -1, 0, 14];
        return {
          head: ['締切日'],
          rows: cellRows(offsets.map(function (n) {
            var m = n < 0 || (n === 0 && withToday);
            return [[fmtDate(addDays(n))], m];
          }))
        };
      }
    },

    {
      id: 'dueSoon',
      cat: 'date',
      title: '期限が近い日付を色付け',
      desc: '今日から N 日以内の日付に色を付けて、締切前に気付けるようにします。',
      chip: 'TODAY()+N',
      color: 'yellow',
      fields: [
        { name: 'range', type: 'range', label: '適用範囲', def: 'A2:A100' },
        { name: 'days', type: 'number', label: '何日以内', def: 7 }
      ],
      validate: function (v) {
        var d = toNum(v.days);
        if (isNaN(d) || d < 0) return '0 以上の数値を入力してください';
        return null;
      },
      formula: function (v, r) {
        var c = r.cell;
        var d = toNum(v.days);
        var f = '=AND(' + c + '>=TODAY(),' + c + '<=TODAY()+' + d + ')';
        return { sheets: f, excel: f };
      },
      notes: [
        { app: 'both', html: '期限切れ(過去)も目立たせたい場合は「期限切れの日付を色付け」ルールを別途追加してください。条件付き書式のルールは同じ範囲に複数併用できます。' }
      ],
      sample: function (v) {
        var d = toNum(v.days);
        if (isNaN(d)) d = 0;
        var offsets = [1, Math.max(1, d - 1), d + 7, -3];
        return {
          head: ['締切日'],
          rows: cellRows(offsets.map(function (n) {
            return [[fmtDate(addDays(n))], n >= 0 && n <= d];
          }))
        };
      }
    },

    {
      id: 'weekend',
      cat: 'date',
      title: '土日の日付を色付け',
      desc: 'スケジュール表の土曜・日曜に自動で色を付けます。',
      chip: 'WEEKDAY',
      color: 'red',
      fields: [
        { name: 'range', type: 'range', label: '適用範囲', def: 'A2:A100' },
        {
          name: 'target', type: 'select', label: '対象', def: 'both',
          options: [
            { value: 'both', label: '土日' },
            { value: 'sat', label: '土曜のみ' },
            { value: 'sun', label: '日曜のみ' }
          ]
        }
      ],
      formula: function (v, r) {
        var c = r.cell;
        var cond = v.target === 'sat' ? '=6' : (v.target === 'sun' ? '=7' : '>=6');
        var f = '=AND(' + c + '<>"",WEEKDAY(' + c + ',2)' + cond + ')';
        return { sheets: f, excel: f };
      },
      notes: [
        { app: 'both', html: '<code>WEEKDAY(セル,2)</code> は月曜=1〜日曜=7 を返します。空白セルは除外しています。' },
        { app: 'both', html: '祝日にも色を付けたい場合は、祝日一覧の範囲を用意して COUNTIF と組み合わせます。' }
      ],
      sample: function (v) {
        var today = new Date();
        var mondayOffset = -((today.getDay() + 6) % 7);
        var rows = [];
        for (var i = 0; i < 7; i++) {
          var d = addDays(mondayOffset + i);
          var day = d.getDay();
          var m = v.target === 'sat' ? day === 6
            : (v.target === 'sun' ? day === 0 : (day === 6 || day === 0));
          rows.push([[fmtDate(d) + '(' + WEEKDAY_NAMES[day] + ')'], m]);
        }
        return { head: ['日付'], rows: cellRows(rows) };
      }
    },

    /* ---------- その他の定番 ---------- */

    {
      id: 'blank',
      cat: 'other',
      title: '空白セル(未入力)を色付け',
      desc: '入力漏れのセルに色を付けます。「入力済みセル」への色付けにも切り替えられます。',
      chip: '=""',
      color: 'yellow',
      fields: [
        { name: 'range', type: 'range', label: '適用範囲', def: 'A2:A100' },
        {
          name: 'mode', type: 'select', label: '対象', def: 'blank',
          options: [
            { value: 'blank', label: '空白のセル' },
            { value: 'filled', label: '空白でないセル' }
          ]
        }
      ],
      formula: function (v, r) {
        var f = v.mode === 'filled' ? '=' + r.cell + '<>""' : '=' + r.cell + '=""';
        return { sheets: f, excel: f };
      },
      notes: [
        { app: 'both', html: '<code>ISBLANK(セル)</code> でも判定できますが、数式が返す空文字("")は空白扱いになりません。<code>=セル=""</code> の書き方が実用的です。' },
        { app: 'sheets', html: '標準の条件「空白」「空白ではない」でも設定できます。' }
      ],
      sample: function (v) {
        var values = ['田中', '', '佐藤', ''];
        var filled = v.mode === 'filled';
        return {
          head: ['担当者'],
          rows: cellRows(values.map(function (x) {
            return [[x], filled ? x !== '' : x === ''];
          }))
        };
      }
    },

    {
      id: 'duplicate',
      cat: 'other',
      title: '重複しているデータを色付け',
      desc: '同じ値が 2 回以上出てくるセルに色を付けます。名簿やメール一覧の重複チェックに。',
      chip: 'COUNTIF',
      color: 'red',
      fields: [
        { name: 'range', type: 'range', label: '適用範囲', def: 'A2:A100' },
        {
          name: 'mode', type: 'select', label: '対象', def: 'all',
          options: [
            { value: 'all', label: '重複しているすべてのセル' },
            { value: 'second', label: '2 個目以降のセルだけ' }
          ]
        }
      ],
      formula: function (v, r) {
        var c = r.cell;
        var f = v.mode === 'second'
          ? '=AND(' + c + '<>"",COUNTIF($' + r.col + '$' + r.row + ':' + c + ',' + c + ')>1)'
          : '=AND(' + c + '<>"",COUNTIF(' + r.abs + ',' + c + ')>1)';
        return { sheets: f, excel: f };
      },
      notes: [
        { app: 'both', html: '空白セル同士が重複と判定されないよう空白を除外しています。' },
        { app: 'both', html: '数式内の範囲は適用範囲から自動で作られています。適用範囲を変えると数式も変わります。' }
      ],
      sample: function (v) {
        var values = [
          'sato@example.com',
          'tanaka@example.com',
          'sato@example.com',
          'suzuki@example.com',
          'tanaka@example.com'
        ];
        var second = v.mode === 'second';
        return {
          head: ['メール'],
          rows: cellRows(values.map(function (x, i) {
            var m;
            if (second) {
              m = values.slice(0, i + 1).filter(function (y) { return y === x; }).length > 1;
            } else {
              m = values.filter(function (y) { return y === x; }).length > 1;
            }
            return [[x], m];
          }))
        };
      }
    },

    {
      id: 'stripes',
      cat: 'other',
      title: '1 行おきに色を付ける(縞模様)',
      desc: '大きな表を読みやすくするゼブラ模様。行を増減しても縞が崩れません。',
      chip: 'MOD(ROW(),2)',
      color: 'gray',
      fields: [
        { name: 'range', type: 'range', label: '適用範囲', def: 'A2:C100' },
        {
          name: 'mode', type: 'select', label: '対象の行', def: 'even',
          options: [
            { value: 'even', label: '偶数行' },
            { value: 'odd', label: '奇数行' }
          ]
        }
      ],
      formula: function (v) {
        var f = '=MOD(ROW(),2)=' + (v.mode === 'odd' ? '1' : '0');
        return { sheets: f, excel: f };
      },
      notes: [
        { app: 'sheets', html: 'メニュー「表示形式」→「交互の背景色」でも同様の見た目にできます。' },
        { app: 'excel', html: '表全体なら「テーブルとして書式設定」を使う方法もあります。' }
      ],
      sample: function (v, r) {
        var data = [
          ['4/1', '文具', '1,200'],
          ['4/3', '交通費', '860'],
          ['4/5', '会議費', '3,400'],
          ['4/8', '消耗品', '540']
        ];
        var want = v.mode === 'odd' ? 1 : 0;
        return {
          head: ['日付', '項目', '金額'],
          rows: cellRows(data.map(function (cells, i) {
            return [cells, (r.row + i) % 2 === want];
          }))
        };
      }
    },

    {
      id: 'inList',
      cat: 'other',
      title: '別のリストにある値を色付け',
      desc: 'NG ワードや会員名簿など、別の場所に用意したリストと一致するセルに色を付けます。',
      chip: 'COUNTIF + INDIRECT',
      color: 'blue',
      fields: [
        { name: 'range', type: 'range', label: '適用範囲', def: 'A2:A100' },
        {
          name: 'listRange', type: 'range', label: 'リストの範囲', def: 'E2:E10',
          help: '同じシート内の範囲。別シートは シート名!A2:A10 の形式'
        }
      ],
      validate: function (v) {
        if (!parseListRange(v.listRange)) return 'リストの範囲を A2:A10 の形式で入力してください';
        return null;
      },
      formula: function (v, r) {
        var c = r.cell;
        var list = parseListRange(v.listRange);
        var refSheets, refExcel;
        if (list.sheet) {
          refSheets = 'INDIRECT("' + escQ(list.sheet + '!' + list.abs) + '")';
          refExcel = list.sheet + '!' + list.abs;
        } else {
          refSheets = list.abs;
          refExcel = list.abs;
        }
        return {
          sheets: '=AND(' + c + '<>"",COUNTIF(' + refSheets + ',' + c + ')>0)',
          excel: '=AND(' + c + '<>"",COUNTIF(' + refExcel + ',' + c + ')>0)'
        };
      },
      notes: [
        { app: 'sheets', html: 'カスタム数式から別シートを直接参照できないため、<code>INDIRECT("シート名!範囲")</code> を使います。' },
        { app: 'excel', html: '最近の Excel は別シート参照をそのまま書けます(Excel 2007 以前は名前付き範囲が必要でした)。' }
      ],
      sample: function () {
        return {
          head: ['商品'],
          rows: cellRows([
            [['りんご'], true],
            [['みかん'], false],
            [['バナナ'], true],
            [['ぶどう'], false]
          ])
        };
      }
    }
  ];

  // リストの範囲(別シート対応)をパースする。
  // シート名はユーザーの入力どおりに保つ('シート名' の引用符もそのまま)
  function parseListRange(str) {
    var s = String(str == null ? '' : str).trim();
    if (s === '') return null;
    var i = s.lastIndexOf('!');
    if (i === -1) {
      var only = parseRange(s);
      return only ? { sheet: null, abs: only.abs } : null;
    }
    var sheet = s.slice(0, i).trim();
    var parsed = parseRange(s.slice(i + 1));
    if (!sheet || !parsed) return null;
    return { sheet: sheet, abs: parsed.abs };
  }

  function ruleById(id) {
    for (var i = 0; i < RULES.length; i++) if (RULES[i].id === id) return RULES[i];
    return null;
  }

  /* ============================================================
     状態
     ============================================================ */

  var STORAGE_KEY = 'cfgen-app';

  var state = { app: 'sheets', ruleId: null, values: {} };

  function loadApp() {
    try {
      var saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'sheets' || saved === 'excel') state.app = saved;
    } catch (e) { /* localStorage が使えない環境は既定値のまま */ }
  }

  function saveApp() {
    try {
      window.localStorage.setItem(STORAGE_KEY, state.app);
    } catch (e) { /* 保存できなくても動作は継続 */ }
  }

  /* ============================================================
     DOM 参照
     ============================================================ */

  var groupsEl = document.getElementById('pattern-groups');
  var configEl = document.getElementById('config');
  var resultEl = document.getElementById('result');
  var ruleTitleEl = document.getElementById('config-rule-title');
  var formEl = document.getElementById('config-form');
  var formulaLabelEl = document.getElementById('formula-label');
  var formulaOutEl = document.getElementById('formula-output');
  var formulaErrEl = document.getElementById('formula-error');
  var copyBtn = document.getElementById('copy-btn');
  var stepsTitleEl = document.getElementById('steps-title');
  var stepsListEl = document.getElementById('steps-list');
  var previewEl = document.getElementById('preview');
  var notesCardEl = document.getElementById('notes-card');
  var notesListEl = document.getElementById('notes-list');
  var appButtons = Array.prototype.slice.call(document.querySelectorAll('.app-toggle button[data-app]'));

  var currentFormula = '';

  /* ============================================================
     カード一覧
     ============================================================ */

  function renderCards() {
    clearEl(groupsEl);
    CATEGORIES.forEach(function (cat) {
      var rules = RULES.filter(function (r) { return r.cat === cat.id; });
      if (!rules.length) return;

      var group = document.createElement('div');
      group.className = 'pattern-group';

      var title = document.createElement('span');
      title.className = 'pattern-group-title';
      title.style.background = cat.bg;
      title.textContent = cat.label;
      group.appendChild(title);

      var cards = document.createElement('div');
      cards.className = 'pattern-cards';

      rules.forEach(function (rule) {
        var card = document.createElement('button');
        card.type = 'button';
        card.className = 'pattern-card';
        card.setAttribute('data-rule', rule.id);

        var h3 = document.createElement('h3');
        h3.textContent = rule.title;
        card.appendChild(h3);

        var p = document.createElement('p');
        p.textContent = rule.desc;
        card.appendChild(p);

        var chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = rule.chip;
        card.appendChild(chip);

        card.addEventListener('click', function () { selectRule(rule.id); });
        cards.appendChild(card);
      });

      group.appendChild(cards);
      groupsEl.appendChild(group);
    });
  }

  function markSelectedCard() {
    var cards = groupsEl.querySelectorAll('.pattern-card');
    Array.prototype.forEach.call(cards, function (card) {
      if (card.getAttribute('data-rule') === state.ruleId) card.classList.add('selected');
      else card.classList.remove('selected');
    });
  }

  /* ============================================================
     フォーム
     ============================================================ */

  function buildField(field) {
    var wrap = document.createElement('div');
    wrap.className = 'field';

    var id = 'field-' + field.name;
    var label = document.createElement('label');
    label.setAttribute('for', id);
    label.textContent = field.label;
    wrap.appendChild(label);

    var input;
    if (field.type === 'select') {
      input = document.createElement('select');
      field.options.forEach(function (opt) {
        var o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        input.appendChild(o);
      });
      input.value = state.values[field.name];
    } else if (field.type === 'number') {
      input = document.createElement('input');
      input.type = 'number';
      input.value = String(state.values[field.name]);
    } else {
      input = document.createElement('input');
      input.type = 'text';
      if (field.type === 'range' || field.type === 'column') input.className = 'mono';
      if (field.type === 'column') input.setAttribute('maxlength', '3');
      input.value = String(state.values[field.name]);
    }
    input.id = id;
    input.setAttribute('data-field', field.name);
    wrap.appendChild(input);

    if (field.help) {
      var help = document.createElement('p');
      help.className = 'help';
      help.textContent = field.help;
      wrap.appendChild(help);
    }
    return wrap;
  }

  function buildPalette() {
    var wrap = document.createElement('div');
    wrap.className = 'field field-wide';

    var label = document.createElement('label');
    label.textContent = '書式の色';
    wrap.appendChild(label);

    var palette = document.createElement('div');
    palette.className = 'palette';

    COLORS.forEach(function (color) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch';
      btn.style.background = color.bg;
      btn.style.color = color.fg;
      btn.textContent = 'A';
      btn.title = color.name;
      btn.setAttribute('aria-label', color.name);
      btn.setAttribute('data-color', color.id);
      btn.setAttribute('aria-pressed', state.values.color === color.id ? 'true' : 'false');
      btn.addEventListener('click', function () {
        state.values.color = color.id;
        Array.prototype.forEach.call(palette.querySelectorAll('.swatch'), function (s) {
          s.setAttribute('aria-pressed', s.getAttribute('data-color') === color.id ? 'true' : 'false');
        });
        renderResult();
      });
      palette.appendChild(btn);
    });

    wrap.appendChild(palette);
    return wrap;
  }

  function renderForm(rule) {
    clearEl(formEl);
    rule.fields.forEach(function (field) {
      formEl.appendChild(buildField(field));
    });
    formEl.appendChild(buildPalette());
  }

  /* ============================================================
     結果の描画
     ============================================================ */

  function renderFormula(rule, v, r, error) {
    formulaLabelEl.textContent = state.app === 'sheets' ? 'カスタム数式' : '数式(新しい書式ルール)';
    if (error) {
      currentFormula = '';
      formulaOutEl.textContent = '—';
      formulaErrEl.textContent = error;
      formulaErrEl.classList.remove('hidden');
      return;
    }
    currentFormula = rule.formula(v, r)[state.app];
    formulaOutEl.textContent = currentFormula;
    formulaErrEl.textContent = '';
    formulaErrEl.classList.add('hidden');
  }

  function renderSteps(rangeText, color) {
    var swatch = '<span class="color-inline" style="background:' + color.bg + '"></span>' + escHtml(color.name);
    var range = '<code>' + escHtml(rangeText) + '</code>';
    var items;

    if (state.app === 'sheets') {
      stepsTitleEl.textContent = 'Google スプレッドシートでの設定手順';
      items = [
        '対象の範囲 ' + range + ' を選択します。',
        'メニューの<span class="ui-name">「表示形式」→「条件付き書式」</span>を開きます。',
        '「セルの書式設定の条件…」で<span class="ui-name">「カスタム数式」</span>を選択します。',
        '数式欄に上の数式を貼り付けます。',
        '「書式設定のスタイル」で塗りつぶしの色(' + swatch + ')を選び、<span class="ui-name">「完了」</span>を押します。'
      ];
    } else {
      stepsTitleEl.textContent = 'Excel での設定手順';
      items = [
        '対象の範囲 ' + range + ' を選択します。',
        '<span class="ui-name">「ホーム」タブ →「条件付き書式」→「新しいルール」</span>をクリックします。',
        '<span class="ui-name">「数式を使用して、書式設定するセルを決定」</span>を選択します。',
        '「次の数式を満たす場合に値を書式設定」に上の数式を貼り付けます。',
        '<span class="ui-name">「書式」</span>ボタン →「塗りつぶし」タブで色(' + swatch + ')を選び、OK で閉じます。'
      ];
    }

    clearEl(stepsListEl);
    items.forEach(function (html) {
      var li = document.createElement('li');
      li.innerHTML = html;
      stepsListEl.appendChild(li);
    });
  }

  function renderPreview(rule, v, r, color, error) {
    clearEl(previewEl);
    if (error || !r) return;

    var s = rule.sample(v, r);
    var numCols = s.numCols || [];
    var startIdx = colToIdx(r.col);

    var table = document.createElement('table');

    var thead = document.createElement('thead');
    var headTr = document.createElement('tr');
    headTr.appendChild(document.createElement('th'));
    s.head.forEach(function (_, i) {
      var th = document.createElement('th');
      th.textContent = idxToCol(startIdx + i);
      headTr.appendChild(th);
    });
    thead.appendChild(headTr);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');

    if (r.row >= 2) {
      var hr = document.createElement('tr');
      var hrNo = document.createElement('th');
      hrNo.textContent = String(r.row - 1);
      hr.appendChild(hrNo);
      s.head.forEach(function (label) {
        var td = document.createElement('td');
        td.className = 'head-row';
        td.textContent = label;
        hr.appendChild(td);
      });
      tbody.appendChild(hr);
    }

    s.rows.forEach(function (row, i) {
      var tr = document.createElement('tr');
      var no = document.createElement('th');
      no.textContent = String(r.row + i);
      tr.appendChild(no);
      row.cells.forEach(function (cell, j) {
        var td = document.createElement('td');
        if (numCols.indexOf(j) !== -1) td.className = 'num';
        td.textContent = cell;
        if (row.match[j]) {
          td.style.background = color.bg;
          td.style.color = color.fg;
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    previewEl.appendChild(table);
  }

  function renderNotes(rule) {
    var notes = (rule.notes || []).filter(function (n) {
      return n.app === 'both' || n.app === state.app;
    });
    clearEl(notesListEl);
    if (!notes.length) {
      notesCardEl.classList.add('hidden');
      return;
    }
    notes.forEach(function (n) {
      var li = document.createElement('li');
      li.innerHTML = n.html;
      notesListEl.appendChild(li);
    });
    notesCardEl.classList.remove('hidden');
  }

  function renderResult() {
    var rule = ruleById(state.ruleId);
    if (!rule) return;

    var v = state.values;
    var r = parseRange(v.range);
    var color = colorById(v.color);
    var error = null;

    if (!r) error = '適用範囲を A2:A100 の形式で入力してください';
    else if (rule.validate) error = rule.validate(v, r);

    renderFormula(rule, v, r, error);
    renderSteps(r ? r.text : String(v.range == null ? '' : v.range), color);
    renderPreview(rule, v, r, color, error);
    renderNotes(rule);
  }

  /* ============================================================
     ルール選択
     ============================================================ */

  function selectRule(id) {
    var rule = ruleById(id);
    if (!rule) return;

    if (state.ruleId !== id) {
      state.ruleId = id;
      state.values = {};
      rule.fields.forEach(function (f) { state.values[f.name] = f.def; });
      state.values.color = rule.color;

      markSelectedCard();
      ruleTitleEl.textContent = rule.title;
      renderForm(rule);
      renderResult();
    }

    configEl.classList.remove('hidden');
    resultEl.classList.remove('hidden');
    configEl.scrollIntoView({ behavior: 'smooth' });
  }

  /* ============================================================
     コピー
     ============================================================ */

  var copyTimer = null;

  function flashCopied() {
    copyBtn.textContent = 'コピーしました ✓';
    copyBtn.classList.add('copied');
    if (copyTimer) window.clearTimeout(copyTimer);
    copyTimer = window.setTimeout(function () {
      copyBtn.textContent = 'コピー';
      copyBtn.classList.remove('copied');
    }, 1600);
  }

  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }

  function copyFormula() {
    if (!currentFormula) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(currentFormula).then(flashCopied, function () {
        if (legacyCopy(currentFormula)) flashCopied();
      });
    } else if (legacyCopy(currentFormula)) {
      flashCopied();
    }
  }

  /* ============================================================
     イベント / 初期化
     ============================================================ */

  function onFormChange(e) {
    var name = e.target && e.target.getAttribute && e.target.getAttribute('data-field');
    if (!name) return;
    state.values[name] = e.target.value;
    renderResult();
  }

  function setApp(app) {
    if (app !== 'sheets' && app !== 'excel') return;
    state.app = app;
    saveApp();
    appButtons.forEach(function (btn) {
      btn.setAttribute('aria-selected', btn.getAttribute('data-app') === app ? 'true' : 'false');
    });
    if (state.ruleId) renderResult();
  }

  function init() {
    loadApp();
    appButtons.forEach(function (btn) {
      btn.addEventListener('click', function () { setApp(btn.getAttribute('data-app')); });
    });
    setApp(state.app);

    formEl.addEventListener('submit', function (e) { e.preventDefault(); });
    formEl.addEventListener('input', onFormChange);
    formEl.addEventListener('change', onFormChange);
    copyBtn.addEventListener('click', copyFormula);

    renderCards();
  }

  init();

})();
