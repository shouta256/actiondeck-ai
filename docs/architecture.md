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
- Agent実行: Python workflow
- LLM: Gemini API
- 評価: FastAPI endpoint + 評価ケースJSON

LangGraphとpgvectorは今後の拡張候補です。MVPでは、処理の境界を先に明確にするため、`apps/api/app/agents` のPython workflowで `Triage -> Retrieval -> Planning -> Safety` を実装しています。

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
- Evaluation画面で評価ケースの結果を表示する

## 今後の拡張候補

- seed evidence検索をpgvector検索に置き換える
- Python workflowをLangGraphに置き換える
- Calendar読み取りなど、外部連携を1本だけ追加する
- Evaluationを実際のAgent Run workflowに接続し、改善サイクルを強くする
