# app.js 実装仕様書 — 条件付き書式ジェネレータ

`index.html` / `style.css` は作成済み。本仕様は残る `app.js`(と `README.md`)の実装仕様。
ビルド不要の Vanilla JS。外部ライブラリ禁止。UI 文言はすべて日本語。

## 1. 前提: index.html の要素契約

app.js が操作する要素(すべて作成済み・ID/クラスは変更しない):

- `.app-toggle button[data-app]` — アプリ切替(`sheets` / `excel`)。`aria-selected` を付け替える
- `#pattern-groups` — カテゴリごとのカード一覧を描画する空コンテナ
- `#config`, `#result` — 初期状態 `.hidden`。ルール選択で表示
- `#config-rule-title` — 選択中ルール名
- `#config-form` — 設定フォーム(動的生成)
- `#formula-label`, `#formula-output`, `#formula-error`(`.hidden` 切替), `#copy-btn`
- `#steps-title`, `#steps-list`
- `#preview` — スプレッドシート風プレビュー
- `#notes-card`(`.hidden` 切替), `#notes-list`

カードは `<button type="button" class="pattern-card">` で生成し、選択中は `.selected` を付与
(CSS がマーチングアンツ枠を表示)。カード構造:
`<h3>タイトル</h3><p>説明</p>`。
カテゴリ見出しは `<span class="pattern-group-title" style="background:◯">ラベル</span>`。

## 2. 状態と全体フロー

```js
state = {
  app: 'sheets' | 'excel',
  navId: null,
  ruleId: null,
  values: {},
  valuesByRule: {}
}
```

- `app` は `localStorage('cfgen-app')` に保存・復元
- サイドナビ項目は単独ルール、または複数ルールを束ねたバリエーションを持つ
- カードクリック → `navId` / `ruleId` を設定し、ルールごとの入力値を `valuesByRule` に保持
- `#config` / `#result` を表示し、選択カードへ `.selected` を付与
- フォームの `input` / `change` で `values` を更新し全結果を再描画(生成ボタンは無し、ライブ更新)
- アプリ切替でも再描画

## 3. ヘルパー(必須実装)

- `escQ(s)` — 数式内文字列用。`"` → `""`
- `escRe(s)` — 正規表現メタ文字 `.*+?^${}()|[]\` を `\` エスケープ(REGEXMATCH 用)
- `escHtml(s)` — `& < > "` をエスケープ。**ユーザー入力を innerHTML に入れる箇所は必ず通す**
- `parseRange(str)` — 適用範囲のパース:
  - trim、全角コロン`：`→`:`、`$`と空白を除去、大文字化
  - `/^([A-Z]{1,3})([0-9]*)(?::([A-Z]{1,3})([0-9]*))?$/` にマッチしなければ `null`
  - 戻り値は `text / col / endCol / colCount / colStep / row / cell / abs`。
    行番号省略時は `row = 1`
  - 例: `A2:C100` は開始列 A、終了列 C、3 列、`cell='A2'`、`abs='$A$2:$C$100'`
- `absRange(s)` — `A2:C100` → `$A$2:$C$100`(行番号なし `A2:A` → `$A$2:$A`)
- `colToIdx('A')=0 / idxToCol(0)='A'`(AA 等 2 文字以上も対応)
- `parseCol(str)` — 判定列入力。大文字化して `/^[A-Z]{1,3}$/`、不一致は `null`
- 日付系: `addDays(n)`(今日+n の `Date`)、`fmtDate(d)` → `M/D`、
  曜日 `['日','月','火','水','木','金','土']`

## 4. 色パレット(7 色・全ルール共通の最終フィールド)

スウォッチは `button.swatch`(`aria-pressed` で選択)。背景 `bg`・文字 `fg` で「A」を表示。

| id | name(手順文で使用) | bg | fg |
|---|---|---|---|
| red | 薄い赤 | #f8d3cd | #8f2a1c |
| orange | 薄いオレンジ | #fbe3c9 | #8a4c10 |
| yellow | 薄い黄 | #faeec3 | #7a5b0e |
| green | 薄い緑 | #d4e8d9 | #1d5c33 |
| blue | 薄い青 | #d6e4f7 | #1d4e89 |
| purple | 薄い紫 | #e6dcf3 | #563387 |
| gray | 薄いグレー | #e7e9e7 | #4c554f |

