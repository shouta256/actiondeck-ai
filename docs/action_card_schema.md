# Action Card Schema

Action Card schemaは、AI Agentが返す提案の共通契約です。

UI、API、DB、Agent出力、評価スクリプトはこのschemaに依存します。MVPではPydantic schemaを正とし、Agentが返したJSONを `ActionCard.model_validate(...)` で検証します。

## 設計方針

### `actions` は原子的な配列にする

複合enumは使いません。

悪い例:

```json
{
  "action_type": "reply_and_schedule_and_prepare"
}
```

良い例:

```json
{
  "actions": ["draft_reply", "propose_schedule", "create_todo"]
}
```

返信、予定、ToDoのような複合性は `actions` の配列と `proposal` の中身で表します。これにより、アクションの組み合わせが増えてもschemaが膨らみません。

## 主なフィールド

- `schema_version`: schemaのバージョン。現在は `1.0`
- `source_item_id`: 元になったメール、通知、メモなどのID
- `actions`: AIが提案する原子的な行動の配列
- `priority`: 対応優先度
- `risk_level`: 誤実行や見落としのリスク
- `confidence`: 判断の目安。LLMの自己申告ではなく、根拠取得や不足情報の状態を含めて扱う
- `approval_required`: ユーザー承認が必要か
- `status`: レビュー状態
- `proposal`: 返信案、予定案、ToDo案などの具体的な提案
- `evidence_ids`: Evidence Panelに表示する根拠ID
- `missing_info`: 判断に不足している情報
- `safety_notes`: 安全上の注意

## actions

| 値 | 意味 |
| --- | --- |
| `draft_reply` | 返信案を作る |
| `propose_schedule` | 予定案を作る |
| `create_todo` | ToDo案を作る |
| `save_for_later` | 後で確認する対象として保存する |
| `ignore` | 対応不要と判断する |
| `request_missing_info` | 不足情報の確認を求める |

## proposalとの対応

- `draft_reply` がある場合、`proposal.reply_draft` が必要
- `propose_schedule` がある場合、`proposal.calendar_event` が必要
- `create_todo` がある場合、`proposal.todos` が必要
- `request_missing_info` がある場合、`missing_info` が必要
- `ignore` は他のactionと組み合わせない

## 承認ルール

MVPでは、以下の場合に `approval_required` を必須にします。

- `draft_reply` を含む
- `propose_schedule` を含む
- `risk_level` が `high`

このルールにより、ユーザーに影響する提案をAIが勝手に確定しない設計にします。

## 例

```json
{
  "schema_version": "1.0",
  "id": "action_001",
  "source_item_id": "inbox_001",
  "title": "面談候補日への返信と準備",
  "actions": ["draft_reply", "propose_schedule", "create_todo"],
  "priority": "high",
  "risk_level": "medium",
  "confidence": 0.84,
  "approval_required": true,
  "status": "pending_review",
  "summary": "面談日程調整メール。返信、予定確認、事前準備が必要。",
  "proposal": {
    "reply_draft": "ご連絡ありがとうございます。以下の日程で参加可能です。",
    "calendar_event": {
      "title": "LINEヤフー 面談",
      "start": "2026-07-03T14:00:00",
      "end": "2026-07-03T14:30:00"
    },
    "todos": [
      {
        "title": "事前提出物を確認する",
        "due_date": "2026-07-02"
      }
    ]
  },
  "evidence_ids": ["ev_001", "ev_002", "ev_003"],
  "missing_info": [],
  "safety_notes": [
    "メール送信と予定作成はユーザー承認が必要です"
  ]
}
```
