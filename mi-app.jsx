/* ===========================================================================
   PHOENIX MI & REPORTING
   Every number here is computed live from the deal/task/gate/audit records
   already in each module's store — nothing is mocked. Where the source data
   doesn't support a metric precisely (e.g. full stage-by-stage conversion
   needs a status_history table this localStorage layer doesn't keep yet),
   the panel is scoped to what can be shown honestly rather than faked.
   =========================================================================== */
function MiCard({ label, value, sub }) {
  return <div className="phxb-card"><div className="l">{label}</div><div className="v">{value}</div>{sub ? <div style={{ fontSize: 10, color: 'var(--muted-2)', marginTop: 4 }}>{sub}</div> : null}</div>;
}

function PipelinePanel({ E, deals }) {
  const buckets = {};
  deals.forEach(d => {
    const b = E.PIPELINE_BUCKET[d.status] || 'Unclassified';
    buckets[b] = buckets[b] || { count: 0, value: 0 };
    buckets[b].count++;
    buckets[b].value += (parseFloat(d.grossFacility) || 0) + (parseFloat(d.seniorFacility) || 0) + (parseFloat(d.mezzanineFacility) || 0);
  });
  const feesInvoiced = deals.filter(d => d.feeInvoicedDate).reduce((s, d) => s + (parseFloat(d.brokerFee) || 0), 0);
  const feesReceived = deals.filter(d => d.feeReceivedDate).reduce((s, d) => s + (parseFloat(d.brokerFee) || 0), 0);
  return (
    <div className="phxb-panel">
      <h3>Pipeline MI</h3>
      <div className="phxb-cards">
        {Object.keys(buckets).map(b => <MiCard key={b} label={b} value={buckets[b].count} sub={E.fmt.money(buckets[b].value)} />)}
        <MiCard label="Fee income invoiced" value={E.fmt.money(feesInvoiced)} />
        <MiCard label="Fee income received" value={E.fmt.money(feesReceived)} />
      </div>
    </div>
  );
}

function StageDistributionPanel({ E, deals, stageField }) {
  const live = deals.filter(d => {
    const b = E.PIPELINE_BUCKET[d.status] || '';
    return b !== 'Closed' && b !== 'Excluded' && b !== 'Completion';
  });
  const byStage = {};
  live.forEach(d => { byStage[d[stageField]] = (byStage[d[stageField]] || 0) + 1; });
  const max = Math.max(1, ...Object.values(byStage).concat([0]));
  return (
    <div className="phxb-panel">
      <h3>Stage distribution — live deals</h3>
      <div className="sub">{live.length} live deal{live.length === 1 ? '' : 's'}.</div>
      {E.STAGES.map(s => {
        const n = byStage[s.n] || 0;
        return (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 170, fontSize: 11.5, color: 'var(--muted-2)', flex: 'none' }}>{s.key} — {s.label}</div>
            <div className="phxb-progress" style={{ flex: 1 }}><div className="bar" style={{ width: (n / max * 100) + '%' }} /></div>
            <div style={{ width: 24, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11.5 }}>{n}</div>
          </div>
        );
      })}
    </div>
  );
}

function GateBlockersPanel({ E, DB, deals }) {
  const rows = [];
  deals.forEach(d => {
    const tasks = DB.listTasks(d.id);
    const readiness = E.gateReadiness(d.stage, tasks);
    const gates = DB.getGates(d.id);
    const stageDef = E.STAGES[d.stage];
    if (!stageDef) return;
    const gateInfo = gates[stageDef.gate];
    if (gateInfo && gateInfo.passed) return;
    if (readiness.total === 0) return;
    rows.push({ deal: d, gate: stageDef.gate, outstanding: readiness.outstanding.length, total: readiness.total });
  });
  const byGate = {};
  rows.forEach(r => { byGate[r.gate] = (byGate[r.gate] || 0) + 1; });
  return (
    <div className="phxb-panel">
      <h3>Gate blockers — where deals are stuck right now</h3>
      <div className="sub">Live deals whose current gate is not yet passable, grouped by gate. A cluster at one gate is the fastest way to spot a process bottleneck.</div>
      {Object.keys(byGate).length === 0 ? <div className="phxb-empty">No deals currently blocked — every live deal's current gate is ready to pass.</div> : (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {Object.keys(byGate).map(g => <span key={g} className="phxb-badge red">{g}: {byGate[g]} deal{byGate[g] === 1 ? '' : 's'}</span>)}
        </div>
      )}
      {rows.length > 0 ? (
        <table className="phxb-table">
          <thead><tr><th>Deal</th><th>Blocked at</th><th>Outstanding</th></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.deal.id}><td>{r.deal.dealRef} — {r.deal.borrowingEntity}</td><td>{r.gate}</td><td>{r.outstanding} of {r.total} required tasks</td></tr>
          ))}</tbody>
        </table>
      ) : null}
    </div>
  );
}

