import { ClipboardCheck } from "lucide-react";
import { getOwnConsents, listActiveConsentTemplates } from "@/actions/consents";
import { getOwnClientData } from "@/actions/clients";
import { WITHDRAWABLE_CATEGORY } from "@/lib/enums";
import { ConsentForm } from "../ConsentForm";
import { WithdrawConsentButton } from "../WithdrawConsentButton";
import { SignedConsentViewer } from "../SignedConsentViewer";
import { Badge } from "@/components/ui/Badge";

export default async function DocumentsPage() {
  const [consents, templates, raw] = await Promise.all([getOwnConsents(), listActiveConsentTemplates(), getOwnClientData()]); const client = raw as { full_name: string }; const signed = new Set(consents.map((item) => item.type)); const pending = templates.filter((item) => !signed.has(item.type));
  return <div className="portal-subpage"><header><p>Documente</p><h1>Declarațiile tale, mereu la îndemână.</h1><span>Verifică ce mai ai de semnat și vezi documentele deja confirmate.</span></header><section className="portal-feature-panel"><div className="portal-panel-title"><ClipboardCheck /><h2>De completat</h2></div>{pending.length ? <div className="space-y-5">{pending.map((item) => <ConsentForm key={item.type} type={item.type} title={item.label} consentText={item.text} clientName={client.full_name} />)}</div> : <p className="portal-quiet">Nu ai documente de semnat acum.</p>}</section><section className="portal-feature-panel"><div className="portal-panel-title"><ClipboardCheck /><h2>Semnate</h2></div><div className="space-y-2">{consents.map((item) => { const template = templates.find((t) => t.type === item.type); const label = template?.label ?? item.type; const withdrawable = template?.category === WITHDRAWABLE_CATEGORY; return <div key={item.id} className="flex flex-wrap items-center gap-2">{item.withdrawn_at ? <Badge variant="warning">{label} · retras {new Date(item.withdrawn_at).toLocaleDateString("ro-RO")}</Badge> : <><Badge variant="success">{label} · {new Date(item.signed_at).toLocaleDateString("ro-RO")}</Badge>{withdrawable && <WithdrawConsentButton consentId={item.id} />}</>}<SignedConsentViewer label={label} text={item.version_text} signedAt={item.signed_at} signatureDataUrl={item.signature_data_url} /></div>; })}{!consents.length && <p className="portal-quiet">Nu ai documente semnate încă.</p>}</div><p className="mt-3 text-xs text-zinc-400">Doar acordul de prelucrare a datelor (GDPR) poate fi retras oricând — celelalte declarații (ex. risc și preț) rămân valabile, ca dovadă a ceea ce ai fost informat/ă și ai acceptat.</p></section></div>;
}
