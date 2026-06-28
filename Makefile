SHELL := /bin/bash

.PHONY: setup up api web db-up db-down db-reset db-check db-seed check api-check web-lint web-build compose-check

setup:
	npm --prefix apps/web install
	cd apps/api && uv sync
	$(MAKE) db-up
	$(MAKE) db-check
	$(MAKE) db-seed

up:
	@echo "Starting API and web. Stop with Ctrl+C."
	@trap 'kill 0' INT TERM EXIT; \
	npm run dev:api & \
	npm run dev:web & \
	wait

api:
	npm run dev:api

web:
	npm run dev:web

db-up:
	docker compose -f infra/docker-compose.yml up -d

db-down:
	docker compose -f infra/docker-compose.yml down

db-reset:
	docker compose -f infra/docker-compose.yml down -v
	docker compose -f infra/docker-compose.yml up -d
	$(MAKE) db-check
	$(MAKE) db-seed

db-check:
	cd apps/api && PYTHONPATH=. uv run python scripts/check_db.py

db-seed:
	cd apps/api && PYTHONPATH=. uv run python scripts/seed_evidence_vectors.py
	cd apps/api && PYTHONPATH=. uv run python scripts/seed_calendar_events.py

check: web-lint web-build api-check compose-check

web-lint:
	npm --prefix apps/web run lint

web-build:
	npm --prefix apps/web run build

api-check:
	cd apps/api && GEMINI_API_KEY= PYTHONPATH=. uv run python scripts/check_app_smoke.py
	cd apps/api && GEMINI_API_KEY= PYTHONPATH=. uv run python scripts/check_eval.py
	cd apps/api && GEMINI_API_KEY= uv run pytest

compose-check:
	docker compose -f infra/docker-compose.yml config >/dev/null
	@echo ok
