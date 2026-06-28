from app.services.calendar_availability import (
    check_calendar_availability,
    describe_calendar_availability,
)


def test_calendar_availability_detects_conflict_and_free_slot():
    result = check_calendar_availability(
        "\n".join(
            (
                "以下の候補で再調整させてください。",
                "- 2026年7月5日 10:00-10:30",
                "- 2026年7月5日 11:00-11:30",
            )
        )
    )

    assert len(result.candidates) == 2
    assert result.candidates[0].conflicting_events[0].id == "cal_001"
    assert result.candidates[1].is_available
    assert "アルバイト" in "\n".join(describe_calendar_availability(result))
