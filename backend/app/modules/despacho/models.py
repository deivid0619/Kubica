"""Lo que esta de paso sin ser inventario (cajas, bolsas...)."""
from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String

from app.core.database import Base, now
from app.modules.bodega.logic import DISPATCH


class Parcel(Base):
    """Algo que esta de paso sin ser inventario: una caja suelta, una canasta,
    una bolsa... con de quien es y que hacer con ella. No suma a la bodega;
    sale de la lista con "Ya salio" y queda quien la saco y cuando."""
    __tablename__ = "parcels"

    id = Column(Integer, primary_key=True)
    # caja | canasta | bolsa | otro | nota (un recordatorio, sin nada fisico)
    kind = Column(String(20), nullable=False, default="caja")
    label = Column(String(60), nullable=True)  # "otro": que es (ej. un casco)
    qty = Column(Integer, nullable=False, default=1)
    owner = Column(String(120), nullable=True)  # de quien es, o para quien
    notes = Column(String(500), nullable=True)  # que hacer con ella (en una nota: que hay que recordar)
    # lo que trae adentro, contado por talla: prendas que no son del inventario
    # (ej. camisas de una marca que se cuentan y se envian) [{name, size, qty}]
    items = Column(JSON(none_as_null=True), nullable=True)
    remind_on = Column(String(10), nullable=True)  # recordar el (AAAA-MM-DD): ese dia sale arriba
    location_id = Column(String(32), nullable=False, default=DISPATCH)  # donde quedo
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user_name = Column(String(120), nullable=False, default="")
    created_at = Column(DateTime(timezone=True), default=now, index=True)
    done_at = Column(DateTime(timezone=True), nullable=True, index=True)  # cuando salio
    done_by = Column(String(120), nullable=True)  # quien la saco
