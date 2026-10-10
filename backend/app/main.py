from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import actions, backtest, chargers, meta, reports, stations, whatif
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.services import data_loader

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ML files are read once and kept in memory; mock mode needs no files.
    if not settings.mock:
        app.state.data = data_loader.load_all(settings.data_dir)
    yield


app = FastAPI(title="AmpWise API", version="0.5", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)
register_error_handlers(app)

for module in (meta, stations, chargers, actions, whatif, backtest, reports):
    app.include_router(module.router, prefix="/api")
