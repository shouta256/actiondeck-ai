# ActionDeck AI Web

ActionDeck AIのフロントエンドです。

Next.js App Router、React、TypeScript、Tailwind CSS v4、shadcn/uiを使います。

## 起動

リポジトリルートから実行します。

```bash
npm run dev:web
```

または、このディレクトリで直接実行します。

```bash
npm run dev
```

## 役割

- Action Card一覧画面
- Action Card詳細画面
- Evidence Panel
- Agent Trace Timeline
- 承認・編集・却下UI

現時点では、プロジェクトの土台確認用に静的なAction Deck画面だけを置いています。

## API接続

Next.js Server ComponentからFastAPIを呼びます。

```env
ACTIONDECK_API_BASE_URL=http://127.0.0.1:8000
```

この値は `apps/web/.env.local` に設定します。未設定の場合もローカルのFastAPIに接続します。
