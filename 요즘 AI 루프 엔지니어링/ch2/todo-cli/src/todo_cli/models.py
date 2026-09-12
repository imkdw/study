"""도메인 모델. 순수 데이터만 다루고 I/O 는 하지 않는다."""

from __future__ import annotations

from dataclasses import dataclass, replace
from enum import Enum
from typing import Any, Self


class Status(str, Enum):
    TODO = "todo"
    DOING = "doing"
    DONE = "done"


@dataclass(frozen=True, slots=True)
class Todo:
    id: int
    title: str
    status: Status
    created_at: str

    def with_status(self, status: Status) -> Self:
        return replace(self, status=status)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "status": self.status.value,
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Self:
        return cls(
            id=int(data["id"]),
            title=str(data["title"]),
            status=Status(data["status"]),
            created_at=str(data["created_at"]),
        )
