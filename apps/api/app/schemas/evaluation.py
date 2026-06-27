from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.action_card import ActionKind, Priority


class ActionCardEvalCase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    input_item_id: str = Field(min_length=1)
    expected_actions: list[ActionKind] = Field(min_length=1)
    expected_priority: Priority
    required_evidence_ids: list[str] = Field(default_factory=list)

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
    required_evidence_covered: bool
    expected_actions: list[ActionKind]
    actual_actions: list[ActionKind]
    expected_priority: Priority
    actual_priority: Priority | None = None
    required_evidence_ids: list[str]
    actual_evidence_ids: list[str]
    missing_evidence_ids: list[str]
    passed: bool


class ActionCardEvalRunResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    total_cases: int = Field(ge=0)
    passed_cases: int = Field(ge=0)
    action_match_rate: float = Field(ge=0, le=1)
    priority_match_rate: float = Field(ge=0, le=1)
    evidence_recall: float = Field(ge=0, le=1)
    cases: list[ActionCardEvalCaseResult]
