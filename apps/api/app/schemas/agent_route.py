from enum import StrEnum


class AgentRoute(StrEnum):
    CONFLICTING_EVIDENCE = "conflicting_evidence"
    IGNORE = "ignore"
    LOW_RISK_TODO = "low_risk_todo"
    MISSING_INFO = "missing_info"
    REVIEW_REQUIRED = "review_required"
