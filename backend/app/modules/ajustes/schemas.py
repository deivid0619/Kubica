"""Configuracion > Tu empresa: lo que se lee y lo que guarda un administrador."""
import re
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, field_validator

Talla = Annotated[str, StringConstraints(strip_whitespace=True, to_upper=True, min_length=1, max_length=8)]


class AjustesOut(BaseModel):
    empresa_nombre: str
    tallas: list[str]
    catalogo_url: str
    codigo_registro: str | None = None  # solo para un administrador


class AjustesIn(BaseModel):
    """Solo cambia lo que llega; lo demas se queda como esta."""
    empresa_nombre: Annotated[str, StringConstraints(strip_whitespace=True, max_length=60)] | None = None
    tallas: list[Talla] | None = Field(default=None, min_length=1, max_length=20)
    # vacia apaga el catalogo de la tienda
    catalogo_url: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] | None = None
    # el que pide la app al crear cuenta; el de antes deja de servir
    codigo_registro: Annotated[str, StringConstraints(strip_whitespace=True, min_length=4, max_length=40)] | None = None

    @field_validator("empresa_nombre", "tallas", "codigo_registro")
    @classmethod
    def _sin_caracteres_raros(cls, v):
        # un caracter de control (de un pegado raro) no se puede escribir en el Excel
        if v is not None and any(re.search(r"[\x00-\x1f\x7f]", t) for t in (v if isinstance(v, list) else [v])):
            raise ValueError("Tiene caracteres que no se pueden usar.")
        return v

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