function SlaPerformancePanel({ E, DB, deals }) {
  if (!E.slaStatusForDeal) return null;
  const rows = [];
  deals.forEach(d => {
    const tasks = DB.listTasks(d.id);
    E.slaStatusForDeal(d, tasks).forEach(s => rows.push(Object.assign({ dealRef: d.dealRef }, s)));
  });
  const met = rows.filter(r => r.status === 'met').length;
  const missed = rows.filter(r => r.status === 'missed').length;
  const breached = rows.filter(r => r.status === 'breached').length;
  const dueSoon = rows.filter(r => r.status === 'due soon').length;
  const onTrack = rows.filter(r => r.status === 'on track').length;
  const scored = met + missed;
  const performance = scored > 0 ? (met / scored) : null;
  const active = rows.filter(r => r.status === 'breached' || r.status === 'due soon');
  return (
    <div className="phxb-panel">
      <h3>SLA performance</h3>
      <div className="sub">Computed from each commitment's due-at clock against actual task completion timestamps.</div>
      <div className="phxb-cards">
        <MiCard label="SLA met" value={met} />
        <MiCard label="SLA missed" value={missed} />
        <MiCard label="Currently breached" value={breached} />
        <MiCard label="Due soon" value={dueSoon} />
        <MiCard label="On track" value={onTrack} />
        <MiCard label="Historical performance" value={performance == null ? '—' : (performance * 100).toFixed(0) + '%'} sub={scored + ' scored commitments'} />
      </div>
      {active.length > 0 ? (
        <table className="phxb-table" style={{ marginTop: 12 }}>
          <thead><tr><th>Deal</th><th>Commitment</th><th>Status</th><th>Due</th></tr></thead>
          <tbody>{active.map((r, i) => (
            <tr key={i}><td>{r.dealRef}</td><td>{r.label}</td><td><span className={'phxb-badge ' + (r.status === 'breached' ? 'red' : 'amber')}>{r.status}</span></td><td>{r.dueAt ? new Date(r.dueAt).toLocaleString('en-GB') : '—'}</td></tr>
          ))}</tbody>
        </table>
      ) : null}
    </div>
  );
}

function ReasonCodePanel({ E, deals, notProceedingStatus }) {
  const notProceeding = deals.filter(d => d.status === notProceedingStatus);
  const byCode = {};
  notProceeding.forEach(d => { const c = d.reasonCode || 'Uncoded'; byCode[c] = (byCode[c] || 0) + 1; });
  const max = Math.max(1, ...Object.values(byCode).concat([0]));
  return (
    <div className="phxb-panel">
      <h3>Reason code analysis — {notProceedingStatus}</h3>
      {notProceeding.length === 0 ? <div className="phxb-empty">No closed-out deals yet.</div> : (
        <React.Fragment>
          {Object.keys(byCode).sort((a, b) => byCode[b] - byCode[a]).map(code => (
            <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 220, fontSize: 11.5, color: 'var(--muted-2)', flex: 'none' }}>{code}</div>
              <div className="phxb-progress" style={{ flex: 1 }}><div className="bar" style={{ width: (byCode[code] / max * 100) + '%' }} /></div>
              <div style={{ width: 24, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11.5 }}>{byCode[code]}</div>
            </div>
          ))}
        </React.Fragment>
      )}
    </div>
  );
}

function FunderPerformancePanel({ E, DB, deals }) {
  if (!DB.getFunderApproaches) return null; // bridging-only for now — development's structuring is multi-layer, tracked on Overview instead
  const byFunder = {};
  deals.forEach(d => {
    (DB.getFunderApproaches(d.id) || []).forEach(fa => {
      const rec = byFunder[fa.funder] = byFunder[fa.funder] || { approached: 0, selected: 0 };
      rec.approached++;
      if (fa.selected) rec.selected++;
    });
  });
  const funders = Object.keys(byFunder);
  return (
    <div className="phxb-panel">
      <h3>Funder performance</h3>
      {funders.length === 0 ? <div className="phxb-empty">No funder approaches logged yet.</div> : (
        <table className="phxb-table">
          <thead><tr><th>Funder</th><th>Deals approached</th><th>Deals selected</th><th>Win rate</th></tr></thead>
          <tbody>{funders.map(f => {
            const r = byFunder[f];
            return <tr key={f}><td>{f}</td><td>{r.approached}</td><td>{r.selected}</td><td>{r.approached ? (r.selected / r.approached * 100).toFixed(0) + '%' : '—'}</td></tr>;
          })}</tbody>
        </table>
      )}
    </div>
  );
}

function ConversionFunnelPanel({ E, DB, deals }) {
  if (!DB.getAllStatusHistory) return null;
  const allHistory = DB.getAllStatusHistory();
  const totalDeals = deals.length;
  if (totalDeals === 0) return null;
  const maxStageByDeal = {};
  deals.forEach(d => {
    const hist = allHistory[d.id] || [];
    let max = d.stage || 0;
    hist.forEach(h => { if (h.toStage != null && h.toStage > max) max = h.toStage; });
    maxStageByDeal[d.id] = max;
  });
  return (
    <div className="phxb-panel">
      <h3>Conversion funnel</h3>
      <div className="sub">Of all {totalDeals} opportunities ever logged, the share that has reached each stage at least once — computed from each deal's recorded stage transitions.</div>
      {E.STAGES.map(s => {
        const reached = deals.filter(d => maxStageByDeal[d.id] >= s.n).length;
        const pct = totalDeals ? (reached / totalDeals * 100) : 0;
        return (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 170, fontSize: 11.5, color: 'var(--muted-2)', flex: 'none' }}>{s.key} — {s.label}</div>
            <div className="phxb-progress" style={{ flex: 1 }}><div className="bar" style={{ width: pct + '%' }} /></div>
            <div style={{ width: 70, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11.5 }}>{reached} ({pct.toFixed(0)}%)</div>
          </div>
        );
      })}
    </div>
  );
}

