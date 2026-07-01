from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.action_cards import router as action_cards_router
from app.routes.action_plan import router as action_plan_router
from app.routes.agent_runs import router as agent_runs_router
from app.routes.calendar_events import router as calendar_events_router
from app.routes.evaluations import router as evaluations_router
from app.routes.inbox_items import router as inbox_items_router
from app.routes.integrations import router as integrations_router

app = FastAPI(
    title="ActionDeck AI API",
    description="Action Card、Evidence、Agent Traceを扱うAPI",
    version="0.1.0",
)

app.include_router(action_cards_router)
app.include_router(action_plan_router)
app.include_router(agent_runs_router)
app.include_router(calendar_events_router)
app.include_router(evaluations_router)
app.include_router(inbox_items_router)
app.include_router(integrations_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root() -> dict[str, str]:
    return {
        "service": "ActionDeck AI API",
        "status": "ok",
    }


@app.get("/health")
def read_health() -> dict[str, str]:
    return {"status": "ok"}
