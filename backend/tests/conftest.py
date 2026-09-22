"""Deterministic test database setup."""
import pytest
from sqlalchemy import delete
from backend.app.db import engine, Base, SessionLocal
from backend.app import models  # noqa: F401

@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db=SessionLocal()
    try:
        for table in reversed(Base.metadata.sorted_tables):
            db.execute(delete(table))
        db.commit()
    finally:
        db.close()
    yield
