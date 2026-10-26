"""La demo publica de Kubica (una copia aparte en Render, ver render-demo.yaml):
una bodega inventada con su distribucion, sus prendas, codigos de mentira y
ocho semanas de historia, mas un enlace "solo ver" con llave fija para que
cualquiera la recorra sin contrasena. Se vuelve a armar en cada arranque, asi
las fechas siempre son de las ultimas semanas. Nada de una empresa real.

Solo corre con DEMO_VIEW_KEY y una base SQLite: en una instalacion de verdad
no hace nada."""
import logging
import random
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from sqlalchemy.orm import Session

from app import models
from app.core.config import settings
from app.core.security import hash_password
from app.modules.ajustes import service as ajustes_service
from app.modules.auth.router import _viewer_email
from app.modules.bodega import service as layout_service

logger = logging.getLogger("uvicorn.error")

ROOM = {"width": 9.6, "depth": 7.2}
LAYOUT = [
    {"id": "e1", "type": "rack", "code": "A", "x": -4.52, "z": -1.7, "rot": 1, "y0": 0, "params": {"w": 3.0, "bars": 3}},
    {"id": "e2", "type": "rack", "code": "B", "x": -4.52, "z": 1.7, "rot": 1, "y0": 0, "params": {"w": 3.0, "bars": 3}},
    {"id": "e3", "type": "bins", "code": "C", "x": -0.6, "z": 3.34, "rot": 2, "y0": 0, "params": {"cols": 8, "rows": 5}},
    {"id": "e4", "type": "shelf", "code": "E", "x": 4.5, "z": -1.6, "rot": 3, "y0": 0, "params": {"w": 2.4, "levels": 4}},
    {"id": "e5", "type": "shelf", "code": "F", "x": 4.5, "z": 1.5, "rot": 3, "y0": 0, "params": {"w": 2.4, "levels": 4}},
    {"id": "e6", "type": "bins", "code": "G", "x": -1.0, "z": -3.34, "rot": 0, "y0": 0, "params": {"cols": 6, "rows": 3}},
    {"id": "e7", "type": "boxes", "code": "K", "x": 2.6, "z": -3.2, "rot": 0, "y0": 0, "params": {"count": 4, "levels": 2}},
    {"id": "e8", "type": "table", "code": "M", "x": 0.3, "z": 0.2, "rot": 0, "y0": 0, "params": {"w": 2.0, "bins": 6}},
    {"id": "e9", "type": "ladder", "code": None, "x": 3.4, "z": 3.2, "rot": 0, "y0": 0, "params": {}},
]

# dibujos planos de cada prenda (viewBox 100x100), solo para que las fichas no
# se vean vacias; son ilustraciones, no fotos
SHAPES = {
    "camiseta": "M30 20 L42 13 Q50 20 58 13 L70 20 L83 33 L73 42 L67 37 L67 87 L33 87 L33 37 L27 42 L17 33 Z",
    "buzo": "M31 22 Q36 9 50 9 Q64 9 69 22 L80 30 L88 74 L78 76 L70 44 L70 88 L30 88 L30 44 L22 76 L12 74 L20 30 Z",
    "chaqueta": "M32 18 L44 13 L50 20 L56 13 L68 18 L80 30 L88 76 L78 78 L70 46 L70 88 L30 88 L30 46 L22 78 L12 76 L20 30 Z",
    "jean": "M31 12 L69 12 L74 88 L56 88 L50 40 L44 88 L26 88 Z",
    "cargo": "M30 12 L70 12 L75 88 L56 88 L50 42 L44 88 L25 88 Z",
    "vestido": "M40 10 L60 10 L62 30 L76 88 L24 88 L38 30 Z",
    "camisa": "M31 19 L42 13 L50 22 L58 13 L69 19 L82 32 L74 42 L67 37 L67 87 L33 87 L33 37 L26 42 L18 32 Z",
    "tenis": "M12 66 Q13 52 26 50 L44 46 Q54 55 70 57 L84 61 Q91 65 89 72 L12 72 Z",
    "gorra": "M24 60 Q24 30 50 30 Q76 30 76 60 Z M70 56 Q88 58 92 66 L70 64 Z",
    "medias": "M40 10 L58 10 L58 58 Q58 64 64 68 L74 74 Q80 80 74 86 Q70 90 62 86 L44 76 Q40 72 40 64 Z",
    "falda": "M34 22 L66 22 L80 82 L20 82 Z",
}

