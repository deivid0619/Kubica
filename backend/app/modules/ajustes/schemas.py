"""Configuracion > Tu empresa: lo que se lee y lo que guarda un administrador."""
import re
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, field_validator

Talla = Annotated[str, StringConstraints(strip_whitespace=True, to_upper=True, min_length=1, max_length=8)]


class AjustesOut(BaseModel):
    empresa_nombre: str
    tallas: list[str]
    catalogo_url: str


class AjustesIn(BaseModel):
    """Solo cambia lo que llega; lo demas se queda como esta."""
    empresa_nombre: Annotated[str, StringConstraints(strip_whitespace=True, max_length=60)] | None = None
    tallas: list[Talla] | None = Field(default=None, min_length=1, max_length=20)
    # vacia apaga el catalogo de la tienda
    catalogo_url: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] | None = None

    @field_validator("tallas")
    @classmethod
    def _sin_repetidas(cls, v):
        if v is not None and len(set(v)) != len(v):
            raise ValueError("Hay tallas repetidas.")
        return v

    @field_validator("catalogo_url")
    @classmethod
    def _http(cls, v):
        if v and not re.fullmatch(r"https?://\S+", v):
            raise ValueError("La tienda va con su dirección completa: https://…")
        return v
