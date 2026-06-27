from dataclasses import dataclass, field

from app.agents.state import AgentState
from app.schemas import (
    ActionKind,
    AgentRunGenerationMode,
    AgentStepName,
    AgentStepStatus,
    AgentToolCall,
    EvidenceItem,
    EvidenceSourceType,
    RiskLevel,
)
from app.schemas.agent_route import AgentRoute
from app.services.gemini_client import generate_action_card_with_gemini


@dataclass
class AgentNodeResult:
    step_name: AgentStepName
    status: AgentStepStatus
    input_summary: str
    output_summary: str
    tool_calls: list[AgentToolCall] = field(default_factory=list)


def triage(state: AgentState) -> AgentNodeResult:
    text = _inbox_text(state)
    requires_reply = _contains_any(text, ("返信", "ご都合", "参加可能", "候補"))
    has_schedule = _contains_any(text, ("日程", "候補", "面談", "時間"))
    has_todo = _contains_any(text, ("提出物", "確認", "締切", "期限"))
    state.triage_signals = {
        "requires_reply": requires_reply,
        "has_schedule": has_schedule,
        "has_todo": has_todo,
    }
    state.route = _route_for_state(state)

    detected_signals = [
        label
        for label, detected in state.triage_signals.items()
        if detected
    ]
    output = (
        f"Detected {', '.join(detected_signals)}."
        if detected_signals
        else "No urgent action signal detected."
    )
    output = f"{output} Route: {state.route.value}."
    return AgentNodeResult(
        step_name=AgentStepName.TRIAGE,
        status=AgentStepStatus.COMPLETED,
        input_summary=f"Checked inbox item {state.inbox_item.id}.",
        output_summary=output,
    )


def retrieve_evidence(state: AgentState) -> AgentNodeResult:
    scored_items = [
        (item, _score_evidence_item(state, item))
        for item in state.all_evidence_items
    ]
    retrieved_items = tuple(
        item
        for item, score in sorted(
            scored_items,
            key=lambda pair: (pair[1], pair[0].relevance_score),
            reverse=True,
        )
        if score > 0
    )[:3]
    state.retrieved_evidence_items = retrieved_items

    evidence_ids = [item.id for item in retrieved_items]
    return AgentNodeResult(
        step_name=AgentStepName.EVIDENCE_RETRIEVAL,
        status=AgentStepStatus.COMPLETED,
        input_summary=f"Scored {len(state.all_evidence_items)} evidence items.",
        output_summary=(
            f"Retrieved evidence: {', '.join(evidence_ids)}."
            if evidence_ids
            else "No supporting evidence was retrieved."
        ),
        tool_calls=[
            AgentToolCall(
                name="seed_evidence_search",
                input_summary="Keyword scoring over local seed evidence.",
                output_summary=f"{len(retrieved_items)} evidence items selected.",
            )
        ],
    )


def plan_action_card(state: AgentState) -> AgentNodeResult:
    gemini_result = generate_action_card_with_gemini(
        inbox_item=state.inbox_item,
        evidence_items=state.retrieved_evidence_items,
        settings=state.settings,
    )
    if gemini_result.action_card:
        state.action_card = gemini_result.action_card
        state.generation_mode = AgentRunGenerationMode.GEMINI_ASSISTED
        state.fallback_reason = None
        output = "Generated an Action Card with Gemini and schema validation."
    else:
        state.action_card = state.template_action_card
        state.generation_mode = AgentRunGenerationMode.DETERMINISTIC_TEMPLATE
        state.fallback_reason = gemini_result.fallback_reason
        output = (
            "Used deterministic template fallback"
            f" because {gemini_result.fallback_reason}."
        )

    return AgentNodeResult(
        step_name=AgentStepName.ACTION_PLANNING,
        status=AgentStepStatus.COMPLETED,
        input_summary=(
            f"Planned actions from {len(state.retrieved_evidence_items)} "
            "retrieved evidence items."
        ),
        output_summary=output,
        tool_calls=[
            AgentToolCall(
                name="gemini_generate_content",
                input_summary=(
                    f"Model {state.settings.gemini_model} with Action Card JSON schema."
                ),
                output_summary=state.generation_mode.value,
            )
        ],
    )


def check_safety(state: AgentState) -> AgentNodeResult:
    if state.action_card is None:
        return AgentNodeResult(
            step_name=AgentStepName.SAFETY_CHECK,
            status=AgentStepStatus.FAILED,
            input_summary="No Action Card was available for safety validation.",
            output_summary="Safety check could not run.",
        )

    action_set = set(state.action_card.actions)
    requires_approval = (
        bool(
            action_set
            & {
                ActionKind.DRAFT_REPLY,
                ActionKind.PROPOSE_SCHEDULE,
            }
        )
        or state.action_card.risk_level == RiskLevel.HIGH
    )
    unknown_evidence_ids = sorted(
        set(state.action_card.evidence_ids)
        - {item.id for item in state.all_evidence_items}
    )
    if unknown_evidence_ids:
        return AgentNodeResult(
            step_name=AgentStepName.SAFETY_CHECK,
            status=AgentStepStatus.FAILED,
            input_summary=f"Checked Action Card {state.action_card.id}.",
            output_summary=(
                "Unknown evidence ids found: "
                f"{', '.join(unknown_evidence_ids)}."
            ),
        )

    review_note = (
        "approval required"
        if requires_approval and state.action_card.approval_required
        else "no approval required"
    )
    return AgentNodeResult(
        step_name=AgentStepName.SAFETY_CHECK,
        status=AgentStepStatus.COMPLETED,
        input_summary=f"Checked Action Card {state.action_card.id}.",
        output_summary=(
            "Schema and evidence references are valid; "
            f"{review_note}."
        ),
    )


def _score_evidence_item(state: AgentState, evidence_item: EvidenceItem) -> float:
    text = _inbox_text(state)
    score = 0.0
    if evidence_item.source_type == EvidenceSourceType.INBOX_ITEM:
        score += 0.3
    if evidence_item.used_for == "priority" and state.triage_signals.get(
        "requires_reply",
        False,
    ):
        score += 0.6
    if evidence_item.used_for == "schedule_risk" and state.triage_signals.get(
        "has_schedule",
        False,
    ):
        score += 0.6
    if evidence_item.used_for == "todo" and state.triage_signals.get("has_todo", False):
        score += 0.6

    evidence_text = f"{evidence_item.title}\n{evidence_item.snippet}".lower()
    for keyword in ("面談", "候補", "提出物", "確認", "返信", "締切", "期限"):
        if keyword in text and keyword in evidence_text:
            score += 0.2

    return score


def _route_for_state(state: AgentState) -> AgentRoute:
    action_card = state.template_action_card
    action_set = set(action_card.actions)
    safety_text = "\n".join(action_card.safety_notes).lower()

    if "矛盾" in safety_text or "conflict" in safety_text:
        return AgentRoute.CONFLICTING_EVIDENCE
    if ActionKind.REQUEST_MISSING_INFO in action_set:
        return AgentRoute.MISSING_INFO
    if ActionKind.IGNORE in action_set:
        return AgentRoute.IGNORE
    if (
        action_set == {ActionKind.CREATE_TODO}
        and not action_card.approval_required
        and action_card.risk_level == RiskLevel.LOW
    ):
        return AgentRoute.LOW_RISK_TODO
    return AgentRoute.REVIEW_REQUIRED


def _inbox_text(state: AgentState) -> str:
    return f"{state.inbox_item.subject}\n{state.inbox_item.body}".lower()


def _contains_any(text: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword in text for keyword in keywords)
