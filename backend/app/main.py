import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import actions, backtest, chargers, demo, meta, overview, reports, scenarios, stations, whatif
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.firebase.client import initialize_firestore, read_done_action_ids
from app.services import data_loader

settings = get_settings()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.firestore = initialize_firestore(settings.firebase_credentials)
    # ML files are read once and kept in memory; mock mode needs no files.
    if not settings.mock:
        app.state.data = data_loader.load_all(settings.data_dir)
        if app.state.firestore is not None:
            # Chargers whose action was marked done before this start count as working again.
            try:
                done = read_done_action_ids(app.state.firestore)
            except Exception:  # the API must still start when Firestore cannot be reached
                logger.exception("Could not read the saved action states; no charger counts as repaired")
                done = []
            app.state.data.repaired = {c for c in map(actions.charger_of, done) if c}
    yield


app = FastAPI(title="AmpWise API", version="1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)
register_error_handlers(app)

for module in (meta, stations, chargers, actions, whatif, backtest, reports, overview, demo, scenarios):
    app.include_router(module.router, prefix="/api")
