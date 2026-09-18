from app.models import Payment
from app.services.packages import consume_package_session


def _make_package_payment(db_session, client_id: str, therapy_id: str, total_sessions: int, used: int = 0):
    payment = Payment(
        client_id=client_id,
        therapy_id=therapy_id,
        base_price=100,
        discount_amount=0,
        final_price=100,
        package_total_sessions=total_sessions,
        sessions_used=used,
    )
    db_session.add(payment)
    db_session.commit()
    db_session.refresh(payment)
    return payment


def test_consume_package_session_increments_oldest_unfinished_package(db_session, make_client_user, make_therapy):
    _, client = make_client_user()
    therapy = make_therapy()
    package = _make_package_payment(db_session, client.id, therapy.id, total_sessions=3, used=0)

    result = consume_package_session(db_session, client_id=client.id, therapy_id=therapy.id)

    assert result.id == package.id
    assert result.sessions_used == 1


def test_consume_package_session_stops_at_total(db_session, make_client_user, make_therapy):
    _, client = make_client_user()
    therapy = make_therapy()
    _make_package_payment(db_session, client.id, therapy.id, total_sessions=1, used=1)

    result = consume_package_session(db_session, client_id=client.id, therapy_id=therapy.id)

    assert result is None


def test_consume_package_session_moves_to_next_package_once_first_is_exhausted(db_session, make_client_user, make_therapy):
    _, client = make_client_user()
    therapy = make_therapy()
    exhausted = _make_package_payment(db_session, client.id, therapy.id, total_sessions=1, used=1)
    fresh = _make_package_payment(db_session, client.id, therapy.id, total_sessions=2, used=0)

    result = consume_package_session(db_session, client_id=client.id, therapy_id=therapy.id)

    assert result.id == fresh.id
    assert exhausted.sessions_used == 1  # neatins
