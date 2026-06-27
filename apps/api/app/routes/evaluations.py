from fastapi import APIRouter

from app.schemas import ActionCardEvalRunResult
from app.services.evaluation_service import run_action_card_eval

router = APIRouter(prefix="/eval", tags=["eval"])


@router.get("/action-cards", response_model=ActionCardEvalRunResult)
def read_action_card_eval() -> ActionCardEvalRunResult:
    return run_action_card_eval()
