"""Lo que esta de paso sin ser inventario (cajas sueltas, canastas...): se
anota con de quien es y que hacer, no toca la bodega y sale con "Ya salio"."""
import uuid

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app


def _h(client):
    r = client.post("/api/auth/login", json={"email": settings.admin_email, "password": settings.admin_password})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _open_ids(client, h):
    return [p["id"] for p in client.get("/api/parcels", headers=h).json()]


def test_parcels_say_whose_and_what_to_do_until_they_leave():
    with TestClient(app) as client:
        h = _h(client)
        units = sum(p["qty"] for p in client.get("/api/products", headers=h).json())

        # sin de quien ni que hacer no sirve; "otro" necesita decir que es
        assert client.post("/api/parcels", headers=h, json={"kind": "caja"}).status_code == 400
        r = client.post("/api/parcels", headers=h, json={"kind": "otro", "owner": "Cliente de prueba"})
        assert r.status_code == 400 and "qué es" in r.json()["detail"]
        r = client.post("/api/parcels", headers=h, json={"owner": "Cliente de prueba", "location_id": "NO-EXISTE"})
        assert r.status_code == 400

        r = client.post("/api/parcels", headers=h, json={"kind": "caja", "qty": 2, "owner": "  Cliente   de prueba ",
                                                          "notes": "Enviar el viernes"})
        assert r.status_code == 201, r.text
        box = r.json()
        assert box["owner"] == "Cliente de prueba" and box["done_at"] is None
        assert box["location_id"] == "DESPACHO" and box["location_name"] == "Despacho (de paso)"

        # en una de las canastas de la mesa
        r = client.post("/api/parcels", headers=h, json={"kind": "canasta", "notes": "Devolver al taller",
                                                          "location_id": "m-1-1"})
        assert r.status_code == 201, r.text
        crate = r.json()
        assert crate["location_id"] == "M-1-1" and crate["owner"] is None

        assert _open_ids(client, h)[-2:] == [box["id"], crate["id"]]  # lo que mas lleva, primero
        assert "Cliente de prueba" in client.get("/api/parcels/owners", headers=h).json()

        # no es inventario: la bodega no cambia
        assert sum(p["qty"] for p in client.get("/api/products", headers=h).json()) == units

        r = client.patch(f"/api/parcels/{crate['id']}", headers=h, json={"owner": "Taller de prueba", "qty": 3})
        assert r.status_code == 200 and r.json()["qty"] == 3 and r.json()["owner"] == "Taller de prueba"
        r = client.patch(f"/api/parcels/{crate['id']}", headers=h, json={"owner": "", "notes": " "})
        assert r.status_code == 400
        still = next(p for p in client.get("/api/parcels", headers=h).json() if p["id"] == crate["id"])
        assert still["owner"] == "Taller de prueba" and still["notes"] == "Devolver al taller"

        # ya salio: deja la lista, queda quien y cuando, y no sale dos veces
        r = client.post(f"/api/parcels/{box['id']}/done", headers=h)
        assert r.status_code == 200 and r.json()["done_by"] and r.json()["done_at"]
        assert client.post(f"/api/parcels/{box['id']}/done", headers=h).status_code == 409
        assert box["id"] not in _open_ids(client, h)
        assert client.get("/api/parcels?state=done", headers=h).json()[0]["id"] == box["id"]

        # deshacer
        assert client.post(f"/api/parcels/{box['id']}/reopen", headers=h).status_code == 200
        assert box["id"] in _open_ids(client, h)

        # anotada por error
        assert client.delete(f"/api/parcels/{crate['id']}", headers=h).status_code == 204
        assert client.patch(f"/api/parcels/{crate['id']}", headers=h, json={"qty": 1}).status_code == 404
        assert client.post(f"/api/parcels/{box['id']}/done", headers=h).status_code == 200


def test_passing_goods_show_the_remision_notes():
    with TestClient(app) as client:
        h = _h(client)
        tag = uuid.uuid4().hex[:6].upper()
        sku = f"NOTA-{tag}-M"
        r = client.post("/api/documents/remision", headers=h, json={
            "number": f"NOTA {tag}", "supplier": "Taller de prueba", "notes": "Para el pedido del cliente de prueba",
            "destination": "despacho", "lines": [{"name": "CHAQUETA CON NOTA", "size": "M", "sku": sku, "qty": 2}]})
        assert r.status_code == 201, r.text
        row = next(d for d in client.get("/api/reports/dispatch", headers=h).json() if d["product"]["sku"] == sku)
        assert row["qty"] == 2 and row["doc_number"] == f"NOTA{tag}"
        assert row["doc_supplier"] == "Taller de prueba" and row["doc_notes"] == "Para el pedido del cliente de prueba"


def test_conteo_por_talla_recordatorio_y_notas():
    tag = uuid.uuid4().hex[:4].upper()
    with TestClient(app) as client:
        h = _h(client)
        units = sum(p["qty"] for p in client.get("/api/products", headers=h).json())
        # una caja con prendas que no son del inventario, contadas por talla, y para recordar el viernes
        r = client.post("/api/parcels", headers=h, json={
            "kind": "caja", "qty": 2, "owner": f"Cliente {tag}", "notes": "Enviar", "remind_on": "2026-10-17",
            "items": [{"name": " camisa  honda ", "size": "m", "qty": 5}, {"name": "CAMISA HONDA", "size": "M", "qty": 3},
                      {"name": "Camisa Yamaha", "size": "L", "qty": 4}]})
        assert r.status_code == 201, r.text
        box = r.json()
        assert box["remind_on"] == "2026-10-17"
        assert box["items"] == [{"name": "CAMISA HONDA", "size": "M", "qty": 8}, {"name": "CAMISA YAMAHA", "size": "L", "qty": 4}]
        # no es inventario
        assert sum(p["qty"] for p in client.get("/api/products", headers=h).json()) == units

        # se corrige el conteo y se quita el recordatorio
        r = client.patch(f"/api/parcels/{box['id']}", headers=h, json={
            "items": [{"name": "CAMISA HONDA", "size": "M", "qty": 7}], "remind_on": None})
        assert r.status_code == 200 and r.json()["items"] == [{"name": "CAMISA HONDA", "size": "M", "qty": 7}]
        assert r.json()["remind_on"] is None
        # sin tocar el conteo, sigue igual
        r = client.patch(f"/api/parcels/{box['id']}", headers=h, json={"notes": "Enviar el lunes"})
        assert r.json()["items"] == [{"name": "CAMISA HONDA", "size": "M", "qty": 7}]

        # una nota suelta: solo lo que hay que recordar, sin prendas ni cantidad
        assert client.post("/api/parcels", headers=h, json={"kind": "nota", "owner": "Taller"}).status_code == 400
        r = client.post("/api/parcels", headers=h, json={"kind": "nota", "notes": f"Llamar al taller {tag}", "qty": 5,
                                                          "remind_on": "2026-10-16", "items": [{"name": "X", "qty": 1}]})
        assert r.status_code == 201, r.text
        note = r.json()
        assert (note["kind"], note["qty"], note["items"], note["remind_on"]) == ("nota", 1, None, "2026-10-16")
        # lista: sale con lo demas y se marca lista igual
        assert note["id"] in [p["id"] for p in client.get("/api/parcels", headers=h).json()]
        assert client.post(f"/api/parcels/{note['id']}/done", headers=h).status_code == 200
        assert client.post(f"/api/parcels/{box['id']}/done", headers=h).status_code == 200
