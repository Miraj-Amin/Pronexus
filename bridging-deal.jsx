/* Phoenix Bridging — Deal Workspace */
(function () {
const E = window.PhoenixBridging;
const DB = window.PhoenixBridgingDB;

function Field({ label, children }) {
  return <div className="phxb-field"><label>{label}</label>{children}</div>;
}
function TextField({ label, value, onChange, type, placeholder }) {
  return <Field label={label}><input type={type || 'text'} value={value == null ? '' : value} placeholder={placeholder}
    onChange={e => onChange(e.target.value)} /></Field>;
}
function SelectField({ label, value, onChange, options }) {
  return <Field label={label}><select value={value || ''} onChange={e => onChange(e.target.value)}>
    <option value="">—</option>
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select></Field>;
}
function TextAreaField({ label, value, onChange }) {
  return <Field label={label}><textarea value={value || ''} onChange={e => onChange(e.target.value)} /></Field>;
}

/* =========================== ROLE-BASED GATING =========================== */
// Wraps a tab's editable content. When the active role lacks `cap`, every
// input inside becomes inert (pointer-events: none) and a banner explains
// why — a real, visible restriction, not just a documentation note. Buttons
// that need a *different, more specific* capability than the tab's default
// (Pass gate, Waive, Satisfy CP, mark fee received, delete document, invite
// portal...) are rendered outside this wrapper and gated individually with
// their own `disabled` check — see each tab below.
function Section({ role, cap, label, children }) {
  const allowed = E.hasPerm(role, cap);
  return (
    <div>
      {!allowed ? (
        <div className="phxb-badge grey" style={{ marginBottom: 12 }}>
          Read-only for {role} — {label || 'editing this section'} requires a role with the "{cap}" permission
        </div>
      ) : null}
      <div style={allowed ? undefined : { opacity: .55, pointerEvents: 'none', userSelect: 'none' }}>
        {children}
      </div>
    </div>
  );
}

/* =========================== HEADER =========================== */
function DealHeader({ deal, onBack, tasks, gates, onOpenAccount }) {
  const metrics = E.calcMetrics(deal);
  const gateDef = E.GATES[deal.lastGatePassed] || null;
  const blockers = React.useMemo(() => {
    const readiness = E.gateReadiness(deal.stage, tasks);
    return readiness.outstanding;
  }, [tasks, deal.stage]);
  const dueIn = E.fmt.daysUntil(deal.nextActionDue);
  const slaBadge = deal.status === 'Completed' || deal.status === 'Redeemed' || deal.status === 'Not proceeding' ? null
    : dueIn == null ? null : dueIn < 0 ? ['red', 'SLA breach'] : dueIn <= 1 ? ['amber', 'Due soon'] : ['ok', 'On track'];

  return (
    <div className="phxb-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontFamily: 'var(--mono)', fontSize: 11.5 }}>
        {deal.accountId && onOpenAccount ? (
          <React.Fragment>
            <button className="phxb-btn ghost" onClick={() => onOpenAccount(deal.accountId)}>{deal.accountName || 'Client'}</button>
            <span style={{ color: 'var(--muted-2)' }}>/</span>
            <span style={{ color: 'var(--muted-2)' }}>{deal.dealRef}</span>
          </React.Fragment>
        ) : (
          <button className="phxb-btn ghost" onClick={onBack}>← Pipeline</button>
        )}
        {deal.accountId ? <button className="phxb-btn ghost" onClick={onBack} style={{ marginLeft: 'auto' }}>Pipeline</button> : null}
      </div>
      <div className="row1">
        <span className="ref">{deal.dealRef}</span>
        <h2>{deal.borrowingEntity || 'Unnamed borrower'}</h2>
      </div>
      <div className="addr">{deal.securityAddress || 'No security address recorded'} · {deal.product}</div>
      <div className="row2">
        <div className="kv"><div className="l">Stage</div><div className="v">S{deal.stage} — {(E.STAGES[deal.stage] || {}).label}</div></div>
        <div className="kv"><div className="l">Status</div><div className="v">{deal.status}</div></div>
        <div className="kv"><div className="l">Last gate</div><div className="v">{deal.lastGatePassed || '—'}</div></div>
        <div className="kv"><div className="l">Next action</div><div className="v">{deal.nextAction || '—'}</div></div>
        <div className="kv"><div className="l">Owner</div><div className="v">{deal.nextActionOwner || '—'}</div></div>
        <div className="kv"><div className="l">Due</div><div className="v">{E.fmt.date(deal.nextActionDue)}</div></div>
        <div className="kv"><div className="l">Gross facility</div><div className="v">{E.fmt.money(deal.grossFacility)}</div></div>
        <div className="kv"><div className="l">Day 1 / Gross LTV</div><div className="v">{E.fmt.pct(metrics.day1Ltv)} / {E.fmt.pct(metrics.grossLtv)}</div></div>
      </div>
      <div className="row3">
        {deal.adverseFlag === 'Yes' ? <span className="phxb-badge red">Adverse</span> : null}
        {deal.policyExceptionFlagged === 'Yes' ? <span className="phxb-badge amber">Exception</span> : null}
        {deal.appetiteTier ? <span className="phxb-badge cyan">{deal.appetiteTier}</span> : null}
        {deal.regulatedStatus && deal.regulatedStatus.indexOf('No') !== 0 ? <span className="phxb-badge red">Regulated concern</span> : null}
        {blockers.length > 0 ? <span className="phxb-badge red">{blockers.length} gate {blockers.length === 1 ? 'blocker' : 'blockers'}</span> : <span className="phxb-badge ok">Gate {deal.stage <= 7 ? 'G' + deal.stage : ''} ready</span>}
        {slaBadge ? <span className={'phxb-badge ' + slaBadge[0]}>{slaBadge[1]}</span> : null}
      </div>
    </div>
  );
}

/* =========================== OVERVIEW =========================== */
function OverviewTab({ deal, patch, role }) {
  const metrics = E.calcMetrics(deal);
  return (
    <Section role={role} cap="editOverview" label="Overview">
      <div className="phxb-panel">
        <h3>Identification</h3>
        <div className="phxb-grid3">
          <Field label="Deal reference"><input value={deal.dealRef} disabled /></Field>
          <TextField label="Date received" type="date" value={deal.dateReceived} onChange={v => patch({ dateReceived: v })} />
          <SelectField label="Source" value={deal.source} onChange={v => patch({ source: v })}
            options={['Direct — existing client', 'Direct — new enquiry', 'Broker introduction', 'Professional introducer', 'Funder referral', 'Repeat / re-broke']} />
          <TextField label="Introducer" value={deal.introducer} onChange={v => patch({ introducer: v })} />
          <SelectField label="Introducer fee share applies" value={deal.introducerShareApplies} onChange={v => patch({ introducerShareApplies: v })} options={['Yes', 'No']} />
          <TextField label="Deal Lead" value={deal.dealLead} onChange={v => patch({ dealLead: v })} />
          <TextField label="Analyst" value={deal.analyst} onChange={v => patch({ analyst: v })} />
          <TextField label="Case Manager" value={deal.caseManager} onChange={v => patch({ caseManager: v })} />
        </div>
        {deal.dealLead && deal.caseManager && deal.dealLead === deal.caseManager ? (
          <div className="phxb-badge amber" style={{ marginTop: 4 }}>Deal Lead and Case Manager are the same person — override only, not default</div>
        ) : null}
      </div>

      <div className="phxb-panel">
        <h3>Client and asset</h3>
        <div className="phxb-grid3">
          <TextField label="Borrowing entity" value={deal.borrowingEntity} onChange={v => patch({ borrowingEntity: v })} />
          <TextField label="Company number" value={deal.companyNumber} onChange={v => patch({ companyNumber: v })} />
          <TextField label="Principals / directors" value={deal.principals} onChange={v => patch({ principals: v })} />
          <TextField label="Guarantors" value={deal.guarantors} onChange={v => patch({ guarantors: v })} />
          <TextField label="Security address" value={deal.securityAddress} onChange={v => patch({ securityAddress: v })} />
          <TextField label="Tenure" value={deal.tenure} onChange={v => patch({ tenure: v })} />
          <TextField label="Asset type" value={deal.assetType} onChange={v => patch({ assetType: v })} />
          <SelectField label="Product type" value={deal.product} onChange={v => patch({ product: v })} options={E.PRODUCTS} />
          <SelectField label="Regulated status — first charge over primary residence?" value={deal.regulatedStatus} onChange={v => patch({ regulatedStatus: v })}
            options={['No — confirmed unregulated', 'Yes', 'Uncertain']} />
        </div>
        {deal.regulatedStatus && deal.regulatedStatus.indexOf('No') !== 0 ? (
          <div className="phxb-badge red">Blocks normal progression — escalate to a principal within the working day</div>
        ) : null}
      </div>

      <div className="phxb-panel">
        <h3>Facility and metrics</h3>
        <div className="phxb-grid3">
          <TextField label="Security value reported (£)" type="number" value={deal.securityValue} onChange={v => patch({ securityValue: v })} />
          <TextField label="Purchase price, if acquisition (£)" type="number" value={deal.purchasePrice} onChange={v => patch({ purchasePrice: v })} />
          <Field label="Lower of value and purchase price"><input disabled value={E.fmt.money(metrics.basisValue)} /></Field>
          <TextField label="Gross facility (£)" type="number" value={deal.grossFacility} onChange={v => patch({ grossFacility: v })} />
          <TextField label="Day 1 advance (£)" type="number" value={deal.day1Advance} onChange={v => patch({ day1Advance: v })} />
          <TextField label="Works / retention facility (£)" type="number" value={deal.worksRetentionFacility} onChange={v => patch({ worksRetentionFacility: v })} />
          <TextField label="Total project cost (£)" type="number" value={deal.totalProjectCost} onChange={v => patch({ totalProjectCost: v })} />
          <TextField label="Term (months)" type="number" value={deal.termMonths} onChange={v => patch({ termMonths: v })} />
          <TextField label="Rate (decimal, e.g. 0.0925)" value={deal.rate} onChange={v => patch({ rate: v })} />
          <TextField label="Arrangement fee (decimal)" value={deal.arrangementFee} onChange={v => patch({ arrangementFee: v })} />
          <TextField label="Exit fee (decimal)" value={deal.exitFee} onChange={v => patch({ exitFee: v })} />
          <Field label="Day 1 LTV (calculated)"><input disabled value={E.fmt.pct(metrics.day1Ltv)} /></Field>
          <Field label="Gross LTV (calculated)"><input disabled value={E.fmt.pct(metrics.grossLtv)} /></Field>
          <Field label="LTC (calculated)"><input disabled value={E.fmt.pct(metrics.ltc)} /></Field>
          <TextField label="Exit route" value={deal.exitRoute} onChange={v => patch({ exitRoute: v })} />
          <SelectField label="Exit evidence held" value={deal.exitEvidenceHeld} onChange={v => patch({ exitEvidenceHeld: v })} options={['Yes', 'No']} />
        </div>
        <div className="phxb-badge grey">Funders lend on the lower of value and purchase price — applied automatically above</div>
      </div>

      <div className="phxb-panel">
        <h3>Key dates</h3>
        <div className="phxb-grid3">
          <TextField label="Terms issued to client" type="date" value={deal.termsIssued} onChange={v => patch({ termsIssued: v })} />
          <TextField label="Terms accepted" type="date" value={deal.termsAccepted} onChange={v => patch({ termsAccepted: v })} />
          <TextField label="Submitted to funder" type="date" value={deal.submittedToFunder} onChange={v => patch({ submittedToFunder: v })} />
          <TextField label="Credit decision received" type="date" value={deal.creditDecisionReceived} onChange={v => patch({ creditDecisionReceived: v })} />
          <TextField label="Offer issued" type="date" value={deal.offerIssued} onChange={v => patch({ offerIssued: v })} />
          <TextField label="Legals instructed" type="date" value={deal.legalsInstructed} onChange={v => patch({ legalsInstructed: v })} />
          <TextField label="Target completion" type="date" value={deal.targetCompletion} onChange={v => patch({ targetCompletion: v })} />
          <TextField label="Actual completion" type="date" value={deal.actualCompletion} onChange={v => patch({ actualCompletion: v })} />
          <TextField label="Term end date" type="date" value={deal.termEndDate} onChange={v => patch({ termEndDate: v })} />
          <TextField label="Redemption date" type="date" value={deal.redemptionDate} onChange={v => patch({ redemptionDate: v })} />
          <Field label="Days enquiry → completion"><input disabled value={metrics.daysEnquiryToCompletion == null ? '—' : metrics.daysEnquiryToCompletion} /></Field>
        </div>
      </div>

      <div className="phxb-panel">
        <h3>Phoenix commercials</h3>
        <div className="phxb-grid3">
          <SelectField label="Terms of business signed" value={deal.termsOfBusinessSigned} onChange={v => patch({ termsOfBusinessSigned: v })} options={['Yes', 'No']} />
          <TextField label="Broker fee basis" value={deal.brokerFeeBasis} onChange={v => patch({ brokerFeeBasis: v })} />
          <TextField label="Broker fee (£)" type="number" value={deal.brokerFee} onChange={v => patch({ brokerFee: v })} />
          <TextField label="Fee invoiced date" type="date" value={deal.feeInvoicedDate} onChange={v => patch({ feeInvoicedDate: v })} />
          <TextField label="Fee received date" type="date" value={deal.feeReceivedDate} onChange={v => patch({ feeReceivedDate: v })} />
          <TextField label="Introducer share (£ or %)" value={deal.introducerShare} onChange={v => patch({ introducerShare: v })} />
        </div>
      </div>

      <div className="phxb-panel">
        <h3>Outcome</h3>
        <div className="phxb-grid3">
          <SelectField label="Outcome" value={deal.outcome} onChange={v => patch({ outcome: v })} options={['Proceeding', 'Completed', 'Redeemed', 'Not proceeding']} />
          {deal.outcome === 'Not proceeding' ? (
            <SelectField label="Reason code" value={deal.reasonCode} onChange={v => patch({ reasonCode: v })} options={E.REASON_CODES.map(r => r.code + ' ' + r.label)} />
          ) : null}
        </div>
        <TextAreaField label="Notes" value={deal.notes} onChange={v => patch({ notes: v })} />
      </div>
    </Section>
  );
}

/* =========================== ELIGIBILITY =========================== */
function EligibilityTab({ deal, patch, dealId, role }) {
  const [tick, setTick] = React.useState(0);
  const elig = DB.getEligibility(dealId);
  const metrics = E.calcMetrics(deal);
  const liveParams = DB.getEffectiveProductParams();
  const liveCore = DB.getEffectiveCoreParams();

  const setTest = (key, field, value) => {
    const t = Object.assign({}, elig.tests[key], { [field]: value });
    DB.setEligibility(dealId, { tests: Object.assign({}, elig.tests, { [key]: t }) });
    setTick(x => x + 1);
  };
  const setAdverse = (key, field, value) => {
    const a = Object.assign({}, elig.adverse[key], { [field]: value });
    const adverse = Object.assign({}, elig.adverse, { [key]: a });
    DB.setEligibility(dealId, { adverse });
    const anyFound = Object.values(adverse).some(x => x.found && !x.cleared);
    patch({ adverseFlag: anyFound ? 'Yes' : 'No' });
    setTick(x => x + 1);
  };
  const setException = (key, field, value) => {
    const x = Object.assign({}, elig.exceptions[key], { [field]: value });
    const exceptions = Object.assign({}, elig.exceptions, { [key]: x });
    DB.setEligibility(dealId, { exceptions });
    const anyPresent = Object.values(exceptions).some(e => e.present);
    patch({ policyExceptionFlagged: anyPresent ? 'Yes' : 'No' });
    setTick(x2 => x2 + 1);
  };

  const failCount = E.ELIGIBILITY_TESTS.filter(t => {
    const auto = t.auto ? E.autoEligibilityVerdict(t, deal, metrics, liveParams, liveCore) : null;
    const v = auto ? auto.verdict : (elig.tests[t.key] || {}).verdict;
    return v === 'Fail';
  }).length;
  const borderlineCount = E.ELIGIBILITY_TESTS.filter(t => {
    const auto = t.auto ? E.autoEligibilityVerdict(t, deal, metrics, liveParams, liveCore) : null;
    const v = auto ? auto.verdict : (elig.tests[t.key] || {}).verdict;
    return v === 'Borderline';
  }).length;
  const adverseFound = Object.values(elig.adverse).some(a => a.found && !a.cleared);
  const exceptionsPresent = Object.values(elig.exceptions).filter(x => x.present).length;
  const suggestedTier = E.suggestTier(deal, adverseFound, exceptionsPresent);

  return (
    <Section role={role} cap="editEligibility" label="Eligibility">
      <div className="phxb-panel">
        <h3>Eligibility screen — 23 tests</h3>
        <div className="sub">Every test applied before terms are sought from any funder. Numeric tests (1, 2, 3, 5, 6, 7) are calculated automatically from Overview fields and product limits.</div>
        {(failCount > 0 || borderlineCount > 0) ? (
          <div style={{ marginBottom: 10 }}>
            {failCount > 0 ? <span className="phxb-badge red" style={{ marginRight: 6 }}>{failCount} failed</span> : null}
            {borderlineCount > 0 ? <span className="phxb-badge amber">{borderlineCount} borderline — escalate</span> : null}
          </div>
        ) : null}
        <table className="phxb-table">
          <thead><tr><th style={{ width: 28 }}>#</th><th>Test</th><th>Requirement</th><th style={{ width: 110 }}>This deal</th><th style={{ width: 110 }}>Within?</th><th>Evidence / note</th></tr></thead>
          <tbody>
            {E.ELIGIBILITY_TESTS.map(t => {
              const auto = t.auto ? E.autoEligibilityVerdict(t, deal, metrics, liveParams, liveCore) : null;
              const rec = elig.tests[t.key] || {};
              const verdict = auto ? auto.verdict : rec.verdict;
              const color = verdict === 'Fail' ? 'red' : verdict === 'Borderline' ? 'amber' : verdict === 'Pass' ? 'ok' : 'grey';
              return (
                <tr key={t.key}>
                  <td>{t.n}</td>
                  <td>{t.label}</td>
                  <td style={{ fontSize: 11.5, color: 'var(--muted-2)' }}>{t.requirement}</td>
                  <td>{auto ? auto.note : (rec.note || '—')}</td>
                  <td>
                    {auto ? <span className={'phxb-badge ' + color}>{verdict || 'N/A'}</span> : (
                      <select className="phxb-status-select" value={rec.verdict || ''} onChange={e => setTest(t.key, 'verdict', e.target.value)}>
                        <option value="">—</option><option>Pass</option><option>Fail</option><option>Borderline</option><option>N/A</option>
                      </select>
                    )}
                  </td>
                  <td>{auto ? '' : <input style={{ width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border-strong)', color: 'var(--ink)', borderRadius: 4, padding: '4px 6px', fontSize: 11.5 }}
                    value={rec.note || ''} onChange={e => setTest(t.key, 'note', e.target.value)} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="phxb-panel">
        <h3>Adverse credit — automatic exclusions</h3>
        <div className="sub">Applied to: {E.ADVERSE_APPLIES_TO}. Any confirmed finding suspends progression and requires a written escalation record and funder pre-clearance.</div>
        <table className="phxb-table">
          <thead><tr><th>#</th><th>Exclusion</th><th style={{ width: 90 }}>Found?</th><th style={{ width: 90 }}>Cleared?</th><th>Detail / escalation record</th></tr></thead>
          <tbody>
            {E.ADVERSE_CATEGORIES.map(a => {
              const rec = elig.adverse[a.key] || {};
              return (
                <tr key={a.key}>
                  <td style={{ fontFamily: 'var(--mono)' }}>{a.key}</td>
                  <td>{a.label}</td>
                  <td><input type="checkbox" checked={!!rec.found} onChange={e => setAdverse(a.key, 'found', e.target.checked)} /></td>
                  <td><input type="checkbox" disabled={!rec.found} checked={!!rec.cleared} onChange={e => setAdverse(a.key, 'cleared', e.target.checked)} /></td>
                  <td><input style={{ width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border-strong)', color: 'var(--ink)', borderRadius: 4, padding: '4px 6px', fontSize: 11.5 }}
                    value={rec.detail || ''} onChange={e => setAdverse(a.key, 'detail', e.target.value)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {adverseFound ? <div className="phxb-badge red" style={{ marginTop: 10 }}>Adverse finding open — progression suspended, escalate to a principal, obtain funder pre-clearance</div> : null}
      </div>

      <div className="phxb-panel">
        <h3>Policy exception triggers</h3>
        <div className="sub">Each requires a Deal Summary to the funder before proceeding.</div>
        <table className="phxb-table">
          <thead><tr><th>#</th><th>Trigger</th><th style={{ width: 80 }}>Present?</th><th style={{ width: 120 }}>Date raised</th><th>Funder response</th><th>Note</th></tr></thead>
          <tbody>
            {E.EXCEPTION_TRIGGERS.map(x => {
              const rec = elig.exceptions[x.key] || {};
              return (
                <tr key={x.key}>
                  <td style={{ fontFamily: 'var(--mono)' }}>{x.key}</td>
                  <td>{x.label}</td>
                  <td><input type="checkbox" checked={!!rec.present} onChange={e => setException(x.key, 'present', e.target.checked)} /></td>
                  <td><input type="date" style={{ background: 'var(--surface-3)', border: '1px solid var(--border-strong)', color: 'var(--ink)', borderRadius: 4, padding: '4px 6px', fontSize: 11 }}
                    value={rec.dateRaised || ''} onChange={e => setException(x.key, 'dateRaised', e.target.value)} /></td>
                  <td><input style={{ width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border-strong)', color: 'var(--ink)', borderRadius: 4, padding: '4px 6px', fontSize: 11.5 }}
                    value={rec.funderResponse || ''} onChange={e => setException(x.key, 'funderResponse', e.target.value)} /></td>
                  <td><input style={{ width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border-strong)', color: 'var(--ink)', borderRadius: 4, padding: '4px 6px', fontSize: 11.5 }}
                    value={rec.note || ''} onChange={e => setException(x.key, 'note', e.target.value)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="phxb-panel">
        <h3>Appetite tier assignment</h3>
        <div className="sub">Suggested from the inputs above — the Deal Lead makes and records the final call. Justification is mandatory for Tier 1 pricing flexibility and all Tier 3.</div>
        <div className="phxb-badge cyan" style={{ marginBottom: 12 }}>System suggestion: {suggestedTier}</div>
        <div className="phxb-grid2">
          <SelectField label="Tier assigned" value={elig.tier} onChange={v => { DB.setEligibility(dealId, { tier: v }); patch({ appetiteTier: v }); setTick(x => x + 1); }} options={E.TIERS.map(t => t.key)} />
          <SelectField label="Screening outcome" value={elig.outcome} onChange={v => { DB.setEligibility(dealId, { outcome: v }); setTick(x => x + 1); }} options={['Proceed to Stage 2', 'Decline and close', 'Escalate for pre-clearance']} />
        </div>
        {elig.tier ? <div className="sub" style={{ marginTop: -4 }}>{(E.TIERS.find(t => t.key === elig.tier) || {}).action}</div> : null}
        <TextAreaField label="Justification" value={elig.tierJustification} onChange={v => { DB.setEligibility(dealId, { tierJustification: v }); setTick(x => x + 1); }} />
        <div className="phxb-grid2">
          <TextField label="Screened by" value={elig.screenedBy} onChange={v => { DB.setEligibility(dealId, { screenedBy: v }); setTick(x => x + 1); }} />
          <TextField label="Screened date" type="date" value={elig.screenedDate} onChange={v => { DB.setEligibility(dealId, { screenedDate: v }); setTick(x => x + 1); }} />
        </div>
        {elig.tier === 'Tier 4 — decline' ? (
          <div className="phxb-badge red">Tier 4 — decline in writing, close the tracker row with a reason code. Do not seek terms.</div>
        ) : null}
      </div>
    </Section>
  );
}

/* =========================== TASKS & GATES =========================== */
function GateModal({ gateKey, gateDef, onClose, onPass }) {
  const [owner, setOwner] = React.useState('');
  const [signedBy, setSignedBy] = React.useState('');
  const [evidence, setEvidence] = React.useState('');
  const g = gateDef || E.GATES[gateKey];
  return (
    <div className="phxb-modal-overlay" onClick={onClose}>
      <div className="phxb-modal" onClick={e => e.stopPropagation()}>
        <h3>Pass {gateKey}</h3>
        <div className="sub" style={{ marginTop: -8 }}>{g.label}</div>
        <TextField label="Owner" value={owner} onChange={setOwner} placeholder={g.owner} />
        <TextField label="Signed / confirmed by" value={signedBy} onChange={setSignedBy} />
        <TextAreaField label="Linked evidence" value={evidence} onChange={setEvidence} />
        <div className="foot">
          <button className="phxb-btn ghost" onClick={onClose}>Cancel</button>
          <button className="phxb-btn primary" onClick={() => onPass({ owner: owner || g.owner, signedBy, evidence })}>Confirm gate pass</button>
        </div>
      </div>
    </div>
  );
}
function WaiveModal({ task, onClose, onWaive }) {
  const [reason, setReason] = React.useState('');
  const [approver, setApprover] = React.useState('');
  return (
    <div className="phxb-modal-overlay" onClick={onClose}>
      <div className="phxb-modal" onClick={e => e.stopPropagation()}>
        <h3>Waive {task.ref}</h3>
        <div className="sub" style={{ marginTop: -8 }}>{task.title}</div>
        <TextAreaField label="Reason" value={reason} onChange={setReason} />
        <TextField label="Approver" value={approver} onChange={setApprover} />
        <div className="foot">
          <button className="phxb-btn ghost" onClick={onClose}>Cancel</button>
          <button className="phxb-btn danger" disabled={!reason || !approver} onClick={() => onWaive({ reason, approver })}>Confirm waiver</button>
        </div>
      </div>
    </div>
  );
}

function TasksGatesTab({ deal, dealId, tasks, refresh, role }) {
  const [gateModal, setGateModal] = React.useState(null);
  const [waiveTarget, setWaiveTarget] = React.useState(null);
  const canEditTasks = E.hasPerm(role, 'editTasks');
  const canPass = E.hasPerm(role, 'passGate');
  const canWaiveAny = E.canWaive(role);

  const setStatus = (ref, status) => { DB.updateTask(dealId, ref, { status }); refresh(); };
  const setField = (ref, field, value) => { DB.updateTask(dealId, ref, { [field]: value }); refresh(); };

  return (
    <div>
      {E.STAGES.map(s => {
        const stageTasks = tasks.filter(t => t.stage === s.n);
        const readiness = E.gateReadiness(s.n, tasks);
        const gates = DB.getGates(dealId);
        const gateInfo = gates[s.gate];
        const isCurrentOrPast = deal.stage >= s.n;
        const complete = stageTasks.filter(t => !t.gate && t.status === 'Complete').length;
        const total = stageTasks.filter(t => !t.gate).length;
        return (
          <div className="phxb-panel phxb-stagegroup" key={s.n}>
            <div className="sh">
              <h4>Stage {s.n} — {s.label}</h4>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--muted-2)' }}>{s.owner} · SLA: {s.sla}</span>
              <div className="rule" />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--muted-2)' }}>{complete}/{total} complete</span>
            </div>
            <div className="phxb-progress" style={{ marginBottom: 10 }}><div className="bar" style={{ width: (total ? (complete / total * 100) : 0) + '%' }} /></div>

            {stageTasks.filter(t => !t.gate).map(t => (
              <div className="phxb-task" key={t.ref}>
                <div className="ref">{t.ref}</div>
                <div className="title">{t.title}</div>
                <div className="owner">{t.owner}</div>
                <select className="phxb-status-select" value={t.status} disabled={!canEditTasks} onChange={e => setStatus(t.ref, e.target.value)}>
                  {['Not started', 'In progress', 'Complete', 'Waived', 'Blocked', 'Not applicable'].map(o => <option key={o}>{o}</option>)}
                </select>
                {t.status !== 'Waived' ? <button className="phxb-small-btn" disabled={!canWaiveAny} title={canWaiveAny ? '' : 'Waivers require senior approval (Admin/Principal)'} onClick={() => setWaiveTarget(t)}>Waive</button> : null}
              </div>
            ))}

            {(() => {
              const gateTask = stageTasks.find(t => t.gate);
              if (!gateTask) return null;
              return (
                <div className={'phxb-gatebar ' + (gateInfo && gateInfo.passed ? 'ready' : readiness.ready ? 'ready' : 'blocked')}>
                  <div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 11.5, fontWeight: 700 }}>{s.gate} — {E.GATES[s.gate].label}</div>
                    {gateInfo && gateInfo.passed ? (
                      <div style={{ fontSize: 11, color: 'var(--muted-2)', marginTop: 3 }}>Passed {E.fmt.date(gateInfo.date)} by {gateInfo.signedBy || gateInfo.owner}</div>
                    ) : !readiness.ready ? (
                      <div style={{ fontSize: 11, color: 'var(--red-ink)', marginTop: 3 }}>Blocked — outstanding: {readiness.outstanding.map(t => t.ref).join(', ')}</div>
                    ) : (
                      <div style={{ fontSize: 11, color: 'var(--ok)', marginTop: 3 }}>All required tasks complete — ready to pass</div>
                    )}
                  </div>
                  {!gateInfo || !gateInfo.passed ? (
                    <button className="phxb-btn primary" disabled={!readiness.ready || !canPass} style={{ opacity: (readiness.ready && canPass) ? 1 : .5 }}
                      title={canPass ? '' : 'Your role cannot pass this gate'}
                      onClick={() => setGateModal({ key: s.gate, def: E.GATES[s.gate] })}>Pass gate</button>
                  ) : <span className="phxb-badge ok">Passed</span>}
                </div>
              );
            })()}
          </div>
        );
      })}

      {deal.product === 'Ground-up development' ? (
        <div className="phxb-panel" style={{ borderColor: 'var(--red-border)' }}>
          <div className="phxb-badge amber">
            Ground-up development now runs through the separate Development Finance module (its own D0–D10 process,
            gates and reference series) rather than continuing here — use "+ New enquiry" in Development Finance for
            this deal. This Bridging record predates that split; update its product type once it's re-created there.
          </div>
        </div>
      ) : null}

      {gateModal ? <GateModal gateKey={gateModal.key} gateDef={gateModal.def} onClose={() => setGateModal(null)}
        onPass={(info) => { DB.passGate(dealId, gateModal.key, info); setGateModal(null); refresh(); }} /> : null}
      {waiveTarget ? <WaiveModal task={waiveTarget} onClose={() => setWaiveTarget(null)}
        onWaive={(info) => { DB.waiveTask(dealId, waiveTarget.ref, info); setWaiveTarget(null); refresh(); }} /> : null}
    </div>
  );
}

/* =========================== DOCUMENTS =========================== */
function DocumentsTab({ deal, dealId, role }) {
  const [tick, setTick] = React.useState(0);
  const [folder, setFolder] = React.useState(E.DOC_FOLDERS[0].key);
  const [docType, setDocType] = React.useState('');
  const [linkedStage, setLinkedStage] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const docs = DB.getDocuments(dealId);
  const canUpload = E.hasPerm(role, 'uploadDocument');
  const canDelete = E.hasPerm(role, 'deleteDocument');
  const storageReady = !!(window.sb && window.sb.storage);

  async function onFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file || !canUpload) return;
    const type = docType.trim() || file.name.replace(/\.[^.]+$/, '');
    setBusy(true); setErr('');
    try {
      const version = DB.nextDocVersion(dealId, folder, type);
      const result = await window.PhoenixBridgingStorage.uploadDocument({
        file, orgId: DB.load().org.id, dealRef: deal.dealRef, folder, docType: type, version,
      });
      if (!result.ok) { setErr(result.error || 'Upload failed'); setBusy(false); return; }
      DB.addDocument(dealId, {
        folder, docType: type, fileName: file.name, mimeType: file.type, size: file.size,
        storagePath: result.storagePath || null, dataUrl: result.dataUrl || null, url: result.url || null,
        linkedStage: linkedStage || null, notes: '',
      });
      setDocType(''); setTick(t => t + 1);
    } catch (ex) {
      setErr(String(ex && ex.message || ex));
    } finally {
      setBusy(false);
    }
  }

  function removeDoc(d) {
    if (!canDelete) return;
    if (!confirm('Delete ' + d.fileName + ' (v' + d.version + ')? This cannot be undone.')) return;
    window.PhoenixBridgingStorage.removeDocument({ storagePath: d.storagePath });
    DB.deleteDocument(dealId, d.id);
    setTick(t => t + 1);
  }

  // group by folder, and within folder by docType "family" so versions stack
  const byFolder = {};
  docs.forEach(d => { (byFolder[d.folder] = byFolder[d.folder] || []).push(d); });

  return (
    <div className="phxb-panel">
      <h3>Document vault</h3>
      <div className="sub">
        Naming convention: {deal.dealRef}_DocType_v{'{n}'}_{new Date().toISOString().slice(0, 10)} — no "final", no "final final".
        {' '}{storageReady ? <span className="phxb-badge ok" style={{ marginLeft: 4 }}>Supabase Storage connected</span> : <span className="phxb-badge amber" style={{ marginLeft: 4 }}>Local fallback storage — bucket not detected</span>}
      </div>

      {canUpload ? (
        <div className="phxb-grid3" style={{ marginBottom: 6 }}>
          <Field label="Folder"><select value={folder} onChange={e => setFolder(e.target.value)}>
            {E.DOC_FOLDERS.map(f => <option key={f.key} value={f.key}>{f.key}</option>)}
          </select></Field>
          <Field label="Document type"><input value={docType} onChange={e => setDocType(e.target.value)} placeholder="e.g. SubmissionPack — defaults to the file name" /></Field>
          <Field label="Linked stage (optional)"><select value={linkedStage} onChange={e => setLinkedStage(e.target.value)}>
            <option value="">—</option>{E.STAGES.map(s => <option key={s.n} value={s.n}>Stage {s.n}</option>)}
          </select></Field>
        </div>
      ) : (
        <div className="phxb-badge grey" style={{ marginBottom: 10 }}>Read-only for {role} — uploading requires the "uploadDocument" permission</div>
      )}
      {canUpload ? (
        <div style={{ marginBottom: 16 }}>
          <label className="phxb-btn primary" style={{ display: 'inline-flex', cursor: busy ? 'wait' : 'pointer', opacity: busy ? .6 : 1 }}>
            {busy ? 'Uploading…' : '+ Upload file'}
            <input type="file" style={{ display: 'none' }} disabled={busy} onChange={onFile} />
          </label>
          {err ? <span className="phxb-badge red" style={{ marginLeft: 8 }}>{err}</span> : null}
        </div>
      ) : null}

      {E.DOC_FOLDERS.map(f => {
        const list = (byFolder[f.key] || []).slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        return (
          <div key={f.key} style={{ marginBottom: 14 }}>
            <div className="sh" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--green-500)', fontSize: 12 }}>{f.key}</span>
              <span style={{ fontSize: 11, color: 'var(--muted-2)' }}>{f.contents}</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 10.5, color: 'var(--muted-2)', fontFamily: 'var(--mono)' }}>{list.length}</span>
            </div>
            {list.length === 0 ? <div className="phxb-empty" style={{ padding: '6px 0' }}>No documents yet.</div> : (
              <table className="phxb-table">
                <thead><tr><th>File</th><th style={{ width: 70 }}>Version</th><th style={{ width: 110 }}>Date</th><th style={{ width: 90 }}>Size</th><th>Uploaded by</th><th style={{ width: 90 }}></th></tr></thead>
                <tbody>
                  {list.map(d => (
                    <tr key={d.id}>
                      <td>{d.url ? <a href={d.url} target="_blank" rel="noreferrer" style={{ color: 'var(--green-500)' }}>{d.docType}_v{d.version}_{d.fileName}</a> : d.docType + '_v' + d.version + '_' + d.fileName}</td>
                      <td>v{d.version}</td>
                      <td style={{ fontSize: 11 }}>{E.fmt.date((d.createdAt || '').slice(0, 10))}</td>
                      <td style={{ fontSize: 11 }}>{d.size ? Math.round(d.size / 1024) + ' KB' : '—'}</td>
                      <td style={{ fontSize: 11 }}>{d.uploadedBy}</td>
                      <td>{canDelete ? <button className="phxb-small-btn" onClick={() => removeDoc(d)}>Delete</button> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* =========================== KYC =========================== */
function KycTab({ dealId, role }) {
  const [tick, setTick] = React.useState(0);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const kyc = DB.getKyc(dealId);
  const received = E.KYC_ITEMS.filter(i => (kyc[i.ref] || {}).received).length;
  const set = (ref, field, value) => { DB.setKycItem(dealId, ref, { [field]: value }); setTick(t => t + 1); };
  const invites = DB.getPortalInvites(dealId);
  const canInvite = E.hasPerm(role, 'inviteClientPortal');
  return (
    <div>
    <Section role={role} cap="editKyc" label="KYC / AML">
    <div className="phxb-panel">
      <h3>KYC / AML register</h3>
      <div className="sub">Required from the borrowing entity, every director, every 25%+ shareholder and every guarantor. Pre-checked by Phoenix before it goes to the funder.</div>
      <div style={{ marginBottom: 10 }}>
        <span className="phxb-badge cyan">{received} of {E.KYC_ITEMS.length} received</span>
        {received === E.KYC_ITEMS.length ? <span className="phxb-badge ok" style={{ marginLeft: 6 }}>Pack complete</span> : <span className="phxb-badge amber" style={{ marginLeft: 6 }}>{E.KYC_ITEMS.length - received} outstanding</span>}
      </div>
      <div className="phxb-progress" style={{ marginBottom: 14 }}><div className="bar" style={{ width: (received / E.KYC_ITEMS.length * 100) + '%' }} /></div>
      <table className="phxb-table">
        <thead><tr><th>#</th><th>Document</th><th>Required from</th><th style={{ width: 80 }}>Received</th><th style={{ width: 120 }}>Date</th><th style={{ width: 80 }}>Certified</th><th>Notes</th></tr></thead>
        <tbody>
          {E.KYC_ITEMS.map(i => {
            const rec = kyc[i.ref] || {};
            return (
              <tr key={i.ref}>
                <td style={{ fontFamily: 'var(--mono)' }}>{i.ref}</td>
                <td>{i.document}<div style={{ fontSize: 10.5, color: 'var(--muted-2)' }}>{i.requirement}</div></td>
                <td style={{ fontSize: 11.5, color: 'var(--muted-2)' }}>{i.requiredFrom}</td>
                <td><input type="checkbox" checked={!!rec.received} onChange={e => set(i.ref, 'received', e.target.checked)} /></td>
                <td><input type="date" style={{ background: 'var(--surface-3)', border: '1px solid var(--border-strong)', color: 'var(--ink)', borderRadius: 4, padding: '4px 6px', fontSize: 11 }}
                  value={rec.dateReceived || ''} onChange={e => set(i.ref, 'dateReceived', e.target.value)} /></td>
                <td><input type="checkbox" checked={!!rec.certified} onChange={e => set(i.ref, 'certified', e.target.checked)} /></td>
                <td><input style={{ width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border-strong)', color: 'var(--ink)', borderRadius: 4, padding: '4px 6px', fontSize: 11.5 }}
                  value={rec.notes || ''} onChange={e => set(i.ref, 'notes', e.target.value)} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </Section>

    <div className="phxb-panel">
      <h3>Client portal invites</h3>
      <div className="sub">Invite the client to upload outstanding KYC documents themselves via a secure, deal-scoped link. The Client Portal role sees only this deal's status and its own uploads — nothing else on the tracker.</div>
      {!canInvite ? <div className="phxb-badge grey" style={{ marginBottom: 10 }}>Read-only for {role} — inviting requires the "inviteClientPortal" permission</div> : (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input style={{ flex: 1, background: 'var(--surface-3)', border: '1px solid var(--border-strong)', color: 'var(--ink)', borderRadius: 5, padding: '8px 10px' }}
            type="email" placeholder="client@example.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
          <button className="phxb-btn primary" disabled={!inviteEmail.trim()} onClick={() => { DB.inviteClientPortal(dealId, inviteEmail.trim()); setInviteEmail(''); setTick(t => t + 1); }}>Send invite</button>
        </div>
      )}
      {invites.length === 0 ? <div className="phxb-empty">No portal invites sent yet.</div> : (
        <table className="phxb-table">
          <thead><tr><th>Email</th><th>Status</th><th>Portal link</th><th>Sent</th></tr></thead>
          <tbody>
            {invites.map(inv => (
              <tr key={inv.id}>
                <td>{inv.email}</td>
                <td>{inv.acceptedAt ? <span className="phxb-badge ok">Accepted</span> : <span className="phxb-badge amber">Pending</span>}</td>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>?portal={inv.token}</td>
                <td style={{ fontSize: 11 }}>{new Date(inv.createdAt).toLocaleDateString('en-GB')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
    </div>
  );
}
function FunderTab({ dealId, patch, role }) {
  const [tick, setTick] = React.useState(0);
  const rows = DB.getFunderApproaches(dealId);
  const [f, setF] = React.useState({ funder: '', contact: '', dateApproached: '' });
  return (
    <Section role={role} cap="editFunder" label="Funder Selection">
    <div className="phxb-panel">
      <h3>Funder shortlist and comparison</h3>
      <div className="sub">Gate G2 cannot pass without a selected funder and written client selection recorded on the Overview tab.</div>
      <table className="phxb-table">
        <thead><tr><th>Funder</th><th>Contact</th><th>Approached</th><th>Response</th><th>Rate</th><th>Arr. fee</th><th>Exit fee</th><th>LTV</th><th>Term</th><th>Total cost</th><th>Selected</th></tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={11} className="phxb-empty">No funders approached yet.</td></tr> : rows.map(r => (
            <tr key={r.id}>
              <td>{r.funder}</td><td>{r.contact}</td><td>{E.fmt.date(r.dateApproached)}</td>
              <td>
                <select className="phxb-status-select" value={r.response || ''} onChange={e => { DB.updateFunderApproach(dealId, r.id, { response: e.target.value }); setTick(t => t + 1); }}>
                  <option value="">—</option><option>Pending</option><option>Indicative terms</option><option>AIP</option><option>Declined</option>
                </select>
              </td>
              <td><input style={{ width: 60, background: 'var(--surface-3)', border: '1px solid var(--border-strong)', color: 'var(--ink)', borderRadius: 4, fontSize: 11 }} value={r.rate || ''} onChange={e => { DB.updateFunderApproach(dealId, r.id, { rate: e.target.value }); setTick(t => t + 1); }} /></td>
              <td><input style={{ width: 60, background: 'var(--surface-3)', border: '1px solid var(--border-strong)', color: 'var(--ink)', borderRadius: 4, fontSize: 11 }} value={r.arrangementFee || ''} onChange={e => { DB.updateFunderApproach(dealId, r.id, { arrangementFee: e.target.value }); setTick(t => t + 1); }} /></td>
              <td><input style={{ width: 60, background: 'var(--surface-3)', border: '1px solid var(--border-strong)', color: 'var(--ink)', borderRadius: 4, fontSize: 11 }} value={r.exitFee || ''} onChange={e => { DB.updateFunderApproach(dealId, r.id, { exitFee: e.target.value }); setTick(t => t + 1); }} /></td>
              <td><input style={{ width: 60, background: 'var(--surface-3)', border: '1px solid var(--border-strong)', color: 'var(--ink)', borderRadius: 4, fontSize: 11 }} value={r.ltv || ''} onChange={e => { DB.updateFunderApproach(dealId, r.id, { ltv: e.target.value }); setTick(t => t + 1); }} /></td>
              <td><input style={{ width: 50, background: 'var(--surface-3)', border: '1px solid var(--border-strong)', color: 'var(--ink)', borderRadius: 4, fontSize: 11 }} value={r.term || ''} onChange={e => { DB.updateFunderApproach(dealId, r.id, { term: e.target.value }); setTick(t => t + 1); }} /></td>
              <td><input style={{ width: 80, background: 'var(--surface-3)', border: '1px solid var(--border-strong)', color: 'var(--ink)', borderRadius: 4, fontSize: 11 }} value={r.totalCost || ''} onChange={e => { DB.updateFunderApproach(dealId, r.id, { totalCost: e.target.value }); setTick(t => t + 1); }} /></td>
              <td><input type="radio" name="selfunder" checked={!!r.selected} onChange={() => { DB.updateFunderApproach(dealId, r.id, { selected: true }); patch({ selectedFunder: r.funder }); setTick(t => t + 1); }} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="phxb-grid3" style={{ marginTop: 14 }}>
        <TextField label="Funder" value={f.funder} onChange={v => setF(Object.assign({}, f, { funder: v }))} />
        <TextField label="Contact" value={f.contact} onChange={v => setF(Object.assign({}, f, { contact: v }))} />
        <TextField label="Date approached" type="date" value={f.dateApproached} onChange={v => setF(Object.assign({}, f, { dateApproached: v }))} />
      </div>
      <button className="phxb-btn primary" disabled={!f.funder} onClick={() => {
        DB.addFunderApproach(dealId, f);
        const approached = rows.map(r => r.funder).concat([f.funder]).join(', ');
        patch({ fundersApproached: approached });
        setF({ funder: '', contact: '', dateApproached: '' }); setTick(t => t + 1);
      }}>+ Add funder approach</button>
    </div>
    </Section>
  );
}

/* =========================== VALUATION =========================== */
function ValuationTab({ deal, patch, dealId, role }) {
  const [tick, setTick] = React.useState(0);
  const v = DB.getValuation(dealId);
  const set = (field, val) => { DB.setValuation(dealId, { [field]: val }); setTick(t => t + 1); };
  const variance = (v.assumedValue && v.reportedValue) ? (parseFloat(v.reportedValue) - parseFloat(v.assumedValue)) / parseFloat(v.assumedValue) : null;
  const escalate = variance != null && Math.abs(variance) > 0.05;
  return (
    <Section role={role} cap="editValuation" label="Valuation">
    <div className="phxb-panel">
      <h3>Valuation and underwriting</h3>
      <div className="phxb-grid3">
        <TextField label="Valuer" value={v.valuer} onChange={val => set('valuer', val)} />
        <TextField label="Instruction date" type="date" value={v.instructionDate} onChange={val => set('instructionDate', val)} />
        <TextField label="Inspection date" type="date" value={v.inspectionDate} onChange={val => set('inspectionDate', val)} />
        <TextField label="Report due date" type="date" value={v.reportDue} onChange={val => set('reportDue', val)} />
        <TextField label="Report received date" type="date" value={v.reportReceived} onChange={val => set('reportReceived', val)} />
        <TextField label="Assumed value at screening (£)" type="number" value={v.assumedValue} onChange={val => set('assumedValue', val)} />
        <TextField label="Reported value (£)" type="number" value={v.reportedValue} onChange={val => { set('reportedValue', val); patch({ reportedValue: val }); }} />
        <Field label="Value variance"><input disabled value={variance == null ? '—' : (variance * 100).toFixed(1) + '%'} /></Field>
        <TextField label="Marketing period" value={v.marketingPeriod} onChange={val => set('marketingPeriod', val)} />
      </div>
      <TextAreaField label="Special assumptions" value={v.specialAssumptions} onChange={val => set('specialAssumptions', val)} />
      <TextAreaField label="Qualifications" value={v.qualifications} onChange={val => set('qualifications', val)} />
      <TextAreaField label="Renegotiation record" value={v.renegotiation} onChange={val => set('renegotiation', val)} />
      <TextAreaField label="Client re-presentation evidence" value={v.clientRepresentation} onChange={val => set('clientRepresentation', val)} />
      {escalate ? <div className="phxb-badge red">Value variance exceeds 5% — escalation triggered</div> : null}
    </div>
    </Section>
  );
}

/* =========================== CP SCHEDULE =========================== */
function CpTab({ dealId, role }) {
  const [tick, setTick] = React.useState(0);
  const cps = DB.getCps(dealId);
  const [n, setN] = React.useState({ condition: '', category: '', owner: '', dueDate: '' });
  const satisfied = cps.filter(c => c.status === 'Satisfied').length;
  const outstanding = cps.length - satisfied;
  const today = new Date();
  const overdue = cps.filter(c => c.status !== 'Satisfied' && c.dueDate && new Date(c.dueDate) < today).length;
  const openOver10 = cps.filter(c => {
    if (c.status === 'Satisfied' || !c.dueDate) return false;
    const days = Math.round((today - new Date(c.dueDate)) / 86400000);
    return days > 10;
  }).length;
  return (
    <Section role={role} cap="editCp" label="CP Schedule">
    <div className="phxb-panel">
      <h3>Conditions precedent schedule</h3>
      <div className="sub">Opened at Stage 4 from the offer letter. Nothing is marked satisfied without a filed evidence reference.</div>
      <div style={{ marginBottom: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span className="phxb-badge cyan">{cps.length} total</span>
        <span className="phxb-badge ok">{satisfied} satisfied</span>
        <span className="phxb-badge grey">{outstanding} outstanding</span>
        {overdue > 0 ? <span className="phxb-badge red">{overdue} overdue</span> : null}
        {openOver10 > 0 ? <span className="phxb-badge red">{openOver10} open &gt;10 working days — escalate</span> : null}
      </div>
      <table className="phxb-table">
        <thead><tr><th>Condition</th><th>Category</th><th>Owner</th><th>Due</th><th>Status</th><th>Evidence</th><th>Chase log / notes</th></tr></thead>
        <tbody>
          {cps.length === 0 ? <tr><td colSpan={7} className="phxb-empty">No conditions precedent logged yet.</td></tr> : cps.map(c => (
            <tr key={c.id}>
              <td>{c.condition}</td>
              <td>{c.category}</td>
              <td>{c.owner}</td>
              <td>{E.fmt.date(c.dueDate)}</td>
              <td>
                <select className="phxb-status-select" value={c.status} onChange={e => { DB.updateCp(dealId, c.id, { status: e.target.value }); setTick(t => t + 1); }}>
                  {['Not started', 'In progress', 'Satisfied', 'Waived', 'Blocked'].map(o => <option key={o}>{o}</option>)}
                </select>
              </td>
              <td><input style={{ width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border-strong)', color: 'var(--ink)', borderRadius: 4, padding: '4px 6px', fontSize: 11.5 }}
                value={c.evidence || ''} onChange={e => { DB.updateCp(dealId, c.id, { evidence: e.target.value }); setTick(t => t + 1); }} /></td>
              <td><input style={{ width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border-strong)', color: 'var(--ink)', borderRadius: 4, padding: '4px 6px', fontSize: 11.5 }}
                value={c.notes || ''} onChange={e => { DB.updateCp(dealId, c.id, { notes: e.target.value }); setTick(t => t + 1); }} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="phxb-grid3" style={{ marginTop: 14 }}>
        <TextField label="Condition as drafted in the offer" value={n.condition} onChange={v => setN(Object.assign({}, n, { condition: v }))} />
        <TextField label="Category" value={n.category} onChange={v => setN(Object.assign({}, n, { category: v }))} />
        <TextField label="Owner" value={n.owner} onChange={v => setN(Object.assign({}, n, { owner: v }))} />
      </div>
      <TextField label="Due date" type="date" value={n.dueDate} onChange={v => setN(Object.assign({}, n, { dueDate: v }))} />
      <button className="phxb-btn primary" disabled={!n.condition} onClick={() => { DB.addCp(dealId, n); setN({ condition: '', category: '', owner: '', dueDate: '' }); setTick(t => t + 1); }}>+ Add condition</button>
    </div>
    </Section>
  );
}

/* =========================== FEES & COSTS =========================== */
function FeesTab({ deal, patch, dealId, role }) {
  const [tick, setTick] = React.useState(0);
  const fees = DB.getFees(dealId);
  const set = (ref, field, val) => { DB.setFeeItem(dealId, ref, { [field]: val }); setTick(t => t + 1); };
  const totalClientCost = E.FEE_ROWS.filter(r => r.payableBy === 'Client').reduce((s, r) => s + (parseFloat((fees[r.ref] || {}).amount) || 0), 0);
  const phoenixGross = parseFloat((fees.F10 || {}).amount) || parseFloat(deal.brokerFee) || 0;
  const introducerShare = parseFloat((fees.F11 || {}).amount) || 0;
  const phoenixNet = phoenixGross - introducerShare;
  return (
    <Section role={role} cap="editFees" label="Fees & Costs">
    <div className="phxb-panel">
      <h3>Fees and costs</h3>
      <div className="sub">Cash costs paid by the client, funder charges deducted from the advance, and Phoenix income are kept clearly distinct. Exportable to send to the client.</div>
      <table className="phxb-table">
        <thead><tr><th>Item</th><th>Payable to</th><th>Payable by</th><th>When</th><th style={{ width: 110 }}>Amount (£)</th><th style={{ width: 70 }}>Invoiced</th><th style={{ width: 70 }}>Received</th></tr></thead>
        <tbody>
          {E.FEE_ROWS.map(r => {
            const rec = fees[r.ref] || {};
            return (
              <tr key={r.ref}>
                <td>{r.item}<div style={{ fontSize: 10.5, color: 'var(--muted-2)' }}>{r.basis}</div></td>
                <td style={{ fontSize: 11.5 }}>{r.payableTo}</td>
                <td style={{ fontSize: 11.5 }}>{r.payableBy}</td>
                <td style={{ fontSize: 11.5, color: 'var(--muted-2)' }}>{r.when}</td>
                <td><input type="number" style={{ width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border-strong)', color: 'var(--ink)', borderRadius: 4, padding: '4px 6px', fontSize: 11.5 }}
                  value={rec.amount || ''} onChange={e => set(r.ref, 'amount', e.target.value)} /></td>
                <td><input type="checkbox" checked={!!rec.invoiced} onChange={e => set(r.ref, 'invoiced', e.target.checked)} /></td>
                <td><input type="checkbox" checked={!!rec.received} onChange={e => set(r.ref, 'received', e.target.checked)} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="phxb-grid3" style={{ marginTop: 14 }}>
        <div className="phxb-card"><div className="l">Total client cost of transaction</div><div className="v">{E.fmt.money(totalClientCost)}</div></div>
        <div className="phxb-card"><div className="l">Phoenix gross fee</div><div className="v">{E.fmt.money(phoenixGross)}</div></div>
        <div className="phxb-card"><div className="l">Phoenix net fee after introducer share</div><div className="v">{E.fmt.money(phoenixNet)}</div></div>
      </div>
    </div>
    </Section>
  );
}

/* =========================== NOTES / COMMUNICATIONS =========================== */
function NotesTab({ dealId }) {
  const [tick, setTick] = React.useState(0);
  const [text, setText] = React.useState('');
  const notes = DB.getNotes(dealId);
  return (
    <div className="phxb-panel">
      <h3>Communications / notes</h3>
      <TextAreaField label="Add a file note" value={text} onChange={setText} />
      <button className="phxb-btn primary" disabled={!text.trim()} onClick={() => { DB.addNote(dealId, text.trim()); setText(''); setTick(t => t + 1); }}>Post note</button>
      <div style={{ marginTop: 16 }}>
        {notes.length === 0 ? <div className="phxb-empty">No notes yet.</div> : notes.map(n => (
          <div key={n.id} className="phxb-kv-list" style={{ marginBottom: 4 }}>
            <div className="r"><span>{n.text}</span><span style={{ color: 'var(--muted-2)', fontFamily: 'var(--mono)', fontSize: 10.5 }}>{n.author} · {new Date(n.ts).toLocaleString('en-GB')}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================== POST-COMPLETION =========================== */
function PostCompletionTab({ deal, patch, dealId, role }) {
  const [tick, setTick] = React.useState(0);
  const pc = DB.getPostCompletion(dealId);
  const set = (field, val) => { DB.setPostCompletion(dealId, { [field]: val }); setTick(t => t + 1); };
  const watchDue = deal.termEndDate ? E.fmt.daysUntil(deal.termEndDate) : null;
  const atWatch = watchDue != null && watchDue <= 90;
  return (
    <Section role={role} cap="editPostCompletion" label="Post-completion">
    <div className="phxb-panel">
      <h3>Post-completion and redemption watch</h3>
      {deal.stage < 6 ? <div className="phxb-empty">Activates once the deal reaches Stage 6 (drawdown and completion).</div> : null}
      <div className="phxb-grid3">
        <TextField label="Term end date" type="date" value={deal.termEndDate} onChange={v => patch({ termEndDate: v })} />
        <SelectField label="Exit status" value={pc.exitStatus} onChange={v => set('exitStatus', v)} options={['On track', 'Delayed', 'At risk']} />
        <SelectField label="Exit confidence" value={pc.exitConfidence} onChange={v => set('exitConfidence', v)} options={['Strong', 'Adequate', 'Weak', 'At risk']} />
        <TextField label="Retention balance (£)" type="number" value={pc.retentionBalance} onChange={v => set('retentionBalance', v)} />
        <TextField label="Last review" type="date" value={pc.lastReview} onChange={v => set('lastReview', v)} />
        <TextField label="Refinance / extension opportunity" value={pc.refinanceOpportunity} onChange={v => set('refinanceOpportunity', v)} />
        <TextField label="Redemption date" type="date" value={deal.redemptionDate} onChange={v => patch({ redemptionDate: v })} />
        <TextField label="Security discharge evidence" value={pc.dischargeEvidence} onChange={v => set('dischargeEvidence', v)} />
      </div>
      {atWatch && deal.status !== 'Redeemed' ? <div className="phxb-badge amber">Within redemption watch window (term minus 90 days) — test the exit and flag any deterioration</div> : null}
    </div>
    </Section>
  );
}

/* =========================== AUDIT TRAIL =========================== */
function AuditTab({ dealId }) {
  const log = DB.getAudit(dealId);
  return (
    <div className="phxb-panel">
      <h3>Audit trail</h3>
      {log.length === 0 ? <div className="phxb-empty">No audit events yet.</div> : (
        <table className="phxb-table">
          <thead><tr><th style={{ width: 160 }}>When</th><th>User</th><th>Action</th><th>Reason</th></tr></thead>
          <tbody>
            {log.map(e => (
              <tr key={e.id}>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>{new Date(e.ts).toLocaleString('en-GB')}</td>
                <td>{e.user}</td>
                <td>{e.action}</td>
                <td style={{ color: 'var(--muted-2)' }}>{e.reason || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* =========================== WORKSPACE SHELL =========================== */
const TABS = ['Overview', 'Eligibility', 'Tasks & Gates', 'Documents', 'KYC / AML', 'Funder Selection', 'Valuation', 'CP Schedule', 'Fees & Costs', 'Notes', 'Post-completion', 'Audit Trail'];

function PhxDealWorkspace({ dealId, onBack, onOpenAccount }) {
  const [tick, setTick] = React.useState(0);
  const refresh = () => setTick(t => t + 1);
  const deal = DB.getDeal(dealId);
  const [tab, setTab] = React.useState('Overview');
  const tasks = React.useMemo(() => DB.listTasks(dealId), [dealId, tick]);
  const gates = React.useMemo(() => DB.getGates(dealId), [dealId, tick]);
  const role = DB.currentUser().activeRole;

  if (!deal) return <div className="phxb-empty">Deal not found. <button className="phxb-btn" onClick={onBack}>← Back to pipeline</button></div>;

  const patch = (fields) => { DB.updateDeal(dealId, fields); refresh(); };

  return (
    <div>
      <DealHeader deal={deal} onBack={onBack} tasks={tasks} gates={gates} onOpenAccount={onOpenAccount} />
      <div className="phxb-tabs">
        {TABS.map(t => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      {tab === 'Overview' && <OverviewTab deal={deal} patch={patch} role={role} />}
      {tab === 'Eligibility' && <EligibilityTab deal={deal} patch={patch} dealId={dealId} role={role} />}
      {tab === 'Tasks & Gates' && <TasksGatesTab deal={deal} dealId={dealId} tasks={tasks} refresh={refresh} role={role} />}
      {tab === 'Documents' && <DocumentsTab deal={deal} dealId={dealId} role={role} />}
      {tab === 'KYC / AML' && <KycTab dealId={dealId} role={role} />}
      {tab === 'Funder Selection' && <FunderTab dealId={dealId} patch={patch} role={role} />}
      {tab === 'Valuation' && <ValuationTab deal={deal} patch={patch} dealId={dealId} role={role} />}
      {tab === 'CP Schedule' && <CpTab dealId={dealId} role={role} />}
      {tab === 'Fees & Costs' && <FeesTab deal={deal} patch={patch} dealId={dealId} role={role} />}
      {tab === 'Notes' && <NotesTab dealId={dealId} />}
      {tab === 'Post-completion' && <PostCompletionTab deal={deal} patch={patch} dealId={dealId} role={role} />}
      {tab === 'Audit Trail' && <AuditTab dealId={dealId} />}
    </div>
  );
}

window.PhxDealWorkspace = PhxDealWorkspace;
})();
