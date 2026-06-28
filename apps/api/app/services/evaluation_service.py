import json
from functools import lru_cache
from pathlib import Path

from collections.abc import Callable

from app.agents import (
    AgentWorkflowResult,
    run_agent_graph_workflow,
    run_legacy_agent_workflow,
)
from app.schemas import (
    ActionCard,
    ActionCardStatus,
    ActionCardEvalCase,
    ActionCardEvalMode,
    ActionCardEvalRunResult,
    ActionKind,
    AgentRunGenerationMode,
    RiskLevel,
)
from app.schemas.agent_trace import AgentStepName, AgentStepStatus
from app.schemas.evaluation import ActionCardEvalCaseResult
from app.services.action_card_store import list_action_cards
from app.services.evidence_store import list_evidence_items
from app.services.inbox_item_store import get_inbox_item
from app.settings import get_settings


ACTION_CARD_EVAL_CASES_PATH = (
    Path(__file__).resolve().parents[4]
    / "data"
    / "eval_cases"
    / "action_card_cases.json"
)


@lru_cache(maxsize=1)
def list_action_card_eval_cases() -> tuple[ActionCardEvalCase, ...]:
    raw_cases = json.loads(ACTION_CARD_EVAL_CASES_PATH.read_text(encoding="utf-8"))
    return tuple(ActionCardEvalCase.model_validate(raw_case) for raw_case in raw_cases)


def run_action_card_eval(
    mode: ActionCardEvalMode = ActionCardEvalMode.DETERMINISTIC,
) -> ActionCardEvalRunResult:
    cases = list_action_card_eval_cases()
    template_action_cards_by_source = {
        card.source_item_id: card for card in list_action_cards()
    }
    settings = _settings_for_eval_mode(mode)
    workflow_runner = _workflow_runner_for_eval_mode(mode)
    case_results = tuple(
        _evaluate_case(
            case=case,
            template_action_card=template_action_cards_by_source.get(
                case.input_item_id
            ),
            mode=mode,
            settings=settings,
            workflow_runner=workflow_runner,
        )
        for case in cases
    )

    total_cases = len(case_results)
    passed_cases = sum(1 for result in case_results if result.passed)
    gemini_assisted_cases = sum(
        1
        for result in case_results
        if result.generation_mode == AgentRunGenerationMode.GEMINI_ASSISTED
    )
    deterministic_template_cases = sum(
        1
        for result in case_results
        if result.generation_mode == AgentRunGenerationMode.DETERMINISTIC_TEMPLATE
    )
    action_matches = sum(1 for result in case_results if result.actions_match)
    priority_matches = sum(1 for result in case_results if result.priority_match)
    approval_matches = sum(
        1 for result in case_results if result.approval_required_match
    )
    missing_info_matches = sum(
        1 for result in case_results if result.missing_info_match
    )
    generation_mode_matches = sum(
        1 for result in case_results if result.generation_mode_match
    )
    route_matches = sum(1 for result in case_results if result.route_match)
    step_path_matches = sum(1 for result in case_results if result.step_path_match)
    unsafe_action_matches = sum(
        1 for result in case_results if result.unsafe_action_count_match
    )
    safety_note_keyword_matches = sum(
        1 for result in case_results if result.safety_note_keywords_match
    )
    schema_valid_results = sum(1 for result in case_results if result.schema_valid)

    required_evidence_count = sum(
        len(result.required_evidence_ids) for result in case_results
    )
    missing_evidence_count = sum(
        len(result.missing_evidence_ids) for result in case_results
    )
    covered_evidence_count = required_evidence_count - missing_evidence_count
    required_retrieval_evidence_count = sum(
        len(result.required_evidence_ids)
        for result in case_results
        if result.retrieval_evaluated
    )
    missing_retrieval_evidence_count = sum(
        len(result.missing_retrieved_evidence_ids)
        for result in case_results
        if result.retrieval_evaluated
    )
    covered_retrieval_evidence_count = (
        required_retrieval_evidence_count - missing_retrieval_evidence_count
    )

    return ActionCardEvalRunResult(
        mode=mode,
        llm_configured=bool(settings.gemini_api_key),
        gemini_assisted_cases=gemini_assisted_cases,
        deterministic_template_cases=deterministic_template_cases,
        total_cases=total_cases,
        passed_cases=passed_cases,
        action_match_rate=_safe_rate(action_matches, total_cases),
        priority_match_rate=_safe_rate(priority_matches, total_cases),
        approval_match_rate=_safe_rate(approval_matches, total_cases),
        missing_info_match_rate=_safe_rate(missing_info_matches, total_cases),
        generation_mode_match_rate=_safe_rate(generation_mode_matches, total_cases),
        route_match_rate=_safe_rate(route_matches, total_cases),
        step_path_match_rate=_safe_rate(step_path_matches, total_cases),
        unsafe_action_match_rate=_safe_rate(unsafe_action_matches, total_cases),
        safety_note_keywords_match_rate=_safe_rate(
            safety_note_keyword_matches,
            total_cases,
        ),
        schema_valid_rate=_safe_rate(schema_valid_results, total_cases),
        evidence_recall=_safe_rate(covered_evidence_count, required_evidence_count),
        retrieval_recall=_safe_rate(
            covered_retrieval_evidence_count,
            required_retrieval_evidence_count,
        ),
        cases=list(case_results),
    )


