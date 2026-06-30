from app.agents.nodes import (
    approval_gate,
    check_safety,
    critique_action_card,
    plan_action_card,
    retrieve_evidence,
    triage,
)
from app.agents.runtime import (
    AgentWorkflowResult,
    list_referenced_evidence_items,
    run_node,
    to_calendar_availability_report,
    to_trace_step,
)
from app.agents.state import AgentState
from app.schemas import (
    ActionCard,
    AgentRunGenerationMode,
    EvidenceItem,
    InboxItem,
)
from app.settings import Settings


def run_legacy_agent_workflow(
    *,
    inbox_item: InboxItem,
    template_action_card: ActionCard,
    evidence_items: tuple[EvidenceItem, ...],
    settings: Settings,
) -> AgentWorkflowResult:
    state = AgentState(
        inbox_item=inbox_item,
        template_action_card=template_action_card,
        all_evidence_items=evidence_items,
        settings=settings,
    )
    node_results = [
        run_node(state, triage),
        run_node(state, retrieve_evidence),
        run_node(state, plan_action_card),
        run_node(state, critique_action_card),
        run_node(state, check_safety),
        run_node(state, approval_gate),
    ]

    if state.action_card is None:
        state.action_card = template_action_card
        state.generation_mode = AgentRunGenerationMode.DETERMINISTIC_TEMPLATE
        state.fallback_reason = "Agent workflow did not produce an Action Card"

    referenced_evidence_items = list_referenced_evidence_items(
        action_card=state.action_card,
        evidence_items=evidence_items,
    )
    return AgentWorkflowResult(
        action_card=state.action_card,
        agent_steps=[
            to_trace_step(
                action_card_id=state.action_card.id,
                sequence=sequence,
                node_result=node_result,
            )
            for sequence, node_result in enumerate(node_results, start=1)
        ],
        evidence_items=list(referenced_evidence_items),
        retrieved_evidence_items=list(state.retrieved_evidence_items),
        calendar_availability=to_calendar_availability_report(
            state.calendar_availability
        ),
        critic_report=state.critic_report,
        generation_mode=state.generation_mode,
        fallback_reason=state.fallback_reason,
        route=state.route,
    )
