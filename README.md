# ActionDeck AI

ActionDeck AIは、日常に散らばるメール、予定、メモ、資料を、根拠付きで承認可能な「次の行動カード」に変換するAI Agentアプリです。

LINEヤフー新卒特別枠に提出するポートフォリオとして、MVPではGmail本番連携ではなく、手動インポートデータからAgent体験の縦スライスを作ります。

## MVPの主役

- Action Card
- Evidence Panel
- Agent Trace
- Human-in-the-loop
- Evaluation

## 技術構成

- フロントエンド: Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui
- バックエンド: FastAPI, Python, uv
- データベース: PostgreSQL 18, pgvector
- Agent Runtime: LangGraph
- 評価: Python script

## 必要なツール

- Node.js 20.19.0以上
- npm 10以上
- Python 3.12以上
- uv
- Docker

Next.js 16系の依存パッケージがNode.js 20.19.0以上を要求するため、手元のNode.jsが古い場合は更新してください。

## 起動

### フロントエンド

```bash
npm run dev:web
```

http://localhost:3000 を開きます。

### バックエンド

```bash
npm run dev:api
```

ヘルスチェック:

```bash
curl http://127.0.0.1:8000/health
```

### PostgreSQL

```bash
npm run start:db
```

停止:

```bash
npm run stop:db
```

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

## 次の実装

次はAction Card JSON schemaを確定し、フロントエンド、API、DB、Agent出力、評価スクリプトの共通契約を作ります。
