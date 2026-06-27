# ActionDeck AI API

ActionDeck AIのバックエンドです。

現時点では、開発環境の疎通確認用に最小のFastAPIアプリだけを用意しています。

## 起動

リポジトリルートから実行します。

```bash
npm run dev:api
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

## Gemini設定

Gemini APIキーはコミットしません。`apps/api/.env.example` を参考に、ローカルの `apps/api/.env` に値を書きます。

```bash
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-3.1-flash-lite
```

`GEMINI_API_KEY` が設定されている場合、Agent RunはGeminiでAction Card JSONを生成し、Pydantic schemaで検証します。検証に失敗した場合やAPIキーがない場合は、deterministicなテンプレートにfallbackします。どちらで生成されたかは `generation_mode` と `fallback_reason` で確認できます。
