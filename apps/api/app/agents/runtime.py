from collections.abc import Callable
from dataclasses import dataclass
from time import perf_counter

from app.agents.nodes import AgentNodeResult
from app.agents.state import AgentState
from app.schemas import (
    ActionCard,
    AgentRunGenerationMode,
    AgentStepName,
    AgentStepStatus,
    AgentTraceStep,
    EvidenceItem,
)
from app.schemas.agent_route import AgentRoute


@dataclass(frozen=True)
class AgentWorkflowResult:
    action_card: ActionCard
    agent_steps: list[AgentTraceStep]
    evidence_items: list[EvidenceItem]
    generation_mode: AgentRunGenerationMode
    fallback_reason: str | None
    route: AgentRoute | None


def run_node(
    state: AgentState,
    node: Callable[[AgentState], AgentNodeResult],
) -> tuple[AgentNodeResult, int]:
    started_at = perf_counter()
    try:
        result = node(state)
    except Exception as error:
        result = AgentNodeResult(
            step_name=_step_name_for_node(node),
            status=AgentStepStatus.FAILED,
            input_summary="Agent node raised an exception.",
            output_summary=f"{type(error).__name__}: {error}",
        )
    latency_ms = max(0, round((perf_counter() - started_at) * 1000))
    return AgentNodeResult(
        step_name=result.step_name,
        status=result.status,
        input_summary=result.input_summary,
        output_summary=result.output_summary,
        tool_calls=result.tool_calls,
    ), latency_ms


def to_trace_step(
    *,
    action_card_id: str,
    sequence: int,
    node_result: tuple[AgentNodeResult, int],
) -> AgentTraceStep:
    result, latency_ms = node_result
    return AgentTraceStep(
        action_card_id=action_card_id,
        sequence=sequence,
        step_name=result.step_name,
        status=result.status,
        input_summary=result.input_summary,
        output_summary=result.output_summary,
        tool_calls=result.tool_calls,
        latency_ms=latency_ms,
    )


def list_referenced_evidence_items(
    *,
    action_card: ActionCard,
    evidence_items: tuple[EvidenceItem, ...],
) -> tuple[EvidenceItem, ...]:
    evidence_by_id = {item.id: item for item in evidence_items}
    return tuple(
        evidence_by_id[evidence_id]
        for evidence_id in action_card.evidence_ids
        if evidence_id in evidence_by_id
    )


def _step_name_for_node(
    node: Callable[[AgentState], AgentNodeResult],
) -> AgentStepName:
    step_names = {
        "triage": AgentStepName.TRIAGE,
        "retrieve_evidence": AgentStepName.EVIDENCE_RETRIEVAL,
        "plan_action_card": AgentStepName.ACTION_PLANNING,
        "check_safety": AgentStepName.SAFETY_CHECK,
    }
    return step_names[node.__name__]
