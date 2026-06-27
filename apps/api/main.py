from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.action_cards import router as action_cards_router
from app.routes.inbox_items import router as inbox_items_router

app = FastAPI(
    title="ActionDeck AI API",
    description="Action Card、Evidence、Agent Traceを扱うAPI",
    version="0.1.0",
)

app.include_router(action_cards_router)
app.include_router(inbox_items_router)

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
