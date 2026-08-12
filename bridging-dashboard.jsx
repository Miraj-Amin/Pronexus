/* Phoenix Bridging — Pipeline Dashboard */
function PhxBadges({ deal }) {
  const b = [];
  if (deal.adverseFlag === 'Yes') b.push(['red', 'Adverse']);
  if (deal.policyExceptionFlagged === 'Yes') b.push(['amber', 'Exception']);
  if (deal.appetiteTier === 'Tier 3 — very limited') b.push(['amber', 'Tier 3']);
  if (deal.appetiteTier === 'Tier 4 — decline') b.push(['red', 'Tier 4']);
  if (deal.regulatedStatus && deal.regulatedStatus.indexOf('No') !== 0) b.push(['red', 'Regulated?']);
  const due = window.PhoenixBridging.fmt.daysUntil(deal.nextActionDue);
  if (due != null && due < 0 && deal.status !== 'Completed' && deal.status !== 'Redeemed' && deal.status !== 'Not proceeding') b.push(['red', 'SLA breach']);
  else if (due != null && due <= 1 && deal.status !== 'Completed' && deal.status !== 'Redeemed' && deal.status !== 'Not proceeding') b.push(['amber', 'Due soon']);
  return (
    <div className="badges">
      {b.map((x, i) => <span key={i} className={'phxb-badge ' + x[0]}>{x[1]}</span>)}
    </div>
  );
}

