# Handoff Guide

このドキュメントは、別のコーディングAIエージェントがActionDeck AIの開発を引き継ぐための作業メモです。

プロジェクトの目的、ここまでの実装、作業の進め方、コミット方針、次にやるべきことをまとめています。新しいエージェントは、まずこのファイル、次に `README.md`、`docs/architecture.md`、`docs/agent_workflow.md`、`docs/demo_scenario.md` を読んでください。

## プロジェクト概要

ActionDeck AIは、LINEヤフー新卒特別枠に提出するポートフォリオ用のAI Agentアプリです。

単なるGmail返信AIではなく、日常のメール、予定、メモ、資料を、根拠付きで承認可能な「Action Card」に変換するレビュー支援Agentとして設計しています。

MVPでは外部サービス本番連携は広げず、手動インポート済みのseedデータから以下の縦スライスを完成させています。

```txt
Inbox Item
  -> Agent Workflow
  -> Gemini / deterministic fallback
  -> Action Card
  -> Evidence
  -> Agent Trace
  -> Human-in-the-loop Review
  -> Evaluation
```

## 重要な方針

- README、docs、コードコメントは日本語を基本にする
- UIはAIっぽい派手な見た目にしない
- 業務ツール風に、シンプルで静かなデザインにする
- 実装前に「次に何を作るか」をユーザーへ説明する
- 実装後に「どのファイルで何を実装したか」を説明する
- 1機能・1ステップごとにcommitする
- commit messageは短い英文にする
- AIっぽいcommit messageは避ける
- pushはユーザーが明示したときだけ行う
- `.env` やAPIキーは絶対にcommitしない

## 作業の流れ

このプロジェクトでは、以下のリズムで進めています。

1. 次の実装候補を説明する
2. ユーザーが実装を依頼する
3. 既存コードを読む
4. 既存設計に合わせて小さく実装する
5. `make check` で確認する
6. 実装内容を日本語で説明する
7. ユーザーが依頼したらcommitする
8. ユーザーが依頼したらpushする

実装だけを急がず、ユーザーが理解できるように説明しながら進めることが重要です。

## 現在の技術構成

- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui
- Backend: FastAPI, Python 3.12, uv
- DB: PostgreSQL 18
- LLM: Gemini API
- Agent: Python workflow
- Evaluation: FastAPI endpoint + JSON eval cases
- CI: GitHub Actions
- Local commands: Makefile

LangGraphとpgvectorは現時点では未導入です。今後の拡張候補としてREADME/docsに明記しています。

## 起動と確認

初回セットアップ:

```bash
make setup
```

WebとAPI起動:

```bash
make up
```

確認:

```bash
make check
```

個別確認:

```bash
make web-lint
make web-build
make api-check
make compose-check
make db-check
```

Geminiを使う場合は `apps/api/.env` に以下を書く。`.env` はgit管理外です。

```bash
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-3.1-flash-lite
```

APIキー未設定でもdeterministic template fallbackで動きます。

## 主要ディレクトリ

```txt
apps/
  web/        Next.js frontend
  api/        FastAPI backend
data/
  seed/       デモ用seedデータ
  eval_cases/ 評価ケース
docs/         設計、シナリオ、引き継ぎメモ
infra/        Docker ComposeとPostgres初期化
```

## 主要実装

### Action Card schema

実装:

- `apps/api/app/schemas/action_card.py`
- `docs/action_card_schema.md`

設計ポイント:

- Pydantic schemaを正とする
- LLM出力は `ActionCard.model_validate(...)` で検証する
- `action_type` の複合enumは使わない
- `actions` は原子的な配列にする
- `approval_required`、`evidence_ids`、`missing_info`、`safety_notes` をschemaに含める

### Agent Workflow

実装:

- `apps/api/app/agents/state.py`
- `apps/api/app/agents/nodes.py`
- `apps/api/app/agents/workflow.py`
- `docs/agent_workflow.md`

流れ:

```txt
Triage
  -> Retrieval
  -> Planning
  -> Safety Check
```

MVPではLangGraphを使わず、Python workflowで責務境界を明確にしています。

### Gemini連携

実装:

- `apps/api/app/services/gemini_client.py`

役割:

- Gemini APIを呼び出す
- Action Card JSON schemaを渡す
- JSON parseとPydantic validationを行う
- `source_item_id` と `evidence_ids` の整合性を確認する
- 失敗時はfallback reasonを返す

現在のモデル:

```txt
gemini-3.1-flash-lite
```

### Agent Run

実装:

- `apps/api/app/routes/agent_runs.py`
- `apps/api/app/services/agent_run_service.py`
- `apps/api/app/services/agent_run_store.py`
- `apps/api/app/schemas/agent_run.py`
- `apps/web/src/features/agent-runs/*`

役割:

- Inbox ItemからAgent Workflowを実行する
- 生成されたAction Card、Evidence、Traceを返す
- PostgreSQLの `agent_runs` に保存する
- DBに接続できない場合は開発用にメモリ保存へfallbackする

### Evidence / Trace / Review

実装:

- `apps/api/app/services/evidence_store.py`
- `apps/api/app/services/agent_trace_store.py`
- `apps/api/app/services/review_event_store.py`
- `apps/web/src/features/evidence/*`
- `apps/web/src/features/agent-trace/*`
- `apps/web/src/features/review-events/*`
- `apps/web/src/features/action-cards/review-actions.tsx`

役割:

- Action Cardの根拠を表示する
- Agentの処理過程を表示する
- Approve / Mark edited / Reject を記録する

