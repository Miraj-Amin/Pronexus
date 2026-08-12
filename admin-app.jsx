/* ===========================================================================
   PHOENIX ADMIN — funder & core parameter editor
   Lets a Principal edit the lending limits used by both the Bridging and
   Development Finance eligibility engines (bridging-engine.js /
   development-engine.js DEFAULT_PRODUCT_PARAMS / DEFAULT_CORE_PARAMS)
   without a code deploy. Writes go through each module's own
   setProductParam/setCoreParam, which merge on top of the shipped defaults
   — nothing here mutates the engine files themselves, so "reset to shipped
   defaults" is always available and safe.
   =========================================================================== */
function AdminRoleGate({ role, children }) {
  const allowed = role === 'Admin' || role === 'Principal';
  if (allowed) return children;
  return (
    <div className="phxb-panel" style={{ textAlign: 'center' }}>
      <div className="phxb-badge red" style={{ marginBottom: 10 }}>Restricted</div>
      <div style={{ color: 'var(--muted)', fontSize: 13 }}>
        Editing funder parameters requires the Admin or Principal role. Switch role above to view or make changes.
      </div>
    </div>
  );
}

function ParamProductTable({ moduleLabel, E, DB, tick, bump }) {
  const live = DB.getEffectiveProductParams();
  const core = DB.getEffectiveCoreParams();
  const overridden = DB.hasAdminOverrides();

  const setP = (product, field, raw) => {
    const value = raw === '' ? null : (field === 'pricing' || field === 'note' ? raw : parseFloat(raw));
    DB.setProductParam(product, field, value);
    bump();
  };
  const setC = (field, raw) => {
    const value = ['minLoan', 'maxLoan', 'minFacility', 'maxFacility', 'maxTermMonths'].indexOf(field) !== -1 ? parseFloat(raw) : parseFloat(raw);
    DB.setCoreParam(field, isNaN(value) ? raw : value);
    bump();
  };

  const coreFields = Object.keys(core).filter(k => typeof core[k] === 'number');

  return (
    <div className="phxb-panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>{moduleLabel} — product limits</h3>
        {overridden ? <span className="phxb-badge amber">Overrides active</span> : <span className="phxb-badge grey">Shipped defaults</span>}
      </div>
      <div className="sub">Editing here changes what the eligibility screen tests against immediately — no deploy required. "Reset" discards overrides and returns to the shipped defaults from the procedure.</div>
      <table className="phxb-table">
        <thead><tr><th>Product</th><th style={{ width: 100 }}>Day 1 LTV</th><th style={{ width: 100 }}>Gross LTV</th><th style={{ width: 100 }}>LTC</th><th style={{ width: 130 }}>Indicative pricing</th><th>Note</th></tr></thead>
        <tbody>
          {Object.keys(live).map(product => {
            const p = live[product];
            return (
              <tr key={product}>
                <td>{product}</td>
                <td><input type="number" step="0.01" style={{ width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border-strong)', color: 'var(--ink)', borderRadius: 4, padding: '4px 6px', fontSize: 12 }}
                  value={p.day1Ltv == null ? '' : p.day1Ltv} onChange={e => setP(product, 'day1Ltv', e.target.value)} /></td>
                <td><input type="number" step="0.01" style={{ width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border-strong)', color: 'var(--ink)', borderRadius: 4, padding: '4px 6px', fontSize: 12 }}
                  value={p.grossLtv == null ? '' : p.grossLtv} onChange={e => setP(product, 'grossLtv', e.target.value)} /></td>
                <td><input type="number" step="0.01" style={{ width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border-strong)', color: 'var(--ink)', borderRadius: 4, padding: '4px 6px', fontSize: 12 }}
                  value={p.ltc == null ? '' : p.ltc} onChange={e => setP(product, 'ltc', e.target.value)} /></td>
                <td><input style={{ width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border-strong)', color: 'var(--ink)', borderRadius: 4, padding: '4px 6px', fontSize: 12 }}
                  value={p.pricing || ''} onChange={e => setP(product, 'pricing', e.target.value)} /></td>
                <td><input style={{ width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border-strong)', color: 'var(--ink)', borderRadius: 4, padding: '4px 6px', fontSize: 12 }}
                  value={p.note || ''} onChange={e => setP(product, 'note', e.target.value)} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h4 style={{ marginTop: 18, marginBottom: 8, fontSize: 12.5 }}>{moduleLabel} — core parameters</h4>
      <div className="phxb-grid3">
        {coreFields.map(k => (
          <div className="phxb-field" key={k}>
            <label>{k}</label>
            <input type="number" step="0.01" value={core[k]} onChange={e => setC(k, e.target.value)} />
          </div>
        ))}
      </div>

      <button className="phxb-btn danger" style={{ marginTop: 10 }} disabled={!overridden}
        onClick={() => { if (confirm('Reset ' + moduleLabel + ' parameters to the shipped defaults? This discards all overrides.')) { DB.resetProductParams ? DB.resetProductParams() : null; bump(); } }}>
        Reset to shipped defaults
      </button>
    </div>
  );
}

function OrgAuditPanel({ label, DB, tick }) {
  const log = DB.getOrgAudit ? DB.getOrgAudit() : [];
  return (
    <div className="phxb-panel">
      <h3>{label} — parameter change log</h3>
      {log.length === 0 ? <div className="phxb-empty">No changes made yet — parameters are at shipped defaults.</div> : (
        <table className="phxb-table">
          <thead><tr><th style={{ width: 160 }}>When</th><th>User</th><th>Change</th><th>New value</th></tr></thead>
          <tbody>
            {log.map(e => (
              <tr key={e.id}>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>{new Date(e.ts).toLocaleString('en-GB')}</td>
                <td>{e.user}</td>
                <td>{e.action}</td>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{JSON.stringify(e.after)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PhoenixAdminApp() {
  const [tick, setTick] = React.useState(0);
  const [role, setRole] = React.useState('Principal');
  const [moduleTab, setModuleTab] = React.useState('bridging');
  const bump = () => setTick(t => t + 1);

  return (
    <div className="phxb">
      <div className="phxb-topbar">
        <div className="phxb-brand"><div className="mk">AD</div>Admin <span style={{ opacity: .5, fontWeight: 400 }}>· Funder &amp; core parameters</span></div>
        <div className="phxb-spacer" />
        <select value={role} onChange={e => setRole(e.target.value)}
          style={{ background: 'var(--surface-3)', border: '1px solid var(--border-strong)', color: 'var(--ink)', fontFamily: 'var(--mono)', fontSize: 11, padding: '6px 10px', borderRadius: 5 }}
          title="Acting role — demo role switcher, independent of the Bridging/Development role switchers">
          {['Admin', 'Principal', 'Deal Lead', 'Viewer'].map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div className="phxb-main">
        <div className="phxb-tabs">
          <button className={moduleTab === 'bridging' ? 'active' : ''} onClick={() => setModuleTab('bridging')}>Bridging</button>
          <button className={moduleTab === 'development' ? 'active' : ''} onClick={() => setModuleTab('development')}>Development Finance</button>
        </div>
        <AdminRoleGate role={role}>
          {moduleTab === 'bridging' ? (
            <React.Fragment>
              <ParamProductTable moduleLabel="Bridging" E={window.PhoenixBridging} DB={window.PhoenixBridgingDB} tick={tick} bump={bump} />
              <OrgAuditPanel label="Bridging" DB={window.PhoenixBridgingDB} tick={tick} />
            </React.Fragment>
          ) : (
            <React.Fragment>
              <ParamProductTable moduleLabel="Development Finance" E={window.PhoenixDevelopment} DB={window.PhoenixDevelopmentDB} tick={tick} bump={bump} />
              <OrgAuditPanel label="Development Finance" DB={window.PhoenixDevelopmentDB} tick={tick} />
            </React.Fragment>
          )}
        </AdminRoleGate>
      </div>
    </div>
  );
}

window.PhoenixAdminApp = PhoenixAdminApp;
