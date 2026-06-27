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
- データベース: PostgreSQL 18
- Agent実行: Python workflow + LangGraph runner
- LLM: Gemini API
- 評価: FastAPI endpoint + 評価ケースJSON

MVPでは、まず処理の境界を明確にするため、`apps/api/app/agents` のPython workflowで `Triage -> Retrieval -> Planning -> Safety` を実装しています。Phase 2ではLangGraph移行を進めており、現在は既存nodeを同じ順序で実行するLangGraph runnerを追加しています。pgvectorは今後の導入対象です。

## ディレクトリの責務

- `apps/web`: ユーザーがAction Cardを確認・承認する画面
- `apps/api`: Action Card、Evidence、Agent Traceを扱うAPI
- `apps/api/app/agents`: Agent Runのworkflowと各node
- `infra`: ローカル開発用のDBなどのインフラ設定
- `data/seed`: デモ用の手動インポートデータ
- `data/eval_cases`: 評価ケース
- `docs`: 設計判断やデモシナリオの説明

## 現在の実装状態

- Action Card schemaはPydanticを正として実装済み
- Inbox Item、Action Card、Evidence、Agent Trace、Review EventのAPIを実装済み
- Agent RunはGemini生成とdeterministic fallbackを実装済み
- Agent Run結果はPostgreSQLに保存する。接続できない場合は開発用にメモリ保存へfallbackする
- WebではAction Card詳細、Evidence、Trace、Review、Agent Run結果を表示する
- Evaluation画面でAgent Workflowをdeterministic modeで実行し、評価ケースの期待値と比較する

## Phase 2の拡張方針 (確定順序)

MVPの縦スライスを保ったまま、以下の順番で拡張する。

1. 評価ケース拡充 (10〜12件)
2. Python workflowをLangGraphへ移行する (現在は同順序runnerを追加済み。次にconditional edge / fallback / approval gate を含める)
3. seed evidence検索をpgvector検索へ置き換える (lexical fallbackは残す)
4. Calendar read-only OAuthを追加する (予定作成はせず、衝突検知と提案に留める)
5. (条件付き) Calendar同期ジョブでretry/idempotencyが必要ならGo sync workerを切り出す
6. (最後) Gmail OAuthをInbox Adapterの1つとして検討する

あわせて、Geminiあり評価を手動実行用に分け、deterministic評価およびpgvector on/offと比較する。