## 5. サイドナビ(表示順)

| グループ | 項目 | 内包するルール |
| --- | --- | --- |
| 値を見て判定 | 文字・キーワード | keyword / multiKeyword / rowByCell |
| 値を見て判定 | 数値 | threshold / between |
| 値を見て判定 | 日時 | overdue / dueSoon / weekend / datetime |
| 値を見て判定 | 空白 | blank |
| 表・リストで判定 | チェックボックス | checkbox |
| 表・リストで判定 | 重複 | duplicate |
| 表・リストで判定 | 交互の背景色 | stripes |
| 表・リストで判定 | 別リストとの一致 | inList |

`日時` のバリエーション選択ラベルは「プリセット / 自由設定」。表示名は順に
「期限切れ」「期限が近い」「曜日を指定」「条件を組み合わせる」とする。

## 6. ルール定義(14 個)

共通仕様:

- 全ルールの先頭フィールドは `range`(適用範囲、`input.mono`)、末尾は色パレット
- 数式内のセル参照は **`parseRange` の結果(範囲左上セル)を基準に動的生成**。
  ユーザーが範囲を変えると数式も追従する
- `formula(v, r)` は `{sheets, excel}` を返す(同一の場合も両方に同じ文字列)
- ユーザー入力文字列は数式では `escQ`、正規表現では `escRe(escQ ではなく生値に適用→その後 escQ)`
  の順で処理: `escQ(escRe(kw))` ではなく **`escRe` してから `escQ`**
- 下記の数式例はデフォルト値・範囲 `A2:...` の場合の期待出力。**一字一句この形式で生成すること**

### 6.1 keyword(text)— キーワードに反応して色を付ける

- desc: 「至急」を含むセルを赤くする、など。部分一致・完全一致・前方/後方一致が選べます。
- chip: `SEARCH`
- fields: range=`A2:A100` / matchType(select: contains=部分一致(含む), equals=完全一致,
  starts=前方一致(で始まる), ends=後方一致(で終わる)) / keyword(text, default `至急`)
- defaultColor: red
- 数式(両アプリ共通):
  - contains: `=ISNUMBER(SEARCH("至急",A2))`
  - equals: `=A2="至急"`
  - starts: `=LEFT(A2,LEN("至急"))="至急"`
  - ends: `=RIGHT(A2,LEN("至急"))="至急"`
- notes:
  - both: SEARCH や「=」の比較は英字の大文字と小文字を区別しません。区別したい場合は
    SEARCH を FIND に、完全一致は `EXACT(セル,"値")` にします。
  - sheets: 部分一致だけなら、条件「テキストに次を含む」でも同じ設定ができます。
  - excel: 部分一致だけなら「セルの強調表示ルール」→「文字列」でも設定できます。
- validate: keyword 空 → 「キーワードを入力してください」
- sample(header `メモ`、matchType で切替、`kw` はユーザー入力):
  - contains: `{kw}：見積書を送付`(m) / `定例ミーティング` / `障害対応({kw})`(m) / `週報の提出`
  - equals: `{kw}`(m) / `対応中` / `保留` / `{kw}`(m)
  - starts: `{kw}のため休業`(m) / `メモ：{kw}` / `{kw}案件`(m) / `その他`
  - ends: `報告書_{kw}`(m) / `{kw}_報告書` / `議事録_{kw}`(m) / `メモ`

### 6.2 multiKeyword(text)— 複数のキーワードのいずれかに反応

- desc: 「至急」「重要」「緊急」のどれかを含むセルに色を付けます。
- chip: `REGEXMATCH / OR`
- fields: range=`A2:A100` / keywords(text, default `至急, 重要, 緊急`,
  help「カンマまたは読点区切りで複数指定」)。`/[,、，]/` で分割し trim・空要素除去
