from collections.abc import Iterable
from datetime import UTC, datetime

from app.schemas.action_card import (
    ActionCard,
    ActionCardStatus,
    ActionKind,
    Priority,
    RiskLevel,
)
from app.schemas.agent_run import AgentRunResult
from app.schemas.action_plan import ActionPlan, ActionPlanEffort, ActionPlanItem
from app.services.action_card_store import list_action_cards
from app.services.agent_run_service import run_agent_for_inbox_item
from app.services.agent_run_store import save_agent_run
from app.services.inbox_item_store import list_inbox_items


ACTIONABLE_STATUSES = {
    ActionCardStatus.DRAFT,
    ActionCardStatus.PENDING_REVIEW,
    ActionCardStatus.EDITED,
}

PRIORITY_SCORE = {
    Priority.URGENT: 100,
    Priority.HIGH: 80,
    Priority.MEDIUM: 50,
    Priority.LOW: 20,
}

STATUS_SCORE = {
    ActionCardStatus.PENDING_REVIEW: 35,
    ActionCardStatus.DRAFT: 12,
    ActionCardStatus.EDITED: 10,
    ActionCardStatus.APPROVED: -30,
    ActionCardStatus.REJECTED: -100,
    ActionCardStatus.COMPLETED: -100,
}

RISK_SCORE = {
    RiskLevel.HIGH: 18,
    RiskLevel.MEDIUM: 8,
    RiskLevel.LOW: 0,
}


def build_action_plan(
    action_cards: Iterable[ActionCard],
    limit: int = 5,
    summary: str | None = None,
    processed_inbox_count: int = 0,
    agent_run_ids: list[str] | None = None,
    llm_configured: bool | None = None,
    generation_modes: dict[str, int] | None = None,
) -> ActionPlan:
    actionable_cards = [
        action_card
        for action_card in action_cards
        if _is_action_plan_candidate(action_card)
    ]
    scored_cards = sorted(
        actionable_cards,
        key=lambda card: (
            -_score_action_card(card),
            _estimate_minutes(card),
            card.id,
        ),
    )

    ranked_items = [
        _build_action_plan_item(
            action_card=action_card,
            rank=rank,
            score=_score_action_card(action_card),
        )
        for rank, action_card in enumerate(scored_cards, start=1)
    ]
    visible_items = ranked_items[:limit]
    quick_wins = sorted(
        visible_items,
        key=lambda item: (item.estimated_minutes, -item.score, item.action_card_id),
    )[:3]

    return ActionPlan(
        generated_at=datetime.now(UTC),
        summary=summary
        or f"{len(actionable_cards)}件の未処理Action Cardを整理しました。",
        processed_inbox_count=processed_inbox_count,
        action_card_count=len(actionable_cards),
        agent_run_ids=agent_run_ids or [],
        llm_configured=llm_configured,
        generation_modes=generation_modes or {},
        items=visible_items,
        quick_wins=quick_wins,
    )


async def run_action_plan_agent(limit: int = 5) -> ActionPlan:
    agent_runs: list[AgentRunResult] = []
    for inbox_item in list_inbox_items():
        agent_run = run_agent_for_inbox_item(inbox_item)
        if agent_run is None:
            continue
        agent_runs.append(await save_agent_run(agent_run))

    stable_action_cards = [
        _stable_action_card_for_plan(agent_run) for agent_run in agent_runs
    ]
    action_plan_card_count = sum(
        1 for action_card in stable_action_cards if _is_action_plan_candidate(action_card)
    )
    generation_modes = _count_generation_modes(agent_runs)
    gemini_count = generation_modes.get("gemini_assisted", 0)
    fallback_count = generation_modes.get("deterministic_template", 0)
    summary = (
        f"{len(agent_runs)}件のメールを確認し、"
        f"{len(stable_action_cards)}件のAction Cardを作成・確認しました。"
        f"対応不要を除き、{action_plan_card_count}件をAction Planに整理しました。"
        f" Gemini生成 {gemini_count}件、ルール/テンプレート補完 {fallback_count}件。"
    )

    return build_action_plan(
        stable_action_cards,
        limit=limit,
        summary=summary,
        processed_inbox_count=len(agent_runs),
        agent_run_ids=[agent_run.run_id for agent_run in agent_runs],
        llm_configured=any(agent_run.llm_configured for agent_run in agent_runs),
        generation_modes=generation_modes,
    )


def _build_action_plan_item(
    action_card: ActionCard,
    rank: int,
    score: int,
) -> ActionPlanItem:
    estimated_minutes = _estimate_minutes(action_card)
    return ActionPlanItem(
        rank=rank,
        action_card_id=action_card.id,
        source_item_id=action_card.source_item_id,
        title=action_card.title,
        summary=action_card.summary,
        actions=action_card.actions,
        priority=action_card.priority,
        risk_level=action_card.risk_level,
        status=action_card.status,
        score=score,
        estimated_minutes=estimated_minutes,
        effort=_effort_from_minutes(estimated_minutes),
        next_action=_next_action(action_card),
        reason=_reason(action_card),
        blockers=_blockers(action_card),
    )


def _is_action_plan_candidate(action_card: ActionCard) -> bool:
    return (
        action_card.status in ACTIONABLE_STATUSES
        and ActionKind.IGNORE not in set(action_card.actions)
    )


