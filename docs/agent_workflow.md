# Agent Workflow

Agent Workflowは、Inbox ItemからAction Cardを生成する処理です。

MVPではLangGraphをまだ使わず、`apps/api/app/agents` に小さなPython workflowとして実装しています。理由は、まずAgentの責務境界を明確にし、画面・DB・評価までつながる縦スライスを完成させるためです。

## 流れ

```txt
Inbox Item
  ↓
Triage
  ↓
Retrieval
  ↓
Planning
  ↓
Safety Check
  ↓
Action Card
```

## 各ステップ

### Triage

入力メッセージを見て、返信、日程調整、ToDo作成が必要かを判定します。

現時点では軽いキーワード判定です。ここでLLMに丸投げせず、後続処理が使うシグナルを明示的に作ります。

### Retrieval

Action Cardの根拠になるEvidenceを選びます。

MVPでは `data/seed/evidence_items.json` のseed evidenceに対して簡易スコアリングを行います。将来的にはここをpgvector検索へ置き換える想定です。

### Planning

Gemini APIを使ってAction Card JSONを生成します。

生成結果は必ず `ActionCard.model_validate(...)` でPydantic schema検証を行います。APIキーがない場合、Gemini呼び出しに失敗した場合、または出力がschemaに合わない場合は、deterministic templateにfallbackします。

### Safety Check

生成されたAction Cardの根拠ID、schema整合性、承認要否を確認します。

メール返信案や予定案のようにユーザーに影響する提案は `approval_required = true` にします。AIは実行せず、ユーザーがレビューして承認する設計です。

## Trace

各ステップの結果は `AgentTraceStep` として保存・表示します。

これにより、ユーザーや面接官が以下を確認できます。

- Agentがどの順番で処理したか
- どの根拠を使ったか
- Gemini生成かfallbackか
- Safety Checkで何を確認したか

## Evaluation

評価APIでは、評価ケースごとにAgent Workflowをdeterministic modeで実行します。

Geminiを毎回呼ぶ評価は出力が揺れやすく、CIにも向きません。そのためMVPでは、`GEMINI_API_KEY` を使わない設定でworkflowを動かし、Action Cardのactions、priority、approval_required、missing_info、required evidence、schema validation、各stepの完了状態を確認します。

## 実装ファイル

- `apps/api/app/agents/state.py`: workflow中に持ち回る状態
- `apps/api/app/agents/nodes.py`: Triage、Retrieval、Planning、Safetyの各処理
- `apps/api/app/agents/workflow.py`: nodeを順番に実行し、Agent Run結果を作る本体
- `apps/api/app/services/gemini_client.py`: Gemini呼び出しとAction Card schema検証
- `apps/api/app/services/agent_run_store.py`: Agent Run結果の保存