- defaultColor: red
- 数式:
  - sheets: `=REGEXMATCH(TO_TEXT(A2),"至急|重要|緊急")`(各語を escRe)
  - excel: `=OR(ISNUMBER(SEARCH("至急",A2)),ISNUMBER(SEARCH("重要",A2)),ISNUMBER(SEARCH("緊急",A2)))`
- notes:
  - sheets: REGEXMATCH は正規表現で判定します。英字の大文字小文字を無視するには
    `"(?i)至急|重要"` のように先頭へ `(?i)` を付けます。
  - excel: SEARCH は英字の大文字小文字を区別しません。
- validate: キーワード 0 個 → 「キーワードを 1 つ以上入力してください」
- sample(header `メモ`、k1・k2 は先頭 2 語): `{k1}：契約書の確認`(m) / `雑談メモ` /
  `{k2}度：高`(m) / `来週で OK`

### 6.3 rowByCell(row)— 特定の列の値で行全体を色付け

- desc: ステータス列が「完了」の行全体をグレーにする、など行単位の色付けの定番です。
- chip: `$C2="完了"`
- fields: range=`A2:C100`(help「行全体を含む範囲」)/ column(判定する列, default `C`)/
  matchType(select: equals=値と等しい, contains=値を含む)/ value(text, default `完了`)
- defaultColor: gray
- 数式(両アプリ共通、`$列 + 範囲先頭行` の複合参照):
  - equals: `=$C2="完了"`
  - contains: `=ISNUMBER(SEARCH("完了",$C2))`
- notes:
  - both: 列だけを `$` で固定した複合参照($C2)にするのがポイントです。これで行内の
    どのセルも同じ列を見て判定されます。
  - both: 適用範囲には行全体(例: A2:C100)を指定してください。
- validate: column 不正 → 「列は A〜Z の列記号で入力してください」/ value 空 → 「値を入力してください」
- sample(header `タスク/担当/ステータス`、行マッチ):
  `資料作成/田中/{value}`(行m) / `見積送付/佐藤/対応中` / `請求処理/鈴木/{value}`(行m) / `受注登録/高橋/未着手`

### 6.4 checkbox(row)— チェックボックスがオンの行を色付け

- desc: チェックを入れた行全体に色を付けて、完了タスクを見える化します。
- chip: `$A2=TRUE`
- fields: range=`A2:B100` / column(チェックボックスの列, default `A`)
- defaultColor: green
- 数式(共通): `=$A2=TRUE`
- notes:
  - sheets: チェックボックスは「挿入」→「チェックボックス」で作成できます。
  - excel: Microsoft 365 の「挿入」→「チェックボックス」で動作します。従来のフォーム
    コントロールの場合はリンクされたセルの値で判定してください。
- sample(header `✓/タスク`): `☑/牛乳を買う`(行m) / `☐/部屋の掃除` / `☑/請求書の支払い`(行m) / `☐/メール返信`

### 6.5 threshold(number)— 数値がしきい値を超えたら色付け

- desc: 在庫が 10 以下で赤、売上が 100 以上で緑など、数値の大小で判定します。
- chip: `>= <=`
- fields: range=`A2:A100` / op(select: `>=`=以上, `>`=より大きい, `<=`=以下, `<`=より小さい,
  `=`=等しい, `<>`=等しくない)/ value(number, default 100)
- defaultColor: green
- 数式(共通)。`<` `<=` `<>` のときだけ空白セル誤反応防止の ISNUMBER ガードを付ける:
  - 例 `>=`: `=A2>=100`
  - 例 `<=`: `=AND(ISNUMBER(A2),A2<=100)`
- notes:
  - both: 「以下」「より小さい」「等しくない」は空白セルまで色が付いてしまうため、
    ISNUMBER で数値かどうかを確認しています。
  - sheets: 標準の条件「以上」「次より大きい」でも設定できます。
  - excel: 「セルの強調表示ルール」でも同様の設定ができます。
