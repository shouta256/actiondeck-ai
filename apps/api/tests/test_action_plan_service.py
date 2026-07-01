from fastapi.testclient import TestClient

from main import app
from app.schemas import ActionCardStatus, ActionPlanEffort
from app.services.action_card_store import list_action_cards
from app.services.action_plan_service import build_action_plan
from app.settings import get_settings


def test_action_plan_prioritizes_reviewable_conflicts():
    plan = build_action_plan(list_action_cards(), limit=5)

    assert plan.items
    assert plan.items[0].action_card_id == "action_006"
    assert plan.items[0].estimated_minutes > 0
    assert plan.items[0].effort == ActionPlanEffort.HIGH
    assert "空いている候補" in plan.items[0].next_action
    assert "予定衝突" in plan.items[0].reason


def test_action_plan_excludes_finished_cards():
    plan = build_action_plan(list_action_cards(), limit=20)

    assert all(
        item.status
        not in {
            ActionCardStatus.APPROVED,
            ActionCardStatus.REJECTED,
            ActionCardStatus.COMPLETED,
        }
        for item in plan.items
    )


def test_action_plan_quick_wins_are_sorted_by_cost():
    plan = build_action_plan(list_action_cards(), limit=5)
    quick_win_minutes = [item.estimated_minutes for item in plan.quick_wins]

    assert quick_win_minutes == sorted(quick_win_minutes)
    assert {item.action_card_id for item in plan.quick_wins}.issubset(
        {item.action_card_id for item in plan.items}
    )


def test_action_plan_api_returns_ranked_items():
    client = TestClient(app)
    response = client.get("/action-plan?limit=3")

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 3
    assert data["items"][0]["action_card_id"] == "action_006"
    assert data["items"][0]["estimated_minutes"] > 0


def test_action_plan_run_api_returns_ranked_items(monkeypatch):
    import app.services.agent_run_service as agent_run_service

    settings = get_settings().model_copy(update={"gemini_api_key": None})
    monkeypatch.setattr(agent_run_service, "get_settings", lambda: settings)

    client = TestClient(app)
    response = client.post("/action-plan/runs?limit=3")

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 3
    assert data["items"][0]["action_card_id"] == "action_006"
    assert data["processed_inbox_count"] == 11
    assert data["action_card_count"] == 9
    assert data["generation_modes"] == {"deterministic_template": 11}
