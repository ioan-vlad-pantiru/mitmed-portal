"""The admin client list carries what staff scan for: visits, last and next
visit, money owed and whether a regular client has stopped coming."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.models import Appointment, AppointmentStatus, Payment, PaymentStatus


def test_client_list_summarises_each_client(client, db_session, make_admin_user, make_client_user, make_therapy):
    admin = make_admin_user()
    _, regular = make_client_user(email="ana@example.com", full_name="Ana")
    _, booked = make_client_user(email="ion@example.com", full_name="Ion")
    therapy = make_therapy()
    now = datetime.now(timezone.utc)

    def visit(profile, when, status=AppointmentStatus.FINALIZATA):
        db_session.add(Appointment(client_id=profile.id, therapy_id=therapy.id, created_by_id=admin.id, starts_at=when, status=status))

    visit(regular, now - timedelta(days=90))
    visit(regular, now - timedelta(days=60))
    visit(booked, now - timedelta(days=60))
    visit(booked, now - timedelta(days=50))
    visit(booked, now + timedelta(days=3), AppointmentStatus.PROGRAMATA)
    db_session.add(Payment(client_id=booked.id, therapy_id=therapy.id, base_price=Decimal(150), final_price=Decimal(150),
                           amount_paid=Decimal(50), status=PaymentStatus.PARTIAL))
    db_session.commit()

    resp = client.post("/auth/login", json={"identifier": "admin@example.com", "password": "parola123"})
    assert resp.status_code == 200
    rows = {r["full_name"]: r for r in client.get("/clients").json()}

    assert rows["Ana"]["visits"] == 2 and rows["Ana"]["at_risk"] is True and rows["Ana"]["next_visit"] is None
    assert rows["Ion"]["at_risk"] is False  # has a visit booked
    assert rows["Ion"]["next_visit"] is not None
    assert rows["Ion"]["amount_due"] == 100
