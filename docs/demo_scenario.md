# Demo Scenario

このMVPでは、LINEヤフー採用担当から届いた面談候補日のメールを中心に、複数の代表ケースを画面から確認できます。

ActionDeck AIが見せたい価値は、返信文を作ることだけではありません。メール、予定、提出物、ユーザー承認を1枚のAction Cardにまとめ、根拠と処理過程を確認できるようにすることです。

## 画面の入口

`/` の `Demo Scenarios` から代表ケースを開きます。

| Scenario | Source | 見せる価値 |
| --- | --- | --- |
| 面談日程調整 | `inbox_001` | 返信案、予定案、ToDoを1枚にまとめる |
| 予定衝突あり | `inbox_006` | Calendar availabilityで候補日時の衝突を検知する |
| 情報不足 | `inbox_003` | 候補日時がないためPlanningを省略し、不足情報を求める |
| 返信不要 | `inbox_004` | 対応不要な入力をterminal routeで処理する |
| 根拠矛盾 | `inbox_007` | 矛盾がある場合、返信案や予定案を確定しない |

## 基本シナリオ

`inbox_001` は、採用担当からの面談日程調整メールです。

メールには以下が含まれています。

- 次回面談の日程調整
- 候補日時
- 面談前日までの事前提出物確認

## Agentが判断すること

Agent Workflowは、以下の順番で処理します。

```txt
Triage
  返信、日程調整、ToDo作成が必要だと判断する

Retrieval
  返信方針メモ、授業予定、面談前提出物の案内を根拠として取得する

Planning
  返信案、予定案、ToDo案をAction Cardにまとめる

Safety Check
  メール返信と予定作成はユーザー承認が必要だと確認する

Approval Gate
  外部アクションを実行せず、ユーザー承認待ちで止める
```

## 出力

`action_001` は、以下を含むAction Cardです。

- 返信案
- 予定案
- 事前提出物確認のToDo
- Evidence IDs
- Safety Notes
- `pending_review` のstatus

このstatusにより、AIは外部アクションを勝手に実行せず、ユーザーが承認・編集・却下します。

## 画面で見る場所

1. `/` で `Demo Scenarios` を見る
2. `面談日程調整` から `action_001` を開く
3. 画面上部の `Agent Decision` で、Actions、Evidence、Approval、Workflowを見る
4. Source Messageで元メールを見る
5. `Run agent` を押す
6. Latest Agent Runで生成結果を見る
7. Run Evidenceで根拠を見る
8. Run Traceで `Triage -> Retrieval -> Planning -> Safety -> Approval Gate` を見る
9. ReviewでHuman-in-the-loopを確認する
10. `/eval` でdeterministic評価を見る
11. `/eval?mode=graph` でLangGraph runner評価とstep path評価を見る
12. `/eval?mode=gemini` でGemini評価を見る

## 予定衝突シナリオ

`inbox_006` は、2つの候補日時を含む再調整メールです。

- `2026年7月5日 10:00-10:30`
- `2026年7月5日 11:00-11:30`

ローカルDBの `calendar_events` には、`2026年7月5日 10:00-10:30` に `アルバイト` が入っています。

画面では以下を確認します。

1. `/` の `予定衝突あり` を開く
2. `Agent Decision` の `Safety` と `Calendar` を確認する
3. `Safety Notes` で `conflict` と `available` のメモを見る
4. `Agent Trace` の `calendar_availability_check` tool callを見る

ここで説明したいことは、AIが予定を作成しているのではなく、read-onlyなCalendar情報を使って安全確認だけを行い、最後はユーザー承認で止めている点です。

## 面接で説明するポイント

- これはGmail返信AIではなく、承認可能なAction Cardを作るAgentです
- Agent出力はPydantic schemaで検証します
- 根拠とTraceを表示し、AIの判断を後から確認できます
- 外部アクションは自動実行せず、Human-in-the-loopで止めます
- LangGraph runnerはroute別に不要なPlanningを省略し、コストと出力ゆれを抑えます
- Calendar availabilityはread-onlyで参照し、予定作成は行いません
- deterministic評価、Graph評価、Gemini評価を分け、legacy比較、標準Graph経路の確認、LLM品質確認を分離しています
- Graph評価では、出力だけでなく期待したstep pathを通ったかも確認します
