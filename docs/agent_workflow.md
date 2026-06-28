# Agent Workflow

Agent Workflowは、Inbox ItemからAction Cardを生成する処理です。

MVPではまずAgentの責務境界を明確にするため、`apps/api/app/agents` に小さなPython workflowを実装しました。これにより、画面・DB・評価までつながる縦スライスを先に完成させています。

Phase 2では、この線形workflowをLangGraphへ移行中です。単純置換ではなく、conditional edge (情報不足 / 低リスク / 高リスク)、fallback、approval gate、trace保持までを設計に含めます。

最初の移行ステップとして、既存nodeをLangGraph上で実行するrunnerを追加しました。現在の標準Agent Run APIはLangGraph runnerを使います。LangGraph runner側では `ignore` / `missing_info` routeで `retrieval` / `planning` をスキップして `safety` に進むconditional edgeを接続しています。`conflicting_evidence` routeでは根拠検索までは実行し、返信案や予定案を確定する `planning` はスキップします。最後に `approval_gate` を通し、AIが外部アクションを実行せずユーザー承認で止まる境界をTraceに残します。`deterministic` 評価modeではlegacy Python workflowを残し、Graph移行前後の比較に使えるようにしています。

legacy Python workflowは `run_legacy_agent_workflow()` として明示しています。Graph runnerとlegacy workflowが共通で使う実行部品は `runtime.py` に切り出しています。

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
Approval Gate
  ↓
Action Card
```

## 各ステップ

### Triage

入力メッセージを見て、返信、日程調整、ToDo作成が必要かを判定します。

現時点では軽いキーワード判定です。ここでLLMに丸投げせず、後続処理が使うシグナルを明示的に作ります。

Phase 2移行前の準備として、Triageでは `route` も決めます。現時点では出力Action Cardを変えず、`missing_info`、`ignore`、`low_risk_todo`、`review_required`、`conflicting_evidence` のどれに進むべきかをTraceに残します。LangGraph移行時には、このrouteをconditional edgeへ置き換える想定です。

LangGraph runnerでは、まず `ignore` / `missing_info` routeをconditional edgeに接続しています。これらのrouteではTriage後に検索・生成を省略し、template Action CardをSafety Checkへ渡します。それ以外のrouteは従来どおり `retrieval`、`planning`、`safety` の順に進みます。

`conflicting_evidence` routeでは、根拠の確認自体が重要なのでRetrievalは実行します。ただし矛盾がある状態で返信案や予定案を作ると危険なため、PlanningはスキップしてSafety Checkへ進みます。

### Retrieval

Action Cardの根拠になるEvidenceを選びます。

MVPでは `data/seed/evidence_items.json` のseed evidenceに対して簡易スコアリングを行います。Phase 2では、ここをpgvectorによるtop-k検索へ置き換え (lexical fallbackは残す)、複数ソース (calendar / user_rules / prior_messages / documents) を横断する想定です。required evidence hit rate などの指標で検索品質を評価します。

### Planning

Gemini APIを使ってAction Card JSONを生成します。

生成結果は必ず `ActionCard.model_validate(...)` でPydantic schema検証を行います。APIキーがない場合、Gemini呼び出しに失敗した場合、または出力がschemaに合わない場合は、deterministic templateにfallbackします。

### Safety Check

生成されたAction Cardの根拠ID、schema整合性、承認要否を確認します。

メール返信案や予定案のようにユーザーに影響する提案は `approval_required = true` にします。AIは実行せず、ユーザーがレビューして承認する設計です。

### Approval Gate

Safety Check後に、人間の承認境界をTraceへ明示します。

`approval_required = true` のAction Cardはユーザー承認待ちとして扱い、メール送信、予定作成、ToDo作成などの外部アクションは実行しません。`approval_required = false` の場合も、MVPでは外部実行を無効にしたまま、提案とレビュー履歴の確認に留めます。

## Trace

各ステップの結果は `AgentTraceStep` として保存・表示します。

これにより、ユーザーや面接官が以下を確認できます。

- Agentがどの順番で処理したか
- どの根拠を使ったか
- Gemini生成かfallbackか
- Safety Checkで何を確認したか
- Approval Gateで外部実行を止めたか

## Evaluation

評価APIでは、評価ケースごとにAgent Workflowを実行し、期待値と比較します。

Geminiを毎回呼ぶ評価は出力が揺れやすく、CIにも向きません。そのためMVPでは、`GEMINI_API_KEY` を使わない設定でworkflowを動かし、Action Cardのactions、priority、approval_required、missing_info、required evidence、schema validation、各stepの完了状態を確認します。

評価modeは3つあります。`deterministic` はlegacy Python workflowをGeminiなしで安定評価し、`gemini` はlegacy Python workflowで手動確認用にGemini生成も含めて評価します。`graph` は標準Agent Runと同じLangGraph runnerをGeminiなしで実行し、同じ評価ケースで回帰確認するためのmodeです。

Phase 2では、LangGraph移行前に `route` も評価対象にします。これにより、既存workflowとLangGraph runnerの両方で `missing_info`、`ignore`、`low_risk_todo`、`review_required`、`conflicting_evidence` の分岐意図が守られているかを確認できます。

## 実装ファイル

- `apps/api/app/agents/state.py`: workflow中に持ち回る状態
- `apps/api/app/agents/nodes.py`: Triage、Retrieval、Planning、Safetyの各処理
- `apps/api/app/agents/runtime.py`: legacy workflowとGraph runnerが共有する実行部品
- `apps/api/app/agents/workflow.py`: legacy Python workflow
- `apps/api/app/agents/graph_workflow.py`: 既存nodeをLangGraph上で実行し、`ignore` / `missing_info` / `conflicting_evidence` routeをconditional edgeへ接続し、最後にapproval gateを通す標準runner
- `apps/api/app/services/gemini_client.py`: Gemini呼び出しとAction Card schema検証
- `apps/api/app/services/agent_run_store.py`: Agent Run結果の保存
