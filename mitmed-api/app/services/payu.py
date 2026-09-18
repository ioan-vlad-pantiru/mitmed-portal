"""Integrare PayU Romania (PayU GPO Europe REST API) — pagina de plată
găzduită ("hosted checkout"). Fluxul complet:

1. routers/payments.py creează o comandă PayU pentru o plată/pachet
   neîncasat și redirecționează clientul către `redirect_url`.
2. Clientul plătește pe pagina PayU (cardul nu trece niciodată prin
   serverele noastre — conformitate PCI e responsabilitatea PayU).
3. PayU trimite o notificare server-to-server pe /webhooks/payu, singura
   sursă de adevăr pentru marcarea plății ca achitată (redirectUrl-ul de
   întoarcere NU e dovadă de plată — poate fi întrerupt de client).

Rămâne neconfigurat (ridică PayuError) până când PAYU_POS_ID/
PAYU_CLIENT_SECRET/PAYU_SECOND_KEY sunt completate în .env — vezi
config.Settings.
"""

import hashlib
import time

from app.config import settings

_token_cache: dict[str, float | str] = {}


class PayuError(Exception):
    """Eroare de comunicare cu PayU sau configurare lipsă — mesajul e sigur
    de arătat direct utilizatorului (nu conține secrete)."""


def _is_configured() -> bool:
    return bool(settings.payu_pos_id and settings.payu_client_secret and settings.payu_second_key)


def _get_access_token() -> str:
    import requests

    now = time.monotonic()
    cached_token = _token_cache.get("token")
    cached_expiry = _token_cache.get("expires_at")
    if cached_token and isinstance(cached_expiry, float) and cached_expiry > now:
        return str(cached_token)

    resp = requests.post(
        f"{settings.payu_base_url}/pl/standard/user/oauth/authorize",
        data={
            "grant_type": "client_credentials",
            "client_id": settings.payu_pos_id,
            "client_secret": settings.payu_client_secret,
        },
        timeout=10,
    )
    if not resp.ok:
        raise PayuError(f"Autentificare PayU eșuată ({resp.status_code}).")
    data = resp.json()
    token = data["access_token"]
    # -60s marjă de siguranță față de expirarea reală, ca să nu folosim un
    # token expirat chiar la limită într-o cerere care pornește la timp.
    _token_cache["token"] = token
    _token_cache["expires_at"] = now + int(data.get("expires_in", 3000)) - 60
    return str(token)


def create_order(
    *,
    ext_order_id: str,
    total_amount_bani: int,
    description: str,
    customer_ip: str,
    buyer_email: str | None,
    notify_url: str,
    continue_url: str,
) -> dict:
    """Creează o comandă PayU. Întoarce {"redirect_url": ..., "order_id": ...}."""
    import requests

    if not _is_configured():
        raise PayuError("Plata online nu este configurată încă — contactează administratorul.")

    token = _get_access_token()
    payload: dict = {
        "notifyUrl": notify_url,
        "continueUrl": continue_url,
        "customerIp": customer_ip,
        "merchantPosId": settings.payu_pos_id,
        "description": description,
        "extOrderId": ext_order_id,
        "currencyCode": "RON",
        "totalAmount": str(total_amount_bani),
    }
    if buyer_email:
        payload["buyer"] = {"email": buyer_email, "language": "ro"}

    # allow_redirects=False — altfel clientul HTTP urmărește automat 302-ul
    # către pagina de plată HTML în loc să întoarcă JSON-ul cu redirectUri.
    resp = requests.post(
        f"{settings.payu_base_url}/api/v2_1/orders",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
        allow_redirects=False,
    )
    if resp.status_code not in (200, 201, 302):
        raise PayuError(f"PayU a refuzat comanda ({resp.status_code}).")

    data = resp.json()
    redirect_url = data.get("redirectUri")
    if not redirect_url:
        raise PayuError("PayU nu a întors o adresă de plată.")
    return {"redirect_url": redirect_url, "order_id": data.get("orderId")}


def verify_signature(raw_body: bytes, signature_header: str | None) -> bool:
    """Verifică header-ul OpenPayU-Signature: MD5(body + a-doua-cheie) trebuie
    să coincidă cu valoarea trimisă — singura garanție că notificarea vine
    într-adevăr de la PayU și n-a fost falsificată/alterată pe drum."""
    if not signature_header or not settings.payu_second_key:
        return False

    parts = dict(item.strip().split("=", 1) for item in signature_header.split(";") if "=" in item)
    signature = parts.get("signature")
    algorithm = parts.get("algorithm", "MD5").upper()
    if not signature or algorithm != "MD5":
        return False

    expected = hashlib.md5(raw_body + settings.payu_second_key.encode()).hexdigest()
    return expected == signature
