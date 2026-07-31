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
    var endCol = m[3] || m[1];
    var startIdx = colToIdx(m[1]);
    var endIdx = colToIdx(endCol);
    return {
      text: text,
      col: m[1],
      endCol: endCol,
      colCount: Math.abs(endIdx - startIdx) + 1,
      colStep: endIdx >= startIdx ? 1 : -1,
      row: row,
      cell: m[1] + row,
      abs: absRange(text)
    };
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
  var WEEKDAYS = [
    { value: '1', label: '月' },
    { value: '2', label: '火' },
    { value: '3', label: '水' },
    { value: '4', label: '木' },
    { value: '5', label: '金' },
    { value: '6', label: '土' },
    { value: '7', label: '日' }
  ];

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function parseIsoDate(value) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value == null ? '' : value));
    if (!m) return null;
    var year = Number(m[1]);
    var month = Number(m[2]);
    var day = Number(m[3]);
    var date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return { year: year, month: month, day: day, date: date };
  }

  function dateExpr(value) {
    var parsed = parseIsoDate(value);
    return parsed ? 'DATE(' + parsed.year + ',' + parsed.month + ',' + parsed.day + ')' : '';
  }

  function parseClock(value) {
    var m = /^(\d{2}):(\d{2})$/.exec(String(value == null ? '' : value));
    if (!m) return null;
    var hour = Number(m[1]);
    var minute = Number(m[2]);
    if (hour > 23 || minute > 59) return null;
    return { hour: hour, minute: minute, total: hour * 60 + minute };
  }

  function timeExpr(value) {
    var parsed = parseClock(value);
    return parsed ? 'TIME(' + parsed.hour + ',' + parsed.minute + ',0)' : '';
  }

  function sameDate(a, b) {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }

  function startOfDay(date) {
    var copy = new Date(date.getTime());
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  function cloneValue(value) {
    if (Array.isArray(value)) return value.map(cloneValue);
    if (value && typeof value === 'object') {
      var copy = {};
      Object.keys(value).forEach(function (key) { copy[key] = cloneValue(value[key]); });
      return copy;
    }
    return value;
  }

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

  var NAV_GROUPS = [
    {
      label: '値を見て判定',
      bg: '#f7ecd9',
      items: [
        {
          id: 'text',
          label: '文字・キーワード',
          summary: '1つ・複数・行全体',
          variants: [
            { ruleId: 'keyword', label: 'キーワード（1つ）' },
            { ruleId: 'multiKeyword', label: 'キーワード（複数）' },
            { ruleId: 'rowByCell', label: '列の値で行全体' }
          ]
        },
        {
          id: 'number',
          label: '数値',
          summary: 'しきい値・範囲',
          variants: [
            { ruleId: 'threshold', label: 'しきい値と比較' },
            { ruleId: 'between', label: '範囲内' }
          ]
        },
        {
          id: 'date',
          label: '日時',
          summary: '日付・時刻・曜日・営業日',
          variantLabel: 'プリセット / 自由設定',
          variants: [
            { ruleId: 'overdue', label: '期限切れ' },
            { ruleId: 'dueSoon', label: '期限が近い' },
            { ruleId: 'weekend', label: '曜日を指定' },
            { ruleId: 'datetime', label: '条件を組み合わせる' }
          ]
        },
        { id: 'blank', label: '空白', summary: '未入力・入力済み', ruleId: 'blank' }
      ]
    },
    {
      label: '表・リストで判定',
      bg: '#e3efe7',
      items: [
        { id: 'checkbox', label: 'チェックボックス', summary: 'オンの行をまとめて', ruleId: 'checkbox' },
        { id: 'duplicate', label: '重複', summary: 'すべて・2件目以降', ruleId: 'duplicate' },
        { id: 'stripes', label: '交互の背景色', summary: '偶数行・奇数行', ruleId: 'stripes' },
        { id: 'inList', label: '別リストとの一致', summary: '別範囲と照合', ruleId: 'inList' }
      ]
    }
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

  var conditionIdCounter = 1;

  function nextConditionId() {
    conditionIdCounter += 1;
    return 'condition-' + conditionIdCounter;
  }

  function makeDatetimeCondition(type, id) {
    var base = { id: id || nextConditionId(), type: type, negate: false };
    if (type === 'weekday') {
      base.days = ['1', '2', '3', '4', '5'];
    } else if (type === 'time') {
      base.operator = 'between';
      base.startTime = '09:00';
      base.endTime = '17:00';
      base.time = '17:00';
      base.amount = 2;
    } else if (type === 'business') {
      base.operator = 'business';
      base.offDays = ['6', '7'];
      base.holidayRange = '';
      base.days = 5;
    } else {
      base.type = 'date';
      base.operator = 'nextDays';
      base.days = 14;
      base.date = '';
      base.startDate = '';
      base.endDate = '';
    }
    return base;
  }

  function isWholeNonNegative(value) {
    var number = toNum(value);
    return !isNaN(number) && number >= 0 && Math.floor(number) === number;
  }

  function weekdayMask(days) {
    var selected = Array.isArray(days) ? days : [];
    return WEEKDAYS.map(function (day) {
      return selected.indexOf(day.value) !== -1 ? '1' : '0';
    }).join('');
  }

  function listRefForApp(value, app) {
    var list = parseListRange(value);
    if (!list) return '';
    if (!list.sheet) return list.abs;
    return app === 'sheets'
      ? 'INDIRECT("' + escQ(list.sheet + '!' + list.abs) + '")'
      : list.sheet + '!' + list.abs;
  }

  function businessFunction(name, cell, condition, app) {
    var rangeRef = String(condition.holidayRange == null ? '' : condition.holidayRange).trim()
      ? listRefForApp(condition.holidayRange, app)
      : '';
    var args = name === 'WORKDAY.INTL'
      ? ['TODAY()', String(toNum(condition.days)), '"' + weekdayMask(condition.offDays) + '"']
      : ['INT(' + cell + ')', 'INT(' + cell + ')', '"' + weekdayMask(condition.offDays) + '"'];
    if (rangeRef) args.push(rangeRef);
    return name + '(' + args.join(',') + ')';
  }

  function datetimePredicate(condition, cell, app) {
    var op = condition.operator;

    if (condition.type === 'weekday') {
      var parts = (condition.days || []).map(function (day) {
        return 'WEEKDAY(INT(' + cell + '),2)=' + day;
      });
      return parts.length === 1 ? parts[0] : 'OR(' + parts.join(',') + ')';
    }

    if (condition.type === 'time') {
      if (op === 'nextHours') {
        return 'AND(' + cell + '>=NOW(),' + cell + '<=NOW()+' + toNum(condition.amount) + '/24)';
      }
      if (op === 'nextMinutes') {
        return 'AND(' + cell + '>=NOW(),' + cell + '<=NOW()+' + toNum(condition.amount) + '/1440)';
      }
      if (op === 'before') return 'MOD(' + cell + ',1)<' + timeExpr(condition.time);
      if (op === 'after') return 'MOD(' + cell + ',1)>' + timeExpr(condition.time);
      var start = parseClock(condition.startTime);
      var end = parseClock(condition.endTime);
      var startFormula = timeExpr(condition.startTime);
      var endFormula = timeExpr(condition.endTime);
      if (start && end && start.total > end.total) {
        return 'OR(MOD(' + cell + ',1)>=' + startFormula + ',MOD(' + cell + ',1)<=' + endFormula + ')';
      }
      return 'AND(MOD(' + cell + ',1)>=' + startFormula + ',MOD(' + cell + ',1)<=' + endFormula + ')';
    }

    if (condition.type === 'business') {
      var holidayRef = String(condition.holidayRange == null ? '' : condition.holidayRange).trim()
        ? listRefForApp(condition.holidayRange, app)
        : '';
      if (op === 'holiday') return 'COUNTIF(' + holidayRef + ',INT(' + cell + '))>0';
      var networkdays = businessFunction('NETWORKDAYS.INTL', cell, condition, app);
      if (op === 'business') return networkdays + '=1';
      if (op === 'nonbusiness') return networkdays + '=0';
      return 'AND(INT(' + cell + ')>=TODAY(),INT(' + cell + ')<='
        + businessFunction('WORKDAY.INTL', cell, condition, app) + ',' + networkdays + '=1)';
    }

    if (op === 'today') return 'INT(' + cell + ')=TODAY()';
    if (op === 'yesterday') return 'INT(' + cell + ')=TODAY()-1';
    if (op === 'tomorrow') return 'INT(' + cell + ')=TODAY()+1';
    if (op === 'past') return 'INT(' + cell + ')<TODAY()';
    if (op === 'future') return 'INT(' + cell + ')>TODAY()';
    if (op === 'nextDays') {
      return 'AND(INT(' + cell + ')>=TODAY(),INT(' + cell + ')<=TODAY()+' + toNum(condition.days) + ')';
    }
    if (op === 'pastDays') {
      return 'AND(INT(' + cell + ')>=TODAY()-' + toNum(condition.days)
        + ',INT(' + cell + ')<=TODAY())';
    }
    if (op === 'onDate') return 'INT(' + cell + ')=' + dateExpr(condition.date);
    if (op === 'onOrBefore') return 'INT(' + cell + ')<=' + dateExpr(condition.date);
    if (op === 'onOrAfter') return 'INT(' + cell + ')>=' + dateExpr(condition.date);
    return 'AND(INT(' + cell + ')>=' + dateExpr(condition.startDate)
      + ',INT(' + cell + ')<=' + dateExpr(condition.endDate) + ')';
  }

  function datetimeFormula(values, range) {
    var conditions = values.conditions || [];

    function forApp(app) {
      var predicates = conditions.map(function (condition) {
        var predicate = datetimePredicate(condition, range.cell, app);
        return condition.negate ? 'NOT(' + predicate + ')' : predicate;
      });
      var combined = values.join === 'any' && predicates.length > 1
        ? 'OR(' + predicates.join(',') + ')'
        : predicates.join(',');
      return '=AND(ISNUMBER(' + range.cell + '),' + combined + ')';
    }

    return { sheets: forApp('sheets'), excel: forApp('excel') };
  }

  function validateDatetime(values) {
    var conditions = values.conditions || [];
    if (!conditions.length) return '条件を 1 つ以上追加してください';

    for (var i = 0; i < conditions.length; i++) {
      var condition = conditions[i];
      var position = (i + 1) + 'つ目の条件: ';

      if (condition.type === 'weekday' && (!condition.days || !condition.days.length)) {
        return position + '曜日を 1 つ以上選んでください';
      }

      if (condition.type === 'date') {
        if ((condition.operator === 'nextDays' || condition.operator === 'pastDays')
          && !isWholeNonNegative(condition.days)) {
          return position + '日数は 0 以上の整数で入力してください';
        }
        if ((condition.operator === 'onDate'
          || condition.operator === 'onOrBefore'
          || condition.operator === 'onOrAfter')
          && !parseIsoDate(condition.date)) {
          return position + '日付を入力してください';
        }
        if (condition.operator === 'between') {
          var start = parseIsoDate(condition.startDate);
          var end = parseIsoDate(condition.endDate);
          if (!start || !end) return position + '期間の開始日と終了日を入力してください';
          if (start.date > end.date) return position + '開始日が終了日を超えています';
        }
      }

      if (condition.type === 'time') {
        if ((condition.operator === 'before' || condition.operator === 'after')
          && !parseClock(condition.time)) {
          return position + '時刻を入力してください';
        }
        if (condition.operator === 'between'
          && (!parseClock(condition.startTime) || !parseClock(condition.endTime))) {
          return position + '開始時刻と終了時刻を入力してください';
        }
        if ((condition.operator === 'nextHours' || condition.operator === 'nextMinutes')
          && !isWholeNonNegative(condition.amount)) {
          return position + '時間または分は 0 以上の整数で入力してください';
        }
      }

      if (condition.type === 'business') {
        if (condition.operator !== 'holiday' && weekdayMask(condition.offDays) === '1111111') {
          return position + '休業曜日を 6 日以下にしてください';
        }
        if (condition.operator === 'nextBusiness' && !isWholeNonNegative(condition.days)) {
          return position + '営業日数は 0 以上の整数で入力してください';
        }
        if (String(condition.holidayRange == null ? '' : condition.holidayRange).trim()
          && !parseListRange(condition.holidayRange)) {
          return position + '祝日・休業日リストを A2:A20 の形式で入力してください';
        }
        if (condition.operator === 'holiday'
          && !String(condition.holidayRange == null ? '' : condition.holidayRange).trim()) {
          return position + '祝日・休業日リストを入力してください';
        }
      }
    }
    return null;
  }

  function weekdayNumber(date) {
    return date.getDay() === 0 ? '7' : String(date.getDay());
  }

  function isPreviewHoliday(date, condition, holidayDate) {
    return !!String(condition.holidayRange == null ? '' : condition.holidayRange).trim()
      && sameDate(date, holidayDate);
  }

  function isPreviewBusinessDay(date, condition, holidayDate) {
    return (condition.offDays || []).indexOf(weekdayNumber(date)) === -1
      && !isPreviewHoliday(date, condition, holidayDate);
  }

  function previewBusinessBoundary(start, count, condition, holidayDate) {
    var cursor = startOfDay(start);
    var remaining = toNum(count);
    var guard = 0;
    while (remaining > 0 && guard < 3700) {
      cursor.setDate(cursor.getDate() + 1);
      if (isPreviewBusinessDay(cursor, condition, holidayDate)) remaining -= 1;
      guard += 1;
    }
    return cursor;
  }

  function matchesDatetimeCondition(condition, date, now, holidayDate) {
    var matched = false;
    var op = condition.operator;
    var today = startOfDay(now);
    var day = startOfDay(date);
    var dayTime = day.getTime();
    var todayTime = today.getTime();
    var dayOffset = Math.round((dayTime - todayTime) / 86400000);

    if (condition.type === 'weekday') {
      matched = (condition.days || []).indexOf(weekdayNumber(date)) !== -1;
    } else if (condition.type === 'time') {
      var minutes = date.getHours() * 60 + date.getMinutes();
      if (op === 'before') matched = minutes < parseClock(condition.time).total;
      else if (op === 'after') matched = minutes > parseClock(condition.time).total;
      else if (op === 'nextHours') {
        matched = date >= now && date <= new Date(now.getTime() + toNum(condition.amount) * 60 * 60 * 1000);
      } else if (op === 'nextMinutes') {
        matched = date >= now && date <= new Date(now.getTime() + toNum(condition.amount) * 60 * 1000);
      } else {
        var start = parseClock(condition.startTime).total;
        var end = parseClock(condition.endTime).total;
        matched = start > end
          ? minutes >= start || minutes <= end
          : minutes >= start && minutes <= end;
      }
    } else if (condition.type === 'business') {
      var business = isPreviewBusinessDay(date, condition, holidayDate);
      if (op === 'business') matched = business;
      else if (op === 'nonbusiness') matched = !business;
      else if (op === 'holiday') matched = isPreviewHoliday(date, condition, holidayDate);
      else {
        var boundary = previewBusinessBoundary(today, condition.days, condition, holidayDate);
        matched = dayTime >= todayTime && dayTime <= boundary.getTime() && business;
      }
    } else {
      if (op === 'today') matched = dayTime === todayTime;
      else if (op === 'yesterday') matched = dayOffset === -1;
      else if (op === 'tomorrow') matched = dayOffset === 1;
      else if (op === 'past') matched = dayOffset < 0;
      else if (op === 'future') matched = dayOffset > 0;
      else if (op === 'nextDays') {
        matched = dayOffset >= 0 && dayOffset <= toNum(condition.days);
      } else if (op === 'pastDays') {
        matched = dayOffset >= -toNum(condition.days) && dayOffset <= 0;
      } else if (op === 'onDate') {
        matched = dayTime === startOfDay(parseIsoDate(condition.date).date).getTime();
      } else if (op === 'onOrBefore') {
        matched = dayTime <= startOfDay(parseIsoDate(condition.date).date).getTime();
      } else if (op === 'onOrAfter') {
        matched = dayTime >= startOfDay(parseIsoDate(condition.date).date).getTime();
      } else {
        matched = dayTime >= startOfDay(parseIsoDate(condition.startDate).date).getTime()
          && dayTime <= startOfDay(parseIsoDate(condition.endDate).date).getTime();
      }
    }

    return condition.negate ? !matched : matched;
  }

  function sampleDatetime(values) {
    var now = new Date();
    var conditions = values.conditions || [];
    var businessCondition = conditions.filter(function (condition) {
      return condition.type === 'business';
    })[0] || {
      type: 'business',
      operator: 'business',
      offDays: ['6', '7'],
      holidayRange: '',
      days: 5,
      negate: false
    };
    var holidayDate = addDays(1);
    var holidayGuard = 0;
    while ((businessCondition.offDays || []).indexOf(weekdayNumber(holidayDate)) !== -1
      && holidayGuard < 7) {
      holidayDate.setDate(holidayDate.getDate() + 1);
      holidayGuard += 1;
    }

    var offsets = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 14];
    var times = [[8, 30], [9, 30], [12, 0], [15, 30], [18, 30], [10, 0], [17, 0], [22, 0], [6, 30], [14, 0]];
    var candidates = offsets.map(function (offset, index) {
      var date = addDays(offset);
      date.setHours(times[index][0], times[index][1], 0, 0);
      return date;
    });

    var relativeTime = conditions.filter(function (condition) {
      return condition.type === 'time'
        && (condition.operator === 'nextHours' || condition.operator === 'nextMinutes');
    })[0];
    if (relativeTime) {
      var unit = relativeTime.operator === 'nextHours' ? 60 * 60 * 1000 : 60 * 1000;
      var amount = Math.max(0, toNum(relativeTime.amount));
      candidates[1] = new Date(now.getTime() + (amount / 2) * unit);
      candidates[2] = new Date(now.getTime() + (amount + 1) * unit);
    }

    var showHolidayExample = conditions.some(function (condition) {
      return condition.type === 'business'
        && String(condition.holidayRange == null ? '' : condition.holidayRange).trim();
    });

    return {
      head: ['日時'],
      rows: cellRows(candidates.map(function (date) {
        var results = conditions.map(function (condition) {
          return matchesDatetimeCondition(condition, date, now, holidayDate);
        });
        var match = values.join === 'any'
          ? results.some(function (result) { return result; })
          : results.every(function (result) { return result; });
        var label = fmtDate(date) + '(' + WEEKDAY_NAMES[date.getDay()] + ') '
          + pad2(date.getHours()) + ':' + pad2(date.getMinutes());
        if (showHolidayExample && sameDate(date, holidayDate)) label += '・祝日例';
        return [[label], match];
      }))
    };
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

    /* ---------- 日時 ---------- */

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
      title: '曜日を指定して色付け',
      desc: 'すべての曜日から 1 日または複数日を選び、該当する日付に色を付けます。',
      chip: 'WEEKDAY',
      color: 'red',
      fields: [
        { name: 'range', type: 'range', label: '適用範囲', def: 'A2:A100' },
        {
          name: 'days', type: 'weekdays', label: '対象の曜日', def: ['6', '7'],
          help: '曜日を複数選べます。ショートカットで平日・土日・すべても指定できます。'
        }
      ],
      validate: function (v) {
        if (!v.days || !v.days.length) return '曜日を 1 つ以上選んでください';
        return null;
      },
      formula: function (v, r) {
        var c = r.cell;
        var days = v.days || [];
        var predicate;
        if (days.length === 7) predicate = 'WEEKDAY(' + c + ',2)>=1';
        else if (days.length === 2 && days.indexOf('6') !== -1 && days.indexOf('7') !== -1) {
          predicate = 'WEEKDAY(' + c + ',2)>=6';
        } else if (days.length === 1) {
          predicate = 'WEEKDAY(' + c + ',2)=' + days[0];
        } else {
          predicate = 'OR(' + days.map(function (day) {
            return 'WEEKDAY(' + c + ',2)=' + day;
          }).join(',') + ')';
        }
        var f = '=AND(' + c + '<>"",' + predicate + ')';
        return { sheets: f, excel: f };
      },
      notes: [
        { app: 'both', html: '<code>WEEKDAY(セル,2)</code> は月曜=1〜日曜=7 を返します。空白セルは除外しています。' },
        { app: 'both', html: '曜日と祝日、期間などを一緒に判定する場合は「条件を組み合わせる」を選びます。' }
      ],
      sample: function (v) {
        var today = new Date();
        var mondayOffset = -((today.getDay() + 6) % 7);
        var rows = [];
        for (var i = 0; i < 7; i++) {
          var d = addDays(mondayOffset + i);
          var day = d.getDay();
          var weekdayNumber = day === 0 ? '7' : String(day);
          var m = (v.days || []).indexOf(weekdayNumber) !== -1;
          rows.push([[fmtDate(d) + '(' + WEEKDAY_NAMES[day] + ')'], m]);
        }
        return { head: ['日付'], rows: cellRows(rows) };
      }
    },

    {
      id: 'datetime',
      cat: 'date',
      title: '日時の条件を組み合わせる',
      desc: '日付・曜日・時刻・営業日を、すべて満たす / いずれか満たすで組み合わせます。',
      chip: 'AND / OR',
      color: 'red',
      customForm: 'datetime',
      fields: [
        { name: 'range', type: 'range', label: '適用範囲', def: 'A2:A100' },
        {
          name: 'join', type: 'select', label: '条件のつなぎ方', def: 'all',
          options: [
            { value: 'all', label: 'すべて満たす（AND）' },
            { value: 'any', label: 'いずれか満たす（OR）' }
          ]
        },
        {
          name: 'conditions', type: 'conditions',
          def: [{
            id: 'condition-1',
            type: 'date',
            operator: 'nextDays',
            days: 14,
            date: '',
            startDate: '',
            endDate: '',
            negate: false
          }]
        }
      ],
      validate: validateDatetime,
      formula: datetimeFormula,
      notes: [
        { app: 'both', html: '日付だけを比べる条件は <code>INT(セル)</code> を使うため、セルに時刻が含まれていても日付部分だけで判定します。' },
        { app: 'both', html: '祝日・会社休業日は自動取得せず、シート内に用意した日付リストを参照します。休業曜日は月〜日の中から変更できます。' },
        { app: 'both', html: '<code>NOW()</code> を使う条件はシートの再計算時に更新されます。時計のように常時更新されるわけではありません。' },
        { app: 'sheets', html: '別シートの祝日リストは、カスタム数式の制約に合わせて <code>INDIRECT</code> で参照します。' },
        { app: 'excel', html: '営業日の判定には <code>NETWORKDAYS.INTL</code>、期限には <code>WORKDAY.INTL</code> を使います。' }
      ],
      sample: sampleDatetime
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

  function navItemById(id) {
    for (var i = 0; i < NAV_GROUPS.length; i++) {
      for (var j = 0; j < NAV_GROUPS[i].items.length; j++) {
        if (NAV_GROUPS[i].items[j].id === id) return NAV_GROUPS[i].items[j];
      }
    }
    return null;
  }

  function navRuleId(item) {
    return item.ruleId || item.variants[0].ruleId;
  }

  /* ============================================================
     状態
     ============================================================ */

  var STORAGE_KEY = 'cfgen-app';

  var state = { app: 'sheets', navId: null, ruleId: null, values: {}, valuesByRule: {} };

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
  var workspaceEmptyEl = document.getElementById('workspace-empty');
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
    NAV_GROUPS.forEach(function (navGroup) {
      var group = document.createElement('div');
      group.className = 'pattern-group';

      var title = document.createElement('span');
      title.className = 'pattern-group-title';
      title.style.background = navGroup.bg;
      title.textContent = navGroup.label;
      group.appendChild(title);

      var cards = document.createElement('div');
      cards.className = 'pattern-cards';

      navGroup.items.forEach(function (item) {
        var card = document.createElement('button');
        card.type = 'button';
        card.className = 'pattern-card';
        card.setAttribute('data-nav', item.id);

        var h3 = document.createElement('h3');
        h3.textContent = item.label;
        card.appendChild(h3);

        var p = document.createElement('p');
        p.textContent = item.summary;
        card.appendChild(p);

        card.addEventListener('click', function () { selectNavItem(item.id); });
        cards.appendChild(card);
      });

      group.appendChild(cards);
      groupsEl.appendChild(group);
    });
  }

  function markSelectedCard() {
    var cards = groupsEl.querySelectorAll('.pattern-card');
    Array.prototype.forEach.call(cards, function (card) {
      if (card.getAttribute('data-nav') === state.navId) card.classList.add('selected');
      else card.classList.remove('selected');
    });
  }

  /* ============================================================
     フォーム
     ============================================================ */

  function buildWeekdayPicker(selectedDays, options) {
    var selected = Array.isArray(selectedDays) ? selectedDays : [];
    var control = document.createElement('div');
    control.className = 'weekday-control';

    var picker = document.createElement('div');
    picker.className = 'weekday-picker';
    picker.setAttribute('aria-label', options.ariaLabel || '曜日を選択');

    WEEKDAYS.forEach(function (day) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'weekday-button';
      button.textContent = day.label;
      button.setAttribute('aria-pressed', selected.indexOf(day.value) !== -1 ? 'true' : 'false');
      button.setAttribute('data-day', day.value);
      if (options.conditionId) {
        button.setAttribute('data-condition-day', 'true');
        button.setAttribute('data-condition-id', options.conditionId);
        button.setAttribute('data-condition-array', options.arrayName);
      } else {
        button.setAttribute('data-weekday-field', options.fieldName);
      }
      picker.appendChild(button);
    });
    control.appendChild(picker);

    var shortcuts = document.createElement('div');
    shortcuts.className = 'weekday-shortcuts';
    [
      { value: 'weekdays', label: '平日' },
      { value: 'weekend', label: '土日' },
      { value: 'all', label: 'すべて' }
    ].forEach(function (shortcut) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'weekday-shortcut';
      button.textContent = shortcut.label;
      button.setAttribute('data-shortcut', shortcut.value);
      if (options.conditionId) {
        button.setAttribute('data-condition-shortcut', 'true');
        button.setAttribute('data-condition-id', options.conditionId);
        button.setAttribute('data-condition-array', options.arrayName);
      } else {
        button.setAttribute('data-weekday-shortcut-field', options.fieldName);
      }
      shortcuts.appendChild(button);
    });
    control.appendChild(shortcuts);
    return control;
  }

  function buildField(field) {
    var wrap = document.createElement('div');
    wrap.className = 'field';

    var id = 'field-' + field.name;
    var label = document.createElement('label');
    label.setAttribute('for', id);
    label.textContent = field.label;
    wrap.appendChild(label);

    if (field.type === 'weekdays') {
      wrap.appendChild(buildWeekdayPicker(state.values[field.name], {
        fieldName: field.name,
        ariaLabel: field.label
      }));
      if (field.help) {
        var weekdayHelp = document.createElement('p');
        weekdayHelp.className = 'help';
        weekdayHelp.textContent = field.help;
        wrap.appendChild(weekdayHelp);
      }
      return wrap;
    }

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

  function buildVariantField(item) {
    var field = {
      name: 'ruleVariant',
      type: 'select',
      label: item.variantLabel || '条件の種類',
      options: item.variants.map(function (variant) {
        return { value: variant.ruleId, label: variant.label };
      })
    };
    var wrap = buildField(field);
    wrap.classList.add('field-wide', 'variant-field');
    var select = wrap.querySelector('select');
    select.removeAttribute('data-field');
    select.setAttribute('data-variant', 'true');
    select.value = state.ruleId;
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

  function conditionById(id) {
    var conditions = state.values.conditions || [];
    for (var i = 0; i < conditions.length; i++) {
      if (conditions[i].id === id) return conditions[i];
    }
    return null;
  }

  function setConditionBinding(element, condition, name) {
    element.setAttribute('data-condition-id', condition.id);
    element.setAttribute('data-condition-field', name);
  }

  function makeConditionSelect(condition, name, value, options, label) {
    var select = document.createElement('select');
    select.setAttribute('aria-label', label);
    options.forEach(function (option) {
      var item = document.createElement('option');
      item.value = option.value;
      item.textContent = option.label;
      select.appendChild(item);
    });
    select.value = value;
    setConditionBinding(select, condition, name);
    return select;
  }

  function makeConditionInput(condition, name, type, value, label, inputOptions) {
    var input = document.createElement('input');
    input.type = type;
    input.value = String(value == null ? '' : value);
    input.setAttribute('aria-label', label);
    setConditionBinding(input, condition, name);
    if (inputOptions && inputOptions.min != null) input.min = String(inputOptions.min);
    if (inputOptions && inputOptions.step != null) input.step = String(inputOptions.step);
    if (inputOptions && inputOptions.placeholder) input.placeholder = inputOptions.placeholder;
    if (inputOptions && inputOptions.mono) input.className = 'mono';
    return input;
  }

  function appendConditionControl(parent, labelText, control, help, wide) {
    var wrap = document.createElement('div');
    wrap.className = 'condition-control' + (wide ? ' condition-control-wide' : '');
    var label = document.createElement('label');
    label.textContent = labelText;
    wrap.appendChild(label);
    wrap.appendChild(control);
    if (help) {
      var note = document.createElement('p');
      note.className = 'help';
      note.textContent = help;
      wrap.appendChild(note);
    }
    parent.appendChild(wrap);
  }

  function buildDateConditionBody(body, condition) {
    var operators = [
      { value: 'today', label: '今日' },
      { value: 'yesterday', label: '昨日' },
      { value: 'tomorrow', label: '明日' },
      { value: 'onDate', label: '指定日' },
      { value: 'past', label: '今日より前' },
      { value: 'future', label: '今日より後' },
      { value: 'nextDays', label: '今日から N 日以内' },
      { value: 'pastDays', label: '過去 N 日以内' },
      { value: 'onOrBefore', label: '指定日以前' },
      { value: 'onOrAfter', label: '指定日以後' },
      { value: 'between', label: '指定期間' }
    ];
    appendConditionControl(
      body,
      '日付の指定',
      makeConditionSelect(condition, 'operator', condition.operator, operators, '日付の指定')
    );

    if (condition.operator === 'nextDays' || condition.operator === 'pastDays') {
      appendConditionControl(
        body,
        '日数',
        makeConditionInput(condition, 'days', 'number', condition.days, '日数', { min: 0, step: 1 })
      );
    } else if (condition.operator === 'onDate'
      || condition.operator === 'onOrBefore'
      || condition.operator === 'onOrAfter') {
      appendConditionControl(
        body,
        '基準日',
        makeConditionInput(condition, 'date', 'date', condition.date, '基準日')
      );
    } else if (condition.operator === 'between') {
      appendConditionControl(
        body,
        '開始日',
        makeConditionInput(condition, 'startDate', 'date', condition.startDate, '開始日')
      );
      appendConditionControl(
        body,
        '終了日',
        makeConditionInput(condition, 'endDate', 'date', condition.endDate, '終了日')
      );
    }
  }

  function buildTimeConditionBody(body, condition) {
    var operators = [
      { value: 'before', label: '指定時刻より前' },
      { value: 'after', label: '指定時刻より後' },
      { value: 'between', label: '指定時間帯' },
      { value: 'nextHours', label: '現在から N 時間以内' },
      { value: 'nextMinutes', label: '現在から N 分以内' }
    ];
    appendConditionControl(
      body,
      '時刻の指定',
      makeConditionSelect(condition, 'operator', condition.operator, operators, '時刻の指定')
    );

    if (condition.operator === 'before' || condition.operator === 'after') {
      appendConditionControl(
        body,
        '基準時刻',
        makeConditionInput(condition, 'time', 'time', condition.time, '基準時刻')
      );
    } else if (condition.operator === 'between') {
      appendConditionControl(
        body,
        '開始時刻',
        makeConditionInput(condition, 'startTime', 'time', condition.startTime, '開始時刻')
      );
      appendConditionControl(
        body,
        '終了時刻',
        makeConditionInput(condition, 'endTime', 'time', condition.endTime, '終了時刻'),
        '日をまたぐ時間帯にも対応'
      );
    } else {
      appendConditionControl(
        body,
        condition.operator === 'nextHours' ? '時間' : '分',
        makeConditionInput(condition, 'amount', 'number', condition.amount, '時間または分', { min: 0, step: 1 })
      );
    }
  }

  function buildBusinessConditionBody(body, condition) {
    var operators = [
      { value: 'business', label: '営業日' },
      { value: 'nonbusiness', label: '休業日（休業曜日・祝日）' },
      { value: 'holiday', label: '祝日・会社休業日のみ' },
      { value: 'nextBusiness', label: '今日から N 営業日以内' }
    ];
    appendConditionControl(
      body,
      '営業日の指定',
      makeConditionSelect(condition, 'operator', condition.operator, operators, '営業日の指定')
    );

    if (condition.operator === 'nextBusiness') {
      appendConditionControl(
        body,
        '営業日数',
        makeConditionInput(condition, 'days', 'number', condition.days, '営業日数', { min: 0, step: 1 })
      );
    }

    if (condition.operator !== 'holiday') {
      appendConditionControl(
        body,
        '休業曜日',
        buildWeekdayPicker(condition.offDays, {
          conditionId: condition.id,
          arrayName: 'offDays',
          ariaLabel: '休業曜日'
        }),
        '初期値は土日',
        true
      );
    }

    appendConditionControl(
      body,
      '祝日・会社休業日の範囲',
      makeConditionInput(
        condition,
        'holidayRange',
        'text',
        condition.holidayRange,
        '祝日・会社休業日の範囲',
        { placeholder: '例: 祝日!A2:A30', mono: true }
      ),
      condition.operator === 'holiday'
        ? '必須。同じシートは E2:E30、別シートは 祝日!A2:A30'
        : '任意。空欄なら休業曜日だけで判定',
      true
    );
  }

  function buildDatetimeCondition(condition, index, total) {
    var card = document.createElement('section');
    card.className = 'datetime-condition';
    card.setAttribute('aria-label', (index + 1) + 'つ目の条件');

    var head = document.createElement('div');
    head.className = 'condition-head';

    var number = document.createElement('span');
    number.className = 'condition-index';
    number.textContent = String(index + 1);
    head.appendChild(number);

    head.appendChild(makeConditionSelect(condition, 'type', condition.type, [
      { value: 'date', label: '日付' },
      { value: 'weekday', label: '曜日' },
      { value: 'time', label: '時刻' },
      { value: 'business', label: '営業日・休日' }
    ], '条件の種類'));

    var negate = document.createElement('label');
    negate.className = 'condition-negate';
    var checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !!condition.negate;
    setConditionBinding(checkbox, condition, 'negate');
    negate.appendChild(checkbox);
    negate.appendChild(document.createTextNode(' この条件を除外'));
    head.appendChild(negate);

    var remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'condition-remove';
    remove.textContent = '削除';
    remove.disabled = total === 1;
    remove.setAttribute('data-remove-condition', condition.id);
    head.appendChild(remove);
    card.appendChild(head);

    var body = document.createElement('div');
    body.className = 'condition-body';

    if (condition.type === 'weekday') {
      appendConditionControl(
        body,
        '対象の曜日',
        buildWeekdayPicker(condition.days, {
          conditionId: condition.id,
          arrayName: 'days',
          ariaLabel: '対象の曜日'
        }),
        '1 日または複数日を選択',
        true
      );
    } else if (condition.type === 'time') {
      buildTimeConditionBody(body, condition);
    } else if (condition.type === 'business') {
      buildBusinessConditionBody(body, condition);
    } else {
      buildDateConditionBody(body, condition);
    }

    card.appendChild(body);
    return card;
  }

  function renderDatetimeForm(rule, item) {
    clearEl(formEl);
    formEl.appendChild(buildVariantField(item));
    formEl.appendChild(buildField(rule.fields[0]));

    var builder = document.createElement('div');
    builder.className = 'datetime-builder field-wide';

    var intro = document.createElement('div');
    intro.className = 'datetime-builder-intro';
    var heading = document.createElement('div');
    var title = document.createElement('h3');
    title.textContent = '判定する条件';
    heading.appendChild(title);
    var description = document.createElement('p');
    description.textContent = '条件を追加し、全体のつなぎ方と必要な除外を指定します。';
    heading.appendChild(description);
    intro.appendChild(heading);

    var joinField = buildField(rule.fields[1]);
    joinField.classList.add('join-field');
    intro.appendChild(joinField);
    builder.appendChild(intro);

    var list = document.createElement('div');
    list.className = 'datetime-condition-list';
    (state.values.conditions || []).forEach(function (condition, index, conditions) {
      list.appendChild(buildDatetimeCondition(condition, index, conditions.length));
    });
    builder.appendChild(list);

    var add = document.createElement('button');
    add.type = 'button';
    add.className = 'condition-add';
    add.textContent = '＋ 条件を追加';
    add.setAttribute('data-add-condition', 'true');
    builder.appendChild(add);

    formEl.appendChild(builder);
    formEl.appendChild(buildPalette());
  }

  function renderForm(rule, item) {
    if (rule.customForm === 'datetime') {
      renderDatetimeForm(rule, item);
      return;
    }
    clearEl(formEl);
    if (item.variants) formEl.appendChild(buildVariantField(item));
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
    var maxColumns = 6;
    var columnCount = Math.min(r.colCount, maxColumns);

    function headerAt(index) {
      if (s.head.length === 1 && columnCount > 1) return s.head[0] + ' ' + (index + 1);
      return s.head[index] || '項目 ' + (index + 1);
    }

    function cellAt(rowIndex, columnIndex) {
      var row = s.rows[rowIndex];
      if (columnIndex < row.cells.length) {
        return {
          text: row.cells[columnIndex],
          match: !!row.match[columnIndex],
          numeric: numCols.indexOf(columnIndex) !== -1
        };
      }
      if (s.head.length === 1) {
        var source = s.rows[(rowIndex + columnIndex) % s.rows.length];
        return {
          text: source.cells[0],
          match: !!source.match[0],
          numeric: numCols.indexOf(0) !== -1
        };
      }
      var rowMatch = row.match.length > 0 && row.match.every(function (matched) {
        return matched === row.match[0];
      });
      return { text: '—', match: rowMatch && !!row.match[0], numeric: false };
    }

    if (r.colCount > maxColumns) {
      var limitNote = document.createElement('p');
      limitNote.className = 'preview-limit-note';
      limitNote.textContent = r.colCount + '列のうち先頭' + maxColumns + '列を表示';
      previewEl.appendChild(limitNote);
    }

    var table = document.createElement('table');

    var thead = document.createElement('thead');
    var headTr = document.createElement('tr');
    headTr.appendChild(document.createElement('th'));
    for (var i = 0; i < columnCount; i++) {
      var th = document.createElement('th');
      th.textContent = idxToCol(startIdx + (i * r.colStep));
      headTr.appendChild(th);
    }
    thead.appendChild(headTr);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');

    if (r.row >= 2) {
      var hr = document.createElement('tr');
      var hrNo = document.createElement('th');
      hrNo.textContent = String(r.row - 1);
      hr.appendChild(hrNo);
      for (var j = 0; j < columnCount; j++) {
        var td = document.createElement('td');
        td.className = 'head-row';
        td.textContent = headerAt(j);
        hr.appendChild(td);
      }
      tbody.appendChild(hr);
    }

    s.rows.forEach(function (row, i) {
      var tr = document.createElement('tr');
      var no = document.createElement('th');
      no.textContent = String(r.row + i);
      tr.appendChild(no);
      for (var j = 0; j < columnCount; j++) {
        var cell = cellAt(i, j);
        var td = document.createElement('td');
        if (cell.numeric) td.className = 'num';
        td.textContent = cell.text;
        if (cell.match) {
          td.style.background = color.bg;
          td.style.color = color.fg;
        }
        tr.appendChild(td);
      }
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

  function defaultValues(rule) {
    var values = {};
    rule.fields.forEach(function (field) { values[field.name] = cloneValue(field.def); });
    values.color = rule.color;
    return values;
  }

  function selectNavItem(id) {
    var item = navItemById(id);
    if (!item) return;
    var ruleId = state.navId === id && state.ruleId ? state.ruleId : navRuleId(item);
    selectRule(ruleId, id);
  }

  function selectRule(id, navId) {
    var rule = ruleById(id);
    var item = navItemById(navId || state.navId);
    if (!rule || !item) return;

    if (state.ruleId !== id) {
      state.navId = item.id;
      state.ruleId = id;
      if (!state.valuesByRule[id]) state.valuesByRule[id] = defaultValues(rule);
      state.values = state.valuesByRule[id];

      markSelectedCard();
      ruleTitleEl.textContent = item.label;
      renderForm(rule, item);
      renderResult();
    }

    configEl.classList.remove('hidden');
    resultEl.classList.remove('hidden');
    workspaceEmptyEl.classList.add('hidden');
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

  function selectedDaysForShortcut(shortcut) {
    if (shortcut === 'weekdays') return ['1', '2', '3', '4', '5'];
    if (shortcut === 'weekend') return ['6', '7'];
    return ['1', '2', '3', '4', '5', '6', '7'];
  }

  function rerenderCurrentForm() {
    var rule = ruleById(state.ruleId);
    var item = navItemById(state.navId);
    if (rule && item) renderForm(rule, item);
  }

  function toggleDay(days, day) {
    var selected = Array.isArray(days) ? days.slice() : [];
    var index = selected.indexOf(day);
    if (index === -1) selected.push(day);
    else selected.splice(index, 1);
    return selected.sort();
  }

  function onFormChange(e) {
    if (e.target && e.target.getAttribute && e.target.getAttribute('data-variant')) {
      selectRule(e.target.value, state.navId);
      return;
    }

    var conditionId = e.target && e.target.getAttribute
      && e.target.getAttribute('data-condition-id');
    var conditionField = e.target && e.target.getAttribute
      && e.target.getAttribute('data-condition-field');
    if (conditionId && conditionField) {
      var condition = conditionById(conditionId);
      if (!condition) return;
      if (conditionField === 'type') {
        var replacement = makeDatetimeCondition(e.target.value, condition.id);
        replacement.negate = condition.negate;
        var position = state.values.conditions.indexOf(condition);
        state.values.conditions[position] = replacement;
      } else {
        condition[conditionField] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      }
      if (conditionField === 'type' || conditionField === 'operator') rerenderCurrentForm();
      renderResult();
      return;
    }

    var name = e.target && e.target.getAttribute && e.target.getAttribute('data-field');
    if (!name) return;
    state.values[name] = e.target.value;
    renderResult();
  }

  function onFormClick(e) {
    var target = e.target;
    if (!target || !target.getAttribute) return;

    var fieldName = target.getAttribute('data-weekday-field');
    if (fieldName) {
      state.values[fieldName] = toggleDay(state.values[fieldName], target.getAttribute('data-day'));
      rerenderCurrentForm();
      renderResult();
      return;
    }

    var shortcutField = target.getAttribute('data-weekday-shortcut-field');
    if (shortcutField) {
      state.values[shortcutField] = selectedDaysForShortcut(target.getAttribute('data-shortcut'));
      rerenderCurrentForm();
      renderResult();
      return;
    }

    var conditionId = target.getAttribute('data-condition-id');
    var arrayName = target.getAttribute('data-condition-array');
    if (target.getAttribute('data-condition-day') && conditionId && arrayName) {
      var condition = conditionById(conditionId);
      if (!condition) return;
      condition[arrayName] = toggleDay(condition[arrayName], target.getAttribute('data-day'));
      rerenderCurrentForm();
      renderResult();
      return;
    }

    if (target.getAttribute('data-condition-shortcut') && conditionId && arrayName) {
      var shortcutCondition = conditionById(conditionId);
      if (!shortcutCondition) return;
      shortcutCondition[arrayName] = selectedDaysForShortcut(target.getAttribute('data-shortcut'));
      rerenderCurrentForm();
      renderResult();
      return;
    }

    if (target.getAttribute('data-add-condition')) {
      state.values.conditions.push(makeDatetimeCondition('date'));
      rerenderCurrentForm();
      renderResult();
      return;
    }

    var removeId = target.getAttribute('data-remove-condition');
    if (removeId) {
      state.values.conditions = state.values.conditions.filter(function (condition) {
        return condition.id !== removeId;
      });
      rerenderCurrentForm();
      renderResult();
    }
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
    formEl.addEventListener('click', onFormClick);
    copyBtn.addEventListener('click', copyFormula);

    renderCards();
  }

  init();

})();
