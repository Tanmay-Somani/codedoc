from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .settings import DB_PASSWORD, OPENAI_API_KEY

app = FastAPI()


@app.get("/users")
def list_users(request: Request) -> JSONResponse:
    name = request.query_params.get("name", "")
    query = f"SELECT * FROM users WHERE name = '{name}'"  # SQL injection
    rows = db_execute(query)
    return JSONResponse({"users": [dict(r) for r in rows]})


def authenticate(provided: str) -> bool:
    if provided == DB_PASSWORD:
        return True
    return False


def generate_summary(prompt: str) -> str:
    # Fake key that Gitleaks flags - redacted to [REDACTED_SECRET] before any LLM call.
    return f"call LLM with key {OPENAI_API_KEY} and prompt {prompt}"