# referencia, dibujo, color, [(talla, ubicacion, cantidad, minimo)], ritmo de venta (salidas por semana)
REFS = [
    ("Chaqueta impermeable", "chaqueta", "#2F5D8C",
     [("S", "C-3-1", 6, 3), ("M", "C-3-2", 4, 3), ("L", "C-3-3", 7, 3), ("XL", "C-3-4", 1, 3)], 3),
    ("Jean slim azul", "jean", "#3B5B8A",
     [("28", "C-1-2", 5, 3), ("30", "C-1-3", 9, 4), ("32", "C-1-4", 7, 4), ("34", "C-1-5", 4, 3)], 5),
    ("Pantalón cargo verde", "cargo", "#6B7A4B",
     [("30", "C-1-6", 6, 2), ("32", "C-1-7", 8, 2), ("34", "C-1-8", 3, 2)], 2),
    ("Camiseta básica blanca", "camiseta", "#FAFAF7",
     [("S", "C-2-1", 14, 6), ("M", "C-2-2", 18, 6), ("L", "C-2-3", 12, 6), ("XL", "C-2-4", 8, 4)], 8),
    ("Camiseta básica negra", "camiseta", "#2A2D33",
     [("S", "C-2-5", 10, 5), ("M", "C-2-6", 13, 5), ("L", "C-2-7", 2, 4), ("XL", "C-2-8", 6, 3)], 6),
    ("Tenis blancos", "tenis", "#FFFFFF",
     [("40", "C-4-1", 2, 2), ("41", "C-4-2", 0, 2), ("39", "C-4-3", 5, 2), ("38", "C-4-4", 4, 2), ("37", "C-4-5", 3, 2)], 3),
    ("Buzo con capota gris", "buzo", "#9AA0A6",
     [("S", "P-A1", 7, 3), ("M", "P-A2", 11, 3), ("L", "P-A3", 9, 3)], 3),
    ("Vestido midi negro", "vestido", "#1F2024",
     [("S", "P-B1", 5, 2), ("M", "P-B2", 6, 2), ("L", "P-B3", 4, 2)], 2),
    ("Camisa de lino beige", "camisa", "#D8C8A8",
     [("S", "E-N1", 4, 2), ("M", "E-N2", 6, 2), ("L", "E-N3", 5, 2)], 2),
    ("Medias deportivas (3 pares)", "medias", "#E9E6DF", [("Única", "F-N1", 22, 8)], 6),
    ("Gorra negra", "gorra", "#22252B", [("Única", "F-N2", 9, 0)], 0),
    ("Falda plisada rosa", "falda", "#D99BA6", [("S", "G-1-1", 6, 0), ("M", "G-1-2", 5, 0)], 0),
]
RESERVE = [("Camiseta básica blanca", "M", 24), ("Jean slim azul", "32", 12),
           ("Buzo con capota gris", "L", 10), ("Chaqueta impermeable", "XL", 6)]
PEOPLE = ["Camila Ríos", "Andrés Mejía", "Administrador"]
SUPPLIER = "Confecciones La Muestra"  # inventado, como todo lo demas
COT = timezone(timedelta(hours=-5))
WIPE = (models.Movement, models.Stock, models.CodeAlias, models.ReserveItem, models.Parcel, models.Document,
        models.Notice, models.Product)


def thumb(shape: str, fill: str) -> str:
    svg = (f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>"
           f"<rect width='100' height='100' fill='#F1EEE7'/>"
           f"<path d='{SHAPES[shape]}' fill='{fill}' stroke='#2A2D33' stroke-width='2' stroke-linejoin='round'/></svg>")
    return "data:image/svg+xml;utf8," + quote(svg)


