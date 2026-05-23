"""Port of lib/taskCategory.ts (category mapping only).

Maps Google Calendar colorId values to task categories. UI styling from the
TS module is intentionally not ported — the backend only needs the category.
"""

from typing import Literal

TaskCategory = Literal["red", "green", "blue", "unknown"]

_COLOR_ID_MAP: dict[str, TaskCategory] = {
    "11": "red",
    "10": "red",
    "6": "red",
    "4": "red",
    "2": "green",
    "9": "green",
    "1": "blue",
    "7": "blue",
    "8": "blue",
}


def get_task_category(color_id: str | None) -> TaskCategory:
    if not color_id:
        return "unknown"
    return _COLOR_ID_MAP.get(color_id, "unknown")
