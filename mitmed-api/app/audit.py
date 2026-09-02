from sqlalchemy.orm import Session as DBSession

from app.models import AuditLog


def log_audit(
    db: DBSession, *, actor_id: str, action: str, target_type: str, target_id: str, metadata: dict | None = None
) -> None:
    db.add(
        AuditLog(
            actor_id=actor_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            audit_metadata=metadata,
        )
    )
    db.commit()
