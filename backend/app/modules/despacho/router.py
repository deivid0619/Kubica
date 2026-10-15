"""Lo que esta de paso sin ser inventario: cajas sueltas, canastas, bolsas...
con de quien son y que hacer con ellas. No suman a la bodega ni a los
reportes; salen de la lista con "Ya salio" y queda quien y cuando."""
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.modules.inventario import service as inv
from app import models
from app.modules.avisos import push
from app import schemas
from app.modules.inventario import serializers as ser
from app.core.database import get_db
from app.core.deps import get_current_user

router = APIRouter(prefix="/api/parcels", tags=["de paso"])

NAMES = {"caja": ("caja", "cajas"), "canasta": ("canasta", "canastas"), "bolsa": ("bolsa", "bolsas")}


def _clean(text: str | None) -> str | None:
    return " ".join((text or "").split()) or None


def describe(p: models.Parcel) -> str:
    """Como se nombra: "1 caja", "3 canastas", "Casco", "Casco (2)" o "Nota"."""
    if p.kind == "nota":
        return "Nota"
    if p.kind in NAMES:
        one, many = NAMES[p.kind]
        name = f"{p.qty} {one if p.qty == 1 else many}"
    else:
        label = p.label or "Otro"
        name = label if p.qty == 1 else f"{label} ({p.qty})"
    units = sum(i["qty"] for i in p.items or [])
    return f"{name} · {units} {'prenda' if units == 1 else 'prendas'}" if units else name


def _items(items) -> list[dict] | None:
    """Lo contado por talla: el nombre en mayuscula y la misma talla repetida se suma."""
    merged: dict[tuple[str, str], int] = {}
    for it in items or []:
        name = " ".join(it.name.upper().split())
        size = " ".join(it.size.upper().split())
        if name:
            merged[(name, size)] = merged.get((name, size), 0) + it.qty
    return [{"name": n, "size": s, "qty": q} for (n, s), q in merged.items()] or None


def _out(p: models.Parcel, names: dict[str, str]) -> schemas.ParcelOut:
    out = schemas.ParcelOut.model_validate(p)
    out.location_name = names.get(p.location_id, p.location_id)
    return out


def _get(db: Session, parcel_id: int, lock: bool = False) -> models.Parcel:
    q = db.query(models.Parcel).filter(models.Parcel.id == parcel_id)
    p = (q.with_for_update() if lock else q).first()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Eso ya no está en la lista.")
    return p


def _check(db: Session, p: models.Parcel) -> None:
    if p.kind == "nota":
        # un recordatorio: no es nada fisico, no lleva prendas ni cantidad
        p.qty, p.items, p.label = 1, None, None
        if not p.notes:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Escribe qué hay que recordar.")
    if p.kind == "otro" and not p.label:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Escribe qué es.")
    if not p.owner and not p.notes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Escribe de quién es o qué hacer con eso.")
    if p.location_id not in inv.location_ids(db):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Esa ubicación no existe.")


