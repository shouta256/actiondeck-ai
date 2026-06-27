from fastapi import APIRouter

from app.schemas import ActionCardEvalMode, ActionCardEvalRunResult
from app.services.evaluation_service import run_action_card_eval

router = APIRouter(prefix="/eval", tags=["eval"])


@router.get("/action-cards", response_model=ActionCardEvalRunResult)
def read_action_card_eval(
    mode: ActionCardEvalMode = ActionCardEvalMode.DETERMINISTIC,
) -> ActionCardEvalRunResult:
    return run_action_card_eval(mode=mode)
