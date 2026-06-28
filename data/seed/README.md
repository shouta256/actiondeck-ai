# seedデータ

デモ用の手動インポートデータを置く場所です。

最初のデモでは、就活面談の案内メール、個人メモ、Calendar mock、事前提出物の資料、過去メールをJSONで用意します。

- `inbox_items.json`: Agentへの入力になるメッセージ
- `action_cards.json`: deterministic fallback用のAction Card
- `evidence_items.json`: pgvector検索に投入する根拠データ
- `calendar_events.json`: read-onlyな予定衝突検知に使うローカル予定
- `agent_steps.json`: 初期表示用のTrace seed
