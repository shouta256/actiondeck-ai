from hashlib import sha256
from math import sqrt

from google import genai
from google.genai import types

from app.settings import Settings


DEFAULT_EVIDENCE_EMBEDDING_DIMENSIONS = 768

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


def embed_evidence_text(
    text: str,
    *,
    settings: Settings,
    task_type: str,
) -> tuple[float, ...]:
    if settings.embedding_provider == "gemini":
        gemini_embedding = _embed_with_gemini(
            text,
            settings=settings,
            task_type=task_type,
        )
        if gemini_embedding is not None:
            return gemini_embedding

    return embed_evidence_text_locally(
        text,
        dimensions=settings.embedding_dimensions,
    )


def embed_evidence_text_locally(
    text: str,
    *,
    dimensions: int = DEFAULT_EVIDENCE_EMBEDDING_DIMENSIONS,
) -> tuple[float, ...]:
    vector = [0.0] * dimensions
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


def _embed_with_gemini(
    text: str,
    *,
    settings: Settings,
    task_type: str,
) -> tuple[float, ...] | None:
    if not settings.gemini_api_key:
        return None

    try:
        client = genai.Client(api_key=settings.gemini_api_key)
        response = client.models.embed_content(
            model=settings.gemini_embedding_model,
            contents=text,
            config=types.EmbedContentConfig(
                task_type=task_type,
                output_dimensionality=settings.embedding_dimensions,
            ),
        )
        values = response.embeddings[0].values if response.embeddings else None
    except Exception:
        return None

    if values is None or len(values) != settings.embedding_dimensions:
        return None
    return tuple(float(value) for value in values)


def _tokens(text: str) -> tuple[str, ...]:
    words = tuple(word for word in text.replace("\n", " ").split(" ") if word)
    character_grams = tuple(
        text[index : index + size]
        for size in (1, 2, 3)
        for index in range(0, max(0, len(text) - size + 1))
        if not text[index : index + size].isspace()
    )
    return (*words, *character_grams)
