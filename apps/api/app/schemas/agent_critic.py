from pydantic import BaseModel, ConfigDict, Field


class AgentCriticReport(BaseModel):
    model_config = ConfigDict(extra="forbid")

    grounded: bool
    issues: list[str] = Field(default_factory=list)
    checked_items: list[str] = Field(default_factory=list)
