from app.services.evidence_store import list_evidence_items
from app.services.evidence_vector_store import seed_evidence_vectors


def main() -> None:
    seeded_count = seed_evidence_vectors(list_evidence_items())
    print(f"seeded evidence_items: {seeded_count}")


if __name__ == "__main__":
    main()
