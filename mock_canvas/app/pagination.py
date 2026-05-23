"""Canvas-style page/per_page pagination with a Link header.

Canvas paginates with ?page= & ?per_page= and advertises navigation via an
RFC 5988 Link header (rel="current"/"next"/"prev"/"first"/"last").
"""

from collections.abc import Sequence
from math import ceil

from starlette.requests import Request

DEFAULT_PER_PAGE = 10
MAX_PER_PAGE = 100


def _int_param(request: Request, name: str, default: int) -> int:
    raw = request.query_params.get(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _page_url(request: Request, page: int, per_page: int) -> str:
    return str(request.url.include_query_params(page=page, per_page=per_page))


def build_link_header(
    request: Request, page: int, per_page: int, last_page: int
) -> str:
    parts = [f'<{_page_url(request, page, per_page)}>; rel="current"']
    if page < last_page:
        parts.append(f'<{_page_url(request, page + 1, per_page)}>; rel="next"')
    if page > 1:
        parts.append(f'<{_page_url(request, page - 1, per_page)}>; rel="prev"')
    parts.append(f'<{_page_url(request, 1, per_page)}>; rel="first"')
    parts.append(f'<{_page_url(request, last_page, per_page)}>; rel="last"')
    return ", ".join(parts)


def paginate[T](items: Sequence[T], request: Request) -> tuple[list[T], str]:
    """Return the requested page of ``items`` plus the Link header value."""
    page = max(1, _int_param(request, "page", 1))
    per_page = min(
        MAX_PER_PAGE, max(1, _int_param(request, "per_page", DEFAULT_PER_PAGE))
    )
    last_page = max(1, ceil(len(items) / per_page))
    start = (page - 1) * per_page
    page_items = list(items[start : start + per_page])
    return page_items, build_link_header(request, page, per_page, last_page)