- validate: value 未入力(NaN)→ 「数値を入力してください」
- sample(header `売上`、値は右寄せ `td.num`): 120 / 85 / 100 / 47 / 230 を
  op と value で実際に判定して m を計算(`<>` は `!==`)

### 6.6 between(number)— 数値が範囲内なら色付け

- desc: 50 以上 100 以下のセルだけに色を付けます。範囲外の検出にも応用できます。
- chip: `AND`
- fields: range=`A2:A100` / min(number, default 50)/ max(number, default 100)
- defaultColor: green
- 数式(共通): `=AND(A2>=50,A2<=100)`。**min <= 0 の場合のみ**
  `=AND(ISNUMBER(A2),A2>=0,A2<=100)` と ISNUMBER ガードを付ける(空白=0 誤反応防止)
- notes:
  - both: 「範囲外」に色を付けたい場合は `=OR(A2<50,A2>100)` のように OR と逆向きの
    不等号にします(空白除外には ISNUMBER を追加)。
- validate: min/max NaN → 「数値を入力してください」/ min > max → 「下限が上限を超えています」
- sample(header `点数`): 72 / 38 / 95 / 100 / 12 を実際に判定して m

### 6.7 overdue(date)— 期限切れの日付を色付け

- desc: 今日より前の日付(期限切れ)に色を付けます。開くたびに自動で更新されます。
- chip: `TODAY()`
- fields: range=`A2:A100` / includeToday(select: no=今日は含めない, yes=今日も含める)
- defaultColor: red
- 数式(共通): `=AND(A2<>"",A2<TODAY())` / yes: `=AND(A2<>"",A2<=TODAY())`
- notes:
  - both: 空白セルに色が付かないよう `A2<>""` を入れています。
  - both: セルには日付として認識される値が必要です(文字列の日付は判定されません)。
- sample(header `締切日`、実際の今日基準で生成・`fmtDate`):
  今日−5(m) / 今日+2 / 今日−1(m) / 今日(includeToday=yes のとき m)/ 今日+14

### 6.8 dueSoon(date)— 期限が近い日付を色付け

- desc: 今日から N 日以内の日付に色を付けて、締切前に気付けるようにします。
- chip: `TODAY()+N`
- fields: range=`A2:A100` / days(number, default 7, label「何日以内」)
- defaultColor: yellow
- 数式(共通): `=AND(A2>=TODAY(),A2<=TODAY()+7)`
- notes:
  - both: 期限切れ(過去)も目立たせたい場合は「期限切れの日付を色付け」ルールを別途
    追加してください。条件付き書式のルールは同じ範囲に複数併用できます。
- validate: days NaN または < 0 → 「0 以上の数値を入力してください」
- sample(header `締切日`): 今日+1(m)/ 今日+max(1, days−1)(m)/ 今日+days+7 / 今日−3

### 6.9 weekend(date)— 曜日を指定して色付け

- desc: すべての曜日から 1 日または複数日を選び、該当する日付に色を付けます。
- chip: `WEEKDAY`
- fields: range=`A2:A100` / days(曜日チップ、default 土・日)
- 曜日チップは月〜日を個別に切り替え可能。ショートカットは「平日」「土日」「すべて」
- defaultColor: red
- 数式(共通):
  - 土日: `=AND(A2<>"",WEEKDAY(A2,2)>=6)`（従来プリセットと同じ）
  - 1 曜日: `=AND(A2<>"",WEEKDAY(A2,2)=1)`
  - 複数曜日: `=AND(A2<>"",OR(WEEKDAY(A2,2)=1,WEEKDAY(A2,2)=3))`
- validate: 0 曜日 → 「曜日を 1 つ以上選んでください」
- sample(header `日付`): 今週の月〜日 7 行を `M/D(曜)` で表示し、選択曜日に応じて m

### 6.10 datetime(date)— 日時の条件を組み合わせる

- desc: 日付・曜日・時刻・営業日を、すべて満たす / いずれか満たすで組み合わせます。
- chip: `AND / OR`
- defaultColor: red
- fields:
  - range=`A2:A100`
  - join: `all`=すべて満たす(AND) / `any`=いずれか満たす(OR)
  - conditions: 1 件以上の条件配列
