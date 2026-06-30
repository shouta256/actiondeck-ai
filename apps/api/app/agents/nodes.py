import re
from dataclasses import dataclass, field

from app.agents.state import AgentState
from app.schemas import (
    ActionKind,
    AgentCriticReport,
    AgentRunGenerationMode,
    AgentStepName,
    AgentStepStatus,
    AgentToolCall,
    EvidenceItem,
    EvidenceSourceType,
    RiskLevel,
)
from app.schemas.agent_route import AgentRoute
from app.services.calendar_availability import (
    check_calendar_availability,
    describe_calendar_availability,
    proposal_conflicts_with_calendar,
)
from app.services.evidence_vector_store import search_evidence_with_pgvector
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
    query_text = _evidence_query_text(state)
    vector_search_result = search_evidence_with_pgvector(
        query_text=query_text,
        limit=12,
    )
    if vector_search_result.evidence_items:
        retrieved_items = _rank_evidence_items(
            state,
            vector_search_result.evidence_items,
        )[:3]
        state.retrieved_evidence_items = retrieved_items
        evidence_ids = [item.id for item in retrieved_items]
        return AgentNodeResult(
            step_name=AgentStepName.EVIDENCE_RETRIEVAL,
            status=AgentStepStatus.COMPLETED,
            input_summary="Searched Postgres pgvector evidence index.",
            output_summary=f"Retrieved evidence: {', '.join(evidence_ids)}.",
            tool_calls=[
                AgentToolCall(
                    name="pgvector_evidence_search",
                    input_summary=(
                        "Local deterministic embedding + vector candidates "
                        "with route-aware reranking."
                    ),
                    output_summary=f"{len(retrieved_items)} evidence items selected.",
                )
            ],
        )

    retrieved_items = _rank_evidence_items(state, state.all_evidence_items)[:3]
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
                input_summary=(
                    "Keyword scoring over local seed evidence. "
                    f"pgvector fallback: {vector_search_result.fallback_reason}."
                ),
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


