from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from .config import BASE_DIR

router = APIRouter()
templates = Jinja2Templates(directory=BASE_DIR / "templates")

NAV = [
    {"id": "dashboard", "href": "/", "label": "Главная", "icon": "home"},
    {"id": "decks", "href": "/decks", "label": "Коллоды", "icon": "layers"},
    {"id": "study", "href": "/study", "label": "Учиться", "icon": "cards"},
    {"id": "calendar", "href": "/calendar", "label": "Календарь", "icon": "calendar"},
    {"id": "analytics", "href": "/analytics", "label": "Аналитика", "icon": "chart"},
]


def _ctx(request: Request, active: str, **extra):
    return {"request": request, "nav": NAV, "active": active, **extra}


@router.get("/", response_class=HTMLResponse)
async def page_dashboard(request: Request):
    return templates.TemplateResponse(request, "dashboard.html", _ctx(request, "dashboard"))


@router.get("/decks", response_class=HTMLResponse)
async def page_decks(request: Request):
    return templates.TemplateResponse(request, "decks.html", _ctx(request, "decks"))


@router.get("/decks/{deck_id}", response_class=HTMLResponse)
async def page_deck(request: Request, deck_id: int):
    return templates.TemplateResponse(
        request, "deck_detail.html", _ctx(request, "decks", deck_id=deck_id)
    )


@router.get("/study", response_class=HTMLResponse)
async def page_study(request: Request):
    return templates.TemplateResponse(request, "study.html", _ctx(request, "study"))


@router.get("/calendar", response_class=HTMLResponse)
async def page_calendar(request: Request):
    return templates.TemplateResponse(request, "calendar.html", _ctx(request, "calendar"))


@router.get("/analytics", response_class=HTMLResponse)
async def page_analytics(request: Request):
    return templates.TemplateResponse(request, "analytics.html", _ctx(request, "analytics"))


@router.get("/settings", response_class=HTMLResponse)
async def page_settings(request: Request):
    return templates.TemplateResponse(request, "settings.html", _ctx(request, "settings"))
