from app.agents.nodes import _evidence_query_text, triage
from app.agents.state import AgentState
from app.services.action_card_store import list_action_cards
from app.services.evidence_store import list_evidence_items
from app.services.evidence_vector_store import search_evidence_with_pgvector
from app.services.inbox_item_store import get_inbox_item
from app.settings import get_settings


def main() -> None:
    inbox_item = get_inbox_item("inbox_001")
    template_action_card = next(
        card for card in list_action_cards() if card.source_item_id == "inbox_001"
    )
    if inbox_item is None:
        raise RuntimeError("inbox_001 was not found")

    state = AgentState(
        inbox_item=inbox_item,
        template_action_card=template_action_card,
        all_evidence_items=list_evidence_items(),
        settings=get_settings(),
    )
    triage(state)
    result = search_evidence_with_pgvector(
        query_text=_evidence_query_text(state),
        limit=12,
    )
    evidence_ids = [item.id for item in result.evidence_items]
    print("pgvector evidence:", ", ".join(evidence_ids))

    required_ids = {"ev_001", "ev_002", "ev_003"}
    missing_ids = sorted(required_ids - set(evidence_ids))
    if result.fallback_reason:
        raise RuntimeError(f"pgvector fallback was used: {result.fallback_reason}")
    if missing_ids:
        raise RuntimeError(f"pgvector missed required evidence: {missing_ids}")


if __name__ == "__main__":
    main()
