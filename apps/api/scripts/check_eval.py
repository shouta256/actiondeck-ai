from app.schemas import ActionCardEvalMode
from app.services.evaluation_service import run_action_card_eval


def main() -> None:
    for mode in (ActionCardEvalMode.DETERMINISTIC, ActionCardEvalMode.GRAPH):
        result = run_action_card_eval(mode)
        print(
            mode.value,
            f"{result.passed_cases}/{result.total_cases}",
            "retrieval",
            result.retrieval_recall,
            "safety",
            result.safety_note_keywords_match_rate,
        )
        if result.passed_cases != result.total_cases:
            failed_cases = [
                case.id
                for case in result.cases
                if not case.passed
            ]
            raise RuntimeError(
                f"{mode.value} eval failed: {', '.join(failed_cases)}"
            )


if __name__ == "__main__":
    main()
