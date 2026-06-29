# ActionDeck AI

[![CI](https://github.com/shouta256/actiondeck-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/shouta256/actiondeck-ai/actions/workflows/ci.yml)

ActionDeck AIは、日常に散らばるメール、予定、メモ、資料を、根拠付きで承認可能な「次の行動カード」に変換するAI Agentアプリです。

LINEヤフー新卒特別枠に提出するポートフォリオとして、MVPではGmail本番連携ではなく、手動インポートデータからAgent体験の縦スライスを作ります。

## MVPの主役

- Action Card
- Evidence Panel
- Agent Trace
- Human-in-the-loop
- Evaluation
- Agent Run

## 技術構成

- フロントエンド: Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui
- バックエンド: FastAPI, Python, uv
- データベース: PostgreSQL 18
- Agent実行: LangGraph runner + legacy Python workflow
- LLM: Gemini API
- Evidence検索: PostgreSQL + pgvector + deterministic fallback
- Calendar確認: local seed / Google Calendar read-only sync
- 評価: FastAPI endpoint + 評価ケースJSON

MVPでは、まずAgent体験の縦スライスを優先するため、Pythonの小さなworkflowとseed evidenceから始めました。現在の標準Agent RunはLangGraph runnerを使い、routeごとに必要なnodeだけを通します。RetrievalではPostgreSQLのpgvector indexを優先し、DB未起動・未seed時は既存のseed scoringにfallbackします。Safety Checkではread-only calendar eventsを見て、候補日時の衝突をAction Cardの安全メモに反映します。Google Calendar OAuthを使う場合も、予定をread-onlyで取得して `calendar_events` に同期するだけで、予定作成・更新は行いません。legacy Python workflowは評価比較用に残しています。

```txt
ignore / missing_info
  -> triage -> safety -> approval_gate

low_risk_todo / conflicting_evidence
  -> triage -> retrieval -> safety -> approval_gate

review_required
  -> triage -> retrieval -> planning -> safety -> approval_gate
```

## 現在できること

1. 手動インポート済みのInbox Itemを表示する
2. Action Cardの一覧・詳細を表示する
3. Agent Runを実行し、GeminiでAction Card JSONを生成する
4. Geminiが使えない場合はdeterministic templateにfallbackする
5. Agent RunをPostgreSQLの `agent_runs` テーブルに保存する
6. EvidenceをPostgreSQLの `evidence_items` テーブルにseedし、pgvector top-k検索する
7. Calendar EventをPostgreSQLの `calendar_events` テーブルにseedし、予定候補の衝突を確認する
8. Google Calendarをread-only OAuthで接続し、予定を `calendar_events` に同期する
9. 実行結果としてAction Card、Evidence、Agent Traceを画面に表示する
10. Action Cardを承認・編集済み・却下としてレビューする
11. 評価ケース12件でlegacy workflow / LangGraph runner / Gemini生成の出力を測定する
12. Graph評価ではroute、期待したstep path、Retrieval evidence recall、Safety note反映も確認する

Agent Workflowの設計は [docs/agent_workflow.md](docs/agent_workflow.md) に整理しています。

## 必要なツール

- Node.js 20.19.0以上
- npm 10以上
- Python 3.12以上
- uv
- Docker

Next.js 16系の依存パッケージがNode.js 20.19.0以上を要求するため、手元のNode.jsが古い場合は更新してください。

## Quick Start

初回セットアップ:

```bash
make setup
```

WebとAPIを起動:

```bash
make up
```

http://localhost:3000 を開きます。

デモ前にDB seedと評価をまとめて確認する場合:

```bash
make demo
```

`make demo` はDB起動、DB schema確認、Evidence/Calendar seed、Web build、API smoke test、評価、pytestを実行し、最後に見るべきURLとシナリオを表示します。アプリの起動自体は `make up` で行います。

Geminiを使う場合は、`apps/api/.env.example` を参考に `apps/api/.env` にAPIキーを書きます。APIキー未設定でもdeterministic templateにfallbackして動きます。

```bash
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-3.1-flash-lite
EMBEDDING_PROVIDER=local
GEMINI_EMBEDDING_MODEL=gemini-embedding-2
EMBEDDING_DIMENSIONS=768
GOOGLE_OAUTH_CLIENT_ID=your_client_id
GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret
GOOGLE_OAUTH_REDIRECT_URI=http://127.0.0.1:8000/integrations/google-calendar/oauth/callback
GOOGLE_CALENDAR_SCOPES=https://www.googleapis.com/auth/calendar.readonly
GOOGLE_CALENDAR_SYNC_DAYS=90
GOOGLE_CALENDAR_SYNC_MAX_RESULTS=100
ACTIONDECK_WEB_BASE_URL=http://localhost:3000
```

Gemini Embeddingを使う場合は `EMBEDDING_PROVIDER=gemini` にします。APIキー未設定、またはEmbedding API呼び出しに失敗した場合はlocal deterministic embeddingへfallbackします。

## Demo Flow

1. `make setup` で依存関係とローカルDBを準備する
2. `make demo` でseedと評価が通ることを確認する
3. `make up` でWebとAPIを起動する
4. http://localhost:3000 を開く
5. 右側のGoogle Calendar panelで接続状態、同期状態、Upcoming Eventsを確認する
6. `予定衝突あり` の詳細を開く
7. Source Messageで候補日時を確認する
8. `Run agent` を押す
9. Latest Agent Runで生成されたAction Card、Calendar Availability、Evidence、Run Traceを確認する
10. Reviewで `Approve` / `Mark edited` / `Reject` を試す
11. http://localhost:3000/eval を開き、deterministic評価を確認する
12. http://localhost:3000/eval?mode=graph でLangGraph runner評価とstep path評価を確認する
13. http://localhost:3000/eval?mode=gemini でGemini評価を確認する

デモシナリオは [docs/demo_scenario.md](docs/demo_scenario.md) に整理しています。

## 個別起動

### フロントエンド

```bash
make web
```

http://localhost:3000 を開きます。

WebはServer ComponentからFastAPIを呼びます。APIのURLは `apps/web/.env.local` の `ACTIONDECK_API_BASE_URL` で変更できます。

### バックエンド

```bash
make api
```

ヘルスチェック:

```bash
curl http://127.0.0.1:8000/health
```

Action Card一覧:

```bash
curl http://127.0.0.1:8000/action-cards
```

### PostgreSQL

```bash
make db-up
```

停止:

```bash
make db-down
```

DBをvolumeごと作り直す場合:

```bash
make db-reset
```

EvidenceとCalendar EventをローカルDBへseedする場合:

```bash
make db-seed
```

`EMBEDDING_DIMENSIONS` を変えた場合や、既存DBが古い `vector(32)` の場合は、`make db-reset` でDBを作り直してください。Calendar Eventはread-onlyな判断材料として使い、MVPでは予定作成や外部カレンダー更新は行いません。

### Google Calendar read-only OAuth

Google Cloud ConsoleでCalendar APIを有効化し、OAuth ClientのAuthorized redirect URIに以下を登録します。

```txt
http://127.0.0.1:8000/integrations/google-calendar/oauth/callback
```

`apps/api/.env` に `GOOGLE_OAUTH_CLIENT_ID` と `GOOGLE_OAUTH_CLIENT_SECRET` を設定したうえで、認可URLを取得します。

Web画面から接続する場合は、http://localhost:3000 のGoogle Calendar panelで `Connect` を押します。同期は同じpanelの `Sync` から実行できます。

curlで確認する場合:

```bash
curl http://127.0.0.1:8000/integrations/google-calendar/oauth/start
```

返ってきた `authorization_url` をブラウザで開きます。認可後にcallbackが成功すると、APIのJSON画面ではなく `ACTIONDECK_WEB_BASE_URL` のWeb画面へ戻ります。

```bash
curl -X POST http://127.0.0.1:8000/integrations/google-calendar/sync
curl 'http://127.0.0.1:8000/calendar-events/upcoming?limit=5'
```

tokenはローカルDBの `oauth_connections` に保存します。MVPではread-only scopeかつローカル開発用の保存です。本番運用ではtoken暗号化、ユーザー分離、失効処理が必要です。

同期対象はデフォルトで今後90日分です。繰り返し予定が何年分も展開されないよう、`GOOGLE_CALENDAR_SYNC_DAYS` で期間を制限しています。同期済みの予定はGoogle Calendar panelのUpcoming Events、または `/calendar-events/upcoming` APIで確認できます。

## 開発チェック

```bash
make check
```

個別には以下も使えます。

```bash
make web-lint
make web-build
make api-check
make compose-check
```

## CI

GitHub Actionsで、`main`へのpushとpull requestごとに最低限の確認を実行します。

- Web: 依存関係のインストール、lint、production build
- API: uvで依存関係を同期し、app smoke test、deterministic/graph評価、pytestを実行
- API DB: Docker ComposeでPostgreSQL + pgvectorを起動し、DB schema、seed、pgvector retrievalを確認
- Infra: Docker Compose設定の構文確認

MVPでは自動デプロイやcoverage gateは入れず、mainが壊れていないこと、Agent評価が通ること、DBありの検索基盤が動くことを確認するCIに留めます。

## ディレクトリ構成

```txt
apps/
  web/        # Next.jsフロントエンド
  api/        # FastAPIバックエンド
data/
  seed/       # デモ用の手動インポートデータ
  eval_cases/ # 評価ケース
docs/         # 設計メモ
infra/        # ローカルインフラ設定
```

## 現時点であえてやっていないこと

- Gmail、LINEなどの本番OAuth連携
- 実行アクションの自動送信・自動登録
- legacy Python workflowの完全削除
- 外部Embedding APIの品質比較と運用設計
- 本番デプロイと認証

MVPでは、外部連携の配管よりも「入力から根拠付きAction Cardを作り、ユーザーが承認できる」縦スライスの完成を優先しています。

これらはMVPで「やらない」と決めたものですが、Phase 2では順番を設計して取り込みます。確定順序は、評価ケース拡充 → LangGraph移行 → pgvector → Calendar read-only OAuth → (条件付き)Go sync worker → (最後)Gmail OAuth です。評価ケースは12件まで拡充済みで、pgvectorの最小導入、Gemini Embedding切り替え設定、ローカルCalendar availability確認、Google Calendar read-only OAuthの同期口まで完了しています。次は検索品質比較を厚くするか、提出向けのデプロイへ進む想定です。

Action Card schemaは [docs/action_card_schema.md](docs/action_card_schema.md) に整理しています。
