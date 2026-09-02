"""Seed inițial: cont ADMIN + catalogul de terapii de pe site. Idempotent."""

from app.config import settings
from app.database import SessionLocal
from app.models import AccountStatus, Role, Therapy, User
from app.security import hash_password

THERAPIES = [
    {"name": "Kinetoterapie", "description": "Program de exerciții terapeutice adaptat fiecărui pacient.", "duration_minutes": 45, "price": 120},
    {"name": "Fizioterapie", "description": "Tratament fizical pentru durere, inflamație și mobilitate redusă.", "duration_minutes": 30, "price": 100},
    {"name": "Masaj de specialitate", "description": "Masaj terapeutic pentru relaxare profundă și recuperare musculară.", "duration_minutes": 50, "price": 150},
    {"name": "Terapia Vacuum", "description": "Terapie prin presiune negativă pentru circulație și fermitatea țesutului.", "duration_minutes": 40, "price": 130},
    {"name": "Terapie Japoneză/Asiatică Yu Mei Ho", "description": "Terapie manuală asiatică pentru echilibru postural și eliberare a tensiunii profunde.", "duration_minutes": 60, "price": 180},
    {"name": "Terapie Dry Needling", "description": "Tratament țintit al punctelor de tensiune musculară, cu rezultate rapide pentru durerea cronică.", "duration_minutes": 30, "price": 140},
    {"name": "Stretching Thai", "description": "Mobilizare asistată a articulațiilor și mușchilor, pentru flexibilitate și recuperare posturală.", "duration_minutes": 60, "price": 160},
    {"name": "Modelare corporală", "description": "Program de modelare corporală susținut de pregătire medicală.", "duration_minutes": 45, "price": 150},
]


def main() -> None:
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == settings.seed_admin_email).first()
        if not existing:
            user = User(
                email=settings.seed_admin_email,
                password_hash=hash_password(settings.seed_admin_password),
                role=Role.ADMIN,
                status=AccountStatus.ACTIVE,
            )
            db.add(user)
            db.commit()
            print(f"Cont ADMIN creat: {settings.seed_admin_email} / {settings.seed_admin_password}")
            print("IMPORTANT: schimbă parola după prima autentificare.")
        else:
            print(f"Există deja un cont ADMIN cu emailul {settings.seed_admin_email} — nimic de făcut.")

        for t in THERAPIES:
            if db.query(Therapy).filter(Therapy.name == t["name"]).first():
                print(f"— există deja: {t['name']}")
                continue
            db.add(Therapy(**t))
            print(f"+ adăugată: {t['name']}")
        db.commit()
        print("\nDurate/prețuri sunt PLACEHOLDER — corectează-le din /admin/terapii.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
