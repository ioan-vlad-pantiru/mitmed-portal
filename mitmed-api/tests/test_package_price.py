"""Prețul pachetului: reducerea dă un total rotunjit la leu întreg, iar adminul
poate edita totalul după aplicarea reducerii."""

from decimal import Decimal

from app.models import Coupon, CouponType
from app.services.pricing import calculate_price


def _login(client):
    resp = client.post("/auth/login", json={"identifier": "admin@example.com", "password": "parola123"})
    assert resp.status_code == 200, resp.text


def _create(client, therapy_id, **extra):
    resp = client.post(
        "/packages",
        json={"name": "Pachet 10", "discount_percent": 8, "items": [{"therapy_id": therapy_id, "sessions_included": 10}], **extra},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_discounted_total_rounds_to_nearest_leu(client, make_admin_user, make_therapy):
    make_admin_user(email="admin@example.com")
    therapy = make_therapy(price=129)  # 1290 - 8% = 1186.80
    _login(client)

    package = _create(client, therapy.id)
    assert package["discount_percent"] == "8.00"
    assert package["computed_price"] == "1187.00"
    assert package["price"] == "1187.00"
    assert package["price_override"] is None


def test_admin_can_edit_total_after_discount(client, make_admin_user, make_therapy, make_client_user):
    make_admin_user(email="admin@example.com")
    _, profile = make_client_user()
    therapy = make_therapy(price=129)
    _login(client)

    package = _create(client, therapy.id, price_override=1180)
    assert package["price"] == "1180.00"
    assert package["computed_price"] == "1187.00"

    # Vânzarea pachetului folosește totalul editat.
    resp = client.post("/payments", json={"client_id": profile.id, "package_id": package["id"]})
    assert resp.status_code == 200, resp.text
    payments = client.get(f"/clients/{profile.id}").json()["payments"]
    assert sum(Decimal(p["final_price"]) for p in payments) == Decimal("1180")

    # Fără total editat, revine la cel calculat.
    resp = client.put(
        f"/packages/{package['id']}",
        json={"name": "Pachet 10", "discount_percent": 8, "items": [{"therapy_id": therapy.id, "sessions_included": 10}]},
    )
    assert resp.json()["price"] == "1187.00"


def test_percent_coupon_rounds_discount_before_total(db_session, make_therapy):
    therapy = make_therapy(price=150.5)
    coupon = Coupon(code="X", type=CouponType.PROCENT, value=Decimal("8.30"), active=True)
    db_session.add(coupon)
    db_session.commit()

    base, discount, final = calculate_price(therapy, coupon, therapy.id)
    assert discount == Decimal("12.49")
    assert discount + final == base
