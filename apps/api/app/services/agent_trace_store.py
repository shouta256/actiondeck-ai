import json
from functools import lru_cache
from pathlib import Path

from app.schemas import AgentTraceStep


SEED_AGENT_STEPS_PATH = (
    Path(__file__).resolve().parents[4] / "data" / "seed" / "agent_steps.json"
)


@lru_cache(maxsize=1)
def list_agent_steps() -> tuple[AgentTraceStep, ...]:
    raw_steps = json.loads(SEED_AGENT_STEPS_PATH.read_text(encoding="utf-8"))
    return tuple(AgentTraceStep.model_validate(raw_step) for raw_step in raw_steps)


def list_agent_steps_for_card(action_card_id: str) -> tuple[AgentTraceStep, ...]:
    return tuple(
        sorted(
            (
                step
                for step in list_agent_steps()
                if step.action_card_id == action_card_id
            ),
            key=lambda step: step.sequence,
        )
    )
