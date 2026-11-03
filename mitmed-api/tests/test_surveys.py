"""Sondajul de satisfacție: clientul evaluează ultima vizită o singură dată,
adminul gestionează întrebările și vede rezultatele."""

from datetime import datetime, timedelta, timezone

from app.models import Appointment, AppointmentStatus, SurveyQuestion, SurveyResponse


def _login(client, email):
    resp = client.post("/auth/login", json={"identifier": email, "password": "parola123"})
    assert resp.status_code == 200, resp.text


def _logout(client):
    client.cookies.clear()


def _setup(db_session, make_admin_user, make_client_user, make_therapy, status=AppointmentStatus.FINALIZATA):
    admin = make_admin_user(email="admin@example.com")
    _, profile = make_client_user()
    therapy = make_therapy()
    appointment = Appointment(
        client_id=profile.id, therapy_id=therapy.id, created_by_id=admin.id,
        starts_at=datetime.now(timezone.utc) - timedelta(days=1), status=status,
    )
    overall = SurveyQuestion(id="q_overall", label="Per total?", kind="rating", required=True, position=0)
    recommend = SurveyQuestion(id="q_rec", label="Ne recomanzi?", kind="choice", options=["Da", "Nu"], position=1)
    liked = SurveyQuestion(id="q_liked", label="Ce ți-a plăcut?", kind="multi", options=["Terapeut", "Curățenie"], position=2)
    comment = SurveyQuestion(id="q_comment", label="Ce am putea face mai bine?", kind="text", position=3)
    db_session.add_all([appointment, overall, recommend, liked, comment])
    db_session.commit()
    return profile, appointment


def test_client_rates_last_visit_once(client, db_session, make_admin_user, make_client_user, make_therapy):
    profile, appointment = _setup(db_session, make_admin_user, make_client_user, make_therapy)
    _login(client, "admin@example.com")
    client.put("/survey/settings", json={"enabled": True, "google_review_url": "https://g.page/r/mitmed/review"})
    _logout(client)

    _login(client, "client@example.com")
    survey = client.get("/survey/me").json()
    assert survey["enabled"] is True
    assert survey["pending"]["appointment_id"] == appointment.id
    assert [q["id"] for q in survey["questions"]] == ["q_overall", "q_rec", "q_liked", "q_comment"]

    resp = client.post("/survey/me", json={
        "appointment_id": appointment.id,
        "answers": {"q_overall": 5, "q_rec": "Da", "q_liked": ["Terapeut", "Curățenie"], "q_comment": "  Totul ok  ", "x": 1},
    })
    assert resp.status_code == 200, resp.text
    # Linkul Google e arătat după trimitere.
    assert resp.json()["google_review_url"] == "https://g.page/r/mitmed/review"

    saved = db_session.query(SurveyResponse).one()
    assert saved.answers == {"q_overall": 5, "q_rec": "Da", "q_liked": ["Terapeut", "Curățenie"], "q_comment": "Totul ok"}
    assert client.get("/survey/me").json()["pending"] is None

    again = client.post("/survey/me", json={"appointment_id": appointment.id, "answers": {"q_overall": 1}})
    assert again.status_code == 409


def test_answers_are_validated(client, db_session, make_admin_user, make_client_user, make_therapy):
    _, appointment = _setup(db_session, make_admin_user, make_client_user, make_therapy)
    _login(client, "client@example.com")

    def post(answers):
        return client.post("/survey/me", json={"appointment_id": appointment.id, "answers": answers}).status_code

    assert post({"q_rec": "Da"}) == 422  # lipsește întrebarea obligatorie
    assert post({"q_overall": 6}) == 422
    assert post({"q_overall": 4, "q_rec": "Poate"}) == 422
    assert post({"q_overall": 4, "q_liked": ["Parcare"]}) == 422
    assert post({"q_overall": 4}) == 200


