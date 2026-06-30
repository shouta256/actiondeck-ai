# Agent Workflow

Agent Workflowは、Inbox ItemからAction Cardを生成する処理です。

MVPではまずAgentの責務境界を明確にするため、`apps/api/app/agents` に小さなPython workflowを実装しました。これにより、画面・DB・評価までつながる縦スライスを先に完成させています。

Phase 2では、この線形workflowをLangGraph runnerへ移行しました。単純置換ではなく、conditional edge、fallback、Critic Check、approval gate、trace保持までを設計に含めています。

現在の標準Agent Run APIはLangGraph runnerを使います。`ignore` / `missing_info` routeでは `retrieval` / `planning` をスキップして `critic` に進みます。`conflicting_evidence` / `low_risk_todo` routeでは根拠検索までは実行し、LLM Planningは省略して安定したtemplateを使います。`review_required` routeではPlannerがAction Cardを生成し、Critic Checkで根拠・提案内容・承認境界を検査してからSafety Checkへ渡します。最後に `approval_gate` を通し、AIが外部アクションを実行せずユーザー承認で止まる境界をTraceに残します。

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
Critic Check
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

Triageでは `route` も決めます。`missing_info`、`ignore`、`low_risk_todo`、`review_required`、`conflicting_evidence` のどれに進むべきかをTraceに残し、LangGraphのconditional edgeで後続nodeを切り替えます。

LangGraph runnerでは、まず `ignore` / `missing_info` routeをconditional edgeに接続しています。これらのrouteではTriage後に検索・生成を省略し、template Action CardをCritic Checkへ渡します。それ以外のrouteは `retrieval`、必要に応じて `planning`、`critic`、`safety` の順に進みます。

`conflicting_evidence` routeでは、根拠の確認自体が重要なのでRetrievalは実行します。ただし矛盾がある状態で返信案や予定案を作ると危険なため、PlanningはスキップしてSafety Checkへ進みます。

`low_risk_todo` routeでもRetrievalは実行します。締切や確認対象の根拠はTraceに残したい一方、低リスクなToDoはLLMで生成し直す必要が薄いため、Planningはスキップしてtemplate Action Cardを使います。

### Retrieval

Action Cardの根拠になるEvidenceを選びます。

MVPでは `data/seed/evidence_items.json` のseed evidenceをPostgreSQLの `evidence_items` テーブルへ投入し、`embedding vector(768)` をpgvectorでtop-k検索します。embeddingは `EMBEDDING_PROVIDER=gemini` の場合にGemini Embeddingを使い、APIキー未設定やAPI失敗時はローカルの決定的なhash embeddingへfallbackします。これは検索基盤の構造を保ちつつ、APIキーなしでも評価とデモが壊れないようにするためです。

DB未起動、未seed、pgvector検索失敗時は、従来のseed evidenceに対する簡易スコアリングへfallbackします。Evaluationでは、最終Action Cardの `evidence_ids` だけでなく、Retrieval nodeが実際に取得したEvidence IDもrequired evidenceと比較します。

### Planning

Gemini APIを使ってAction Card JSONを生成します。

生成結果は必ず `ActionCard.model_validate(...)` でPydantic schema検証を行います。APIキーがない場合、Gemini呼び出しに失敗した場合、または出力がschemaに合わない場合は、deterministic templateにfallbackします。

### Critic Check

Plannerの出力をそのままSafetyへ渡すのではなく、別nodeとしてCritic Checkを通します。

Criticは、Action Cardの根拠IDが存在するか、`draft_reply` に返信案があるか、`propose_schedule` に予定案があるか、reviewable actionが承認必須になっているかを検査します。問題がある場合は `critic_report.issues` とAction Cardの `safety_notes` に残し、Safety Checkで人間が気づける形にします。現時点のCriticはLLMではなく決定的な検査です。これは評価とCIで安定して回せるようにするためです。

### Safety Check

生成されたAction Cardの根拠ID、schema整合性、承認要否を確認します。

メール返信案や予定案のようにユーザーに影響する提案は `approval_required = true` にします。AIは実行せず、ユーザーがレビューして承認する設計です。

