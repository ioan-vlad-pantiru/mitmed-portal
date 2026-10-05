from decimal import ROUND_HALF_UP, Decimal

from app.models import Coupon, Therapy


class CouponError(Exception):
    pass


def round_money(value: Decimal) -> Decimal:
    """Rotunjește la bani (2 zecimale). Reducerea se rotunjește ÎNAINTE de a
    calcula totalul, ca preț = total + reducere să rămână exact după salvarea
    pe 2 zecimale (altfel ex. 12,345 + 87,655 devin 12,35 + 87,66)."""
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calculate_price(therapy: Therapy, coupon: Coupon | None, therapy_id: str) -> tuple[Decimal, Decimal, Decimal]:
    """Returnează (base_price, discount_amount, final_price). Oglindește lib/pricing.ts."""
    base_price = Decimal(therapy.price)

    if coupon is None:
        return base_price, Decimal(0), base_price

    if not coupon.active:
        raise CouponError("Acest cupon nu mai este activ.")

    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    if coupon.valid_from and now < coupon.valid_from:
        raise CouponError("Acest cupon nu este încă valabil.")
    if coupon.valid_until and now > coupon.valid_until:
        raise CouponError("Acest cupon a expirat.")
    if coupon.max_uses is not None and coupon.uses_count >= coupon.max_uses:
        raise CouponError("Acest cupon a fost deja folosit de numărul maxim de ori.")

    therapy_ids = {t.id for t in coupon.therapies}
    if therapy_ids and therapy_id not in therapy_ids:
        raise CouponError("Acest cupon nu se aplică terapiei selectate.")

    value = Decimal(coupon.value)
    if coupon.type.value == "PROCENT":
        discount_amount = round_money(base_price * value / Decimal(100))
    else:
        discount_amount = round_money(value)

    if discount_amount > base_price:
        discount_amount = base_price

    final_price = base_price - discount_amount
    return base_price, discount_amount, final_price
