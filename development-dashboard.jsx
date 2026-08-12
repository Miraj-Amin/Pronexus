/* Phoenix Development Finance — Pipeline Dashboard */
function PhdBadges({ deal }) {
  const b = [];
  if (deal.adverseFlag === 'Yes') b.push(['red', 'Adverse']);
  if (deal.policyExceptionFlagged === 'Yes') b.push(['amber', 'Exception']);
  if (deal.appetiteTier === 'Tier 3 — very limited') b.push(['amber', 'Tier 3']);
  if (deal.appetiteTier === 'Tier 4 — decline') b.push(['red', 'Tier 4']);
  if (deal.regulatedStatus && deal.regulatedStatus.indexOf('No') !== 0) b.push(['red', 'Regulated?']);
  const due = window.PhoenixDevelopment.fmt.daysUntil(deal.nextActionDue);
  const live = deal.status !== 'Completed and handed over' && deal.status !== 'Not proceeding';
  if (due != null && due < 0 && live) b.push(['red', 'SLA breach']);
  else if (due != null && due <= 1 && live) b.push(['amber', 'Due soon']);
  return <div className="badges">{b.map((x, i) => <span key={i} className={'phxb-badge ' + x[0]}>{x[1]}</span>)}</div>;
}

function NewDevDealModal({ onClose, onCreate, accounts, presetAccountId }) {
  const E = window.PhoenixDevelopment;
  const [f, setF] = React.useState({
    borrowingEntity: '', siteAddress: '', product: 'Ground-up development',
    source: 'Direct — new enquiry', introducer: '', dealLead: '', developmentAnalyst: '', financialAnalyst: '', caseManager: '',
    gdvClient: '', termMonths: 18, accountId: presetAccountId || '',
  });
  const set = (k) => (e) => setF(Object.assign({}, f, { [k]: e.target.value }));
  const presetAccount = presetAccountId ? (accounts || []).find(a => a.id === presetAccountId) : null;
  return (
    <div className="phxb-modal-overlay" onClick={onClose}>
      <div className="phxb-modal" onClick={e => e.stopPropagation()}>
        <h3>Log new development enquiry</h3>
        <div className="sub" style={{ color: 'var(--muted-2)', fontSize: 11.5, marginTop: -8, marginBottom: 14 }}>
          Creates the tracker row immediately, issues the deal reference and opens the twelve-folder structure. D0 tasks are generated automatically.
        </div>
        {presetAccount ? (
          <div className="phxb-badge cyan" style={{ marginBottom: 12 }}>Linked to client: {presetAccount.name}</div>
        ) : accounts && accounts.length > 0 ? (
          <div className="phxb-field"><label>Client (CRM account)</label>
            <select value={f.accountId} onChange={set('accountId')}>
              <option value="">— Not linked to a CRM client —</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        ) : null}
        <div className="phxb-field"><label>Borrowing entity / client</label><input autoFocus value={f.borrowingEntity} onChange={set('borrowingEntity')} placeholder="e.g. Northfield Gardens SPV Ltd" /></div>
        <div className="phxb-field"><label>Site address</label><input value={f.siteAddress} onChange={set('siteAddress')} placeholder="e.g. Land at Northfield Gardens, Redhill" /></div>
        <div className="phxb-grid2">
          <div className="phxb-field"><label>Product</label>
            <select value={f.product} onChange={set('product')}>{E.PRODUCTS.map(p => <option key={p}>{p}</option>)}</select>
          </div>
          <div className="phxb-field"><label>Indicative GDV (£)</label><input type="number" value={f.gdvClient} onChange={set('gdvClient')} /></div>
        </div>
        <div className="phxb-grid2">
          <div className="phxb-field"><label>Source</label>
            <select value={f.source} onChange={set('source')}>
              {['Direct — existing client', 'Direct — new enquiry', 'Broker introduction', 'Professional introducer', 'Funder referral', 'Agent referral', 'Repeat / re-broke'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="phxb-field"><label>Introducer</label><input value={f.introducer} onChange={set('introducer')} /></div>
        </div>
        <div className="phxb-grid3">
          <div className="phxb-field"><label>Deal Lead</label><input value={f.dealLead} onChange={set('dealLead')} /></div>
          <div className="phxb-field"><label>Development Analyst</label><input value={f.developmentAnalyst} onChange={set('developmentAnalyst')} /></div>
          <div className="phxb-field"><label>Financial Analyst</label><input value={f.financialAnalyst} onChange={set('financialAnalyst')} /></div>
        </div>
        <div className="phxb-field"><label>Case Manager</label><input value={f.caseManager} onChange={set('caseManager')} /></div>
        <div className="foot">
          <button className="phxb-btn ghost" onClick={onClose}>Cancel</button>
          <button className="phxb-btn primary" disabled={!f.borrowingEntity.trim()}
            style={{ opacity: f.borrowingEntity.trim() ? 1 : .5 }}
            onClick={() => f.borrowingEntity.trim() && onCreate(Object.assign({}, f, { accountName: presetAccount ? presetAccount.name : ((accounts || []).find(a => a.id === f.accountId) || {}).name || '' }))}>Create deal &amp; issue reference</button>
        </div>
      </div>
    </div>
  );
}

function PhdDashboard({ onOpenDeal, accounts, presetAccountId, onConsumePreset }) {
  const DB = window.PhoenixDevelopmentDB;
  const E = window.PhoenixDevelopment;
  const [tick, setTick] = React.useState(0);
  const refresh = () => setTick(t => t + 1);
  const deals = React.useMemo(() => DB.listDeals(), [tick]);

  const [view, setView] = React.useState('kanban');
  const [q, setQ] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [ownerFilter, setOwnerFilter] = React.useState('');
  const [showNew, setShowNew] = React.useState(!!presetAccountId);

  React.useEffect(() => { if (presetAccountId) setShowNew(true); }, [presetAccountId]);

  const owners = Array.from(new Set(deals.map(d => d.dealLead).filter(Boolean)));

  const filtered = deals.filter(d => {
    if (statusFilter && d.status !== statusFilter) return false;
    if (ownerFilter && d.dealLead !== ownerFilter) return false;
    if (q) {
      const hay = [d.dealRef, d.borrowingEntity, d.siteAddress, d.introducer, d.selectedSeniorFunder].join(' ').toLowerCase();
      if (hay.indexOf(q.toLowerCase()) === -1) return false;
    }
    return true;
  });

  const live = deals.filter(d => d.status !== 'Completed and handed over' && d.status !== 'Not proceeding');
  const screening = deals.filter(d => ['Screening', 'Information gathering'].indexOf(d.status) !== -1);
  const appraisal = deals.filter(d => ['Appraisal', 'Structuring'].indexOf(d.status) !== -1);
  const withFunder = deals.filter(d => ['Due diligence', 'At committee'].indexOf(d.status) !== -1);
  const committed = deals.filter(d => ['Credit approved', 'In legals'].indexOf(d.status) !== -1);
  const completed = deals.filter(d => d.status === 'Completed and handed over');
  const notProceeding = deals.filter(d => d.status === 'Not proceeding');
  const grossLive = live.reduce((s, d) => s + (parseFloat(d.seniorFacility) || 0) + (parseFloat(d.mezzanineFacility) || 0), 0);
  const feesInvoiced = deals.filter(d => d.feeInvoicedDate).reduce((s, d) => s + (parseFloat(d.brokerFee) || 0), 0);
  const feesReceived = deals.filter(d => d.feeReceivedDate).reduce((s, d) => s + (parseFloat(d.brokerFee) || 0), 0);
  const completedWithDays = completed.map(d => E.calcMetrics(d).daysD0ToFeeReceived).filter(x => x != null);
  const avgDays = completedWithDays.length ? Math.round(completedWithDays.reduce((a, b) => a + b, 0) / completedWithDays.length) : null;

  const cards = [
    ['Live opportunities', live.length],
    ['At screening', screening.length],
    ['Appraisal / structuring', appraisal.length],
    ['With funder / committee', withFunder.length],
    ['Committed pipeline', committed.length],
    ['Completed & handed over', completed.length],
    ['Not proceeding', notProceeding.length],
    ['Facility value, live', E.fmt.money(grossLive)],
    ['Fees invoiced', E.fmt.money(feesInvoiced)],
    ['Fees received', E.fmt.money(feesReceived)],
    ['Avg. D0→fee received', avgDays != null ? avgDays + ' days' : '—'],
  ];

  function createDeal(fields) {
    const d = DB.newDeal(fields);
    setShowNew(false);
    if (onConsumePreset) onConsumePreset();
    refresh();
    onOpenDeal(d.id);
  }
  function closeNew() {
    setShowNew(false);
    if (onConsumePreset) onConsumePreset();
  }

  return (
    <div>
      <div className="phxb-cards">
        {cards.map((c, i) => <div className="phxb-card" key={i}><div className="l">{c[0]}</div><div className="v">{c[1]}</div></div>)}
      </div>

      <div className="phxb-toolbar">
        <input type="text" placeholder="Search ref, borrower, site, introducer, funder…" value={q} onChange={e => setQ(e.target.value)} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {E.STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        {owners.length > 0 && (
          <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}>
            <option value="">All Deal Leads</option>
            {owners.map(o => <option key={o}>{o}</option>)}
          </select>
        )}
        <div className="phxb-spacer" />
        <div className="phxb-viewtoggle">
          <button className={view === 'kanban' ? 'active' : ''} onClick={() => setView('kanban')}>Kanban</button>
          <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>Table</button>
        </div>
        <button className="phxb-btn primary" onClick={() => setShowNew(true)}>+ New enquiry</button>
      </div>

      {view === 'kanban' ? (
        <div className="phxb-kanban">
          {E.STATUSES.map(status => {
            const col = filtered.filter(d => d.status === status);
            return (
              <div className="phxb-kcol" key={status}>
                <h4><span>{status}</span><span>{col.length}</span></h4>
                {col.length === 0 ? <div style={{ fontSize: 11, color: 'var(--muted-2)' }}>—</div> : col.map(d => (
                  <div className="phxb-kcard" key={d.id} onClick={() => onOpenDeal(d.id)}>
                    <div className="ref">{d.dealRef}</div>
                    <div className="name">{d.borrowingEntity || 'Unnamed'}</div>
                    <div className="meta">{d.product} · {E.fmt.money(parseFloat(d.seniorFacility || 0) + parseFloat(d.mezzanineFacility || 0))}</div>
                    <PhdBadges deal={d} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <table className="phxb-table">
          <thead><tr>
            <th>Ref</th><th>Borrower</th><th>Product</th><th>Stage</th><th>Status</th>
            <th>Facility</th><th>Deal Lead</th><th>Next action</th><th>Due</th><th>Flags</th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={10} className="phxb-empty">No opportunities match these filters.</td></tr> :
              filtered.map(d => (
                <tr key={d.id} onClick={() => onOpenDeal(d.id)}>
                  <td style={{ fontFamily: 'var(--mono)', color: 'var(--green-500)' }}>{d.dealRef}</td>
                  <td>{d.borrowingEntity}</td>
                  <td>{d.product}</td>
                  <td>D{d.stage}</td>
                  <td>{d.status}</td>
                  <td>{E.fmt.money(parseFloat(d.seniorFacility || 0) + parseFloat(d.mezzanineFacility || 0))}</td>
                  <td>{d.dealLead || '—'}</td>
                  <td>{d.nextAction || '—'}</td>
                  <td>{E.fmt.date(d.nextActionDue)}</td>
                  <td><PhdBadges deal={d} /></td>
                </tr>
              ))}
          </tbody>
        </table>
      )}

      {showNew ? <NewDevDealModal onClose={closeNew} onCreate={createDeal} accounts={accounts} presetAccountId={presetAccountId} /> : null}
    </div>
  );
}

window.PhdDashboard = PhdDashboard;