- 初期条件: 日付「今日から 14 日以内」
- 各条件は `type / operator / 値 / negate` を持つ。`negate` は「この条件を除外」
- 条件の入れ子は設けず、全体の AND/OR と各条件の NOT だけを扱う

条件種別:

| type | 指定できる内容 |
| --- | --- |
| date | 今日 / 昨日 / 明日 / 過去 / 未来 / 前後 N 日 / 指定日 / 指定日以前・以後 / 指定期間 |
| weekday | 月〜日の任意の組み合わせ。平日 / 土日 / すべてのショートカット |
| time | 指定時刻より前・後 / 時間帯 / 現在から N 時間・N 分以内 |
| business | 営業日 / 休業日 / 祝日・会社休業日 / 今日から N 営業日以内 |

数式生成:

- 全体を `ISNUMBER(左上セル)` でガードし、空白や文字列を除外
- date は `INT(セル)` で時刻部分を除いて比較。指定日・期間は `DATE(年,月,日)` へ変換
- weekday は `WEEKDAY(INT(セル),2)` を使用
- time の時刻部分は `MOD(セル,1)` と `TIME(時,分,0)` を使用
- 日をまたぐ時間帯(例: 22:00〜05:00)は 2 条件を OR で接続
- 現在からの時間・分は `NOW()` と `N/24` または `N/1440` を使用
- business は休業曜日を 7 桁マスク(月〜日、休業日=`1`)に変換し、
  `NETWORKDAYS.INTL` / `WORKDAY.INTL` へ渡す
- 祝日・会社休業日はユーザー指定範囲を参照する。Google スプレッドシートの別シートは
  `INDIRECT`、Excel は直接参照

デフォルト数式(共通):

`=AND(ISNUMBER(A2),AND(INT(A2)>=TODAY(),INT(A2)<=TODAY()+14))`

組み合わせ例(すべて満たす):

```text
=AND(
  ISNUMBER(A2),
  AND(INT(A2)>=TODAY(),INT(A2)<=TODAY()+14),
  OR(WEEKDAY(INT(A2),2)=1,WEEKDAY(INT(A2),2)=3,WEEKDAY(INT(A2),2)=5),
  AND(MOD(A2,1)>=TIME(9,0,0),MOD(A2,1)<=TIME(17,0,0))
)
```

営業日:

- 営業日: `NETWORKDAYS.INTL(INT(A2),INT(A2),"0000011",祝日範囲)=1`
- 休業日: 上記末尾を `=0`
- 祝日のみ: `COUNTIF(祝日範囲,INT(A2))>0`
- N 営業日以内: `WORKDAY.INTL(TODAY(),N,"0000011",祝日範囲)` を上限にし、
  対象日自体も営業日か確認
- 祝日範囲は「祝日のみ」では必須、他は任意
- 休業曜日が 7 日すべての場合は検証エラー

プレビュー:

- 今日を基準とした連続日・複数時刻を表示し、入力中の全条件を JavaScript でも評価
- 祝日範囲があるときは、将来の営業日 1 日を「祝日例」として表示

### 6.11 blank(other)— 空白セル(未入力)を色付け

- desc: 入力漏れのセルに色を付けます。「入力済みセル」への色付けにも切り替えられます。
- chip: `=""`
- fields: range=`A2:A100` / mode(select: blank=空白のセル, filled=空白でないセル)
- defaultColor: yellow
- 数式(共通): `=A2=""` / `=A2<>""`
- notes:
  - both: `ISBLANK(セル)` でも判定できますが、数式が返す空文字("")は空白扱いに
    なりません。`=セル=""` の書き方が実用的です。
  - sheets: 標準の条件「空白」「空白ではない」でも設定できます。
- sample(header `担当者`): `田中` / (空)/ `佐藤` / (空)を mode で判定して m

### 6.12 duplicate(other)— 重複しているデータを色付け

