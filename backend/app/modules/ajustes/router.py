"""Configuracion > Tu empresa: el nombre que sale en los PDF y en Excel, las
tallas de una referencia nueva y la tienda en linea. Y de Equipo, el codigo
para crear cuenta."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.modules.ajustes import service

router = APIRouter(prefix="/api/settings", tags=["configuracion"])


@router.get("", response_model=schemas.AjustesOut, response_model_exclude_none=True)
def read(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return service.ajustes(db, admin=user.role == "admin")


@router.put("", response_model=schemas.AjustesOut, response_model_exclude_none=True)
def save(payload: schemas.AjustesIn, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    return service.guardar(db, payload.model_dump(exclude_unset=True, exclude_none=True))