予定調整が含まれる場合は、ローカルDBの `calendar_events` をread-onlyで参照します。`calendar_events` にはseed予定、またはGoogle Calendar read-only OAuthで同期した予定が入ります。Inbox本文から `2026年7月5日 10:00-10:30` のような候補日時を抽出し、既存予定と重なるかを確認します。結果はAction Cardの `safety_notes` とTraceの `calendar_availability_check` tool callに残します。MVPではここで予定を作成・更新せず、候補日時の安全確認だけを行います。

### Approval Gate

Safety Check後に、人間の承認境界をTraceへ明示します。

`approval_required = true` のAction Cardはユーザー承認待ちとして扱い、メール送信、予定作成、ToDo作成などの外部アクションは実行しません。`approval_required = false` の場合も、MVPでは外部実行を無効にしたまま、提案とレビュー履歴の確認に留めます。

## Trace

各ステップの結果は `AgentTraceStep` として保存・表示します。

これにより、ユーザーや面接官が以下を確認できます。

- Agentがどの順番で処理したか
- どの根拠を使ったか
- Gemini生成かfallbackか
- CriticがPlanner出力をgroundedと判断したか
- Safety Checkで何を確認したか
- Calendar候補日時が既存予定と衝突したか
- Approval Gateで外部実行を止めたか

## Evaluation

評価APIでは、評価ケースごとにAgent Workflowを実行し、期待値と比較します。現在は12件のケースで、返信のみ、予定調整、低リスクToDo、情報不足、無視、根拠矛盾を確認します。

Geminiを毎回呼ぶ評価は出力が揺れやすく、CIにも向きません。そのためMVPでは、`GEMINI_API_KEY` を使わない設定でworkflowを動かし、Action Cardのactions、priority、approval_required、missing_info、required evidence、schema validation、各stepの完了状態を確認します。

評価modeは3つあります。`deterministic` はlegacy Python workflowをGeminiなしで安定評価し、`gemini` はlegacy Python workflowで手動確認用にGemini生成も含めて評価します。`graph` は標準Agent Runと同じLangGraph runnerをGeminiなしで実行し、同じ評価ケースで回帰確認するためのmodeです。

Graph modeでは `expected_step_names` と実際のTrace step順を比較し、`missing_info`、`ignore`、`low_risk_todo`、`review_required`、`conflicting_evidence` が期待したworkflow pathを通ったかを確認します。Retrievalが実行されたケースでは、実際に取得したEvidence IDにrequired evidenceが含まれるかも評価します。Critic report、Safety note、Calendar availabilityもAgent Run結果で確認できます。deterministic / gemini modeはlegacy workflowの安定評価を壊さないため、step pathはGraph modeで検証します。

## 実装ファイル

- `apps/api/app/agents/state.py`: workflow中に持ち回る状態
- `apps/api/app/agents/nodes.py`: Triage、Retrieval、Planning、Critic、Safetyの各処理
- `apps/api/app/agents/runtime.py`: legacy workflowとGraph runnerが共有する実行部品
- `apps/api/app/agents/workflow.py`: legacy Python workflow
- `apps/api/app/agents/graph_workflow.py`: 既存nodeをLangGraph上で実行し、`ignore` / `missing_info` / `conflicting_evidence` / `low_risk_todo` routeをconditional edgeへ接続し、Critic Checkとapproval gateを通す標準runner
- `apps/api/app/services/evidence_embedding.py`: Evidence検索用のローカル決定的embedding
- `apps/api/app/services/evidence_vector_store.py`: pgvector table seed / top-k検索
- `apps/api/app/services/calendar_event_store.py`: Calendar Event seed / DB保存
- `apps/api/app/services/calendar_availability.py`: 候補日時抽出と予定衝突判定
- `apps/api/app/services/google_calendar_service.py`: Google Calendar read-only OAuth / 同期
- `apps/api/app/services/gemini_client.py`: Gemini呼び出しとAction Card schema検証
- `apps/api/app/services/agent_run_store.py`: Agent Run結果の保存
