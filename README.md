# Format Lab — 条件付き書式ワークベンチ

Excel ライクな表を見ながら、Google スプレッドシート / Excel の条件付き書式を組み立てる静的 Web アプリです。
複数のルールと AND / OR / NOT の条件グループを、実データへ即時反映して確認できます。

公開 URL: <https://yakinik.github.io/conditional-formatting/>

## 主な機能

- シートタブ付きの表プレビューとドラッグ範囲選択
- シートごとの優先順位付きルール
- 文字、数値、日付、時刻、曜日、営業日、空白、チェックボックス、重複、交互色、別リスト参照
- 条件の AND / OR / NOT と入れ子グループ
- 選択ルールの一致セルを示す「ルールレンズ」
- Google スプレッドシート / Excel 用カスタム数式と設定手順
- XLSX / CSV / TSV のファイル選択・ドロップ、および表形式テキストの貼り付け

取り込んだデータはサーバーへ送信せず、ブラウザ内だけで処理します。表示上限は 1 シートあたり200行×26列、最大20シート、ファイルサイズは10MBです。

## 開発

Node.js 20.19 以上と pnpm 10 を使用します。

```sh
pnpm install
pnpm dev
```

検証と本番ビルド:

```sh
pnpm check
pnpm build
```

`pnpm check` は型検査、Vitest、Feature-Sliced Design の境界検査、本番ビルドを実行します。
`pnpm build` は Vite の成果物を `dist/` に生成し、GitHub Pages 用の `index.html`、`style.css`、`app.js` をリポジトリ直下へ同期します。

## 構成

Feature-Sliced Design v2.1 の Pages First 方針に従い、単一画面で必要な最小レイヤーにしています。

```text
src/
├─ app/                 # エントリーポイント、全体スタイル
├─ pages/workbench/     # 表、ルールモデル、取り込み、画面UI
└─ shared/ui/           # 再利用する小さなUI部品
```

現時点では再利用先のない `features`、`entities`、`widgets` は設けていません。

## 取り込み範囲

XLSX からはシート名とセル値（日付・数値・真偽値を含む）を取り込み、現在設定中のルールを新しい先頭シートへ引き継ぎます。XLSX 内に保存されている既存の条件付き書式、数式計算、セル編集、XLSX 書き出しは対象外です。
