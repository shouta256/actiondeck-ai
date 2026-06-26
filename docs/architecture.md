# ActionDeck AI アーキテクチャメモ

## 現時点の方針

ActionDeck AIは、メール返信AIではなく、日常の情報を根拠付きのAction Cardに変換するレビュー支援Agentです。

MVPでは外部サービス連携を広げず、手動インポートしたデータから以下の流れを作ります。

1. 入力データを受け取る
2. 必要な根拠を検索する
3. Action Cardを生成する
4. Agentの判断過程を残す
5. ユーザーが承認・編集・却下する
6. 評価ケースで品質を測る

## 技術構成

- フロントエンド: Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui
- バックエンド: FastAPI, Python, uv
- データベース: PostgreSQL 18, pgvector
- Agent実行: LangGraph
- 評価: Python script

## ディレクトリの責務

- `apps/web`: ユーザーがAction Cardを確認・承認する画面
- `apps/api`: Action Card、Evidence、Agent Traceを扱うAPI
- `infra`: ローカル開発用のDBなどのインフラ設定
- `data/seed`: デモ用の手動インポートデータ
- `data/eval_cases`: 評価ケース
- `docs`: 設計判断やデモシナリオの説明

## 次に決めること

次のステップでは、Action Card JSON schemaを確定します。

schemaを先に固める理由は、UI、DB、Agent出力、評価スクリプトの共通契約になるためです。