### Evaluation

実装:

- `apps/api/app/routes/evaluations.py`
- `apps/api/app/services/evaluation_service.py`
- `apps/api/app/schemas/evaluation.py`
- `data/eval_cases/action_card_cases.json`
- `apps/web/src/app/eval/page.tsx`
- `apps/web/src/features/evaluation/*`

評価モード:

```txt
/eval/action-cards?mode=deterministic
/eval/action-cards?mode=gemini
```

deterministic mode:

- Geminiを呼ばない
- `GEMINI_API_KEY` なし扱いでworkflowを実行する
- deterministic template fallbackの結果を評価する
- CIや安定確認向け

gemini mode:

- Gemini APIキーが設定されていればGemini生成を評価する
- APIキー未設定ならfallbackする
- 手元でLLM品質を見るための手動確認向け

評価項目:

- actions一致
- priority一致
- approval_required一致
- missing_info一致
- required evidence coverage
- schema validation
- agent step completion

## デモ導線

デモの説明は `docs/demo_scenario.md` にあります。

基本の見せ方:

1. `/` でAction Card一覧を見る
2. `action_001` を開く
3. Source Messageで面談候補日のメールを見る
4. `Run agent` を押す
5. Latest Agent Runで生成結果を見る
6. Run Evidenceで根拠を見る
7. Run Traceで処理過程を見る
8. ReviewでHuman-in-the-loopを見る
9. `/eval` でdeterministic評価を見る
10. `/eval?mode=gemini` でGemini評価を見る

## Git運用

基本方針:

- 1機能・1ステップごとにcommit
- commit messageは短い英文
- 例: `Add agent workflow`, `Show agent run result`, `Update MVP docs`
- pushはユーザーが依頼したときだけ
- PRはMVPでは必須にしていない
- mainへの直接pushでもCIは動く

直近の主なコミット:

```txt
441b4fa Add demo guide
e876c0b Evaluate agent workflow
c8e7678 Update MVP docs
8021166 Show agent run result
7f07718 Add agent workflow
7dc6f5e Add make commands
4bb61ed Add agent run storage
42a8fec Add Gemini generation
```

## ここまでの実装順

1. GitHub repo作成
2. Next.js / FastAPIの土台作成
3. CI追加
4. Action Card schema設計
5. Action Card APIとseedデータ
6. Web一覧・詳細ページ
7. Evidence Panel
8. Agent Trace
9. Review actions / Review history
10. Source Message panel
11. Evaluation runner
12. Agent Run API
13. Gemini連携
14. PostgreSQL保存
15. Makefile
16. Agent Workflow
17. Agent Run結果のUI表示
18. MVP docs更新
19. EvaluationをAgent Workflowへ接続
20. Demo guide追加

## 既知の注意点

- `apps/api/.env` はgit管理外。APIキーを絶対にcommitしない
- `make api-check` は `GEMINI_API_KEY=` で実行し、fallbackが動くことを見る
- FastAPI TestClient実行時にStarletteのdeprecation warningが出るが、現時点では動作に影響なし
- DBが落ちていてもAgent Run storeはメモリfallbackするため、開発中に画面は壊れにくい
- 評価のdeterministic modeはGeminiの賢さを測るものではなく、Agent Workflowの配線とschema整合性を見るもの
- READMEの技術構成にLangGraph/pgvectorを「実装済み」と書かない。現時点では今後の拡張候補

## 次にやるなら

優先度が高い順です。

### 1. Gemini評価結果の説明強化

`/eval?mode=gemini` で、Geminiが使われたのかfallbackしたのかをより見やすくする。

見るべきファイル:

- `apps/web/src/app/eval/page.tsx`
- `apps/web/src/features/evaluation/types.ts`
- `apps/api/app/services/evaluation_service.py`

### 2. AgentRunPanelの軽い分割

`apps/web/src/features/agent-runs/agent-run-panel.tsx` が大きくなっているため、表示部品を分ける。

ただし、機能が動いているので優先度は中程度です。見た目を変えすぎないこと。

### 3. Calendar読み取りモックの強化

本番OAuthではなく、Calendar seedを少し増やしてRetrievalの説得力を上げる。

### 4. Evaluation case追加

現在は2ケース。3から5ケース程度に増やすと評価レイヤーの説得力が上がる。

### 5. pgvector / LangGraph検討

今すぐ導入しない。MVPが安定してから検討する。

## 引き継ぎ先エージェントへの作業ルール

- まず既存コードを読む
- 既存の設計名とディレクトリ構成に合わせる
- 大きな抽象化を急がない
- UIは静かで実務的にする
- 新機能を増やす前に、README/docsとのズレを確認する
- 実装後は `make check` を実行する
- ユーザーへ、変更ファイルと実装内容を日本語で説明する
- ユーザーに頼まれるまでcommit/pushしない

## よく使う確認コマンド

```bash
git status --short
git log --oneline --decorate -10
make check
make db-check
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/action-cards
curl 'http://127.0.0.1:8000/eval/action-cards?mode=deterministic'
curl 'http://127.0.0.1:8000/eval/action-cards?mode=gemini'
```

## 最終確認

引き継ぎ時点では、以下が期待状態です。

- `main` と `origin/main` は同期している
- 作業ツリーはclean
- `make check` が成功する
- READMEからDemo Flowを追える
- `docs/demo_scenario.md` で面接時の説明軸が分かる
- `docs/agent_workflow.md` でAgentの処理境界が分かる
- `docs/handoff.md` で次のエージェントが作業を再開できる
