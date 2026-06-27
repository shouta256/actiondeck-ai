# 評価ケース

ActionDeck AIの判断品質を測る評価ケースを置く場所です。

Phase 2ではまず10〜12件を目標に、成功系だけでなく以下を評価します。

- 予定調整、返信、ToDo作成
- Calendar conflict
- Missing info
- Low risk ToDo
- Ignore / archive
- Conflicting evidence
- Gemini fallback (deterministic modeでfallback経路を確認)

最初の拡張では8件まで増やし、LangGraph移行前に分岐、根拠矛盾、安全性、fallbackを評価できる土台を作ります。
