import json
from functools import lru_cache
from pathlib import Path

from app.schemas import ActionCard, ActionCardEvalCase, ActionCardEvalRunResult
from app.schemas.evaluation import ActionCardEvalCaseResult
from app.services.action_card_store import list_action_cards


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


def run_action_card_eval() -> ActionCardEvalRunResult:
    cases = list_action_card_eval_cases()
    action_cards_by_source = {
        card.source_item_id: card for card in list_action_cards()
    }
    case_results = tuple(
        _evaluate_case(case, action_cards_by_source.get(case.input_item_id))
        for case in cases
    )

    total_cases = len(case_results)
    passed_cases = sum(1 for result in case_results if result.passed)
    action_matches = sum(1 for result in case_results if result.actions_match)
    priority_matches = sum(1 for result in case_results if result.priority_match)

    required_evidence_count = sum(
        len(result.required_evidence_ids) for result in case_results
    )
    missing_evidence_count = sum(
        len(result.missing_evidence_ids) for result in case_results
    )
    covered_evidence_count = required_evidence_count - missing_evidence_count

    return ActionCardEvalRunResult(
        total_cases=total_cases,
        passed_cases=passed_cases,
        action_match_rate=_safe_rate(action_matches, total_cases),
        priority_match_rate=_safe_rate(priority_matches, total_cases),
        evidence_recall=_safe_rate(covered_evidence_count, required_evidence_count),
        cases=list(case_results),
    )


def _evaluate_case(
    case: ActionCardEvalCase,
    action_card: ActionCard | None,
) -> ActionCardEvalCaseResult:
    actual_actions = action_card.actions if action_card else []
    actual_evidence_ids = action_card.evidence_ids if action_card else []
    missing_evidence_ids = [
        evidence_id
        for evidence_id in case.required_evidence_ids
        if evidence_id not in actual_evidence_ids
    ]
    actions_match = set(actual_actions) == set(case.expected_actions)
    priority_match = (
        action_card is not None and action_card.priority == case.expected_priority
    )
    required_evidence_covered = len(missing_evidence_ids) == 0

    return ActionCardEvalCaseResult(
        id=case.id,
        input_item_id=case.input_item_id,
        actual_action_card_id=action_card.id if action_card else None,
        actions_match=actions_match,
        priority_match=priority_match,
        required_evidence_covered=required_evidence_covered,
        expected_actions=case.expected_actions,
        actual_actions=actual_actions,
        expected_priority=case.expected_priority,
        actual_priority=action_card.priority if action_card else None,
        required_evidence_ids=case.required_evidence_ids,
        actual_evidence_ids=actual_evidence_ids,
        missing_evidence_ids=missing_evidence_ids,
        passed=actions_match and priority_match and required_evidence_covered,
    )


def _safe_rate(numerator: int, denominator: int) -> float:
    if denominator == 0:
        return 1.0
    return numerator / denominator
