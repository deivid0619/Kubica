"""Configuracion > Equipo: un administrador ve quien entra, cambia el rol
entre administrador y operador, quita o devuelve el acceso (sin borrar el
historial) y cambia el codigo para crear cuenta. Nunca queda la app sin un
administrador y nadie se quita el acceso a si mismo."""
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_bodega.db")
os.environ.setdefault("ADMIN_EMAIL", "admin@test.com")
os.environ.setdefault("ADMIN_PASSWORD", "admin1234")

from fastapi.testclient import TestClient

from app import models
from app.core.config import settings
from app.core.database import SessionLocal
from app.main import app

NO_ACCESS = "Esta cuenta ya no tiene acceso. Habla con un administrador."
LAST_ADMIN = "Kubica necesita al menos un administrador."
NOT_SELF = "No puedes quitarte el acceso a ti mismo."


def _h(token):
    return {"Authorization": f"Bearer {token}"}


def _admin(client):
    r = client.post("/api/auth/login", json={"email": settings.admin_email, "password": settings.admin_password})
    return _h(r.json()["access_token"]), r.json()["user"]["id"]


def _person(client, email, name="Persona Equipo"):
    """Una cuenta de operador (la crea o entra si ya existe). Devuelve sus
    encabezados y su id."""
    r = client.post("/api/auth/register", json={"name": name, "email": email, "password": "op123456",
                                                "invite_code": settings.registration_code})
    if r.status_code != 200:
        r = client.post("/api/auth/login", json={"email": email, "password": "op123456"})
    return _h(r.json()["access_token"]), r.json()["user"]["id"]


def _restore(user_id, role="operator", active=True):
    db = SessionLocal()
    try:
        u = db.get(models.User, user_id)
        u.role, u.active = role, active
        db.commit()
    finally:
        db.close()


def test_list_users_admin_only():
    with TestClient(app) as client:
        admin, _ = _admin(client)
        op, _ = _person(client, "eq-lista@test.com", "Lista Equipo")
        assert client.get("/api/users", headers=op).status_code == 403
        # la cuenta "solo ver" de un enlace no es del equipo
        link = client.post("/api/auth/view-links", headers=admin, json={"name": "Visita Equipo"}).json()
        client.post("/api/auth/view", json={"key": link["key"]})
        try:
            people = client.get("/api/users", headers=admin).json()
            emails = [p["email"] for p in people]
            assert settings.admin_email in emails and "eq-lista@test.com" in emails
            assert all(p["role"] != "viewer" for p in people)
            first = people[0]
            assert set(first) == {"id", "name", "email", "role", "active", "created_at"}
        finally:
            client.delete(f"/api/auth/view-links/{link['id']}", headers=admin)


def test_promote_and_demote():
    with TestClient(app) as client:
        admin, _ = _admin(client)
        op, op_id = _person(client, "eq-rol@test.com")
        try:
            r = client.patch(f"/api/users/{op_id}", headers=admin, json={"role": "admin"})
            assert r.status_code == 200 and r.json()["role"] == "admin"
            assert client.get("/api/users", headers=op).status_code == 200
            r = client.patch(f"/api/users/{op_id}", headers=admin, json={"role": "operator"})
            assert r.json()["role"] == "operator"
            assert client.get("/api/users", headers=op).status_code == 403
            assert client.patch("/api/users/999999", headers=admin, json={"role": "admin"}).status_code == 404
            assert client.patch(f"/api/users/{op_id}", headers=admin, json={"role": "viewer"}).status_code == 422
        finally:
            _restore(op_id)


def test_cannot_remove_last_admin():
    with TestClient(app) as client:
        admin, me = _admin(client)
        r = client.patch(f"/api/users/{me}", headers=admin, json={"role": "operator"})
        assert r.status_code == 409 and r.json()["detail"] == LAST_ADMIN
        assert client.patch(f"/api/users/{me}", headers=admin, json={"active": False}).status_code == 409
        assert client.get("/api/auth/me", headers=admin).json()["role"] == "admin"


