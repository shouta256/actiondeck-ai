import asyncio

from main import app

from app.schemas import (
    ActionCard,
    ActionCardEvalRunResult,
    ActionCardStatusUpdate,
    AgentRunResult,
    AgentTraceStep,
    EvidenceItem,
    InboxItem,
    ReviewEvent,
)
from app.services.action_card_store import list_action_cards
from app.services.agent_run_service import run_agent_for_inbox_item
from app.services.agent_run_store import list_agent_runs, save_agent_run
from app.services.agent_trace_store import list_agent_steps
from app.services.evidence_store import list_evidence_items
from app.services.evaluation_service import run_action_card_eval
from app.services.inbox_item_store import get_inbox_item, list_inbox_items


async def main() -> None:
    cards = list_action_cards()
    evidence = list_evidence_items()
    steps = list_agent_steps()
    inbox_items = list_inbox_items()
    eval_result = run_action_card_eval()
    agent_run = run_agent_for_inbox_item(get_inbox_item("inbox_001"))

    if agent_run is None:
        raise RuntimeError("agent run smoke test did not return a result")

    saved_run = await save_agent_run(agent_run)
    agent_runs = await list_agent_runs("inbox_001")

    print(
        app.title,
        ActionCard.__name__,
        len(cards),
        EvidenceItem.__name__,
        len(evidence),
        AgentTraceStep.__name__,
        len(steps),
        ActionCardStatusUpdate.__name__,
        ReviewEvent.__name__,
        InboxItem.__name__,
        len(inbox_items),
        ActionCardEvalRunResult.__name__,
        eval_result.passed_cases,
        AgentRunResult.__name__,
        saved_run.run_id,
        len(agent_runs),
    )


if __name__ == "__main__":
    asyncio.run(main())
