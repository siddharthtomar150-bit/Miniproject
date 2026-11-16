import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Compute absolute path to students.db inside the backend directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_PATH = os.path.join(BASE_DIR, "students.db")
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

# create_engine: Establishes connection with SQLite
# check_same_thread=False: Needed in SQLite for FastAPI to allow requests across multiple threads
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}
)

# SessionLocal: Database session factory for queries and commits
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base: Declarative base class for all SQLAlchemy ORM models
Base = declarative_base()


def get_db():
    """
    Dependency generator for FastAPI routes.
    Yields a database session per request and guarantees its closure upon completion.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
