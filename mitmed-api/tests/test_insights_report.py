"""Period insights report: day / month / year / all, comparison with the
previous period, and the drill-down rows behind each number."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

from app.models import Appointment, AppointmentStatus, Payment, PaymentStatus

TZ = ZoneInfo("Europe/Bucharest")


def _login(client):
    resp = client.post("/auth/login", json={"identifier": "admin@example.com", "password": "parola123"})
    assert resp.status_code == 200, resp.text


def _visit(db, admin, profile, therapy, when, status=AppointmentStatus.FINALIZATA, paid=None):
    appt = Appointment(client_id=profile.id, therapy_id=therapy.id, created_by_id=admin.id, starts_at=when, status=status)
    db.add(appt)
    db.flush()
    if paid is not None:
        db.add(Payment(
            client_id=profile.id, therapy_id=therapy.id, appointment_id=appt.id, base_price=Decimal(paid),
            final_price=Decimal(paid), amount_paid=Decimal(paid), amount_paid_cash=Decimal(paid),
            status=PaymentStatus.PLATIT, paid_at=when,
        ))
    db.commit()
    return appt


def _seed(db_session, make_admin_user, make_client_user, make_therapy):
    admin = make_admin_user()
    _, ana = make_client_user(email="ana@example.com", full_name="Ana")
    _, ion = make_client_user(email="ion@example.com", full_name="Ion")
    kineto = make_therapy(name="Kineto")
    masaj = make_therapy(name="Masaj")
    # March 2025: Ana's first visit. April 2025: Ana comes back, Ion is new, one cancellation.
    _visit(db_session, admin, ana, kineto, datetime(2025, 3, 10, 10, tzinfo=TZ), paid=100)
    _visit(db_session, admin, ana, kineto, datetime(2025, 4, 2, 10, tzinfo=TZ), paid=150)
    _visit(db_session, admin, ion, masaj, datetime(2025, 4, 2, 11, tzinfo=TZ), paid=200)
    _visit(db_session, admin, ion, masaj, datetime(2025, 4, 3, 9, tzinfo=TZ), status=AppointmentStatus.ANULATA)
    return ana, ion, kineto, masaj


def test_month_report_compares_with_previous_month(client, db_session, make_admin_user, make_client_user, make_therapy):
    _seed(db_session, make_admin_user, make_client_user, make_therapy)
    _login(client)

    report = client.get("/insights/report", params={"scope": "month", "date": "2025-04-15"}).json()

    assert report["period"]["label"] == "Aprilie 2025"
    assert report["period"]["prev_anchor"] == "2025-03-01"
    cur, prev = report["current"], report["previous"]
    assert cur["revenue"] == 350 and prev["revenue"] == 100
    assert cur["sessions"] == 2 and cur["cancelled"] == 1
    assert cur["cancellation_rate"] == 33.3
    assert cur["active_clients"] == 2 and cur["returning_clients"] == 1
    assert report["methods"]["cash"] == 350
    assert [t["name"] for t in report["therapies"]] == ["Masaj", "Kineto"]
    assert report["therapies"][1]["prev_revenue"] == 100
    days = {b["key"]: b for b in report["series"]["buckets"]}
    assert len(days) == 30 and days["2025-04-02"]["revenue"] == 350 and days["2025-04-03"]["cancelled"] == 1


def test_day_year_and_all_scopes(client, db_session, make_admin_user, make_client_user, make_therapy):
    _seed(db_session, make_admin_user, make_client_user, make_therapy)
    _login(client)

    day = client.get("/insights/report", params={"scope": "day", "date": "2025-04-02"}).json()
    assert day["current"]["sessions"] == 2
    assert {b["key"]: b["sessions"] for b in day["series"]["buckets"]}["10"] == 1

    year = client.get("/insights/report", params={"scope": "year", "date": "2025-06-01"}).json()
    assert year["current"]["revenue"] == 450
    assert len(year["series"]["buckets"]) == 12

    everything = client.get("/insights/report", params={"scope": "all"}).json()
    assert everything["previous"] is None
    assert everything["current"]["revenue"] == 450


def test_drilldown_lists_rows_behind_numbers(client, db_session, make_admin_user, make_client_user, make_therapy):
    ana, ion, kineto, _ = _seed(db_session, make_admin_user, make_client_user, make_therapy)
    _login(client)
    params = {"scope": "month", "date": "2025-04-01"}

    revenue = client.get("/insights/drilldown", params={**params, "metric": "revenue"}).json()
    assert sorted(r["amount"] for r in revenue) == [150, 200]
    assert all(r["href"].startswith("/admin/clienti/") for r in revenue)

    returning = client.get("/insights/drilldown", params={**params, "metric": "returning_clients"}).json()
    assert [r["client_name"] for r in returning] == ["Ana"]

    therapy = client.get("/insights/drilldown", params={**params, "metric": "therapy", "therapy_id": kineto.id}).json()
    assert len(therapy) == 1 and therapy[0]["client_id"] == ana.id

    slot = client.get("/insights/drilldown", params={**params, "metric": "slot", "weekday": 2, "hour": 11}).json()
    assert [r["client_id"] for r in slot] == [ion.id]

    assert client.get("/insights/drilldown", params={**params, "metric": "nope"}).status_code == 404


def test_attention_flags_clients_who_stopped_coming(client, db_session, make_admin_user, make_client_user, make_therapy):
    admin = make_admin_user()
    _, ana = make_client_user(email="ana@example.com", full_name="Ana")
    therapy = make_therapy()
    now = datetime.now(timezone.utc)
    _visit(db_session, admin, ana, therapy, now - timedelta(days=120))
    _visit(db_session, admin, ana, therapy, now - timedelta(days=60))
    _visit(db_session, admin, ana, therapy, now - timedelta(days=2), status=AppointmentStatus.PROGRAMATA)
    _login(client)

    attention = client.get("/insights/report").json()["attention"]
    assert attention["at_risk_clients"] == 1
    assert attention["stale_unfinished"] == 1
    rows = client.get("/insights/drilldown", params={"metric": "at_risk"}).json()
    assert rows[0]["client_name"] == "Ana"
