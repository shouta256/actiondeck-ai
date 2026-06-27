# Agent Workflow

Agent Workflowは、Inbox ItemからAction Cardを生成する処理です。

MVP時点ではLangGraphは未使用で、`apps/api/app/agents` に小さなPython workflowとして実装しています。理由は、まずAgentの責務境界を明確にし、画面・DB・評価までつながる縦スライスを完成させるためです。

Phase 2では、この線形workflowをLangGraphへ移行する予定です。単純置換ではなく、conditional edge (情報不足 / 低リスク / 高リスク)、fallback、approval gate、trace保持までを設計に含めます。

最初の移行ステップとして、既存nodeを同じ順序で実行するLangGraph runnerを追加しています。まだAPIやEvaluationの標準経路は既存のPython workflowを使い、次の段階で `route` をconditional edgeへ接続します。

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

Phase 2移行前の準備として、Triageでは `route` も決めます。現時点では出力Action Cardを変えず、`missing_info`、`ignore`、`low_risk_todo`、`review_required`、`conflicting_evidence` のどれに進むべきかをTraceに残します。LangGraph移行時には、このrouteをconditional edgeへ置き換える想定です。

### Retrieval

Action Cardの根拠になるEvidenceを選びます。

MVPでは `data/seed/evidence_items.json` のseed evidenceに対して簡易スコアリングを行います。Phase 2では、ここをpgvectorによるtop-k検索へ置き換え (lexical fallbackは残す)、複数ソース (calendar / user_rules / prior_messages / documents) を横断する想定です。required evidence hit rate などの指標で検索品質を評価します。

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

Phase 2では、LangGraph移行前に `route` も評価対象にします。これにより、既存workflow上で `missing_info`、`ignore`、`low_risk_todo`、`review_required`、`conflicting_evidence` の分岐意図が守られているかを確認できます。

## 実装ファイル

- `apps/api/app/agents/state.py`: workflow中に持ち回る状態
- `apps/api/app/agents/nodes.py`: Triage、Retrieval、Planning、Safetyの各処理
- `apps/api/app/agents/workflow.py`: nodeを順番に実行し、Agent Run結果を作る本体
- `apps/api/app/agents/graph_workflow.py`: 既存nodeをLangGraph上で同じ順序に実行する移行用runner
- `apps/api/app/services/gemini_client.py`: Gemini呼び出しとAction Card schema検証
- `apps/api/app/services/agent_run_store.py`: Agent Run結果の保存
