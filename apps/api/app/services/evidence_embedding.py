from hashlib import sha256
from math import sqrt


EVIDENCE_EMBEDDING_DIMENSIONS = 32

DOMAIN_FEATURES = (
    ("返信", "reply", "返信方針", "確認済み", "ご都合"),
    ("面談", "interview"),
    ("候補", "候補日時"),
    ("日程", "時間", "予定", "calendar"),
    ("提出物", "資料", "ポートフォリオ"),
    ("締切", "期限", "まで"),
    ("衝突", "空き", "移動", "避ける", "schedule_risk"),
    ("不要", "メンテナンス", "イベント", "ignore"),
    ("不足", "曖昧", "missing_info"),
    ("最終",),
    ("第一志望", "24時間", "priority"),
    ("todo", "create_todo", "確認"),
)


def embed_evidence_text(text: str) -> tuple[float, ...]:
    vector = [0.0] * EVIDENCE_EMBEDDING_DIMENSIONS
    normalized_text = text.lower()
    for index, terms in enumerate(DOMAIN_FEATURES):
        if any(term in normalized_text for term in terms):
            vector[index] += 3.0

    for token in _tokens(normalized_text):
        digest = sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:2], byteorder="big") % len(vector)
        sign = 1.0 if digest[2] % 2 == 0 else -1.0
        vector[index] += sign * 0.25

    magnitude = sqrt(sum(value * value for value in vector))
    if magnitude == 0:
        return tuple(vector)
    return tuple(value / magnitude for value in vector)


def evidence_text_for_embedding(*, title: str, snippet: str, used_for: str) -> str:
    return f"{title}\n{snippet}\n{used_for}"


def _tokens(text: str) -> tuple[str, ...]:
    words = tuple(word for word in text.replace("\n", " ").split(" ") if word)
    character_grams = tuple(
        text[index : index + size]
        for size in (1, 2, 3)
        for index in range(0, max(0, len(text) - size + 1))
        if not text[index : index + size].isspace()
    )
    return (*words, *character_grams)