def build(db: Session, key: str) -> None:
    if not settings.database_url.startswith("sqlite"):
        # borra todo antes de armarla: nunca sobre una base de verdad
        logger.warning("DEMO_VIEW_KEY se ignora: la demo solo se arma sobre SQLite.")
        return
    rnd = random.Random(7)
    now = datetime.now(timezone.utc).replace(microsecond=0)

    def work_time(days_ago: int, early: bool = False) -> datetime:
        """Una hora de trabajo (7 am a 5 pm en Colombia) de hace `days_ago` dias, nunca en el futuro."""
        day = (now.astimezone(COT) - timedelta(days=days_ago)).replace(hour=7, minute=0, second=0)
        when = day + timedelta(minutes=rnd.randint(0, 90) if early else rnd.randint(60, 600))
        return min(when, now - timedelta(minutes=rnd.randint(5, 40))).astimezone(timezone.utc)

    for table in WIPE:
        db.query(table).delete()
    db.commit()
    layout_service._replace_all(db, [dict(e) for e in LAYOUT], room=dict(ROOM))
    db.commit()
    ajustes_service.guardar(db, {"empresa_nombre": "Bodega de ejemplo", "catalogo_url": ""})

    admin = db.query(models.User).filter(models.User.role == "admin").order_by(models.User.id).first()
    plan = []  # por talla: (sku, nombre, talla, ubicacion, cantidad, inicial, creada, eventos)
    n = 0
    for ref_i, (name, shape, color, sizes, per_week) in enumerate(REFS):
        image = thumb(shape, color)
        for size, loc, qty, minimum in sizes:
            n += 1
            sku = f"20010{ref_i + 1:02d}{n:04d}"
            db.add(models.Product(sku=sku, name=name, size=size, location_id=loc, qty=qty, min_qty=minimum,
                                  image_url=image, created_at=now - timedelta(days=75)))
            db.flush()
            if qty > 0:
                db.add(models.Stock(sku=sku, location_id=loc, qty=qty))

            # historia de 8 semanas: salidas por factura casi a diario y una
            # remision cada tres semanas que repone lo vendido
            events = []
            rate = per_week / len(sizes)  # salidas por semana de esta talla
            for day in range(56):
                if rnd.random() < rate / 6:
                    events.append(("out", rnd.choice([1, 1, 2]), work_time(day)))
            if rate:
                # cada referencia llega en una semana distinta, para que no entre todo junto
                for week in range(1, 8):
                    if (week + ref_i) % 3 == 0:
                        events.append(("in", max(round(rate * 4) + rnd.randint(0, 2), 2),
                                       work_time(week * 7 - 2 - ref_i % 3, early=True), week))
            outs = sum(e[1] for e in events if e[0] == "out")
            while qty + outs - sum(e[1] for e in events if e[0] == "in") < 0:
                events.remove(next(e for e in events if e[0] == "in"))
            start = qty + outs - sum(e[1] for e in events if e[0] == "in")
            # lo que de verdad pasa: una salida nunca deja la talla por debajo de cero
            total, kept = start, []
            for kind, q, when, *week in sorted(events, key=lambda e: e[2]):
                if kind == "out":
                    q = min(q, total)
                    if q == 0:
                        continue
                total += q if kind == "in" else -q
                # el numero del papel se pone despues: [tipo, cantidad, hora, numero]
                kept.append([kind, q, when, f"R-{1048 - week[0]}" if week else None])
            created = now - timedelta(days=70 if per_week == 0 else 60, hours=5)
            plan.append((sku, name, size, loc, qty, start, created, kept))

    # las facturas, numeradas en el orden en que salieron
    outs = sorted((e for row in plan for e in row[7] if e[0] == "out"), key=lambda e: e[2])
    for i, e in enumerate(outs):
        e[3] = f"FV-{2201 + i}"

    docs = {}  # (tipo, numero) -> el papel con sus lineas (Remisiones y facturas del Resumen)
    for sku, name, size, loc, qty, start, created, events in plan:
        db.add(models.Movement(sku=sku, type="new", qty=start, before=0, after=start, location_id=loc,
                               note="Remisión R-1031", product_name=name, product_size=size,
                               user_id=admin.id, user_name="Administrador", created_at=created))
        total = start
        for kind, q, when, number in events:
            after = total + q if kind == "in" else total - q
            doc_kind = "remision" if kind == "in" else "factura"
            who = rnd.choice(PEOPLE)
            db.add(models.Movement(sku=sku, type=kind, qty=q, before=total, after=after, location_id=loc,
                                   note=f"{'Remisión' if kind == 'in' else 'Factura'} {number}",
                                   product_name=name, product_size=size,
                                   user_id=admin.id, user_name=who, created_at=when))
            doc = docs.setdefault((doc_kind, number), {"lines": [], "user_name": who, "created_at": when})
            line = {"sku": sku, "qty": q, "location_id": loc}
            if doc_kind == "remision":
                line.update(name=name, size=size, pending=0, dest="bodega")
            doc["lines"].append(line)
            doc["created_at"] = min(doc["created_at"], when)
            total = after
        if total != qty:  # un conteo deja el total exacto
            db.add(models.Movement(sku=sku, type="set", qty=qty, before=total, after=qty, location_id=loc,
                                   note="Conteo", product_name=name, product_size=size,
                                   user_id=admin.id, user_name="Camila Ríos", created_at=now - timedelta(hours=2)))
    for (doc_kind, number), doc in docs.items():
        remision = doc_kind == "remision"
        db.add(models.Document(kind=doc_kind, number=number, lines=doc["lines"],
                               units=sum(line["qty"] for line in doc["lines"]),
                               supplier=SUPPLIER if remision else None,
                               doc_date=doc["created_at"].astimezone(COT).date().isoformat() if remision else None,
                               user_id=admin.id, user_name=doc["user_name"], created_at=doc["created_at"]))

    # bodega de reserva
    for name, size, qty in RESERVE:
        p = db.query(models.Product).filter_by(name=name, size=size).first()
        db.add(models.ReserveItem(sku=p.sku, name=name, size=size, qty=qty, image_url=p.image_url))

    # algo de paso para despachar
    db.add(models.Parcel(kind="caja", qty=2, owner="Tienda Centro", notes="Sale el viernes con el pedido de la tienda",
                         location_id="DESPACHO", user_id=admin.id, user_name="Andrés Mejía",
                         created_at=now - timedelta(days=1)))

    # el enlace "solo ver" de la pagina de Kubica (/?ver=LLAVE) y su cuenta ya
    # creada: si dos visitantes entran a la vez, no la crean los dos
    if not db.query(models.ViewLink).filter(models.ViewLink.key == key).first():
        db.add(models.ViewLink(key=key, name="Visitante"))
    if not db.query(models.User).filter(models.User.email == _viewer_email(key)).first():
        db.add(models.User(email=_viewer_email(key), name="Visitante",
                           password_hash=hash_password(secrets.token_urlsafe(24)), role="viewer"))
    db.commit()
    logger.info("Demo armada: %s productos, %s movimientos, %s remisiones y facturas.",
                db.query(models.Product).count(), db.query(models.Movement).count(), len(docs))