- desc: 同じ値が 2 回以上出てくるセルに色を付けます。名簿やメール一覧の重複チェックに。
- chip: `COUNTIF`
- fields: range=`A2:A100` / mode(select: all=重複しているすべてのセル,
  second=2 個目以降のセルだけ)
- defaultColor: red
- 数式(共通、範囲は `parseRange.abs` を使用):
  - all: `=AND(A2<>"",COUNTIF($A$2:$A$100,A2)>1)`
  - second: `=AND(A2<>"",COUNTIF($A$2:A2,A2)>1)`(絶対参照の先頭セル〜相対参照の現在セル)
- notes:
  - both: 空白セル同士が重複と判定されないよう空白を除外しています。
  - both: 数式内の範囲は適用範囲から自動で作られています。適用範囲を変えると数式も変わります。
- sample(header `メール`): `sato@example.com` / `tanaka@example.com` / `sato@example.com` /
  `suzuki@example.com` / `tanaka@example.com` を mode で実際に判定して m

### 6.13 stripes(other)— 1 行おきに色を付ける(縞模様)

- desc: 大きな表を読みやすくするゼブラ模様。行を増減しても縞が崩れません。
- chip: `MOD(ROW(),2)`
- fields: range=`A2:C100` / mode(select: even=偶数行, odd=奇数行)
- defaultColor: gray
- 数式(共通): `=MOD(ROW(),2)=0` / `=MOD(ROW(),2)=1`
- notes:
  - sheets: メニュー「表示形式」→「交互の背景色」でも同様の見た目にできます。
  - excel: 表全体なら「テーブルとして書式設定」を使う方法もあります。
- sample(header `日付/項目/金額`): `4/1/文具/1,200`・`4/3/交通費/860`・`4/5/会議費/3,400`・
  `4/8/消耗品/540` の 4 行。**実際のシート行番号(範囲先頭行+i)の偶奇**で行 m を計算

### 6.14 inList(other)— 別のリストにある値を色付け

- desc: NG ワードや会員名簿など、別の場所に用意したリストと一致するセルに色を付けます。
- chip: `COUNTIF + INDIRECT`
- fields: range=`A2:A100` / listRange(text, mono, default `E2:E10`, label「リストの範囲」,
  help「同じシート内の範囲。別シートは シート名!A2:A10 の形式」)
- defaultColor: blue
- listRange の処理: `!` を含む場合は前半をシート名、後半を範囲としてパース(範囲部分は
  `parseRange` で検証し `abs` 化)。含まない場合は全体を範囲としてパース
- 数式:
  - 同一シート(共通): `=AND(A2<>"",COUNTIF($E$2:$E$10,A2)>0)`
  - 別シート sheets: `=AND(A2<>"",COUNTIF(INDIRECT("Sheet2!$E$2:$E$10"),A2)>0)`
  - 別シート excel: `=AND(A2<>"",COUNTIF(Sheet2!$E$2:$E$10,A2)>0)`
- notes:
  - sheets: カスタム数式から別シートを直接参照できないため、`INDIRECT("シート名!範囲")`
    を使います。
  - excel: 最近の Excel は別シート参照をそのまま書けます(Excel 2007 以前は名前付き範囲が
    必要でした)。
- validate: listRange パース不能 → 「リストの範囲を A2:A10 の形式で入力してください」
- sample(header `商品`、静的): `りんご`(m) / `みかん` / `バナナ`(m) / `ぶどう`

## 7. フォーム生成

- フィールド型: `range`(text + `.mono`)/ `text` / `number` / `column`(text + `.mono`,
  maxlength 3)/ `select` / `weekdays` / 色パレット
- 各フィールドは `.field`(label + input + `.help`)。範囲系・キーワード系など主要入力は
  そのまま、フォームは CSS グリッドに任せる。help 文はフィールド定義の `help` を表示
- select は `<select>` で生成。number は `input[type=number]`
- `weekdays` は月〜日のトグルボタンと「平日 / 土日 / すべて」のショートカットを表示
- datetime は専用フォームを使う。条件カードの追加・削除、種別変更、曜日チップ、
  条件ごとの除外をイベント委譲で処理し、変更のたびに数式・プレビューを更新
