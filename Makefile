PYTHON ?= python3

.PHONY: backend frontend test build-frontend reset-db prototype

backend:
	uvicorn backend.app.main:app --reload

frontend:
	cd frontend && npm run dev

test:
	pytest

build-frontend:
	cd frontend && npm run build

prototype:
	$(PYTHON) python/prototype.py

reset-db:
	rm -f data/sports_strategy_engine.db
