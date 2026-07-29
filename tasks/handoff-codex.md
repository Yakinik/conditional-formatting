# 引き継ぎ: 条件付き書式ジェネレータの検収と GitHub Pages 公開

## プロジェクト概要

- 場所: `/Users/nagahata/Git/github/conditional-formatting`
- 内容: 静的サイト「条件付き書式ジェネレータ」。Google スプレッドシート / Excel の
  条件付き書式について、よく使うパターン（13 種）を選び、反応する値や色を設定すると、
  設定手順とそのまま貼れるカスタム数式が表示されるツール
- 技術: Vanilla JS・ビルド無し・外部ライブラリ無し（Google Fonts のみ）。UI は日本語
- 最終目標: GitHub Pages での公開（三層ブランチ構成）

## 現在の状態

| ファイル | 状態 |
|---|---|
| `index.html` / `style.css` | 完成（設計確定済みの基準実装。原則変更しない） |
| `tasks/spec-app.md` | **app.js の実装仕様書（SSOT）**。数式・フィールド・描画仕様のすべて |
| `app.js` / `README.md` | 別エージェント（Claude Opus）が仕様書から実装。**未検収**。実装エージェントは途中で停止させており完了報告を受け取っていない。未完成の可能性あり |
| `.playwright-cli/` / `s1.yaml` | 実装エージェントの検証作業の残骸と思われる。内容確認のうえ不要なら削除（コミットに含めない） |
| `tasks/todo.md` | 作業計画と進捗 |

- git は**未初期化**。GitHub リポジトリも未作成
- `gh` CLI は認証済み。**2 アカウント登録があり、active は `Yakinik`**（こちらを使う）
- コミット時に gitleaks フックが走る環境

## やること

### 1. app.js / README.md の検収（最優先）

`tasks/spec-app.md` と全項目照合する。仕様書が正。特に:

- §6 の 13 ルールすべての数式が期待出力と一致すること（セル参照は適用範囲の入力に追従）
- ローカルサーバ（`python3 -m http.server` など。`file://` 直開きでも動く設計）で動作確認:
  - コンソールエラー 0 件 / カード 13 枚・5 カテゴリ描画 / カード選択 → 設定フォーム → 結果表示のフロー
  - アプリ切替（ヘッダーのトグル）で手順・数式が切り替わる
  - コピーボタンで「コピーしました ✓」表示
- 数式スポットチェック（`#formula-output` の文字列一致）:
  - (a) 「キーワードに反応」デフォルト → `=ISNUMBER(SEARCH("至急",A2))`
  - (b) 同ルールで範囲を `B3:B50` に変更 → `=ISNUMBER(SEARCH("至急",B3))`
  - (c) 「特定の列の値で行全体」デフォルト → `=$C2="完了"`
  - (d) 「しきい値」で演算子「以下」 → `=AND(ISNUMBER(A2),A2<=100)`
  - (e) 「重複」デフォルト → `=AND(A2<>"",COUNTIF($A$2:$A$100,A2)>1)`
  - (f) 「別のリスト」でリスト範囲 `Sheet2!E2:E10` → sheets 表示:
    `=AND(A2<>"",COUNTIF(INDIRECT("Sheet2!$E$2:$E$10"),A2)>0)` / Excel 切替:
    `=AND(A2<>"",COUNTIF(Sheet2!$E$2:$E$10,A2)>0)`
- 不備・未実装があれば仕様書に合わせて修正または実装。数式を仕様と変えるべきだと
  判断した場合は独断で変えず、理由を付けて報告
- `README.md` は仕様書 §9 の要件（概要 / 使い方 / 13 パターン一覧 / 公開 URL /
  ローカル確認方法。ライセンス節は書かない）を満たすこと

### 2. 三層ブランチ構成での公開

共有スキル `~/.agents/skills/tri-branch-pages/`（`SKILL.md` を読むこと）を使う。
構成: `main`=README・docs のみ（デフォルト）/ `develop`=ソース一式 /
`gh-pages`=公開ファイルのみ（Pages 配信元）。

重要な安全規則: **main / gh-pages を作業ツリーで checkout しない**。
両ブランチへの書き込みは `scripts/tbp.sh` が一時 worktree 経由で行う。

手順（SKILL.md の init 節と同じ）:

1. `git init -b develop`
2. `.pages-manifest` を作成（内容: `index.html` / `style.css` / `app.js` の 3 行）
3. 必要なら `.gitignore`（`.playwright-cli/` など）。全ファイルを develop にコミット
4. `bash ~/.agents/skills/tri-branch-pages/scripts/tbp.sh init-branches`
5. `gh repo create Yakinik/conditional-formatting --public --source=. --remote=origin`
6. `git push -u origin develop main`
7. `bash ~/.agents/skills/tri-branch-pages/scripts/tbp.sh publish`
8. `gh repo edit Yakinik/conditional-formatting --default-branch main`
9. Pages 有効化:
   `gh api -X POST "repos/Yakinik/conditional-formatting/pages" -f "source[branch]=gh-pages" -f "source[path]=/"`
   （409 なら有効化済み → `-X PUT` で配信元更新）
10. `https://yakinik.github.io/conditional-formatting/` の表示を確認（初回ビルド 1〜2 分）

リポジトリ作成・push・公開は本タスクの明示された目的なので実行してよい。

### 3. 補足タスク

- tri-branch-pages スクリプトのスモークテストは途中まで実施済み
  （場所: `/private/tmp/claude-501/-Users-nagahata-Git-github-conditional-formatting/9b8c28a2-0c21-4717-8ba3-8865ee07188b/scratchpad/tbp-test`）。
  検証済み: `init-branches` / `publish`(新規作成) / `publish`(冪等・no changes)。
  **未検証: develop 変更後の `publish` 反映と `sync-main`**。実プロジェクトでの
  利用がそのまま検証になるので、実行結果（特に sync-main）を注視すること
- `tasks/todo.md` のチェックボックスを進捗に合わせて更新すること

## 報告してほしいこと

1. 検収結果: 仕様書 §1〜§10・§6.1〜§6.13 の各項目の合否と、修正した箇所
2. スポットチェック (a)〜(f) の実測値
3. 公開 URL と Pages のビルド状態
4. tri-branch-pages の未検証だった 2 操作の実行結果
5. 気付いたが変更しなかった点