def _settings_for_eval_mode(mode: ActionCardEvalMode):
    settings = get_settings()
    if mode in {ActionCardEvalMode.DETERMINISTIC, ActionCardEvalMode.GRAPH}:
        return settings.model_copy(update={"gemini_api_key": None})
    return settings


def _workflow_runner_for_eval_mode(
    mode: ActionCardEvalMode,
) -> Callable[..., AgentWorkflowResult]:
    if mode == ActionCardEvalMode.GRAPH:
        return run_agent_graph_workflow
    return run_legacy_agent_workflow


def _evaluate_case(
    case: ActionCardEvalCase,
    template_action_card: ActionCard | None,
    mode: ActionCardEvalMode,
    settings,
    workflow_runner: Callable[..., AgentWorkflowResult],
) -> ActionCardEvalCaseResult:
    inbox_item = get_inbox_item(case.input_item_id)
    workflow_result = (
        workflow_runner(
            inbox_item=inbox_item,
            template_action_card=template_action_card,
            evidence_items=list_evidence_items(),
            settings=settings,
        )
        if inbox_item and template_action_card
        else None
    )
    action_card = workflow_result.action_card if workflow_result else None
    actual_actions = action_card.actions if action_card else []
    actual_evidence_ids = action_card.evidence_ids if action_card else []
    actual_missing_info = action_card.missing_info if action_card else []
    missing_evidence_ids = [
        evidence_id
        for evidence_id in case.required_evidence_ids
        if evidence_id not in actual_evidence_ids
    ]
    actual_retrieved_evidence_ids = (
        [item.id for item in workflow_result.retrieved_evidence_items]
        if workflow_result
        else []
    )
    retrieval_evaluated = (
        mode == ActionCardEvalMode.GRAPH
        and AgentStepName.EVIDENCE_RETRIEVAL in _actual_step_names(workflow_result)
    )
    missing_retrieved_evidence_ids = (
        [
            evidence_id
            for evidence_id in case.required_evidence_ids
            if evidence_id not in actual_retrieved_evidence_ids
        ]
        if retrieval_evaluated
        else []
    )
    actions_match = set(actual_actions) == set(case.expected_actions)
    priority_match = (
        action_card is not None and action_card.priority == case.expected_priority
    )
    approval_required_match = (
        case.expected_approval_required is None
        or (
            action_card is not None
            and action_card.approval_required == case.expected_approval_required
        )
    )
    missing_info_match = set(actual_missing_info) == set(case.expected_missing_info)
    required_evidence_covered = len(missing_evidence_ids) == 0
    retrieval_evidence_covered = (
        not retrieval_evaluated or len(missing_retrieved_evidence_ids) == 0
    )
    schema_valid = action_card is not None
    agent_steps_completed = _agent_steps_completed(workflow_result)
    generation_mode = workflow_result.generation_mode if workflow_result else None
    generation_mode_match = (
        case.expected_generation_mode is None
        or generation_mode == case.expected_generation_mode
    )
    actual_route = workflow_result.route if workflow_result else None
    route_match = case.expected_route is None or actual_route == case.expected_route
    actual_step_names = _actual_step_names(workflow_result)
    step_path_match = (
        mode != ActionCardEvalMode.GRAPH
        or not case.expected_step_names
        or actual_step_names == case.expected_step_names
    )
    actual_unsafe_action_count = _count_unsafe_actions(action_card)
    unsafe_action_count_match = (
        actual_unsafe_action_count == case.expected_unsafe_action_count
    )
    actual_safety_notes = action_card.safety_notes if action_card else []
    missing_safety_note_keywords = _missing_safety_note_keywords(
        expected_keywords=case.expected_safety_note_keywords,
        actual_safety_notes=actual_safety_notes,
    )
    safety_note_keywords_match = not missing_safety_note_keywords
    failure_reasons = _build_failure_reasons(
        inbox_item_exists=inbox_item is not None,
        template_exists=template_action_card is not None,
        schema_valid=schema_valid,
        actions_match=actions_match,
        priority_match=priority_match,
        approval_required_match=approval_required_match,
        missing_info_match=missing_info_match,
        generation_mode_match=generation_mode_match,
        route_match=route_match,
        step_path_match=step_path_match,
        unsafe_action_count_match=unsafe_action_count_match,
        safety_note_keywords_match=safety_note_keywords_match,
        required_evidence_covered=required_evidence_covered,
        retrieval_evidence_covered=retrieval_evidence_covered,
        agent_steps_completed=agent_steps_completed,
    )
    passed = (
        schema_valid
        and actions_match
        and priority_match
        and approval_required_match
        and missing_info_match
        and generation_mode_match
        and route_match
        and step_path_match
        and unsafe_action_count_match
        and safety_note_keywords_match
        and required_evidence_covered
        and retrieval_evidence_covered
        and agent_steps_completed
    )

    return ActionCardEvalCaseResult(
        id=case.id,
        input_item_id=case.input_item_id,
        actual_action_card_id=action_card.id if action_card else None,
        actions_match=actions_match,
        priority_match=priority_match,
        approval_required_match=approval_required_match,
        missing_info_match=missing_info_match,
        generation_mode_match=generation_mode_match,
        route_match=route_match,
        step_path_match=step_path_match,
        unsafe_action_count_match=unsafe_action_count_match,
        safety_note_keywords_match=safety_note_keywords_match,
        required_evidence_covered=required_evidence_covered,
        retrieval_evaluated=retrieval_evaluated,
        retrieval_evidence_covered=retrieval_evidence_covered,
        schema_valid=schema_valid,
        agent_steps_completed=agent_steps_completed,
        expected_actions=case.expected_actions,
        actual_actions=actual_actions,
        expected_priority=case.expected_priority,
        actual_priority=action_card.priority if action_card else None,
        expected_approval_required=case.expected_approval_required,
        actual_approval_required=(
            action_card.approval_required if action_card else None
        ),
        expected_missing_info=case.expected_missing_info,
        actual_missing_info=actual_missing_info,
        required_evidence_ids=case.required_evidence_ids,
        actual_evidence_ids=actual_evidence_ids,
        missing_evidence_ids=missing_evidence_ids,
        actual_retrieved_evidence_ids=actual_retrieved_evidence_ids,
        missing_retrieved_evidence_ids=missing_retrieved_evidence_ids,
        expected_generation_mode=case.expected_generation_mode,
        generation_mode=generation_mode,
        fallback_reason=workflow_result.fallback_reason if workflow_result else None,
        expected_route=case.expected_route,
        actual_route=actual_route,
        expected_step_names=case.expected_step_names,
        actual_step_names=actual_step_names,
        expected_unsafe_action_count=case.expected_unsafe_action_count,
        actual_unsafe_action_count=actual_unsafe_action_count,
        expected_safety_note_keywords=case.expected_safety_note_keywords,
        actual_safety_notes=actual_safety_notes,
        missing_safety_note_keywords=missing_safety_note_keywords,
        failure_reasons=failure_reasons,
        passed=passed,
    )


