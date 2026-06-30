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
        AgentStepName.CRITIC_CHECK,
        AgentStepName.SAFETY_CHECK,
        AgentStepName.APPROVAL_GATE,
    ]
    assert result.critic_report is not None
    assert result.critic_report.grounded


def test_graph_workflow_skips_retrieval_and_planning_for_missing_info_route():
    result = _run_graph_workflow_for_inbox("inbox_003")

    assert result.route == AgentRoute.MISSING_INFO
    assert result.action_card.id == "action_003"
    assert result.generation_mode == AgentRunGenerationMode.DETERMINISTIC_TEMPLATE
    assert result.fallback_reason == "Graph route skipped planning for missing_info"
    assert [step.step_name for step in result.agent_steps] == [
        AgentStepName.TRIAGE,
        AgentStepName.CRITIC_CHECK,
        AgentStepName.SAFETY_CHECK,
        AgentStepName.APPROVAL_GATE,
    ]
    assert result.critic_report is not None
    assert result.critic_report.grounded


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
        AgentStepName.CRITIC_CHECK,
        AgentStepName.SAFETY_CHECK,
        AgentStepName.APPROVAL_GATE,
    ]
    assert result.critic_report is not None
    assert result.critic_report.grounded


def test_graph_workflow_adds_calendar_availability_to_safety_notes():
    result = _run_graph_workflow_for_inbox("inbox_006")

    assert result.calendar_availability is not None
    assert len(result.calendar_availability.candidates) == 2
    first_candidate = result.calendar_availability.candidates[0]
    second_candidate = result.calendar_availability.candidates[1]
    assert not first_candidate.is_available
    assert first_candidate.conflicting_events[0].id == "cal_001"
    assert second_candidate.is_available

    safety_text = "\n".join(result.action_card.safety_notes)
    assert "アルバイト" in safety_text
    assert "cal_001" in safety_text

    safety_step = next(
        step
        for step in result.agent_steps
        if step.step_name == AgentStepName.SAFETY_CHECK
    )
    assert any(
        tool_call.name == "calendar_availability_check"
        for tool_call in safety_step.tool_calls
    )


def test_graph_workflow_skips_planning_for_conflicting_evidence_route():
    result = _run_graph_workflow_for_inbox("inbox_007")

    assert result.route == AgentRoute.CONFLICTING_EVIDENCE
    assert result.action_card.id == "action_007"
    assert result.generation_mode == AgentRunGenerationMode.DETERMINISTIC_TEMPLATE
    assert (
        result.fallback_reason
        == "Graph route skipped planning for conflicting_evidence"
    )
    assert [step.step_name for step in result.agent_steps] == [
        AgentStepName.TRIAGE,
        AgentStepName.EVIDENCE_RETRIEVAL,
        AgentStepName.CRITIC_CHECK,
        AgentStepName.SAFETY_CHECK,
        AgentStepName.APPROVAL_GATE,
    ]
    assert result.critic_report is not None
    assert result.critic_report.grounded


def test_graph_workflow_skips_planning_for_low_risk_todo_route():
    result = _run_graph_workflow_for_inbox("inbox_005")

    assert result.route == AgentRoute.LOW_RISK_TODO
    assert result.action_card.id == "action_005"
    assert result.generation_mode == AgentRunGenerationMode.DETERMINISTIC_TEMPLATE
    assert result.fallback_reason == "Graph route skipped planning for low_risk_todo"
    assert [step.step_name for step in result.agent_steps] == [
        AgentStepName.TRIAGE,
        AgentStepName.EVIDENCE_RETRIEVAL,
        AgentStepName.CRITIC_CHECK,
        AgentStepName.SAFETY_CHECK,
        AgentStepName.APPROVAL_GATE,
    ]
    assert result.critic_report is not None
    assert result.critic_report.grounded


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
