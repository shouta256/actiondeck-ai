import json

from google import genai
from google.genai import types
from pydantic import ValidationError

from app.schemas import ActionCard, EvidenceItem, InboxItem
from app.settings import Settings


class GeminiActionCardResult:
    def __init__(
        self,
        action_card: ActionCard | None,
        fallback_reason: str | None = None,
    ) -> None:
        self.action_card = action_card
        self.fallback_reason = fallback_reason


def generate_action_card_with_gemini(
    inbox_item: InboxItem,
    evidence_items: tuple[EvidenceItem, ...],
    settings: Settings,
) -> GeminiActionCardResult:
    if not settings.gemini_api_key:
        return GeminiActionCardResult(
            action_card=None,
            fallback_reason="GEMINI_API_KEY is not configured",
        )

    client = genai.Client(api_key=settings.gemini_api_key)
    try:
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=_build_prompt(inbox_item, evidence_items),
            config=types.GenerateContentConfig(
                temperature=0.1,
                response_mime_type="application/json",
                response_json_schema=ActionCard.model_json_schema(),
                max_output_tokens=1600,
            ),
        )
    except Exception as error:
        return GeminiActionCardResult(
            action_card=None,
            fallback_reason=f"Gemini request failed: {type(error).__name__}",
        )

    try:
        raw_action_card = json.loads(response.text or "{}")
        action_card = ActionCard.model_validate(raw_action_card)
    except (json.JSONDecodeError, ValidationError) as error:
        return GeminiActionCardResult(
            action_card=None,
            fallback_reason=f"Gemini output validation failed: {type(error).__name__}",
        )

    if action_card.source_item_id != inbox_item.id:
        return GeminiActionCardResult(
            action_card=None,
            fallback_reason="Gemini output source_item_id mismatch",
        )

    allowed_evidence_ids = {item.id for item in evidence_items}
    if any(evidence_id not in allowed_evidence_ids for evidence_id in action_card.evidence_ids):
        return GeminiActionCardResult(
            action_card=None,
            fallback_reason="Gemini output used unknown evidence_ids",
        )

    return GeminiActionCardResult(action_card=action_card)


def _build_prompt(
    inbox_item: InboxItem,
    evidence_items: tuple[EvidenceItem, ...],
) -> str:
    evidence_payload = [
        {
            "id": item.id,
            "title": item.title,
            "snippet": item.snippet,
            "used_for": item.used_for,
        }
        for item in evidence_items
    ]
    return json.dumps(
        {
            "instruction": (
                "Convert the inbox message into one Action Card. "
                "Return JSON only. Do not execute external actions. "
                "Actions must be atomic. Use evidence_ids only from the given evidence list. "
                "If sending a reply or creating a calendar event, approval_required must be true. "
                "If proposal.reply_draft is not null, actions must include draft_reply. "
                "If proposal.calendar_event is not null, actions must include propose_schedule. "
                "If proposal.todos is not empty, actions must include create_todo."
            ),
            "action_card_contract": {
                "schema_version": "1.0",
                "id": f"generated_{inbox_item.id}",
                "source_item_id": inbox_item.id,
                "actions_allowed": [
                    "draft_reply",
                    "propose_schedule",
                    "create_todo",
                    "save_for_later",
                    "ignore",
                    "request_missing_info",
                ],
                "status_allowed": [
                    "draft",
                    "pending_review",
                    "approved",
                    "edited",
                    "rejected",
                    "completed",
                ],
                "required_top_level_fields": [
                    "schema_version",
                    "id",
                    "source_item_id",
                    "title",
                    "actions",
                    "priority",
                    "risk_level",
                    "confidence",
                    "approval_required",
                    "status",
                    "summary",
                    "proposal",
                    "evidence_ids",
                    "missing_info",
                    "safety_notes",
                ],
                "proposal_shape": {
                    "reply_draft": "string or null",
                    "calendar_event": {
                        "title": "string",
                        "start": "ISO datetime string",
                        "end": "ISO datetime string",
                        "location": "string or null",
                    },
                    "todos": [
                        {
                            "title": "string",
                            "due_date": "YYYY-MM-DD string or null",
                        }
                    ],
                },
                "array_fields": [
                    "actions",
                    "evidence_ids",
                    "missing_info",
                    "safety_notes",
                    "proposal.todos",
                ],
            },
            "inbox_item": inbox_item.model_dump(mode="json"),
            "evidence_items": evidence_payload,
        },
        ensure_ascii=False,
    )
