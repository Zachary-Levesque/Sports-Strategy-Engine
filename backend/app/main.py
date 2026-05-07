from __future__ import annotations

from contextlib import asynccontextmanager
import time

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.api.routes import api_router
from backend.app.core.config import get_settings
from backend.app.core.exceptions import AppError, NotFoundError, SimulationError
from backend.app.core.logging import configure_logging, get_logger, log_event
from backend.app.database.database import SessionLocal, init_database
from backend.app.schemas.common import MessageResponse
from backend.app.services.seed_service import seed_database_if_empty


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger = configure_logging(settings.log_level)
    init_database()
    with SessionLocal() as db:
        seed_database_if_empty(db)
    logger.info(log_event("startup_complete", app_name=settings.app_name, database_url=settings.database_url))
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, version=settings.app_version, debug=settings.debug, lifespan=lifespan)
    app.include_router(api_router)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_timing_middleware(request: Request, call_next):
        logger = get_logger()
        started = time.perf_counter()
        response: Response | None = None
        try:
            response = await call_next(request)
            return response
        finally:
            duration_ms = (time.perf_counter() - started) * 1000
            status_code = response.status_code if response is not None else 500
            logger.info(
                log_event(
                    "request_complete",
                    method=request.method,
                    path=request.url.path,
                    status_code=status_code,
                    duration_ms=round(duration_ms, 2),
                )
            )
            if response is not None:
                response.headers["X-Process-Time-Ms"] = f"{duration_ms:.2f}"

    @app.exception_handler(NotFoundError)
    async def not_found_handler(_: Request, exc: NotFoundError):
        get_logger().warning(log_event("not_found", detail=str(exc)))
        return JSONResponse(status_code=404, content=MessageResponse(detail=str(exc)).model_dump())

    @app.exception_handler(SimulationError)
    async def simulation_error_handler(_: Request, exc: SimulationError):
        get_logger().error(log_event("simulation_error", detail=str(exc)))
        return JSONResponse(status_code=500, content=MessageResponse(detail=str(exc)).model_dump())

    @app.exception_handler(AppError)
    async def app_error_handler(_: Request, exc: AppError):
        get_logger().error(log_event("app_error", detail=str(exc)))
        return JSONResponse(status_code=400, content=MessageResponse(detail=str(exc)).model_dump())

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(_: Request, exc: RequestValidationError):
        get_logger().warning(log_event("validation_error", errors=exc.errors()))
        return JSONResponse(
            status_code=422,
            content=MessageResponse(detail="Request validation failed.").model_dump(),
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(_: Request, exc: HTTPException):
        detail = exc.detail if isinstance(exc.detail, str) else "HTTP error"
        get_logger().warning(log_event("http_error", status_code=exc.status_code, detail=detail))
        return JSONResponse(status_code=exc.status_code, content=MessageResponse(detail=detail).model_dump())

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(_: Request, exc: Exception):
        get_logger().exception(log_event("unhandled_exception", detail=str(exc)))
        return JSONResponse(status_code=500, content=MessageResponse(detail="Internal server error.").model_dump())

    return app


app = create_app()
