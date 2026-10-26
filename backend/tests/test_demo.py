"""La demo publica (DEMO_VIEW_KEY): arma la bodega de ejemplo con su historia,
sus remisiones y facturas, el enlace "solo ver" y su cuenta; se puede volver a
armar sin chocar con lo de antes, y nunca toca una base que no sea SQLite. En
una base aparte, porque empieza borrando todo."""
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_bodega.db")
os.environ.setdefault("ADMIN_EMAIL", "admin@test.com")
os.environ.setdefault("ADMIN_PASSWORD", "admin1234")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models
from app.core import demo
from app.core.config import settings
from app.core.database import Base
from app.core.seed import seed


def _session():
    engine = create_engine("sqlite:///./test_demo.db", connect_args={"check_same_thread": False})
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = sessionmaker(bind=engine)()
    seed(db)
    return db


def test_demo_builds_the_sample_warehouse_twice():
    db = _session()
    try:
        for _ in range(2):  # cada arranque la vuelve a armar
            demo.build(db, "demo")
            assert db.query(models.Product).count() == 37
            assert db.query(models.Product).filter(models.Product.name.like("%Pigmalion%")).count() == 0
            kinds = {k for (k,) in db.query(models.Document.kind)}
            assert kinds == {"remision", "factura"}
            # cada talla termina con lo que dice su ficha
            for p in db.query(models.Product):
                last = db.query(models.Movement).filter_by(sku=p.sku).order_by(models.Movement.created_at.desc(),
                                                                              models.Movement.id.desc()).first()
                assert last.after == p.qty
            assert db.query(models.ViewLink).filter_by(key="demo").count() == 1
            viewer = db.query(models.User).filter_by(role="viewer").one()
            assert viewer.name == "Visitante"
    finally:
        db.close()


def test_demo_never_touches_a_real_database(monkeypatch):
    db = _session()
    try:
        db.add(models.Product(sku="REAL-1", name="PRENDA DE VERDAD", size="M", location_id="F-1-1", qty=3))
        db.commit()
        monkeypatch.setattr(settings, "database_url", "postgresql://usuario@servidor/bodega")
        demo.build(db, "demo")
        assert [p.sku for p in db.query(models.Product)] == ["REAL-1"]
        assert db.query(models.ViewLink).count() == 0
    finally:
        db.close()
