from fastapi import APIRouter, HTTPException

from app.schemas import AgentRunRequest, AgentRunResult
from app.services.agent_run_service import run_agent_for_inbox_item
from app.services.agent_run_store import get_agent_run, list_agent_runs, save_agent_run
from app.services.inbox_item_store import get_inbox_item

router = APIRouter(prefix="/agent-runs", tags=["agent-runs"])


@router.get("", response_model=list[AgentRunResult])
async def read_agent_runs(
    inbox_item_id: str | None = None,
) -> tuple[AgentRunResult, ...]:
    return await list_agent_runs(inbox_item_id=inbox_item_id)


@router.post("", response_model=AgentRunResult)
async def create_agent_run(payload: AgentRunRequest) -> AgentRunResult:
    inbox_item = get_inbox_item(payload.inbox_item_id)
    if inbox_item is None:
        raise HTTPException(status_code=404, detail="Inbox item not found")

    result = run_agent_for_inbox_item(inbox_item)
    if result is None:
        raise HTTPException(status_code=422, detail="No action card template found")
    return await save_agent_run(result)


@router.get("/{run_id}", response_model=AgentRunResult)
async def read_agent_run(run_id: str) -> AgentRunResult:
    agent_run = await get_agent_run(run_id)
    if agent_run is None:
        raise HTTPException(status_code=404, detail="Agent run not found")
    return agent_run
