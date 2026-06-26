import json
from functools import lru_cache
from pathlib import Path

from app.schemas import EvidenceItem


SEED_EVIDENCE_ITEMS_PATH = (
    Path(__file__).resolve().parents[4] / "data" / "seed" / "evidence_items.json"
)


@lru_cache(maxsize=1)
def list_evidence_items() -> tuple[EvidenceItem, ...]:
    raw_items = json.loads(SEED_EVIDENCE_ITEMS_PATH.read_text(encoding="utf-8"))
    return tuple(EvidenceItem.model_validate(raw_item) for raw_item in raw_items)


def list_evidence_by_ids(evidence_ids: list[str]) -> tuple[EvidenceItem, ...]:
    evidence_by_id = {item.id: item for item in list_evidence_items()}
    return tuple(
        evidence_by_id[evidence_id]
        for evidence_id in evidence_ids
        if evidence_id in evidence_by_id
    )
