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
# lo que llega -> su clave en app_settings ("ajuste:<clave>")
KEYS = {"empresa_nombre": "empresa_nombre", "tallas": "tallas", "catalogo_url": "catalogo_url",
        "codigo_registro": "registration_code"}


def _get(db: Session, name: str) -> str | None:
    row = db.get(models.AppSetting, f"ajuste:{name}")
    return row.value if row else None


def ajustes(db: Session, admin: bool = False) -> dict:
    """Los ajustes de la empresa; el codigo para crear cuenta solo lo ve un
    administrador."""
    tallas = _get(db, "tallas")
    url = _get(db, "catalogo_url")
    out = {
        "empresa_nombre": _get(db, "empresa_nombre") or "",
        "tallas": json.loads(tallas) if tallas else list(TALLAS),
        "catalogo_url": settings.catalog_url if url is None else url,
    }
    if admin:
        out["codigo_registro"] = codigo_registro(db)
    return out


def codigo_registro(db: Session) -> str:
    """El codigo que pide la app al crear cuenta: el de Configuracion o, si no
    se ha cambiado, el de REGISTRATION_CODE."""
    return _get(db, "registration_code") or settings.registration_code


def tienda_guardada(db: Session) -> str | None:
    """La tienda guardada en Configuracion; None si se usa la de CATALOG_URL."""
    return _get(db, "catalogo_url")


def guardar(db: Session, cambios: dict) -> dict:
    for name, key in KEYS.items():
        if name not in cambios:
            continue
        value = json.dumps(cambios[name]) if name == "tallas" else cambios[name]
        row = db.get(models.AppSetting, f"ajuste:{key}")
        if row:
            row.value = value
        else:
            db.add(models.AppSetting(key=f"ajuste:{key}", value=value))
    db.commit()
    if "catalogo_url" in cambios:
        # la tienda nueva se lee ya, en segundo plano
        catalog.set_url(cambios["catalogo_url"])
        catalog.warm()
    return ajustes(db, admin=True)