function NewDealModal({ onClose, onCreate }) {
  const E = window.PhoenixBridging;
  const [f, setF] = React.useState({
    borrowingEntity: '', securityAddress: '', product: 'Unregulated bridging',
    source: 'Direct — new enquiry', introducer: '', dealLead: '', analyst: '', caseManager: '',
    grossFacility: '', termMonths: 12,
  });
  const set = (k) => (e) => setF(Object.assign({}, f, { [k]: e.target.value }));
  return (
    <div className="phxb-modal-overlay" onClick={onClose}>
      <div className="phxb-modal" onClick={e => e.stopPropagation()}>
        <h3>Log new enquiry</h3>
        <div className="sub" style={{ color: 'var(--muted-2)', fontSize: 11.5, marginTop: -8, marginBottom: 14 }}>
          Creates the tracker row immediately and issues the deal reference. Stage 0 tasks are generated automatically.
        </div>
        <div className="phxb-field"><label>Borrowing entity / client</label><input autoFocus value={f.borrowingEntity} onChange={set('borrowingEntity')} placeholder="e.g. Example Holdings Ltd" /></div>
        <div className="phxb-field"><label>Security address</label><input value={f.securityAddress} onChange={set('securityAddress')} placeholder="e.g. 1 Example Road, London SE1" /></div>
        <div className="phxb-grid2">
          <div className="phxb-field"><label>Product</label>
            <select value={f.product} onChange={set('product')}>{E.PRODUCTS.map(p => <option key={p}>{p}</option>)}</select>
          </div>
          <div className="phxb-field"><label>Loan required (£)</label><input type="number" value={f.grossFacility} onChange={set('grossFacility')} /></div>
        </div>
        <div className="phxb-grid2">
          <div className="phxb-field"><label>Source</label>
            <select value={f.source} onChange={set('source')}>
              {['Direct — existing client', 'Direct — new enquiry', 'Broker introduction', 'Professional introducer', 'Funder referral', 'Repeat / re-broke'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="phxb-field"><label>Introducer</label><input value={f.introducer} onChange={set('introducer')} /></div>
        </div>
        <div className="phxb-grid3">
          <div className="phxb-field"><label>Deal Lead</label><input value={f.dealLead} onChange={set('dealLead')} /></div>
          <div className="phxb-field"><label>Analyst</label><input value={f.analyst} onChange={set('analyst')} /></div>
          <div className="phxb-field"><label>Case Manager</label><input value={f.caseManager} onChange={set('caseManager')} /></div>
        </div>
        <div className="foot">
          <button className="phxb-btn ghost" onClick={onClose}>Cancel</button>
          <button className="phxb-btn primary" disabled={!f.borrowingEntity.trim()}
            style={{ opacity: f.borrowingEntity.trim() ? 1 : .5 }}
            onClick={() => f.borrowingEntity.trim() && onCreate(f)}>Create deal &amp; issue reference</button>
        </div>
      </div>
    </div>
  );
}

function PhxDashboard({ onOpenDeal }) {
  const DB = window.PhoenixBridgingDB;
  const E = window.PhoenixBridging;
  const [tick, setTick] = React.useState(0);
  const refresh = () => setTick(t => t + 1);
  const deals = React.useMemo(() => DB.listDeals(), [tick]);

  const [view, setView] = React.useState('kanban');
  const [q, setQ] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [ownerFilter, setOwnerFilter] = React.useState('');
  const [showNew, setShowNew] = React.useState(false);

  const owners = Array.from(new Set(deals.map(d => d.dealLead).filter(Boolean)));

  const filtered = deals.filter(d => {
    if (statusFilter && d.status !== statusFilter) return false;
    if (ownerFilter && d.dealLead !== ownerFilter) return false;
    if (q) {
      const hay = [d.dealRef, d.borrowingEntity, d.securityAddress, d.introducer, d.selectedFunder].join(' ').toLowerCase();
      if (hay.indexOf(q.toLowerCase()) === -1) return false;
    }
    return true;
  });

  // summary cards
  const live = deals.filter(d => d.status !== 'Completed' && d.status !== 'Redeemed' && d.status !== 'Not proceeding');
  const screening = deals.filter(d => d.status === 'Screening');
  const termsOutAccepted = deals.filter(d => d.status === 'Terms out' || d.status === 'Terms accepted');
  const withFunder = deals.filter(d => ['Packaged / submitted', 'Funder underwriting'].indexOf(d.status) !== -1);
  const committed = deals.filter(d => ['Offer issued', 'In legals'].indexOf(d.status) !== -1);
  const completed = deals.filter(d => d.status === 'Completed');
  const notProceeding = deals.filter(d => d.status === 'Not proceeding');
  const grossLive = live.reduce((s, d) => s + (parseFloat(d.grossFacility) || 0), 0);
  const feesInvoiced = deals.filter(d => d.feeInvoicedDate).reduce((s, d) => s + (parseFloat(d.brokerFee) || 0), 0);
  const feesReceived = deals.filter(d => d.feeReceivedDate).reduce((s, d) => s + (parseFloat(d.brokerFee) || 0), 0);
  const completedWithDays = completed.map(d => E.calcMetrics(d).daysEnquiryToCompletion).filter(x => x != null);
  const avgDays = completedWithDays.length ? Math.round(completedWithDays.reduce((a, b) => a + b, 0) / completedWithDays.length) : null;

  const cards = [
    ['Live opportunities', live.length],
    ['At screening', screening.length],
    ['Terms out / accepted', termsOutAccepted.length],
    ['With funder', withFunder.length],
    ['Committed pipeline', committed.length],
    ['Completed', completed.length],
    ['Not proceeding', notProceeding.length],
    ['Gross facility, live', E.fmt.money(grossLive)],
    ['Fees invoiced', E.fmt.money(feesInvoiced)],
    ['Fees received', E.fmt.money(feesReceived)],
    ['Avg. enquiry→completion', avgDays != null ? avgDays + ' days' : '—'],
  ];

  function createDeal(fields) {
    const d = DB.newDeal(fields);
    setShowNew(false);
    refresh();
    onOpenDeal(d.id);
  }

  return (
    <div>
      <div className="phxb-cards">
        {cards.map((c, i) => (
          <div className="phxb-card" key={i}><div className="l">{c[0]}</div><div className="v">{c[1]}</div></div>
        ))}
      </div>

      <div className="phxb-toolbar">
        <input type="text" placeholder="Search ref, borrower, address, introducer, funder…" value={q} onChange={e => setQ(e.target.value)} />
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
                    <div className="meta">{d.product} · {E.fmt.money(d.grossFacility)}</div>
                    <PhxBadges deal={d} />
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
            <th>Gross facility</th><th>Deal Lead</th><th>Next action</th><th>Due</th><th>Flags</th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={10} className="phxb-empty">No opportunities match these filters.</td></tr> :
              filtered.map(d => (
                <tr key={d.id} onClick={() => onOpenDeal(d.id)}>
                  <td style={{ fontFamily: 'var(--mono)', color: 'var(--green-500)' }}>{d.dealRef}</td>
                  <td>{d.borrowingEntity}</td>
                  <td>{d.product}</td>
                  <td>Stage {d.stage}</td>
                  <td>{d.status}</td>
                  <td>{E.fmt.money(d.grossFacility)}</td>
                  <td>{d.dealLead || '—'}</td>
                  <td>{d.nextAction || '—'}</td>
                  <td>{E.fmt.date(d.nextActionDue)}</td>
                  <td><PhxBadges deal={d} /></td>
                </tr>
              ))}
          </tbody>
        </table>
      )}

      {showNew ? <NewDealModal onClose={() => setShowNew(false)} onCreate={createDeal} /> : null}
    </div>
  );
}

window.PhxDashboard = PhxDashboard;
