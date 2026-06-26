from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AgentStepName(StrEnum):
    TRIAGE = "triage"
    EVIDENCE_RETRIEVAL = "evidence_retrieval"
    ACTION_PLANNING = "action_planning"
    SAFETY_CHECK = "safety_check"


class AgentStepStatus(StrEnum):
    COMPLETED = "completed"
    SKIPPED = "skipped"
    FAILED = "failed"


class AgentToolCall(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1)
    input_summary: str = Field(min_length=1)
    output_summary: str = Field(min_length=1)


class AgentTokenUsage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    input_tokens: int = Field(ge=0)
    output_tokens: int = Field(ge=0)
    total_tokens: int = Field(ge=0)

    @model_validator(mode="after")
    def validate_total_tokens(self) -> "AgentTokenUsage":
        if self.total_tokens != self.input_tokens + self.output_tokens:
            raise ValueError("total_tokens must equal input_tokens + output_tokens")
        return self


class AgentTraceStep(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action_card_id: str = Field(min_length=1)
    sequence: int = Field(ge=1)
    step_name: AgentStepName
    status: AgentStepStatus
    input_summary: str = Field(min_length=1)
    output_summary: str = Field(min_length=1)
    tool_calls: list[AgentToolCall] = Field(default_factory=list)
    latency_ms: int = Field(ge=0)
    token_usage: AgentTokenUsage | None = None
