from fastapi import APIRouter, HTTPException

from app.schemas import AgentRunRequest, AgentRunResult
from app.services.agent_run_service import run_agent_for_inbox_item
from app.services.inbox_item_store import get_inbox_item

router = APIRouter(prefix="/agent-runs", tags=["agent-runs"])


@router.post("", response_model=AgentRunResult)
def create_agent_run(payload: AgentRunRequest) -> AgentRunResult:
    inbox_item = get_inbox_item(payload.inbox_item_id)
    if inbox_item is None:
        raise HTTPException(status_code=404, detail="Inbox item not found")

    result = run_agent_for_inbox_item(inbox_item)
    if result is None:
        raise HTTPException(status_code=422, detail="No action card template found")
    return result
