# 条件付き書式ジェネレータ

## 目標

Google スプレッドシート / Excel の条件付き書式でよく使うパターンをカタログ化し、
「やりたいこと」を選ぶ → 反応する値や色を設定する → 設定手順とカスタム数式が表示される
静的サイトを作成し、GitHub Pages で公開する。

## 方針

- 技術: ビルド不要の静的サイト（index.html / style.css / app.js、Vanilla JS）
- 対応アプリ: Google スプレッドシート / Excel の両対応（切り替えタブ）
- UI 言語: 日本語
- 公開: `Yakinik/conditional-formatting`（public）→ GitHub Pages（gh-pages ブランチ / ルート）

## ルールカタログ（実装対象）

- テキスト: キーワード一致（部分/完全/前方/後方）、複数キーワードのいずれか
- 行: 特定の列の値で行全体を色付け、チェックボックス ON の行
- 数値: しきい値（以上/以下など）、範囲内
- 日付: 期限切れ、期限が N 日以内、土日
- その他: 空白/非空白セル、重複データ、1 行おきの縞模様、別リストに含まれる値

## 進め方（ユーザー指示による変更）

方針確定までは Fable（本セッション）、実装は Opus サブエージェントに委譲する。
委譲には fable-mindset Mode B（ガードレールブロック同梱）を使用。
仕様書: `tasks/spec-app.md`（数式・フィールド・描画仕様の SSOT）。

## タスク

- [x] 環境確認（空ディレクトリ・gh 認証）
- [x] frontend-design スキルを読み込み、デザイン方針を決める（方眼紙×帳簿、明朝+ゴシック+等幅）
- [x] index.html / style.css 作成（Fable）
- [x] app.js の実装仕様書 `tasks/spec-app.md` を作成（数式は Fable が確定）
- [x] fable-mindset Mode B で Opus に app.js + README.md の実装を委譲
      → **ユーザー指示により途中で停止**。app.js / README.md は未検収・完了報告なし
- [x] 三層ブランチ運用スキル tri-branch-pages を作成（`~/.agents/skills/tri-branch-pages/`、
      `~/.claude/skills/` から symlink）。スモークテスト: init-branches / publish(新規・冪等) 済み。
      未検証: 変更後 publish・sync-main
- [x] （Codex へ引き継ぎ: `tasks/handoff-codex.md`）app.js / README.md の検収・修正
- [x] （Codex へ引き継ぎ）tri-branch-pages init 手順で公開:
      git init -b develop → .pages-manifest → init-branches → gh repo create（Yakinik/conditional-formatting, public）
      → push → publish → default branch=main → Pages 有効化 → URL 確認
