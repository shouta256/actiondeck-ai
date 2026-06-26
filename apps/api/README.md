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
