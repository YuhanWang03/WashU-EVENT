FROM python:3.12-slim

# Bring in the uv binary from the official image.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

# Install dependencies first (cached unless the lockfile changes).
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Copy the application source (incl. seed data under app/data).
COPY app ./app

EXPOSE 8080

CMD ["uv", "run", "--frozen", "--no-dev", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
