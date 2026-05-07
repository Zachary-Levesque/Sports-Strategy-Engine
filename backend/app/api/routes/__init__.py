from __future__ import annotations

from fastapi import APIRouter

from backend.app.api.routes.health import router as health_router
from backend.app.api.routes.holes import router as holes_router
from backend.app.api.routes.players import router as players_router
from backend.app.api.routes.recommendations import router as recommendations_router
from backend.app.api.routes.scenarios import router as scenarios_router


api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(players_router)
api_router.include_router(holes_router)
api_router.include_router(recommendations_router)
api_router.include_router(scenarios_router)
