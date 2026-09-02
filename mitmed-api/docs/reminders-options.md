# Remindere de programare — opțiuni gratuite

## Rezumat

Nu există WhatsApp oficial gratuit pentru mesaje trimise de cabinet (remindere).
Există alternative reale, gratuite, dar fiecare cu un compromis.

## Comparație

| Opțiune | Cost | Cum funcționează | Risc / limitare |
|---|---|---|---|
| **Email** | Gratuit (Resend: 3000/lună, pe vecie) | API cheie, trimis din serverul nostru | Segmentul 50+ verifică emailul mai rar |
| **SMS — Textbee** | Gratuit (300/lună) | Un telefon Android al cabinetului, cu orice cartelă SIM, devine gateway SMS | Telefonul trebuie să rămână pornit + conectat la net, permanent, la cabinet |
| **WhatsApp — Baileys/whatsapp-web.js** (neoficial) | Gratuit | Se conectează pe numărul de WhatsApp al cabinetului, ca WhatsApp Web | **Risc real de BAN** — numărul poate fi blocat de Meta în 2-8 săptămâni dacă trimite automat, chiar dacă mesajele sunt "remindere", nu spam. Un ban afectează și WhatsApp-ul folosit acum pentru contact cu clienții (CTA de pe site) |
| **WhatsApp Cloud API oficial** | **Plătit** | API-ul oficial Meta, prin propriul cont Business | Sigur, dar nu e gratuit — mesajele de tip "utility" (remindere) în afara ferestrei de 24h se taxează per mesaj |

## De ce nu recomand WhatsApp gratuit (Baileys)

E gratuit azi, dar riscul e mare și costul unui ban e mult mai mare decât economia:
dacă se blochează numărul de WhatsApp al cabinetului, se pierde și canalul folosit
acum pentru contact direct cu clienții (link-ul de pe site). Nu recomand asta
pentru un cabinet medical care depinde de încrederea clienților.

## Recomandare

**Email (Resend) ca principal, SMS (Textbee) ca variantă suplimentară** pentru
clienții fără email sau din segmentul 50+ — ambele gratuite, fără riscul de ban
de pe WhatsApp. Dacă mai târziu vrei neapărat WhatsApp, varianta corectă e API-ul
oficial Meta (plătit, dar sigur) — nu varianta neoficială.

## Ce trebuie să faci tu, dacă alegi una din ele

- **Resend**: cont gratuit pe resend.com, generezi o cheie API, mi-o dai (env var)
- **Textbee**: instalezi aplicația Textbee pe un telefon Android vechi cu o cartelă
  SIM prepay, îl lași conectat la net la cabinet, generezi o cheie API din contul
  Textbee