def test_demote_self_when_other_admin_exists():
    with TestClient(app) as client:
        admin, me = _admin(client)
        other, other_id = _person(client, "eq-otro-admin@test.com")
        try:
            client.patch(f"/api/users/{other_id}", headers=admin, json={"role": "admin"})
            r = client.patch(f"/api/users/{me}", headers=admin, json={"role": "operator"})
            assert r.status_code == 200 and r.json()["role"] == "operator"
            # el otro administrador la devuelve
            assert client.patch(f"/api/users/{me}", headers=other, json={"role": "admin"}).status_code == 200
        finally:
            _restore(me, role="admin")
            _restore(other_id)


def test_cannot_deactivate_self():
    with TestClient(app) as client:
        admin, me = _admin(client)
        r = client.patch(f"/api/users/{me}", headers=admin, json={"active": False})
        assert r.status_code == 409 and r.json()["detail"] == NOT_SELF


def test_inactive_cannot_login_and_token_rejected():
    with TestClient(app) as client:
        admin, _ = _admin(client)
        op, op_id = _person(client, "eq-sin-acceso@test.com")
        try:
            r = client.patch(f"/api/users/{op_id}", headers=admin, json={"active": False})
            assert r.status_code == 200 and r.json()["active"] is False
            # la sesion que tenia abierta se cierra
            r = client.get("/api/auth/me", headers=op)
            assert r.status_code == 401 and r.json()["detail"] == NO_ACCESS
            r = client.post("/api/auth/login", json={"email": "eq-sin-acceso@test.com", "password": "op123456"})
            assert r.status_code == 401 and r.json()["detail"] == NO_ACCESS
            # sale de ultimas en la lista
            people = client.get("/api/users", headers=admin).json()
            assert people[-1]["email"] == "eq-sin-acceso@test.com" or not people[-1]["active"]
        finally:
            _restore(op_id)


def test_reactivate():
    with TestClient(app) as client:
        admin, _ = _admin(client)
        _, op_id = _person(client, "eq-vuelve@test.com")
        try:
            client.patch(f"/api/users/{op_id}", headers=admin, json={"active": False})
            r = client.patch(f"/api/users/{op_id}", headers=admin, json={"active": True})
            assert r.status_code == 200 and r.json()["active"] is True
            r = client.post("/api/auth/login", json={"email": "eq-vuelve@test.com", "password": "op123456"})
            assert r.status_code == 200
        finally:
            _restore(op_id)


def test_history_kept():
    with TestClient(app) as client:
        admin, _ = _admin(client)
        op, op_id = _person(client, "eq-historial@test.com", "Historial Equipo")
        try:
            r = client.post("/api/products", headers=op, json={"sku": "EQ-HIST-1", "name": "PRUEBA EQUIPO", "size": "M",
                                                             "location_id": "F-6-1", "qty": 1})
            assert r.status_code in (201, 400)  # 400: quedo de una corrida anterior
            client.patch(f"/api/users/{op_id}", headers=admin, json={"active": False})
            moves = client.get("/api/movements?sku=EQ-HIST-1", headers=admin).json()
            assert any(m["user_name"] == "Historial Equipo" for m in moves)
        finally:
            _restore(op_id)


def test_registration_code_override():
    with TestClient(app) as client:
        admin, _ = _admin(client)
        op, _ = _person(client, "eq-codigo@test.com")
        try:
            assert client.put("/api/settings", headers=admin, json={"codigo_registro": "abc"}).status_code == 422
            r = client.put("/api/settings", headers=admin, json={"codigo_registro": " codigo-nuevo-26 "})
            assert r.status_code == 200 and r.json()["codigo_registro"] == "codigo-nuevo-26"
            assert "codigo_registro" not in client.get("/api/settings", headers=op).json()
            assert client.get("/api/settings", headers=admin).json()["codigo_registro"] == "codigo-nuevo-26"
            new = {"name": "Codigo Nuevo", "email": "eq-codigo-nuevo@test.com", "password": "op123456"}
            assert client.post("/api/auth/register", json={**new, "invite_code": settings.registration_code}).status_code == 400
            r = client.post("/api/auth/register", json={**new, "invite_code": "codigo-nuevo-26"})
            assert r.status_code in (200, 400) and (r.status_code == 200 or "Ya existe" in r.json()["detail"])
        finally:
            db = SessionLocal()
            try:
                db.query(models.AppSetting).filter(models.AppSetting.key == "ajuste:registration_code").delete()
                db.commit()
            finally:
                db.close()
        assert client.get("/api/settings", headers=admin).json()["codigo_registro"] == settings.registration_code
