from slowapi import Limiter
from slowapi.util import get_remote_address

# Instanță unică, importată atât de app/main.py (înregistrare middleware/handler)
# cât și de routerele care au nevoie de limite pe endpoint-uri specifice
# (auth, public) — separată în modul propriu ca să evite un import circular
# cu app/main.py, care la rândul lui importă routerele.
limiter = Limiter(key_func=get_remote_address)