function StageVelocityPanel({ E, DB, deals }) {
  if (!DB.getAllStatusHistory) return null;
  const allHistory = DB.getAllStatusHistory();
  const now = new Date();
  const totals = {}; // stage -> {sumDays, count}
  deals.forEach(d => {
    const hist = (allHistory[d.id] || []).slice().sort((a, b) => new Date(a.ts) - new Date(b.ts));
    // walk consecutive stage-change events; time between them is time spent in the "from" stage
    let lastStage = hist.length ? hist[0].toStage : d.stage;
    let lastTs = hist.length ? new Date(hist[0].ts) : null;
    for (let i = 1; i < hist.length; i++) {
      const h = hist[i];
      if (h.toStage !== lastStage && h.toStage != null && lastTs) {
        const days = (new Date(h.ts) - lastTs) / 86400000;
        if (days >= 0) { totals[lastStage] = totals[lastStage] || { sum: 0, n: 0 }; totals[lastStage].sum += days; totals[lastStage].n++; }
        lastStage = h.toStage; lastTs = new Date(h.ts);
      }
    }
    // time in the current (still-open) stage, for live deals
    const isClosed = (E.PIPELINE_BUCKET[d.status] || '') === 'Closed' || (E.PIPELINE_BUCKET[d.status] || '') === 'Excluded' || (E.PIPELINE_BUCKET[d.status] || '') === 'Completion';
    if (!isClosed && lastTs) {
      const days = (now - lastTs) / 86400000;
      if (days >= 0) { totals[lastStage] = totals[lastStage] || { sum: 0, n: 0 }; totals[lastStage].sum += days; totals[lastStage].n++; }
    }
  });
  const anyData = Object.keys(totals).length > 0;
  return (
    <div className="phxb-panel">
      <h3>Stage velocity</h3>
      <div className="sub">Average days spent in each stage, from recorded transitions (in-progress deals count time in their current stage up to today).</div>
      {!anyData ? <div className="phxb-empty">Not enough transition history yet — this fills in as deals move through stages and gates get passed.</div> : (
        E.STAGES.map(s => {
          const t = totals[s.n];
          const avg = t && t.n ? t.sum / t.n : null;
          return (
            <div key={s.n} className="phxb-kv-list" style={{ marginBottom: 2 }}>
              <div className="r"><span>{s.key} — {s.label}</span><span style={{ fontFamily: 'var(--mono)' }}>{avg == null ? '—' : avg.toFixed(1) + ' days avg'}{t ? ' (' + t.n + ' obs.)' : ''}</span></div>
            </div>
          );
        })
      )}
    </div>
  );
}

function ModuleMi({ E, DB, stageField, notProceedingStatus }) {
  const deals = DB.listDeals();
  return (
    <div>
      <PipelinePanel E={E} deals={deals} />
      <ConversionFunnelPanel E={E} DB={DB} deals={deals} />
      <StageVelocityPanel E={E} DB={DB} deals={deals} />
      <SlaPerformancePanel E={E} DB={DB} deals={deals} />
      <StageDistributionPanel E={E} deals={deals} stageField={stageField} />
      <GateBlockersPanel E={E} DB={DB} deals={deals} />
      <ReasonCodePanel E={E} deals={deals} notProceedingStatus={notProceedingStatus} />
      <FunderPerformancePanel E={E} DB={DB} deals={deals} />
    </div>
  );
}

function PhoenixMiApp() {
  const [moduleTab, setModuleTab] = React.useState('bridging');
  return (
    <div className="phxb">
      <div className="phxb-topbar">
        <div className="phxb-brand"><div className="mk">MI</div>MI &amp; Reporting</div>
        <div className="phxb-spacer" />
      </div>
      <div className="phxb-main">
        <div className="phxb-tabs">
          <button className={moduleTab === 'bridging' ? 'active' : ''} onClick={() => setModuleTab('bridging')}>Bridging</button>
          <button className={moduleTab === 'development' ? 'active' : ''} onClick={() => setModuleTab('development')}>Development Finance</button>
        </div>
        {moduleTab === 'bridging'
          ? <ModuleMi E={window.PhoenixBridging} DB={window.PhoenixBridgingDB} stageField="stage" notProceedingStatus="Not proceeding" />
          : <ModuleMi E={window.PhoenixDevelopment} DB={window.PhoenixDevelopmentDB} stageField="stage" notProceedingStatus="Not proceeding" />}
      </div>
    </div>
  );
}

window.PhoenixMiApp = PhoenixMiApp;
