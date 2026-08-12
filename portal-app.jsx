/* ===========================================================================
   PHOENIX CLIENT PORTAL
   Reached via ?portal=TOKEN (see app.jsx), bypassing the internal Supabase
   auth entirely — this is the client-facing surface, not an internal tool.
   It deliberately shows less than the internal deal workspace: stage,
   status, next action, and an upload area for outstanding KYC / information
   pack items. No fees, no funder terms, no internal notes, no gate controls.

   This is the UI-side implementation of the "narrower RLS policy set for
   Client Portal User" principle from db/bridging_schema.sql — real
   enforcement of that boundary belongs in Postgres RLS once this moves off
   localStorage; here, the boundary is enforced by this component simply
   never reading or rendering the restricted fields, not by an auth check.
   =========================================================================== */
function resolvePortalInvite(token) {
  const B = window.PhoenixBridgingDB, D = window.PhoenixDevelopmentDB;
  if (B) { const hit = B.findPortalInviteByToken(token); if (hit) return { module: 'bridging', DB: B, E: window.PhoenixBridging, ...hit }; }
  if (D) { const hit = D.findPortalInviteByToken(token); if (hit) return { module: 'development', DB: D, E: window.PhoenixDevelopment, ...hit }; }
  return null;
}

function PortalUploadRow({ label, requirement, received, onUpload, uploading }) {
  return (
    <div className="phxb-task" style={{ alignItems: 'center' }}>
      <div className="title">
        {label}
        {requirement ? <div style={{ fontSize: 10.5, color: 'var(--muted-2)' }}>{requirement}</div> : null}
      </div>
      {received ? (
        <span className="phxb-badge ok">Received</span>
      ) : (
        <label className="phxb-btn primary" style={{ cursor: uploading ? 'wait' : 'pointer', opacity: uploading ? .6 : 1 }}>
          {uploading ? 'Uploading…' : 'Upload'}
          <input type="file" style={{ display: 'none' }} disabled={uploading} onChange={onUpload} />
        </label>
      )}
    </div>
  );
}

function BridgingPortalItems({ dealId, deal, DB, E }) {
  const [tick, setTick] = React.useState(0);
  const [busyRef, setBusyRef] = React.useState(null);
  const kyc = DB.getKyc(dealId) || {};

  async function upload(item, file) {
    setBusyRef(item.ref);
    try {
      const version = DB.nextDocVersion(dealId, '02_KYC_AML', item.document);
      const result = await window.PhoenixBridgingStorage.uploadDocument({ file, orgId: DB.load().org.id, dealRef: deal.dealRef, folder: '02_KYC_AML', docType: item.document, version });
      if (result.ok) {
        DB.addDocument(dealId, { folder: '02_KYC_AML', docType: item.document, fileName: file.name, mimeType: file.type, size: file.size, storagePath: result.storagePath || null, dataUrl: result.dataUrl || null, url: result.url || null, notes: 'Uploaded via client portal' });
        DB.setKycItem(dealId, item.ref, { received: true, dateReceived: new Date().toISOString().slice(0, 10), notes: 'Uploaded via client portal' });
      }
    } finally {
      setBusyRef(null);
      setTick(t => t + 1);
    }
  }

  const outstanding = E.KYC_ITEMS.filter(i => !(kyc[i.ref] || {}).received);
  const received = E.KYC_ITEMS.length - outstanding.length;

  return (
    <div className="phxb-panel">
      <h3>Documents we still need</h3>
      <div className="sub">{received} of {E.KYC_ITEMS.length} received. Upload each item below — we'll confirm once it's checked.</div>
      {outstanding.length === 0 ? (
        <div className="phxb-empty">Everything we've asked for has been received — thank you.</div>
      ) : outstanding.map(item => (
        <PortalUploadRow key={item.ref} label={item.document} requirement={item.requirement}
          received={false} uploading={busyRef === item.ref}
          onUpload={e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) upload(item, f); }} />
      ))}
    </div>
  );
}

