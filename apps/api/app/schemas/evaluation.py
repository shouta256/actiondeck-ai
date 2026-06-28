from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.action_card import ActionKind, Priority
from app.schemas.agent_run import AgentRunGenerationMode
from app.schemas.agent_route import AgentRoute
from app.schemas.agent_trace import AgentStepName


class ActionCardEvalMode(StrEnum):
    DETERMINISTIC = "deterministic"
    GEMINI = "gemini"
    GRAPH = "graph"


class ActionCardEvalCase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    input_item_id: str = Field(min_length=1)
    expected_actions: list[ActionKind] = Field(min_length=1)
    expected_priority: Priority
    expected_approval_required: bool | None = None
    expected_missing_info: list[str] = Field(default_factory=list)
    required_evidence_ids: list[str] = Field(default_factory=list)
    expected_generation_mode: AgentRunGenerationMode | None = None
    expected_route: AgentRoute | None = None
    expected_step_names: list[AgentStepName] = Field(default_factory=list)
    expected_unsafe_action_count: int = Field(default=0, ge=0)

    @model_validator(mode="after")
    def validate_expected_actions(self) -> "ActionCardEvalCase":
        if len(set(self.expected_actions)) != len(self.expected_actions):
            raise ValueError("expected_actions must not contain duplicates")
        return self


class ActionCardEvalCaseResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    input_item_id: str = Field(min_length=1)
    actual_action_card_id: str | None = None
    actions_match: bool
    priority_match: bool
    approval_required_match: bool
    missing_info_match: bool
    generation_mode_match: bool
    route_match: bool
    step_path_match: bool
    unsafe_action_count_match: bool
    required_evidence_covered: bool
    retrieval_evaluated: bool
    retrieval_evidence_covered: bool
    schema_valid: bool
    agent_steps_completed: bool
    expected_actions: list[ActionKind]
    actual_actions: list[ActionKind]
    expected_priority: Priority
    actual_priority: Priority | None = None
    expected_approval_required: bool | None = None
    actual_approval_required: bool | None = None
    expected_missing_info: list[str]
    actual_missing_info: list[str]
    required_evidence_ids: list[str]
    actual_evidence_ids: list[str]
    missing_evidence_ids: list[str]
    actual_retrieved_evidence_ids: list[str]
    missing_retrieved_evidence_ids: list[str]
    expected_generation_mode: AgentRunGenerationMode | None = None
    generation_mode: AgentRunGenerationMode | None = None
    fallback_reason: str | None = None
    expected_route: AgentRoute | None = None
    actual_route: AgentRoute | None = None
    expected_step_names: list[AgentStepName]
    actual_step_names: list[AgentStepName]
    expected_unsafe_action_count: int = Field(ge=0)
    actual_unsafe_action_count: int = Field(ge=0)
    failure_reasons: list[str]
    passed: bool


class ActionCardEvalRunResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mode: ActionCardEvalMode
    llm_configured: bool
    gemini_assisted_cases: int = Field(ge=0)
    deterministic_template_cases: int = Field(ge=0)
    total_cases: int = Field(ge=0)
    passed_cases: int = Field(ge=0)
    action_match_rate: float = Field(ge=0, le=1)
    priority_match_rate: float = Field(ge=0, le=1)
    approval_match_rate: float = Field(ge=0, le=1)
    missing_info_match_rate: float = Field(ge=0, le=1)
    generation_mode_match_rate: float = Field(ge=0, le=1)
    route_match_rate: float = Field(ge=0, le=1)
    step_path_match_rate: float = Field(ge=0, le=1)
    unsafe_action_match_rate: float = Field(ge=0, le=1)
    schema_valid_rate: float = Field(ge=0, le=1)
    evidence_recall: float = Field(ge=0, le=1)
    retrieval_recall: float = Field(ge=0, le=1)
    cases: list[ActionCardEvalCaseResult]