@router.get("", response_model=list[schemas.ParcelOut])
def list_parcels(state: Literal["open", "done"] = "open", limit: int = Query(default=100, le=200),
                 db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    """Lo que espera salir (lo que mas lleva, primero) o lo que ya salio (lo
    mas reciente, primero)."""
    q = db.query(models.Parcel)
    if state == "open":
        q = q.filter(models.Parcel.done_at.is_(None)).order_by(models.Parcel.created_at, models.Parcel.id)
    else:
        q = q.filter(models.Parcel.done_at.isnot(None)).order_by(models.Parcel.done_at.desc(), models.Parcel.id.desc())
    names = ser.loc_names(db)
    return [_out(p, names) for p in q.limit(limit).all()]


@router.get("/owners", response_model=list[str])
def owners(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    """Los nombres usados ultimamente, para sugerirlos al escribir."""
    seen: dict[str, str] = {}
    rows = (db.query(models.Parcel.owner).filter(models.Parcel.owner.isnot(None))
            .order_by(models.Parcel.created_at.desc()).limit(300).all())
    for (name,) in rows:
        seen.setdefault(name.lower(), name)
    return list(seen.values())[:30]


@router.post("", response_model=schemas.ParcelOut, status_code=status.HTTP_201_CREATED)
def create_parcel(payload: schemas.ParcelIn, background: BackgroundTasks, db: Session = Depends(get_db),
                  user: models.User = Depends(get_current_user)):
    p = models.Parcel(
        kind=payload.kind, label=_clean(payload.label) if payload.kind == "otro" else None, qty=payload.qty,
        owner=_clean(payload.owner), notes=_clean(payload.notes), location_id=payload.location_id.strip().upper(),
        items=_items(payload.items), remind_on=payload.remind_on.isoformat() if payload.remind_on else None,
        user_id=user.id, user_name=user.name,
    )
    _check(db, p)
    db.add(p)
    db.commit()
    db.refresh(p)
    names = ser.loc_names(db)
    if p.kind == "nota":
        title, place = "Recordatorio", None
    else:
        title, place = f"De paso · {describe(p)}", names.get(p.location_id, p.location_id)
    body = " · ".join(x for x in (p.owner, p.notes, place, p.remind_on and f"recordar el {p.remind_on}", user.name) if x)
    background.add_task(push.notify, "in", title, body, "/summary", f"parcel-{p.id}", user.id)
    return _out(p, names)


@router.patch("/{parcel_id}", response_model=schemas.ParcelOut)
def update_parcel(parcel_id: int, payload: schemas.ParcelUpdateIn, db: Session = Depends(get_db),
                  _: models.User = Depends(get_current_user)):
    p = _get(db, parcel_id)
    data = payload.model_dump(exclude_unset=True)
    if data.get("kind"):
        p.kind = data["kind"]
    if "label" in data:
        p.label = _clean(data["label"])
    if p.kind != "otro":
        p.label = None
    if data.get("qty"):
        p.qty = data["qty"]
    if "owner" in data:
        p.owner = _clean(data["owner"])
    if "notes" in data:
        p.notes = _clean(data["notes"])
    if data.get("location_id"):
        p.location_id = data["location_id"].strip().upper()
    if "items" in data:
        p.items = _items(payload.items)
    if "remind_on" in data:
        p.remind_on = payload.remind_on.isoformat() if payload.remind_on else None
    try:
        _check(db, p)
    except HTTPException:
        db.rollback()
        raise
    db.commit()
    db.refresh(p)
    return _out(p, ser.loc_names(db))


@router.post("/{parcel_id}/done", response_model=schemas.ParcelOut)
def mark_done(parcel_id: int, background: BackgroundTasks, db: Session = Depends(get_db),
              user: models.User = Depends(get_current_user)):
    """Ya salio: deja la lista y queda quien la saco y cuando."""
    p = _get(db, parcel_id, lock=True)
    if p.done_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Ya había salido ({p.done_by}).")
    p.done_at = datetime.now(timezone.utc)
    p.done_by = user.name
    db.commit()
    db.refresh(p)
    if p.kind == "nota":
        title, body = "Recordatorio listo", " · ".join(x for x in (p.notes, user.name) if x)
    else:
        title, body = f"Ya salió · {describe(p)}", " · ".join(x for x in (p.owner, user.name) if x)
    background.add_task(push.notify, "out", title, body, "/summary", f"parcel-{p.id}", user.id)
    return _out(p, ser.loc_names(db))


@router.post("/{parcel_id}/reopen", response_model=schemas.ParcelOut)
def reopen(parcel_id: int, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    """Deshacer "Ya salio": vuelve a la lista."""
    p = _get(db, parcel_id, lock=True)
    p.done_at = None
    p.done_by = None
    db.commit()
    db.refresh(p)
    return _out(p, ser.loc_names(db))


@router.delete("/{parcel_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_parcel(parcel_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Borrar algo anotado por error: quien lo anoto o un administrador."""
    p = _get(db, parcel_id)
    if user.role != "admin" and p.user_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo quien lo anotó o un administrador puede borrarlo.")
    db.delete(p)
    db.commit()
