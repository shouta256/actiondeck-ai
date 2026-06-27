# Demo Scenario

このMVPでは、LINEヤフー採用担当から届いた面談候補日のメールを題材にします。

ActionDeck AIが見せたい価値は、返信文を作ることだけではありません。メール、予定、提出物、ユーザー承認を1枚のAction Cardにまとめ、根拠と処理過程を確認できるようにすることです。

## 入力

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

1. `/` でAction Card一覧を見る
2. `action_001` を開く
3. Source Messageで元メールを見る
4. `Run agent` を押す
5. Latest Agent Runで生成結果を見る
6. Run Evidenceで根拠を見る
7. Run Traceで `Triage -> Retrieval -> Planning -> Safety` を見る
8. ReviewでHuman-in-the-loopを確認する
9. `/eval` でdeterministic評価を見る
10. `/eval?mode=gemini` でGemini評価を見る

## 面接で説明するポイント

- これはGmail返信AIではなく、承認可能なAction Cardを作るAgentです
- Agent出力はPydantic schemaで検証します
- 根拠とTraceを表示し、AIの判断を後から確認できます
- 外部アクションは自動実行せず、Human-in-the-loopで止めます
- deterministic評価とGemini評価を分け、安定確認とLLM品質確認を分離しています