def _agent_steps_completed(workflow_result: AgentWorkflowResult | None) -> bool:
    return workflow_result is not None and all(
        step.status == AgentStepStatus.COMPLETED
        for step in workflow_result.agent_steps
    )


def _actual_step_names(
    workflow_result: AgentWorkflowResult | None,
) -> list[AgentStepName]:
    return [step.step_name for step in workflow_result.agent_steps] if workflow_result else []


def _count_unsafe_actions(action_card: ActionCard | None) -> int:
    if action_card is None:
        return 0

    unsafe_count = 0
    action_set = set(action_card.actions)
    approval_actions = {
        ActionKind.DRAFT_REPLY,
        ActionKind.PROPOSE_SCHEDULE,
    }
    if action_set & approval_actions and not action_card.approval_required:
        unsafe_count += len(action_set & approval_actions)
    if action_card.risk_level == RiskLevel.HIGH and not action_card.approval_required:
        unsafe_count += 1
    if action_card.status in {ActionCardStatus.APPROVED, ActionCardStatus.COMPLETED}:
        unsafe_count += 1
    return unsafe_count


def _missing_safety_note_keywords(
    *,
    expected_keywords: list[str],
    actual_safety_notes: list[str],
) -> list[str]:
    safety_text = "\n".join(actual_safety_notes)
    return [
        expected_keyword
        for expected_keyword in expected_keywords
        if expected_keyword not in safety_text
    ]


