"""Configuracion > Tu empresa: el nombre de la empresa, las tallas de las
remisiones y la tienda en linea. Cualquier sesion los lee; solo un
administrador los cambia. Lo guardado manda sobre las variables del servidor."""
import io
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_bodega.db")
os.environ.setdefault("ADMIN_EMAIL", "admin@test.com")
os.environ.setdefault("ADMIN_PASSWORD", "admin1234")

from fastapi.testclient import TestClient
from openpyxl import load_workbook

from app import models
from app.core.config import settings
from app.core.database import SessionLocal
from app.main import app
from app.modules.catalogo import service as catalog

DEFAULT_TALLAS = ["S", "M", "L", "XL", "2XL", "3XL", "4XL"]


def _h(token):
    return {"Authorization": f"Bearer {token}"}


def _admin(client):
    r = client.post("/api/auth/login", json={"email": settings.admin_email, "password": settings.admin_password})
    return _h(r.json()["access_token"])


def _operator(client, email="op-ajustes@test.com"):
    r = client.post("/api/auth/register", json={"name": "Operador Ajustes", "email": email, "password": "op123456",
                                                "invite_code": settings.registration_code})
    if r.status_code != 200:
        r = client.post("/api/auth/login", json={"email": email, "password": "op123456"})
    return _h(r.json()["access_token"])


def _reset():
    """Deja los ajustes como venian (las variables del servidor)."""
    db = SessionLocal()
    try:
        db.query(models.AppSetting).filter(models.AppSetting.key.like("ajuste:%")).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()
    catalog.set_url(None)


def test_defaults():
    with TestClient(app) as client:
        _reset()
        r = client.get("/api/settings", headers=_operator(client))
        assert r.status_code == 200
        assert r.json() == {"empresa_nombre": "", "tallas": DEFAULT_TALLAS, "catalogo_url": settings.catalog_url}


def test_admin_saves_and_reads():
    with TestClient(app) as client:
        admin = _admin(client)
        try:
            r = client.put("/api/settings", headers=admin, json={"empresa_nombre": "  Distribuidora Uno ",
                                                                 "tallas": ["s", " M", "L"]})
            assert r.status_code == 200
            assert r.json()["empresa_nombre"] == "Distribuidora Uno" and r.json()["tallas"] == ["S", "M", "L"]
            # lo ve cualquiera
            got = client.get("/api/settings", headers=_operator(client)).json()
            assert got["empresa_nombre"] == "Distribuidora Uno" and got["tallas"] == ["S", "M", "L"]
            # cambiar solo el nombre deja las tallas
            r = client.put("/api/settings", headers=admin, json={"empresa_nombre": "Uno"})
            assert {k: v for k, v in r.json().items() if k != "codigo_registro"} == {**got, "empresa_nombre": "Uno"}
        finally:
            _reset()


def test_operator_cannot_save():
    with TestClient(app) as client:
        r = client.put("/api/settings", headers=_operator(client), json={"empresa_nombre": "Otra"})
        assert r.status_code == 403
        assert client.get("/api/settings", headers=_admin(client)).json()["empresa_nombre"] == ""


def test_invalid_tallas():
    with TestClient(app) as client:
        admin = _admin(client)
        try:
            for bad in ({"tallas": []}, {"tallas": [str(i) for i in range(21)]}, {"tallas": ["M", "m"]},
                        {"tallas": ["MUYLARGA9"]}, {"catalogo_url": "ftp://tienda"}, {"empresa_nombre": "x" * 61}):
                assert client.put("/api/settings", headers=admin, json=bad).status_code == 422, bad
            assert client.get("/api/settings", headers=admin).json()["tallas"] == DEFAULT_TALLAS
        finally:
            _reset()


def test_catalog_url_saved_and_cleared(monkeypatch):
    # nada sale a internet: la tienda "no responde"
    def offline():
        raise RuntimeError("sin conexion")
    monkeypatch.setattr(catalog, "_fetch", offline)
    with TestClient(app) as client:
        admin = _admin(client)
        try:
            url = "https://tienda.example/products.json"
            assert client.put("/api/settings", headers=admin, json={"catalogo_url": url}).json()["catalogo_url"] == url
            assert catalog.current_url() == url
            assert client.get("/api/catalog/status", headers=admin).json()["enabled"] is True
            # vaciarla apaga el catalogo
            assert client.put("/api/settings", headers=admin, json={"catalogo_url": ""}).json()["catalogo_url"] == ""
            assert catalog.current_url() == ""
            assert client.get("/api/catalog/status", headers=admin).json()["enabled"] is False
        finally:
            _reset()
        assert catalog.current_url() == settings.catalog_url


def test_excel_uses_empresa():
    with TestClient(app) as client:
        admin = _admin(client)
        try:
            client.put("/api/settings", headers=admin, json={"empresa_nombre": "Distribuidora Uno"})
            r = client.get("/api/reports/inventory.xlsx", headers=admin)
            assert r.status_code == 200
            wb = load_workbook(io.BytesIO(r.content))
            assert "Distribuidora Uno" in wb.properties.title
            assert "Distribuidora Uno" in wb.worksheets[0].oddFooter.center.text
        finally:
            _reset()