function DevelopmentPortalItems({ dealId, deal, DB, E }) {
  const [tick, setTick] = React.useState(0);
  const [busyRef, setBusyRef] = React.useState(null);
  const pack = DB.getInfoPack(dealId) || {};

  async function upload(item, file) {
    setBusyRef(item.n);
    try {
      const version = DB.nextDocVersion(dealId, '01_Initial_Enquiry', item.item);
      const result = await window.PhoenixBridgingStorage.uploadDocument({ file, orgId: DB.load().org.id, dealRef: deal.dealRef, folder: '01_Initial_Enquiry', docType: item.item, version });
      if (result.ok) {
        DB.addDocument(dealId, { folder: '01_Initial_Enquiry', docType: item.item, fileName: file.name, mimeType: file.type, size: file.size, storagePath: result.storagePath || null, dataUrl: result.dataUrl || null, url: result.url || null, notes: 'Uploaded via client portal' });
        DB.setInfoPackItem(dealId, item.n, { received: true, date: new Date().toISOString().slice(0, 10), source: 'Client portal' });
      }
    } finally {
      setBusyRef(null);
      setTick(t => t + 1);
    }
  }

  const outstanding = E.INFO_PACK_ITEMS.filter(i => !(pack[i.n] || {}).received);
  const received = E.INFO_PACK_ITEMS.length - outstanding.length;

  return (
    <div className="phxb-panel">
      <h3>Information we still need</h3>
      <div className="sub">{received} of {E.INFO_PACK_ITEMS.length} received across the development, commercial and borrower streams.</div>
      {outstanding.length === 0 ? (
        <div className="phxb-empty">Everything we've asked for has been received — thank you.</div>
      ) : outstanding.map(item => (
        <PortalUploadRow key={item.n} label={item.item} requirement={item.stream}
          received={false} uploading={busyRef === item.n}
          onUpload={e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) upload(item, f); }} />
      ))}
    </div>
  );
}

function PortalStatusTimeline({ deal, E }) {
  const currentIdx = deal.stage;
  return (
    <div className="phxb-panel">
      <h3>Where things stand</h3>
      <div className="sub">A plain-English view of progress — for the full picture, speak to your Deal Lead.</div>
      {E.STAGES.map(s => {
        const done = s.n < currentIdx;
        const active = s.n === currentIdx;
        return (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%', flex: 'none',
              background: done ? 'var(--ok)' : active ? 'var(--green-500)' : 'var(--surface-3)',
              border: active ? '2px solid var(--green-500)' : '1px solid var(--border-strong)',
            }} />
            <div style={{ fontSize: 13, color: active ? 'var(--ink)' : done ? 'var(--muted)' : 'var(--muted-2)', fontWeight: active ? 600 : 400 }}>{s.label}</div>
            {active ? <span className="phxb-badge cyan" style={{ marginLeft: 'auto' }}>Current stage</span> : null}
          </div>
        );
      })}
    </div>
  );
}

function PortalDealView({ dealId, deal, module, DB, E }) {
  return (
    <div>
      <div className="phxb-header">
        <div className="row1"><span className="ref">{deal.dealRef}</span><h2>{deal.borrowingEntity || 'Your deal'}</h2></div>
        <div className="addr">{module === 'bridging' ? deal.securityAddress : deal.siteAddress}</div>
        <div className="row2">
          <div className="kv"><div className="l">Status</div><div className="v">{deal.status}</div></div>
          <div className="kv"><div className="l">Next action</div><div className="v">{deal.nextAction || '—'}</div></div>
          <div className="kv"><div className="l">Expected by</div><div className="v">{E.fmt.date(deal.nextActionDue)}</div></div>
        </div>
      </div>
      <PortalStatusTimeline deal={deal} E={E} />
      {module === 'bridging'
        ? <BridgingPortalItems dealId={dealId} deal={deal} DB={DB} E={E} />
        : <DevelopmentPortalItems dealId={dealId} deal={deal} DB={DB} E={E} />}
      <div className="phxb-empty">Questions about anything above? Contact your Deal Lead directly — this portal doesn't send messages.</div>
    </div>
  );
}

function PhoenixPortalApp({ token }) {
  const [resolved] = React.useState(() => resolvePortalInvite(token));
  React.useEffect(() => {
    if (resolved && resolved.DB.acceptPortalInvite && !resolved.invite.acceptedAt) {
      resolved.DB.acceptPortalInvite(token);
    }
  }, []);

  if (!resolved) {
    return (
      <div className="phxb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="phxb-panel" style={{ maxWidth: 420, textAlign: 'center' }}>
          <h3>Link not recognised</h3>
          <div className="sub">This portal link is invalid or has expired. Please contact your Deal Lead for a new one.</div>
        </div>
      </div>
    );
  }

  const deal = resolved.DB.getDeal(resolved.dealId);
  if (!deal) {
    return (
      <div className="phxb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="phxb-panel" style={{ maxWidth: 420, textAlign: 'center' }}><h3>Deal not found</h3></div>
      </div>
    );
  }

  return (
    <div className="phxb">
      <div className="phxb-topbar">
        <div className="phxb-brand"><div className="mk">P</div>Phoenix <span style={{ opacity: .5, fontWeight: 400 }}>· Client Portal</span></div>
        <div className="phxb-spacer" />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--muted-2)' }}>{resolved.invite.email}</span>
      </div>
      <div className="phxb-main" style={{ maxWidth: 760 }}>
        <PortalDealView dealId={resolved.dealId} deal={deal} module={resolved.module} DB={resolved.DB} E={resolved.E} />
      </div>
    </div>
  );
}

window.PhoenixPortalApp = PhoenixPortalApp;