def test_only_finished_own_visits_can_be_rated(client, db_session, make_admin_user, make_client_user, make_therapy):
    _, appointment = _setup(db_session, make_admin_user, make_client_user, make_therapy, status=AppointmentStatus.PROGRAMATA)
    make_client_user(email="altul@example.com", full_name="Alt Client")

    _login(client, "client@example.com")
    assert client.get("/survey/me").json()["pending"] is None
    assert client.post("/survey/me", json={"appointment_id": appointment.id, "answers": {"q_overall": 5}}).status_code == 409
    _logout(client)

    appointment.status = AppointmentStatus.FINALIZATA
    db_session.commit()
    _login(client, "altul@example.com")
    assert client.post("/survey/me", json={"appointment_id": appointment.id, "answers": {"q_overall": 5}}).status_code == 404


def test_disabled_survey_is_not_offered(client, db_session, make_admin_user, make_client_user, make_therapy):
    _, appointment = _setup(db_session, make_admin_user, make_client_user, make_therapy)
    _login(client, "admin@example.com")
    client.put("/survey/settings", json={"enabled": False})
    _logout(client)

    _login(client, "client@example.com")
    survey = client.get("/survey/me").json()
    assert survey["enabled"] is False and survey["pending"] is None
    assert client.post("/survey/me", json={"appointment_id": appointment.id, "answers": {"q_overall": 5}}).status_code == 409


def test_admin_manages_questions_and_keeps_old_answers(client, db_session, make_admin_user, make_client_user, make_therapy):
    _, appointment = _setup(db_session, make_admin_user, make_client_user, make_therapy)
    _login(client, "client@example.com")
    client.post("/survey/me", json={"appointment_id": appointment.id, "answers": {"q_overall": 4, "q_rec": "Da"}})
    _logout(client)

    _login(client, "admin@example.com")
    created = client.post("/survey/questions", json={"label": "Parcarea?", "kind": "choice", "options": ["Ușor", "Greu", "Ușor"]})
    assert created.status_code == 200, created.text
    assert created.json()["options"] == ["Ușor", "Greu"]
    assert client.post("/survey/questions", json={"label": "X", "kind": "choice", "options": ["Doar una"]}).status_code == 422

    # Fără răspunsuri: se șterge de tot. Cu răspunsuri: se arhivează.
    assert client.delete(f"/survey/questions/{created.json()['id']}").json()["outcome"] == "deleted"
    assert client.delete("/survey/questions/q_rec").json()["outcome"] == "archived"
    assert client.put("/survey/questions/q_overall", json={"label": "Per total", "kind": "text"}).status_code == 409

    results = client.get("/survey/results").json()
    assert results["total_responses"] == 1
    assert results["average_rating"] == 4
    by_id = {q["id"]: q for q in results["questions"]}
    assert by_id["q_rec"]["archived"] is True
    assert {"label": "Da", "count": 1} in by_id["q_rec"]["distribution"]
    assert results["responses"][0]["client"]["full_name"] == "Client Test"
    _logout(client)

    _login(client, "client@example.com")
    assert "q_rec" not in [q["id"] for q in client.get("/survey/me").json()["questions"]]


def test_reorder_questions(client, db_session, make_admin_user, make_client_user, make_therapy):
    _setup(db_session, make_admin_user, make_client_user, make_therapy)
    _login(client, "admin@example.com")
    client.post("/survey/questions/q_rec/move", json={"direction": "up"})
    ids = [q["id"] for q in client.get("/survey/questions").json()]
    assert ids[:2] == ["q_rec", "q_overall"]


def test_staff_and_clients_cannot_see_other_endpoints(client, db_session, make_admin_user, make_client_user, make_therapy):
    _setup(db_session, make_admin_user, make_client_user, make_therapy)
    make_admin_user(email="receptie@example.com", role="RECEPTIE")
    _login(client, "client@example.com")
    assert client.get("/survey/results").status_code == 403
    assert client.post("/survey/questions", json={"label": "X"}).status_code == 403
    _logout(client)
    _login(client, "receptie@example.com")
    assert client.get("/survey/results").status_code == 403
    assert client.get("/survey/me").status_code == 403
