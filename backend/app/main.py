from fastapi import FastAPI

app = FastAPI(title="Cadence backend")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