def _score_action_card(action_card: ActionCard) -> int:
    score = (
        PRIORITY_SCORE[action_card.priority]
        + STATUS_SCORE[action_card.status]
        + RISK_SCORE[action_card.risk_level]
    )

    action_set = set(action_card.actions)
    if ActionKind.DRAFT_REPLY in action_set:
        score += 8
    if ActionKind.PROPOSE_SCHEDULE in action_set:
        score += 8
    if ActionKind.CREATE_TODO in action_set:
        score += 4
    if ActionKind.REQUEST_MISSING_INFO in action_set:
        score += 12
    if action_card.approval_required:
        score += 10
    if action_card.confidence < 0.75:
        score += 8
    if _has_calendar_conflict(action_card):
        score += 20
    if _has_conflicting_evidence(action_card):
        score += 18

    return score


def _estimate_minutes(action_card: ActionCard) -> int:
    action_set = set(action_card.actions)
    minutes = 5

    if ActionKind.DRAFT_REPLY in action_set:
        minutes += 10
    if ActionKind.PROPOSE_SCHEDULE in action_set:
        minutes += 10
    if ActionKind.CREATE_TODO in action_set:
        minutes += 6
    if ActionKind.REQUEST_MISSING_INFO in action_set:
        minutes += 8
    if ActionKind.SAVE_FOR_LATER in action_set:
        minutes += 3
    if ActionKind.IGNORE in action_set:
        minutes += 2
    if action_card.approval_required:
        minutes += 5
    if _has_calendar_conflict(action_card):
        minutes += 8
    if _has_conflicting_evidence(action_card):
        minutes += 8
    if action_card.risk_level == RiskLevel.HIGH:
        minutes += 5

    return min(minutes, 60)


def _effort_from_minutes(minutes: int) -> ActionPlanEffort:
    if minutes <= 12:
        return ActionPlanEffort.LOW
    if minutes <= 28:
        return ActionPlanEffort.MEDIUM
    return ActionPlanEffort.HIGH


def _next_action(action_card: ActionCard) -> str:
    action_set = set(action_card.actions)
    if _has_conflicting_evidence(action_card):
        return "矛盾している根拠を確認する"
    if ActionKind.REQUEST_MISSING_INFO in action_set:
        return "不足情報を確認してから対応案を作り直す"
    if _has_calendar_conflict(action_card):
        return "空いている候補だけに絞って返信案を確認する"
    if {
        ActionKind.DRAFT_REPLY,
        ActionKind.PROPOSE_SCHEDULE,
        ActionKind.CREATE_TODO,
    }.issubset(action_set):
        return "返信案・予定案・準備タスクをまとめて確認する"
    if {ActionKind.DRAFT_REPLY, ActionKind.PROPOSE_SCHEDULE}.issubset(action_set):
        return "返信案と予定案を確認する"
    if ActionKind.DRAFT_REPLY in action_set:
        return "返信案を確認して承認する"
    if ActionKind.CREATE_TODO in action_set:
        return "ToDoを実行できる粒度に分ける"
    if ActionKind.IGNORE in action_set:
        return "対応不要として閉じる"
    return "内容を確認する"


def _reason(action_card: ActionCard) -> str:
    reasons: list[str] = []

    if action_card.priority in {Priority.URGENT, Priority.HIGH}:
        reasons.append("重要度が高い")
    if action_card.status == ActionCardStatus.PENDING_REVIEW:
        reasons.append("承認待ち")
    if _has_calendar_conflict(action_card):
        reasons.append("予定衝突がある")
    if _has_conflicting_evidence(action_card):
        reasons.append("根拠に矛盾がある")
    if action_card.missing_info:
        reasons.append("不足情報がある")
    if action_card.approval_required:
        reasons.append("送信や予定作成に承認が必要な")

    if not reasons:
        return "低リスクだが、未処理のAction Cardです。"

    return "、".join(reasons[:3]) + "ため、先に確認します。"


def _blockers(action_card: ActionCard) -> list[str]:
    blockers = list(action_card.missing_info)
    if _has_calendar_conflict(action_card):
        blockers.append("予定衝突の確認")
    if _has_conflicting_evidence(action_card):
        blockers.append("矛盾した根拠の確認")
    if action_card.approval_required:
        blockers.append("ユーザー承認")
    return blockers


def _has_calendar_conflict(action_card: ActionCard) -> bool:
    return _contains_note(
        action_card,
        ["予定と衝突", "既存予定と衝突", "calendar conflict", "schedule conflict"],
    )


def _has_conflicting_evidence(action_card: ActionCard) -> bool:
    return _contains_note(action_card, ["矛盾", "contradict"])


def _contains_note(action_card: ActionCard, keywords: list[str]) -> bool:
    return any(
        keyword in note.lower()
        for note in action_card.safety_notes
        for keyword in keywords
    )


def _stable_action_card_for_plan(agent_run: AgentRunResult) -> ActionCard:
    template_action_card = next(
        (
            action_card
            for action_card in list_action_cards()
            if action_card.source_item_id == agent_run.inbox_item_id
        ),
        None,
    )
    if template_action_card is None:
        return agent_run.action_card

    return agent_run.action_card.model_copy(update={"id": template_action_card.id})


def _count_generation_modes(agent_runs: list[AgentRunResult]) -> dict[str, int]:
    generation_modes: dict[str, int] = {}
    for agent_run in agent_runs:
        mode = agent_run.generation_mode.value
        generation_modes[mode] = generation_modes.get(mode, 0) + 1
    return generation_modes
