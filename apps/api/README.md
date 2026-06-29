# ActionDeck AI API

ActionDeck AIのバックエンドです。

FastAPIでAction Card、Evidence、Calendar Event、Agent Trace、Review Event、Agent Run、Evaluationを扱います。

Agent Runでは現在、標準経路としてLangGraph runnerを実行します。routeごとに必要なnodeだけを通し、最後にApproval Gateで外部実行せずユーザー承認待ちにします。

```txt
ignore / missing_info
  -> triage -> safety -> approval_gate

low_risk_todo / conflicting_evidence
  -> triage -> retrieval -> safety -> approval_gate

review_required
  -> triage -> retrieval -> planning -> safety -> approval_gate
```

Geminiが使えない場合やschema検証に失敗した場合は、deterministicなテンプレートにfallbackします。

`/eval/action-cards?mode=graph` では、標準Agent Runと同じLangGraph runnerを評価できます。Graph modeではrouteだけでなく、期待したstep pathとRetrieval evidence recallも確認します。`/eval/action-cards?mode=deterministic` はlegacy Python workflowの安定評価として残しています。

Evidence検索では、PostgreSQLの `evidence_items` テーブルに `embedding vector(768)` を保存し、pgvectorのcosine距離でtop-k検索します。`EMBEDDING_PROVIDER=gemini` の場合はGemini Embeddingを使い、APIキー未設定やAPI失敗時はlocal deterministic embeddingへfallbackします。DB未起動、未seed、pgvector検索失敗時はseed JSONのkeyword scoringにfallbackします。

Calendar確認では、PostgreSQLの `calendar_events` テーブルにseedまたはGoogle Calendar read-only OAuthで同期した予定を参照します。Safety CheckでInbox本文の候補日時と既存予定を比較し、衝突や空き状況をAction Cardの `safety_notes` とTraceの `calendar_availability_check` に残します。MVPでは予定作成・更新は行いません。

## 起動

リポジトリルートから実行します。

```bash
make api
```

ローカルDBを使う場合は、先にPostgresを起動します。

```bash
make db-up
```

`agent_runs` はPostgresの `agent_runs` テーブルに保存されます。Postgresに接続できない場合、開発中に画面が壊れないよう一時的にメモリ保存へfallbackします。

EvidenceとCalendar Eventのseed投入:

```bash
make db-seed
```

## 確認

```bash
curl http://127.0.0.1:8000/health
```

Action Card一覧:

```bash
curl http://127.0.0.1:8000/action-cards
```

Action Card詳細:

```bash
curl http://127.0.0.1:8000/action-cards/action_001
```

Agent Run実行:

```bash
curl -X POST http://127.0.0.1:8000/agent-runs \
  -H "Content-Type: application/json" \
  -d '{"inbox_item_id":"inbox_001"}'
```

Evaluation:

```bash
curl 'http://127.0.0.1:8000/eval/action-cards?mode=deterministic'
curl 'http://127.0.0.1:8000/eval/action-cards?mode=graph'
curl 'http://127.0.0.1:8000/eval/action-cards?mode=gemini'
```

Google Calendar接続:

```bash
curl http://127.0.0.1:8000/integrations/google-calendar/oauth/start
curl http://127.0.0.1:8000/integrations/google-calendar/status
curl -X POST http://127.0.0.1:8000/integrations/google-calendar/sync
```

## Gemini設定

Gemini APIキーはコミットしません。`apps/api/.env.example` を参考に、ローカルの `apps/api/.env` に値を書きます。

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
```

`GEMINI_API_KEY` が設定されている場合、Agent RunはGeminiでAction Card JSONを生成し、Pydantic schemaで検証します。検証に失敗した場合やAPIキーがない場合は、deterministicなテンプレートにfallbackします。どちらで生成されたかは `generation_mode` と `fallback_reason` で確認できます。

Google Calendar OAuthはread-only scopeに限定します。同期対象はデフォルトで今後90日分に制限し、繰り返し予定が何年分も展開されることを防ぎます。tokenはローカルDBの `oauth_connections` に保存します。MVPのローカル開発用実装であり、本番運用ではtoken暗号化、ユーザー分離、失効処理が必要です。
