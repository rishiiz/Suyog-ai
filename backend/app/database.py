from sqlmodel import SQLModel, create_engine, Session
from app.config import settings

connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args=connect_args
)

def init_db():
    # Import all models to register with SQLModel metadata
    import app.models  # noqa
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
