"""Los ajustes de la empresa, guardados en app_settings con la clave
"ajuste:<nombre>". Lo que no se ha guardado sale de las variables del
servidor (ver core/config.py)."""
from __future__ import annotations

import json

from sqlalchemy.orm import Session

from app import models
from app.core.config import settings
from app.modules.catalogo import service as catalog

TALLAS = ["S", "M", "L", "XL", "2XL", "3XL", "4XL"]  # las de una referencia nueva en una remision
KEYS = ("empresa_nombre", "tallas", "catalogo_url")


def _get(db: Session, name: str) -> str | None:
    row = db.get(models.AppSetting, f"ajuste:{name}")
    return row.value if row else None


def ajustes(db: Session) -> dict:
    tallas = _get(db, "tallas")
    url = _get(db, "catalogo_url")
    return {
        "empresa_nombre": _get(db, "empresa_nombre") or "",
        "tallas": json.loads(tallas) if tallas else list(TALLAS),
        "catalogo_url": settings.catalog_url if url is None else url,
    }


def tienda_guardada(db: Session) -> str | None:
    """La tienda guardada en Configuracion; None si se usa la de CATALOG_URL."""
    return _get(db, "catalogo_url")


def guardar(db: Session, cambios: dict) -> dict:
    for name in KEYS:
        if name not in cambios:
            continue
        value = json.dumps(cambios[name]) if name == "tallas" else cambios[name]
        row = db.get(models.AppSetting, f"ajuste:{name}")
        if row:
            row.value = value
        else:
            db.add(models.AppSetting(key=f"ajuste:{name}", value=value))
    db.commit()
    if "catalogo_url" in cambios:
        # la tienda nueva se lee ya, en segundo plano
        catalog.set_url(cambios["catalogo_url"])
        catalog.warm()
    return ajustes(db)
