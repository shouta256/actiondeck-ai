from app.agents.graph_workflow import run_agent_graph_workflow
from app.schemas import AgentRunGenerationMode, AgentStepName
from app.schemas.agent_route import AgentRoute
from app.services.action_card_store import list_action_cards
from app.services.evidence_store import list_evidence_items
from app.services.inbox_item_store import get_inbox_item
from app.settings import get_settings


def test_graph_workflow_skips_retrieval_and_planning_for_ignore_route():
    result = _run_graph_workflow_for_inbox("inbox_004")

    assert result.route == AgentRoute.IGNORE
    assert result.action_card.id == "action_004"
    assert result.generation_mode == AgentRunGenerationMode.DETERMINISTIC_TEMPLATE
    assert result.fallback_reason == "Graph route skipped planning for ignore"
    assert [step.step_name for step in result.agent_steps] == [
        AgentStepName.TRIAGE,
        AgentStepName.SAFETY_CHECK,
    ]


def test_graph_workflow_runs_full_path_for_review_required_route():
    result = _run_graph_workflow_for_inbox("inbox_001")

    assert result.route == AgentRoute.REVIEW_REQUIRED
    assert result.action_card.id == "action_001"
    assert result.generation_mode == AgentRunGenerationMode.DETERMINISTIC_TEMPLATE
    assert result.fallback_reason == "GEMINI_API_KEY is not configured"
    assert [step.step_name for step in result.agent_steps] == [
        AgentStepName.TRIAGE,
        AgentStepName.EVIDENCE_RETRIEVAL,
        AgentStepName.ACTION_PLANNING,
        AgentStepName.SAFETY_CHECK,
    ]


def _run_graph_workflow_for_inbox(inbox_item_id: str):
    inbox_item = get_inbox_item(inbox_item_id)
    assert inbox_item is not None

    template_action_cards_by_source = {
        action_card.source_item_id: action_card for action_card in list_action_cards()
    }
    template_action_card = template_action_cards_by_source[inbox_item_id]
    settings = get_settings().model_copy(update={"gemini_api_key": None})
    return run_agent_graph_workflow(
        inbox_item=inbox_item,
        template_action_card=template_action_card,
        evidence_items=list_evidence_items(),
        settings=settings,
    )
