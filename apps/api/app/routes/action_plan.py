from fastapi import APIRouter, Query

from app.schemas import ActionPlan
from app.services.action_card_store import list_action_cards
from app.services.action_plan_service import build_action_plan, run_action_plan_agent

router = APIRouter(prefix="/action-plan", tags=["action-plan"])


@router.get("", response_model=ActionPlan)
def read_action_plan(
    limit: int = Query(default=5, ge=1, le=20),
) -> ActionPlan:
    return build_action_plan(list_action_cards(), limit=limit)


@router.post("/runs", response_model=ActionPlan)
async def run_action_plan(
    limit: int = Query(default=5, ge=1, le=20),
) -> ActionPlan:
    return await run_action_plan_agent(limit=limit)
