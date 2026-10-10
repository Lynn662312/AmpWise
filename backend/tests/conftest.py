import os

os.environ["MOCK"] = "1"

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_data
from app.main import app
from app.services import data_loader
from app.services.data_loader import DataStore
from scripts.make_dummy_data import write_dummy_data


@pytest.fixture
def client() -> TestClient:
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture(scope="session")
def data(tmp_path_factory: pytest.TempPathFactory) -> DataStore:
    """The dummy ML files, loaded the same way the app loads them."""
    data_dir = str(tmp_path_factory.mktemp("data"))
    write_dummy_data(data_dir)
    return data_loader.load_all(data_dir)


@pytest.fixture
def real_client(data: DataStore) -> Iterator[TestClient]:
    """A client that behaves like MOCK=0, served from the dummy files."""
    app.dependency_overrides[get_data] = lambda: data
    yield TestClient(app, raise_server_exceptions=False)
    app.dependency_overrides.clear()
