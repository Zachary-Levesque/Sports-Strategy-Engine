from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class ORMBaseModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class MessageResponse(BaseModel):
    detail: str


class HealthResponse(BaseModel):
    status: str
    database: str
    version: str
