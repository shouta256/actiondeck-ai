# ActionDeck AI

[![CI](https://github.com/shouta256/actiondeck-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/shouta256/actiondeck-ai/actions/workflows/ci.yml)

ActionDeck AIは、**Gmail返信AIではありません。**

メールや予定をそのまま自動処理するのではなく、入力内容を根拠付きの **Action Card** に変換し、返信案・予定候補・ToDo・安全確認を1枚にまとめて、人間が承認できる状態にするAI Agentアプリです。

## 何を見てほしいか

- `Triage -> Retrieval -> Planning -> Critic -> Safety -> Approval` のAgent workflow
- LLM出力をPydantic schemaで検証し、壊れたJSONや危険な提案を早めに弾く設計
- pgvectorによるEvidence検索と、DB/API未接続時にも壊れないdeterministic fallback
- Google Calendar read-only同期を使った予定衝突チェック
- 外部アクションを自動実行せず、Human-in-the-loopで止めるApproval Gate
- 12件の評価ケースによるroute、step path、retrieval recall、safety noteの確認

```txt
ignore / missing_info
  -> triage -> critic -> safety -> approval_gate

low_risk_todo / conflicting_evidence
  -> triage -> retrieval -> critic -> safety -> approval_gate

review_required
  -> triage -> retrieval -> planning -> critic -> safety -> approval_gate
```

## 技術構成

- フロントエンド: Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui
- バックエンド: FastAPI, Python, uv
- データベース: PostgreSQL 18
- Agent実行: LangGraph runner + Planner/Critic/Safety nodes + legacy Python workflow
- LLM: Gemini API
- Evidence検索: PostgreSQL + pgvector + Gemini/local embedding fallback
- Calendar確認: local seed / Google Calendar read-only sync
- 評価: FastAPI endpoint + 評価ケースJSON + pytest

## Quick Start

初回セットアップ:

```bash
make setup
```

デモ前の再現性チェック:

```bash
make demo
```

WebとAPIを起動:

```bash
make up
```

http://localhost:3000 を開きます。

`make demo` はDB起動、schema確認、Evidence/Calendar seed、Web build、API smoke test、評価、pytestを実行します。アプリの起動自体は `make up` で行います。

## 5分デモ

1. http://localhost:3000 を開く
2. `予定衝突あり` を開く
3. `Run agent` を押す
4. `Availability`、`Critic Check`、`Run Trace` を確認する
5. `/eval?mode=graph` でGraph評価を見る

詳しい見せ方は [docs/demo_scenario.md](docs/demo_scenario.md) に整理しています。

## 現在できること

- 手動インポート済みのInbox ItemからAction Cardを生成する
- GeminiでAction Card JSONを生成し、失敗時はdeterministic templateへfallbackする
- EvidenceをPostgreSQLへseedし、pgvector top-k検索する
- Agent Run、Evidence、Trace、Critic report、Calendar Availabilityを画面で確認する
- Action Cardを承認・編集済み・却下としてレビューする
- Google Calendarをread-only OAuthで接続し、予定を `calendar_events` に同期する
- 評価ケース12件でlegacy workflow / LangGraph runner / Gemini生成の出力を測定する

## 環境変数

GeminiやGoogle Calendarを使う場合は、`apps/api/.env.example` を参考に `apps/api/.env` を用意します。APIキー未設定でもdeterministic fallbackで動きます。

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

GitHub Actionsで、`main` へのpushとpull requestごとに以下を確認します。

- Web: lint、production build
- API: smoke test、deterministic/graph評価、pytest
- API DB: PostgreSQL + pgvector起動、schema確認、seed、pgvector retrieval
- Infra: Docker Compose設定の構文確認

MVPでは自動デプロイやcoverage gateは入れず、mainが壊れていないこと、Agent評価が通ること、DBありの検索基盤が動くことを確認するCIに留めています。

## ドキュメント

面接官が読むなら、まずこの順番です。

1. [docs/demo_scenario.md](docs/demo_scenario.md): デモ手順と説明ポイント
2. [docs/agent_workflow.md](docs/agent_workflow.md): Agent workflowの責務境界
3. [docs/action_card_schema.md](docs/action_card_schema.md): Action Card schemaの設計意図
4. [docs/architecture.md](docs/architecture.md): 技術構成と現在地

引き継ぎ用・戦略検討用の長いメモはローカル専用として `.gitignore` 対象にしています。

## あえてやっていないこと

- Gmail、LINEなどの本番OAuth連携
- 実行アクションの自動送信・自動登録
- legacy Python workflowの完全削除
- 本番デプロイ、認証、マルチユーザー対応

MVPでは、外部連携の配管よりも「入力から根拠付きAction Cardを作り、ユーザーが承認できる」縦スライスの完成を優先しています。