def critique_action_card(state: AgentState) -> AgentNodeResult:
    if state.action_card is None:
        state.critic_report = AgentCriticReport(
            grounded=False,
            issues=["Action Card is missing."],
            checked_items=[],
        )
        return AgentNodeResult(
            step_name=AgentStepName.CRITIC_CHECK,
            status=AgentStepStatus.FAILED,
            input_summary="No Action Card was available for critic review.",
            output_summary="Critic check could not run.",
        )

    checked_items = [
        "schema_contract",
        "proposal_completeness",
        "approval_boundary",
        "evidence_grounding",
    ]
    issues = _critic_issues(state)
    state.critic_report = AgentCriticReport(
        grounded=not issues,
        issues=issues,
        checked_items=checked_items,
    )

    if issues:
        critic_notes = [f"Critic: {issue}" for issue in issues]
        merged_notes = [
            *state.action_card.safety_notes,
            *(
                note
                for note in critic_notes
                if note not in state.action_card.safety_notes
            ),
        ]
        state.action_card = state.action_card.model_copy(
            update={"safety_notes": merged_notes}
        )

    output = (
        "Planner output passed grounding checks."
        if not issues
        else f"Planner output has {len(issues)} critic issue(s)."
    )
    return AgentNodeResult(
        step_name=AgentStepName.CRITIC_CHECK,
        status=AgentStepStatus.COMPLETED,
        input_summary=f"Reviewed Action Card {state.action_card.id}.",
        output_summary=output,
        tool_calls=[
            AgentToolCall(
                name="critic_grounding_check",
                input_summary=(
                    "Checked planner output against proposal, approval, "
                    "and evidence rules."
                ),
                output_summary=(
                    "0 issues found."
                    if not issues
                    else f"{len(issues)} issues found."
                ),
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

    calendar_tool_call = _apply_calendar_availability_notes(state)
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
        tool_calls=([calendar_tool_call] if calendar_tool_call else []),
    )


def approval_gate(state: AgentState) -> AgentNodeResult:
    if state.action_card is None:
        return AgentNodeResult(
            step_name=AgentStepName.APPROVAL_GATE,
            status=AgentStepStatus.FAILED,
            input_summary="No Action Card was available for approval gating.",
            output_summary="Approval gate could not run.",
        )

    if state.action_card.approval_required:
        output = "Waiting for user approval; no external action executed."
    else:
        output = "No approval required; external execution is still disabled in MVP."

    return AgentNodeResult(
        step_name=AgentStepName.APPROVAL_GATE,
        status=AgentStepStatus.COMPLETED,
        input_summary=f"Checked approval boundary for {state.action_card.id}.",
        output_summary=output,
    )


def _critic_issues(state: AgentState) -> list[str]:
    if state.action_card is None:
        return ["Action Card is missing."]

    action_card = state.action_card
    action_set = set(action_card.actions)
    proposal = action_card.proposal
    issues: list[str] = []

    if ActionKind.DRAFT_REPLY in action_set and not proposal.reply_draft:
        issues.append("draft_reply action is missing reply_draft.")
    if ActionKind.PROPOSE_SCHEDULE in action_set and proposal.calendar_event is None:
        issues.append("propose_schedule action is missing calendar_event.")
    if ActionKind.CREATE_TODO in action_set and not proposal.todos:
        issues.append("create_todo action is missing todos.")
    if ActionKind.REQUEST_MISSING_INFO in action_set and not action_card.missing_info:
        issues.append("request_missing_info action is missing missing_info.")

    approval_actions = {
        ActionKind.DRAFT_REPLY,
        ActionKind.PROPOSE_SCHEDULE,
    }
    if (action_set & approval_actions or action_card.risk_level == RiskLevel.HIGH) and (
        not action_card.approval_required
    ):
        issues.append("reviewable action does not require approval.")

    unknown_evidence_ids = sorted(
        set(action_card.evidence_ids)
        - {item.id for item in state.all_evidence_items}
    )
    if unknown_evidence_ids:
        issues.append(
            "unknown evidence ids: "
            f"{', '.join(unknown_evidence_ids)}."
        )

    terminal_actions = {
        ActionKind.IGNORE,
        ActionKind.REQUEST_MISSING_INFO,
    }
    if not action_card.evidence_ids and not action_set <= terminal_actions:
        issues.append("reviewable action has no evidence ids.")

    return issues


def _rank_evidence_items(
    state: AgentState,
    evidence_items: tuple[EvidenceItem, ...],
) -> tuple[EvidenceItem, ...]:
    scored_items = [
        (item, _score_evidence_item(state, item))
        for item in evidence_items
    ]
    return tuple(
        item
        for item, score in sorted(
            scored_items,
            key=lambda pair: (pair[1], pair[0].relevance_score),
            reverse=True,
        )
        if score > 0
    )


def _score_evidence_item(state: AgentState, evidence_item: EvidenceItem) -> float:
    text = _evidence_query_text(state).lower()
    score = 0.0
    if evidence_item.source_type == EvidenceSourceType.INBOX_ITEM:
        score += 0.3
    if evidence_item.used_for == "priority" and state.triage_signals.get(
        "requires_reply",
        False,
    ):
        score += 1.0
    if evidence_item.used_for == "schedule_risk" and state.triage_signals.get(
        "has_schedule",
        False,
    ):
        score += 0.6
    if evidence_item.used_for == "todo" and state.triage_signals.get("has_todo", False):
        todo_weight = (
            0.9
            if _contains_any(text, ("提出物", "締切", "期限", "資料", "ポートフォリオ"))
            else 0.2
        )
        score += todo_weight

    evidence_text = f"{evidence_item.title}\n{evidence_item.snippet}".lower()
    if _extract_date_keys(text) & _extract_date_keys(evidence_text):
        score += 0.7

    for keyword in ("面談", "候補", "提出物", "確認", "返信", "締切", "期限", "第一志望"):
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


def _evidence_query_text(state: AgentState) -> str:
    hints = []
    if "lineヤフー" in _inbox_text(state):
        hints.append("第一志望")
    if (
        state.triage_signals.get("requires_reply", False)
        and state.route != AgentRoute.CONFLICTING_EVIDENCE
    ):
        hints.append("priority 返信 返信方針")
    if state.triage_signals.get("has_schedule", False):
        hints.append("schedule_risk 予定 衝突 候補日時")
    if state.triage_signals.get("has_todo", False):
        hints.append("todo create_todo 確認")
    if state.route == AgentRoute.MISSING_INFO:
        hints.append("missing_info 不足 曖昧")
    return "\n".join((_inbox_text(state), *hints))


def _contains_any(text: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword in text for keyword in keywords)


def _extract_date_keys(text: str) -> set[str]:
    date_keys = set(re.findall(r"20\d{2}-\d{2}-\d{2}", text))
    for year, month, day in re.findall(r"(20\d{2})年(\d{1,2})月(\d{1,2})日", text):
        date_keys.add(f"{year}-{int(month):02d}-{int(day):02d}")
    return date_keys


def _apply_calendar_availability_notes(
    state: AgentState,
) -> AgentToolCall | None:
    if not state.triage_signals.get("has_schedule", False):
        return None

    availability = check_calendar_availability(_inbox_text(state))
    state.calendar_availability = availability

    notes = list(state.action_card.safety_notes) if state.action_card else []
    availability_notes = list(describe_calendar_availability(availability))
    notes.extend(note for note in availability_notes if note not in notes)

    if state.action_card and state.action_card.proposal.calendar_event:
        proposed_event = state.action_card.proposal.calendar_event
        conflicting_events = proposal_conflicts_with_calendar(
            start=proposed_event.start,
            end=proposed_event.end,
        )
        for event in conflicting_events:
            note = (
                "提案予定が既存予定"
                f"「{event.title}」({event.id}) と衝突します"
            )
            if note not in notes:
                notes.append(note)

    if state.action_card and notes != state.action_card.safety_notes:
        state.action_card = state.action_card.model_copy(
            update={"safety_notes": notes}
        )

    if not availability.has_candidates:
        output = "No explicit calendar candidates were found."
    else:
        conflict_count = sum(
            1 for candidate in availability.candidates if not candidate.is_available
        )
        output = (
            f"Checked {len(availability.candidates)} candidate slots; "
            f"{conflict_count} conflicts found."
        )

    return AgentToolCall(
        name="calendar_availability_check",
        input_summary="Read-only local calendar events were compared with schedule candidates.",
        output_summary=output,
    )
