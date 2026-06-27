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

Geminiを使う場合は、`apps/api/.env.example` を参考に `apps/api/.env` にAPIキーを書きます。APIキー未設定でもdeterministic templateにfallbackして動きます。

```bash
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-3.1-flash-lite
```

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
- API: uvで依存関係を同期し、FastAPI appをimportできるか確認
- Infra: Docker Compose設定の構文確認

MVPでは自動デプロイやcoverage gateは入れず、mainが壊れていないことを確認する軽いCIに留めます。

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

Action Card schemaは [docs/action_card_schema.md](docs/action_card_schema.md) に整理しています。

次はschemaに沿ったseedデータを作り、FastAPIからAction Card一覧を返す最小APIを実装します。
