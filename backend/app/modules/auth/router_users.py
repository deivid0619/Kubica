"""Configuracion > Equipo: quien entra a la app, su rol y quitar o devolver
el acceso. Quitarlo no borra nada: su historial se queda con su nombre. Nunca
queda la app sin un administrador y nadie se quita el acceso a si mismo."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.core.config import settings
from app.core.database import get_db
from app.core.deps import require_admin

router = APIRouter(prefix="/api/users", tags=["equipo"])


@router.get("", response_model=list[schemas.UserAdminOut])
def people(db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    """Las personas del equipo (sin las cuentas "solo ver" de los enlaces):
    primero las que tienen acceso, por nombre."""
    users = db.query(models.User).filter(models.User.role != "viewer").all()
    return sorted(users, key=lambda u: (not u.active, u.name.lower()))


@router.patch("/{user_id}", response_model=schemas.UserAdminOut)
def change(user_id: int, payload: schemas.UserPatchIn, db: Session = Depends(get_db),
           me: models.User = Depends(require_admin)):
    user = db.get(models.User, user_id)
    if not user or user.role == "viewer":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Esa persona no existe.")
    if payload.active is False and user.id == me.id:
        raise HTTPException(status.HTTP_409_CONFLICT, "No puedes quitarte el acceso a ti mismo.")
    role = payload.role or user.role
    active = user.active if payload.active is None else payload.active
    if user.role == "admin" and user.active and not (role == "admin" and active):
        others = (db.query(models.User)
                  .filter(models.User.role == "admin", models.User.active.is_(True), models.User.id != user.id).count())
        if not others:
            raise HTTPException(status.HTTP_409_CONFLICT, f"{settings.nombre_app} necesita al menos un administrador.")
    user.role, user.active = role, active
    db.commit()
    db.refresh(user)
    return user
