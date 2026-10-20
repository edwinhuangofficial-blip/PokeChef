from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from agent import chat
from review_service import review_team, follow_up_team
from showdown_parser import parse_showdown_team


BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(title="PokéChef API")


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=12000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=12)


class TeamReviewRequest(BaseModel):
    team_text: str = Field(min_length=1, max_length=12000)


class TeamFollowUpRequest(BaseModel):
    team_text: str = Field(min_length=1, max_length=12000)
    question: str = Field(min_length=1, max_length=1000)


def handle_result(result):
    """Turn validation errors into HTTP responses."""

    if "error" in result:
        raise HTTPException(
            status_code=400,
            detail=result["error"]
        )

    return result


@app.post("/api/chat")
def send_message(request: ChatRequest):
    try:
        return {"answer": chat(request.message, [turn.model_dump() for turn in request.history])}
    except Exception as error:
        print("Chat error:", repr(error))
        raise HTTPException(
            status_code=500,
            detail="PokéChef couldn't process your message."
        )


@app.post("/api/team/review")
def review(request: TeamReviewRequest):
    try:
        result = review_team(request.team_text)
        return handle_result(result)

    except HTTPException:
        raise

    except Exception as error:
        print("Review error:", repr(error))
        raise HTTPException(
            status_code=500,
            detail="Team review failed. Check the server terminal."
        )


@app.post("/api/team/preview")
def preview(request: TeamReviewRequest):
    """Parse only: no Pokémon data requests or paid AI calls."""
    return handle_result(parse_showdown_team(request.team_text))


@app.post("/api/team/followup")
def followup(request: TeamFollowUpRequest):
    try:
        result = follow_up_team(
            request.team_text,
            request.question
        )
        return handle_result(result)

    except HTTPException:
        raise

    except Exception as error:
        print("Follow-up error:", repr(error))
        raise HTTPException(
            status_code=500,
            detail="PokéChef couldn't answer the follow-up."
        )


app.mount(
    "/static",
    StaticFiles(directory=BASE_DIR / "static"),
    name="static"
)


@app.get("/")
def home():
    return FileResponse(BASE_DIR / "index.html")