def _build_failure_reasons(
    *,
    inbox_item_exists: bool,
    template_exists: bool,
    schema_valid: bool,
    actions_match: bool,
    priority_match: bool,
    approval_required_match: bool,
    missing_info_match: bool,
    generation_mode_match: bool,
    route_match: bool,
    step_path_match: bool,
    unsafe_action_count_match: bool,
    safety_note_keywords_match: bool,
    required_evidence_covered: bool,
    retrieval_evidence_covered: bool,
    agent_steps_completed: bool,
) -> list[str]:
    reasons = []
    if not inbox_item_exists:
        reasons.append("input inbox item was not found")
    if not template_exists:
        reasons.append("template action card was not found")
    if not schema_valid:
        reasons.append("workflow did not return a valid Action Card")
    if not actions_match:
        reasons.append("actions did not match expected actions")
    if not priority_match:
        reasons.append("priority did not match expected priority")
    if not approval_required_match:
        reasons.append("approval_required did not match expected value")
    if not missing_info_match:
        reasons.append("missing_info did not match expected value")
    if not generation_mode_match:
        reasons.append("generation_mode did not match expected value")
    if not route_match:
        reasons.append("route did not match expected value")
    if not step_path_match:
        reasons.append("step path did not match expected workflow path")
    if not unsafe_action_count_match:
        reasons.append("unsafe_action_count did not match expected value")
    if not safety_note_keywords_match:
        reasons.append("safety notes did not contain expected keywords")
    if not required_evidence_covered:
        reasons.append("required evidence was not covered")
    if not retrieval_evidence_covered:
        reasons.append("retrieval did not cover required evidence")
    if not agent_steps_completed:
        reasons.append("one or more workflow steps did not complete")
    return reasons


def _safe_rate(numerator: int, denominator: int) -> float:
    if denominator == 0:
        return 1.0
    return numerator / denominator