- 色パレットは `.field.field-wide` 内に `.palette` として生成。label は「書式の色」

## 8. 結果の描画

### 数式カード

- `#formula-label`: sheets → `カスタム数式`、excel → `数式(新しい書式ルール)`
- `#formula-output` へ **textContent** で設定(innerHTML 禁止)
- validate エラー時: `#formula-output` に `—` を表示し、`#formula-error` にエラー文を表示
- コピー: `navigator.clipboard.writeText`、失敗時は一時 textarea + `document.execCommand('copy')`
  にフォールバック。成功時はボタンを「コピーしました ✓」+ `.copied` にして 1.6 秒後に戻す

### 手順(`#steps-title` / `#steps-list`)

sheets(タイトル「Google スプレッドシートでの設定手順」):
1. 対象の範囲 `<code>{range}</code>` を選択します。
2. メニューの<span class="ui-name">「表示形式」→「条件付き書式」</span>を開きます。
3. 「セルの書式設定の条件…」で<span class="ui-name">「カスタム数式」</span>を選択します。
4. 数式欄に上の数式を貼り付けます。
5. 「書式設定のスタイル」で塗りつぶしの色({色スウォッチ}{色名})を選び、
   <span class="ui-name">「完了」</span>を押します。

excel(タイトル「Excel での設定手順」):
1. 対象の範囲 `<code>{range}</code>` を選択します。
2. <span class="ui-name">「ホーム」タブ →「条件付き書式」→「新しいルール」</span>をクリックします。
3. <span class="ui-name">「数式を使用して、書式設定するセルを決定」</span>を選択します。
4. 「次の数式を満たす場合に値を書式設定」に上の数式を貼り付けます。
5. <span class="ui-name">「書式」</span>ボタン →「塗りつぶし」タブで色({色スウォッチ}{色名})を
   選び、OK で閉じます。

{色スウォッチ} は `<span class="color-inline" style="background:{bg}"></span>`。
{range} などユーザー入力は escHtml 必須。

### プレビュー(`#preview`)

- スプレッドシート風テーブル。左上に空の角セル、上辺に **範囲の開始列からの列記号**
  (A, B, C…)、左辺に行番号
- 適用範囲が複数列ならプレビューも同じ列数に広げる。ただし 7 列以上は先頭 6 列だけを
  描画し、「{全列数}列のうち先頭6列を表示」と明記する
- 範囲の開始行が 2 以上のとき、その 1 行上をヘッダー行(`td.head-row`)としてサンプルの
  header ラベルを表示。開始行 1 のときはヘッダー行なし
- データ行は範囲開始行から連番。マッチセル(またはマッチ行の全セル)に選択色を
  `style="background:{bg};color:{fg}"` で適用
- 数値セルは `td.num`。DOM 生成は createElement / textContent(innerHTML 不使用)

### ヒント(`#notes-card` / `#notes-list`)

- ルールの notes から `app === state.app || app === 'both'` のものだけ表示
- 0 件なら `#notes-card` を `.hidden`
- note 本文内のコード表記は `<code>` を使ってよい(静的文字列のみ、ユーザー入力は含めない)

## 9. README.md

日本語で簡潔に、タイトル / ツール概要 / 主な特徴 / 公開 URL
`https://yakinik.github.io/conditional-formatting/` までを記載する。それ以降の使い方・
パターン一覧・開発者向け情報・ライセンス節は書かない。main へも同じ内容を同期する。

## 10. 品質要件

- `app.js` 冒頭は `'use strict';`。グローバル汚染は IIFE か素の const 群で最小限に
- 依存なし・ビルドなし。`file://` 直開きでも動くこと(fetch や module import を使わない)
- XSS: ユーザー入力(キーワード・範囲・値)を innerHTML に渡す場合は必ず escHtml。
  数式・プレビューは textContent / createElement
- 数式はこの仕様の期待出力と**完全一致**すること(セル参照は範囲入力に追従)
- 変数・関数名は英語、コメントは書きすぎない(意図が不明瞭な箇所のみ)
