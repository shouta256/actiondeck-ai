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
- Agent実行: LangGraph runner + legacy Python workflow
- LLM: Gemini API
- Evidence検索: PostgreSQL + pgvector + Gemini/local embedding fallback
- Calendar確認: PostgreSQL + local seed / Google Calendar read-only sync
- 評価: FastAPI endpoint + 評価ケースJSON

MVPでは、まず処理の境界を明確にするため、`apps/api/app/agents` のPython workflowで `Triage -> Retrieval -> Planning -> Safety -> Approval Gate` を実装しました。Phase 2ではLangGraph移行を進め、現在は標準Agent Runを `ignore` / `missing_info` routeで `triage -> safety -> approval_gate` に短絡し、`conflicting_evidence` / `low_risk_todo` routeで `triage -> retrieval -> safety -> approval_gate` に進めるLangGraph runnerへ切り替え済みです。legacy Python workflowは同じ評価ケースで比較するために残しています。Retrievalはpgvector top-k検索を優先し、Gemini Embeddingまたはlocal embeddingでqueryをvector化します。Safety Checkではread-onlyな `calendar_events` を参照し、候補日時と既存予定の衝突をAction Cardの安全メモへ反映します。Google Calendar OAuthはAgentから直接呼ばず、read-onlyで取得した予定を `calendar_events` に同期するAdapterとして扱います。同期期間はデフォルト90日へ制限し、繰り返し予定の過剰展開を防ぎます。DBやseedがない場合はdeterministic fallbackに戻します。

## ディレクトリの責務

- `apps/web`: ユーザーがAction Cardを確認・承認する画面
- `apps/api`: Action Card、Evidence、Agent Traceを扱うAPI
- `apps/api/app/agents`: LangGraph runner、legacy workflow、各node、共通runtime
- `infra`: ローカル開発用のDBなどのインフラ設定
- `data/seed`: デモ用の手動インポートデータ
- `data/eval_cases`: 評価ケース
- `docs`: 設計判断やデモシナリオの説明

## 現在の実装状態

- Action Card schemaはPydanticを正として実装済み
- Inbox Item、Action Card、Evidence、Agent Trace、Review EventのAPIを実装済み
- Agent RunはLangGraph runner、Gemini生成、deterministic fallback、approval gateを実装済み
- Evidence seedをPostgreSQLへ投入し、pgvectorでtop-k検索する
- Agent Run結果はPostgreSQLに保存する。接続できない場合は開発用にメモリ保存へfallbackする
- Calendar Event seedまたはGoogle Calendar read-only OAuth同期データをPostgreSQLへ投入し、予定候補の衝突をSafety Checkで確認する
- WebではAction Card詳細、Evidence、Trace、Review、Agent Run結果、Calendar Availabilityを表示する
- Evaluation画面で `deterministic` / `graph` / `gemini` modeを切り替え、評価ケースの期待値、route、Graph step path、Retrieval evidence recall、Safety note反映と比較する

## Phase 2の拡張方針 (確定順序)

MVPの縦スライスを保ったまま、以下の順番で拡張する。

1. 評価ケース拡充 (12件まで実装済み)
2. Python workflowをLangGraphへ移行する (標準Agent RunはGraphへ切り替え済み。approval gate、terminal route、conflicting evidence route、低リスクToDo routeもGraph上に表現済み)
3. seed evidence検索をpgvector検索へ置き換える (最小導入済み。Retrieval evidence recallとGemini Embedding切り替え設定も追加済み)
4. Calendar read-only OAuthを追加する (Google Calendarから `calendar_events` への同期口まで実装済み。予定作成はせず、衝突検知と提案に留める)
5. (条件付き) Calendar同期ジョブでretry/idempotencyが必要ならGo sync workerを切り出す
6. (最後) Gmail OAuthをInbox Adapterの1つとして検討する

あわせて、Geminiあり評価を手動実行用に分け、deterministic評価およびpgvector on/offと比較する。
