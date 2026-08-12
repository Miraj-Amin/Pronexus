/* Phoenix Development Finance — Deal Workspace */
(function () {
const E = window.PhoenixDevelopment;
const DB = window.PhoenixDevelopmentDB;

function Field({ label, children }) { return <div className="phxb-field"><label>{label}</label>{children}</div>; }
function TextField({ label, value, onChange, type, placeholder }) {
  return <Field label={label}><input type={type || 'text'} value={value == null ? '' : value} placeholder={placeholder} onChange={e => onChange(e.target.value)} /></Field>;
}
function SelectField({ label, value, onChange, options }) {
  return <Field label={label}><select value={value || ''} onChange={e => onChange(e.target.value)}>
    <option value="">—</option>{options.map(o => <option key={o} value={o}>{o}</option>)}
  </select></Field>;
}
function TextAreaField({ label, value, onChange }) { return <Field label={label}><textarea value={value || ''} onChange={e => onChange(e.target.value)} /></Field>; }

function Section({ role, cap, label, children }) {
  const allowed = window.PhoenixBridging ? window.PhoenixBridging.hasPerm(role, cap) : true; // reuse the shared permission matrix shape
  return (
    <div>
      {!allowed ? <div className="phxb-badge grey" style={{ marginBottom: 12 }}>Read-only for {role} — {label || 'editing this section'} requires the "{cap}" permission</div> : null}
      <div style={allowed ? undefined : { opacity: .55, pointerEvents: 'none', userSelect: 'none' }}>{children}</div>
    </div>
  );
}

/* =========================== HEADER =========================== */
function DealHeader({ deal, onBack, tasks, onOpenAccount }) {
  const metrics = E.calcMetrics(deal);
  const blockers = React.useMemo(() => E.gateReadiness(deal.stage, tasks).outstanding, [tasks, deal.stage]);
  const dueIn = E.fmt.daysUntil(deal.nextActionDue);
  const live = deal.status !== 'Completed and handed over' && deal.status !== 'Not proceeding';
  const slaBadge = !live || dueIn == null ? null : dueIn < 0 ? ['red', 'SLA breach'] : dueIn <= 1 ? ['amber', 'Due soon'] : ['ok', 'On track'];
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
      <div className="addr">{deal.siteAddress || 'No site address recorded'} · {deal.product}</div>
      <div className="row2">
        <div className="kv"><div className="l">Stage</div><div className="v">D{deal.stage} — {(E.STAGES[deal.stage] || {}).label}</div></div>
        <div className="kv"><div className="l">Status</div><div className="v">{deal.status}</div></div>
        <div className="kv"><div className="l">Last gate</div><div className="v">{deal.lastGatePassed || '—'}</div></div>
        <div className="kv"><div className="l">Next action</div><div className="v">{deal.nextAction || '—'}</div></div>
        <div className="kv"><div className="l">Owner</div><div className="v">{deal.nextActionOwner || '—'}</div></div>
        <div className="kv"><div className="l">Due</div><div className="v">{E.fmt.date(deal.nextActionDue)}</div></div>
        <div className="kv"><div className="l">Peak debt</div><div className="v">{E.fmt.money(metrics.peakDebt)}</div></div>
        <div className="kv"><div className="l">LTC / LTGDV</div><div className="v">{E.fmt.pct(metrics.ltc)} / {E.fmt.pct(metrics.ltgdv)}</div></div>
      </div>
      <div className="row3">
        {deal.adverseFlag === 'Yes' ? <span className="phxb-badge red">Adverse</span> : null}
        {deal.policyExceptionFlagged === 'Yes' ? <span className="phxb-badge amber">Exception</span> : null}
        {deal.appetiteTier ? <span className="phxb-badge cyan">{deal.appetiteTier}</span> : null}
        {deal.regulatedStatus && deal.regulatedStatus.indexOf('No') !== 0 ? <span className="phxb-badge red">Regulated concern</span> : null}
        {blockers.length > 0 ? <span className="phxb-badge red">{blockers.length} gate {blockers.length === 1 ? 'blocker' : 'blockers'}</span> : <span className="phxb-badge ok">Gate ready</span>}
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
            options={['Direct — existing client', 'Direct — new enquiry', 'Broker introduction', 'Professional introducer', 'Funder referral', 'Agent referral', 'Repeat / re-broke']} />
          <TextField label="Introducer" value={deal.introducer} onChange={v => patch({ introducer: v })} />
          <SelectField label="Introducer fee share applies" value={deal.introducerShareApplies} onChange={v => patch({ introducerShareApplies: v })} options={['Yes', 'No']} />
          <TextField label="Deal Lead" value={deal.dealLead} onChange={v => patch({ dealLead: v })} />
          <TextField label="Development Analyst" value={deal.developmentAnalyst} onChange={v => patch({ developmentAnalyst: v })} />
          <TextField label="Financial Analyst" value={deal.financialAnalyst} onChange={v => patch({ financialAnalyst: v })} />
          <TextField label="Case Manager" value={deal.caseManager} onChange={v => patch({ caseManager: v })} />
        </div>
      </div>

      <div className="phxb-panel">
        <h3>Client and scheme</h3>
        <div className="phxb-grid3">
          <TextField label="Borrowing entity (SPV)" value={deal.borrowingEntity} onChange={v => patch({ borrowingEntity: v })} />
          <TextField label="Company number" value={deal.companyNumber} onChange={v => patch({ companyNumber: v })} />
          <TextField label="Principals / directors" value={deal.principals} onChange={v => patch({ principals: v })} />
          <TextField label="Guarantors" value={deal.guarantors} onChange={v => patch({ guarantors: v })} />
          <TextField label="Site address" value={deal.siteAddress} onChange={v => patch({ siteAddress: v })} />
          <TextField label="Local authority" value={deal.localAuthority} onChange={v => patch({ localAuthority: v })} />
          <TextField label="Units" type="number" value={deal.units} onChange={v => patch({ units: v })} />
          <TextField label="NSA (sq ft)" type="number" value={deal.nsaSqFt} onChange={v => patch({ nsaSqFt: v })} />
          <SelectField label="Product type" value={deal.product} onChange={v => patch({ product: v })} options={E.PRODUCTS} />
          <TextField label="Planning reference" value={deal.planningRef} onChange={v => patch({ planningRef: v })} />
          <TextField label="Planning granted" type="date" value={deal.planningGranted} onChange={v => patch({ planningGranted: v })} />
          <SelectField label="Regulated status" value={deal.regulatedStatus} onChange={v => patch({ regulatedStatus: v })} options={['No — confirmed unregulated', 'Yes', 'Uncertain']} />
        </div>
        <TextAreaField label="Scheme description" value={deal.schemeDescription} onChange={v => patch({ schemeDescription: v })} />
        {deal.regulatedStatus && deal.regulatedStatus.indexOf('No') !== 0 ? (
          <div className="phxb-badge red">Blocks normal progression — escalate to a principal within the working day</div>
        ) : null}
      </div>

      <div className="phxb-panel">
        <h3>Appraisal metrics</h3>
        <div className="phxb-grid3">
          <TextField label="GDV — client figure (£)" type="number" value={deal.gdvClient} onChange={v => patch({ gdvClient: v })} />
          <TextField label="GDV — verified (£)" type="number" value={deal.gdvVerified} onChange={v => patch({ gdvVerified: v })} />
          <Field label="GDV variance"><input disabled value={E.fmt.pct(metrics.gdvVariance)} /></Field>
          <TextField label="Total development cost (£)" type="number" value={deal.totalCost} onChange={v => patch({ totalCost: v })} />
          <TextField label="Contingency %" value={deal.contingencyPct} onChange={v => patch({ contingencyPct: v })} placeholder="e.g. 0.06" />
          <TextField label="Land value / purchase price (£)" type="number" value={deal.landValue} onChange={v => patch({ landValue: v })} />
          <TextField label="Senior facility (£)" type="number" value={deal.seniorFacility} onChange={v => patch({ seniorFacility: v })} />
          <TextField label="Mezzanine facility (£)" type="number" value={deal.mezzanineFacility} onChange={v => patch({ mezzanineFacility: v })} />
          <TextField label="Client equity (£)" type="number" value={deal.clientEquity} onChange={v => patch({ clientEquity: v })} />
          <Field label="Peak debt (calculated)"><input disabled value={E.fmt.money(metrics.peakDebt)} /></Field>
          <Field label="Profit on cost — base"><input disabled value={E.fmt.pct(metrics.profitOnCost)} /></Field>
          <Field label="Profit on cost — GDV −10%"><input disabled value={E.fmt.pct(metrics.profitOnCostStress)} /></Field>
          <Field label="LTC (calculated)"><input disabled value={E.fmt.pct(metrics.ltc)} /></Field>
          <Field label="LTGDV (calculated)"><input disabled value={E.fmt.pct(metrics.ltgdv)} /></Field>
          <Field label="Structure closes?"><input disabled value={metrics.structureCloses == null ? '—' : (metrics.structureCloses ? 'Yes' : 'No')} /></Field>
          <TextField label="Term (months)" type="number" value={deal.termMonths} onChange={v => patch({ termMonths: v })} />
          <TextField label="Margin (bps)" value={deal.marginBps} onChange={v => patch({ marginBps: v })} />
          <TextField label="Exit route" value={deal.exitRoute} onChange={v => patch({ exitRoute: v })} />
        </div>
        <div className="phxb-badge grey">Viability is tested at the stress case (GDV −10%), not the base case</div>
      </div>

      <div className="phxb-panel">
        <h3>Contractor and structure</h3>
        <div className="phxb-grid3">
          <TextField label="Main contractor" value={deal.contractor} onChange={v => patch({ contractor: v })} />
          <SelectField label="Contractor DD outcome" value={deal.contractorDD} onChange={v => patch({ contractorDD: v })} options={['Cleared', 'Concerns noted', 'Failed']} />
          <TextField label="Contract value : turnover" value={deal.contractValueToTurnover} onChange={v => patch({ contractValueToTurnover: v })} placeholder="e.g. 18%" />
          <SelectField label="Structure" value={deal.structure} onChange={v => patch({ structure: v })} options={['Senior only', 'Senior + stretch', 'Senior + mezzanine', 'Senior + equity', 'Senior + mezzanine + equity']} />
          <TextField label="Funders approached" value={deal.fundersApproached} onChange={v => patch({ fundersApproached: v })} />
          <TextField label="Selected senior funder" value={deal.selectedSeniorFunder} onChange={v => patch({ selectedSeniorFunder: v })} />
          <TextField label="Selected junior funder" value={deal.selectedJuniorFunder} onChange={v => patch({ selectedJuniorFunder: v })} />
          <TextField label="Commitment fee (£)" type="number" value={deal.commitmentFee} onChange={v => patch({ commitmentFee: v })} />
          <TextField label="Commitment fee paid date" type="date" value={deal.commitmentFeePaidDate} onChange={v => patch({ commitmentFeePaidDate: v })} />
          <TextField label="Valuer" value={deal.valuer} onChange={v => patch({ valuer: v })} />
          <TextField label="Monitoring surveyor" value={deal.monitoringSurveyor} onChange={v => patch({ monitoringSurveyor: v })} />
          <TextField label="Funder solicitor" value={deal.funderSolicitor} onChange={v => patch({ funderSolicitor: v })} />
          <TextField label="Borrower solicitor" value={deal.borrowerSolicitor} onChange={v => patch({ borrowerSolicitor: v })} />
        </div>
      </div>

      <div className="phxb-panel">
        <h3>Key dates and completion</h3>
        <div className="phxb-grid3">
          <TextField label="Terms accepted" type="date" value={deal.termsAccepted} onChange={v => patch({ termsAccepted: v })} />
          <TextField label="Valuation received" type="date" value={deal.valuationReceived} onChange={v => patch({ valuationReceived: v })} />
          <TextField label="MS report received" type="date" value={deal.msReportReceived} onChange={v => patch({ msReportReceived: v })} />
          <TextField label="Submitted to funder" type="date" value={deal.submittedToFunder} onChange={v => patch({ submittedToFunder: v })} />
          <TextField label="Decision received" type="date" value={deal.decisionReceived} onChange={v => patch({ decisionReceived: v })} />
          <TextField label="Offer accepted" type="date" value={deal.offerAccepted} onChange={v => patch({ offerAccepted: v })} />
          <TextField label="Legals instructed" type="date" value={deal.legalsInstructed} onChange={v => patch({ legalsInstructed: v })} />
          <TextField label="Target completion" type="date" value={deal.targetCompletion} onChange={v => patch({ targetCompletion: v })} />
          <TextField label="Actual completion" type="date" value={deal.actualCompletion} onChange={v => patch({ actualCompletion: v })} />
          <TextField label="First drawdown date" type="date" value={deal.firstDrawdownDate} onChange={v => patch({ firstDrawdownDate: v })} />
          <TextField label="First drawdown amount (£)" type="number" value={deal.firstDrawdownAmount} onChange={v => patch({ firstDrawdownAmount: v })} />
          <TextField label="File archived date" type="date" value={deal.fileArchivedDate} onChange={v => patch({ fileArchivedDate: v })} />
        </div>
      </div>

      <div className="phxb-panel">
        <h3>Phoenix commercials</h3>
        <div className="phxb-grid3">
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
          <SelectField label="Outcome" value={deal.outcome} onChange={v => patch({ outcome: v })} options={['Proceeding', 'Completed and handed over', 'Not proceeding']} />
          {deal.outcome === 'Not proceeding' ? (
            <React.Fragment>
              <TextField label="Gate reached if aborted" value={deal.gateReachedIfAborted} onChange={v => patch({ gateReachedIfAborted: v })} placeholder="e.g. GD2" />
              <SelectField label="Reason code" value={deal.reasonCode} onChange={v => patch({ reasonCode: v })} options={E.REASON_CODES.map(r => r.code + ' ' + r.label)} />
            </React.Fragment>
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

  const setTest = (key, field, value) => { const t = Object.assign({}, elig.tests[key], { [field]: value }); DB.setEligibility(dealId, { tests: Object.assign({}, elig.tests, { [key]: t }) }); setTick(x => x + 1); };
  const setAdverse = (key, field, value) => {
    const a = Object.assign({}, elig.adverse[key], { [field]: value });
    const adverse = Object.assign({}, elig.adverse, { [key]: a });
    DB.setEligibility(dealId, { adverse });
    patch({ adverseFlag: Object.values(adverse).some(x => x.found && !x.cleared) ? 'Yes' : 'No' });
    setTick(x => x + 1);
  };
  const setException = (key, field, value) => {
    const x = Object.assign({}, elig.exceptions[key], { [field]: value });
    const exceptions = Object.assign({}, elig.exceptions, { [key]: x });
    DB.setEligibility(dealId, { exceptions });
    patch({ policyExceptionFlagged: Object.values(exceptions).some(e => e.present) ? 'Yes' : 'No' });
    setTick(x2 => x2 + 1);
  };

  const verdictFor = (t) => (t.auto ? E.autoEligibilityVerdict(t, deal, metrics, liveParams, liveCore) : null);
  const failCount = E.ELIGIBILITY_TESTS.filter(t => { const auto = verdictFor(t); const v = auto ? auto.verdict : (elig.tests[t.key] || {}).verdict; return v === 'Fail'; }).length;
  const borderlineCount = E.ELIGIBILITY_TESTS.filter(t => { const auto = verdictFor(t); const v = auto ? auto.verdict : (elig.tests[t.key] || {}).verdict; return v === 'Borderline'; }).length;
  const adverseFound = Object.values(elig.adverse).some(a => a.found && !a.cleared);
  const exceptionsPresent = Object.values(elig.exceptions).filter(x => x.present).length;
  const suggestedTier = E.suggestTier(deal, adverseFound, exceptionsPresent);

  return (
    <Section role={role} cap="editEligibility" label="Eligibility">
      <div className="phxb-panel">
        <h3>Pre-screen and eligibility — 28 tests</h3>
        <div className="sub">Every test applied before terms are sought from any funder. Numeric tests (1, 2, 3, 7, 8, 9, 11, 12) are calculated automatically.</div>
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
              const auto = verdictFor(t);
              const rec = elig.tests[t.key] || {};
              const verdict = auto ? auto.verdict : rec.verdict;
              const color = verdict === 'Fail' ? 'red' : verdict === 'Borderline' ? 'amber' : verdict === 'Pass' ? 'ok' : 'grey';
              return (
                <tr key={t.key}>
                  <td>{t.n}</td>
                  <td>{t.label}</td>
                  <td style={{ fontSize: 11.5, color: 'var(--muted-2)' }}>{t.requirement}</td>
                  <td>{auto ? auto.note : (rec.note || '—')}</td>
                  <td>{auto ? <span className={'phxb-badge ' + color}>{verdict || 'N/A'}</span> : (
                    <select className="phxb-status-select" value={rec.verdict || ''} onChange={e => setTest(t.key, 'verdict', e.target.value)}>
                      <option value="">—</option><option>Pass</option><option>Fail</option><option>Borderline</option><option>N/A</option>
                    </select>
                  )}</td>
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
        <div className="sub">Applied to: {E.ADVERSE_APPLIES_TO}.</div>
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
        <div className="phxb-badge cyan" style={{ marginBottom: 12 }}>System suggestion: {suggestedTier}</div>
        <div className="phxb-grid2">
          <SelectField label="Tier assigned" value={elig.tier} onChange={v => { DB.setEligibility(dealId, { tier: v }); patch({ appetiteTier: v }); setTick(x => x + 1); }} options={E.TIERS.map(t => t.key)} />
          <SelectField label="Screening outcome" value={elig.outcome} onChange={v => { DB.setEligibility(dealId, { outcome: v }); setTick(x => x + 1); }} options={['Proceed to D2', 'Decline and close', 'Escalate for pre-clearance']} />
        </div>
        {elig.tier ? <div className="sub" style={{ marginTop: -4 }}>{(E.TIERS.find(t => t.key === elig.tier) || {}).action}</div> : null}
        <TextAreaField label="Justification" value={elig.tierJustification} onChange={v => { DB.setEligibility(dealId, { tierJustification: v }); setTick(x => x + 1); }} />
        <div className="phxb-grid2">
          <TextField label="Screened by" value={elig.screenedBy} onChange={v => { DB.setEligibility(dealId, { screenedBy: v }); setTick(x => x + 1); }} />
          <TextField label="Screened date" type="date" value={elig.screenedDate} onChange={v => { DB.setEligibility(dealId, { screenedDate: v }); setTick(x => x + 1); }} />
        </div>
        {elig.tier === 'Tier 4 — decline' ? <div className="phxb-badge red">Tier 4 — decline in writing, close the tracker row with a reason code. Do not seek terms.</div> : null}
      </div>
    </Section>
  );
}

/* =========================== APPRAISAL & STRESS =========================== */
function AppraisalStressTab({ dealId, role }) {
  const [tick, setTick] = React.useState(0);
  const data = DB.getAppraisalStress(dealId) || {};
  const cols = [['base', 'Base case'], ['gdvMinus5', 'GDV −5%'], ['gdvMinus10', 'GDV −10%'], ['costPlus5', 'Cost +5%'], ['costPlus10', 'Cost +10%'], ['delay3', 'Delay 3 months'], ['combined', 'Combined: GDV −10% & cost +5%']];
  const rows = [['gdv', 'Gross development value'], ['constructionCost', 'Construction cost'], ['contingency', 'Contingency'], ['landFeesStatutory', 'Land, acquisition, fees and statutory'], ['financeCosts', 'Finance costs']];
  const set = (row, col, val) => { DB.setAppraisalStressCell(dealId, row, col, val); setTick(t => t + 1); };
  return (
    <Section role={role} cap="editEligibility" label="Appraisal and stress">
      <div className="phxb-panel">
        <h3>Appraisal — base case and stress cases</h3>
        <div className="sub">The gate test at GD3 is profit on cost surviving GDV minus 10%, not the base case. The delay case assumes the senior margin plus the reference rate (Reference tab) applied to peak debt for the delay period.</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="phxb-table">
            <thead><tr><th>Line</th>{cols.map(c => <th key={c[0]} style={{ minWidth: 110 }}>{c[1]}</th>)}</tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r[0]}>
                  <td>{r[1]}</td>
                  {cols.map(c => (
                    <td key={c[0]}>
                      <input type="number" style={{ width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border-strong)', color: 'var(--ink)', borderRadius: 4, padding: '4px 6px', fontSize: 11.5 }}
                        value={(data[r[0]] || {})[c[0]] || ''} onChange={e => set(r[0], c[0], e.target.value)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
}

/* =========================== STAGE CHECKLIST & GATES =========================== */
function GateModal({ gateKey, onClose, onPass }) {
  const [owner, setOwner] = React.useState('');
  const [signedBy, setSignedBy] = React.useState('');
  const [evidence, setEvidence] = React.useState('');
  const g = E.GATES[gateKey];
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
  const B = window.PhoenixBridging; // shared permission matrix
  const canEditTasks = B ? B.hasPerm(role, 'editTasks') : true;
  const canPass = B ? B.hasPerm(role, 'passGate') : true;
  const canWaiveAny = B ? B.canWaive(role) : true;

  const setStatus = (ref, status) => { DB.updateTask(dealId, ref, { status }); refresh(); };

  return (
    <div>
      {E.STAGES.map(s => {
        const stageTasks = tasks.filter(t => t.stage === s.n);
        const readiness = E.gateReadiness(s.n, tasks);
        const gates = DB.getGates(dealId);
        const gateInfo = gates[s.gate];
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
                {t.status !== 'Waived' ? <button className="phxb-small-btn" disabled={!canWaiveAny} onClick={() => setWaiveTarget(t)}>Waive</button> : null}
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
                      onClick={() => setGateModal(s.gate)}>Pass gate</button>
                  ) : <span className="phxb-badge ok">Passed</span>}
                </div>
              );
            })()}
          </div>
        );
      })}
      {gateModal ? <GateModal gateKey={gateModal} onClose={() => setGateModal(null)}
        onPass={(info) => { DB.passGate(dealId, gateModal, info); setGateModal(null); refresh(); }} /> : null}
      {waiveTarget ? <WaiveModal task={waiveTarget} onClose={() => setWaiveTarget(null)}
        onWaive={(info) => { DB.waiveTask(dealId, waiveTarget.ref, info); setWaiveTarget(null); refresh(); }} /> : null}
    </div>
  );
}

/* =========================== INFORMATION PACK =========================== */
function InfoPackTab({ dealId, role }) {
  const [tick, setTick] = React.useState(0);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const pack = DB.getInfoPack(dealId) || {};
  const received = E.INFO_PACK_ITEMS.filter(i => (pack[i.n] || {}).received).length;
  const set = (n, field, value) => { DB.setInfoPackItem(dealId, n, { [field]: value }); setTick(t => t + 1); };
  const streams = ['Development', 'Commercial', 'Borrower'];
  const invites = DB.getPortalInvites(dealId);
  const B = window.PhoenixBridging;
  const canInvite = B ? B.hasPerm(role, 'inviteClientPortal') : true;
  return (
    <div>
    <Section role={role} cap="editKyc" label="Information pack">
      <div className="phxb-panel">
        <h3>Information pack register — three streams</h3>
        <div className="sub">Worked at D2. Every item received, dated and filed. Where an item cannot be produced, record why and what stands in its place.</div>
        <div style={{ marginBottom: 10 }}>
          <span className="phxb-badge cyan">{received} of {E.INFO_PACK_ITEMS.length} received</span>
          {received === E.INFO_PACK_ITEMS.length ? <span className="phxb-badge ok" style={{ marginLeft: 6 }}>Pack complete</span> : <span className="phxb-badge amber" style={{ marginLeft: 6 }}>{E.INFO_PACK_ITEMS.length - received} outstanding</span>}
        </div>
        <div className="phxb-progress" style={{ marginBottom: 14 }}><div className="bar" style={{ width: (received / E.INFO_PACK_ITEMS.length * 100) + '%' }} /></div>
        {streams.map(stream => (
          <div key={stream} style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--green-500)', marginBottom: 6 }}>{stream}</div>
            <table className="phxb-table">
              <thead><tr><th style={{ width: 40 }}>#</th><th>Item</th><th>Why needed</th><th style={{ width: 70 }}>Received</th><th style={{ width: 120 }}>Date</th><th>Source</th><th>Gap note</th></tr></thead>
              <tbody>
                {E.INFO_PACK_ITEMS.filter(i => i.stream === stream).map(i => {
                  const rec = pack[i.n] || {};
                  return (
                    <tr key={i.n}>
                      <td style={{ fontFamily: 'var(--mono)' }}>{i.n}</td>
                      <td>{i.item}</td>
                      <td style={{ fontSize: 11, color: 'var(--muted-2)' }}>{i.whyNeeded}</td>
                      <td><input type="checkbox" checked={!!rec.received} onChange={e => set(i.n, 'received', e.target.checked)} /></td>
                      <td><input type="date" style={{ background: 'var(--surface-3)', border: '1px solid var(--border-strong)', color: 'var(--ink)', borderRadius: 4, padding: '4px 6px', fontSize: 11 }}
                        value={rec.date || ''} onChange={e => set(i.n, 'date', e.target.value)} /></td>
                      <td><input style={{ width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border-strong)', color: 'var(--ink)', borderRadius: 4, padding: '4px 6px', fontSize: 11.5 }}
                        value={rec.source || ''} onChange={e => set(i.n, 'source', e.target.value)} /></td>
                      <td><input style={{ width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border-strong)', color: 'var(--ink)', borderRadius: 4, padding: '4px 6px', fontSize: 11.5 }}
                        value={rec.gapNote || ''} onChange={e => set(i.n, 'gapNote', e.target.value)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </Section>

    <div className="phxb-panel">
      <h3>Client portal invites</h3>
      <div className="sub">Invite the client to upload outstanding information pack items themselves via a secure, deal-scoped link.</div>
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

/* =========================== CP SCHEDULE =========================== */
function CpTab({ dealId, role }) {
  const [tick, setTick] = React.useState(0);
  const cps = DB.getCps(dealId);
  const [n, setN] = React.useState({ condition: '', category: '', owner: '', dueDate: '' });
  const satisfied = cps.filter(c => c.status === 'Satisfied').length;
  const outstanding = cps.length - satisfied;
  const today = new Date();
  const overdue = cps.filter(c => c.status !== 'Satisfied' && c.dueDate && new Date(c.dueDate) < today).length;
  return (
    <Section role={role} cap="editCp" label="CP schedule">
      <div className="phxb-panel">
        <h3>Conditions precedent schedule</h3>
        <div className="sub">Opened at D9 from the offer letter. Nothing is marked satisfied without a filed evidence reference.</div>
        <div style={{ marginBottom: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span className="phxb-badge cyan">{cps.length} total</span>
          <span className="phxb-badge ok">{satisfied} satisfied</span>
          <span className="phxb-badge grey">{outstanding} outstanding</span>
          {overdue > 0 ? <span className="phxb-badge red">{overdue} overdue</span> : null}
        </div>
        <table className="phxb-table">
          <thead><tr><th>Condition</th><th>Category</th><th>Owner</th><th>Due</th><th>Status</th><th>Evidence</th><th>Chase log / notes</th></tr></thead>
          <tbody>
            {cps.length === 0 ? <tr><td colSpan={7} className="phxb-empty">No conditions precedent logged yet.</td></tr> : cps.map(c => (
              <tr key={c.id}>
                <td>{c.condition}</td><td>{c.category}</td><td>{c.owner}</td><td>{E.fmt.date(c.dueDate)}</td>
                <td><select className="phxb-status-select" value={c.status} onChange={e => { DB.updateCp(dealId, c.id, { status: e.target.value }); setTick(t => t + 1); }}>
                  {['Not started', 'In progress', 'Satisfied', 'Waived', 'Blocked'].map(o => <option key={o}>{o}</option>)}
                </select></td>
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
  const toDrawdown = E.FEE_ROWS.filter(r => r.phase === 'To drawdown' && r.payableBy === 'Client').reduce((s, r) => s + (parseFloat((fees[r.ref] || {}).amount) || 0), 0);
  const throughBuild = E.FEE_ROWS.filter(r => r.phase === 'Through the build' && r.payableBy === 'Client').reduce((s, r) => s + (parseFloat((fees[r.ref] || {}).amount) || 0), 0);
  const phoenixFee = parseFloat((fees.F10 || {}).amount) || parseFloat(deal.brokerFee) || 0;
  return (
    <Section role={role} cap="editFees" label="Fees and costs">
      <div className="phxb-panel">
        <h3>Fees and costs — every layer, every phase</h3>
        <div className="sub">Split between costs to first drawdown and costs continuing through the build after Phoenix has left. Sent to the client before terms are accepted.</div>
        <table className="phxb-table">
          <thead><tr><th>Item</th><th>Layer</th><th>Phase</th><th>Payable to / by</th><th style={{ width: 110 }}>Amount (£)</th><th style={{ width: 70 }}>Invoiced</th><th style={{ width: 70 }}>Received</th></tr></thead>
          <tbody>
            {E.FEE_ROWS.map(r => {
              const rec = fees[r.ref] || {};
              return (
                <tr key={r.ref}>
                  <td>{r.item}<div style={{ fontSize: 10.5, color: 'var(--muted-2)' }}>{r.basis}</div></td>
                  <td style={{ fontSize: 11 }}>{r.layer}</td>
                  <td style={{ fontSize: 11 }}>{r.phase}</td>
                  <td style={{ fontSize: 11, color: 'var(--muted-2)' }}>{r.payableTo} / {r.payableBy}</td>
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
          <div className="phxb-card"><div className="l">Client cost to first drawdown</div><div className="v">{E.fmt.money(toDrawdown)}</div></div>
          <div className="phxb-card"><div className="l">Client cost through the build</div><div className="v">{E.fmt.money(throughBuild)}</div></div>
          <div className="phxb-card"><div className="l">Phoenix fee</div><div className="v">{E.fmt.money(phoenixFee)}</div></div>
        </div>
      </div>
    </Section>
  );
}

/* =========================== HANDOVER PACK =========================== */
function HandoverTab({ dealId, role }) {
  const [tick, setTick] = React.useState(0);
  const h = DB.getHandover(dealId) || { sections: {} };
  const setSection = (n, field, val) => { DB.setHandoverSection(dealId, n, { [field]: val }); setTick(t => t + 1); };
  const setMeta = (field, val) => { DB.setHandoverMeta(dealId, { [field]: val }); setTick(t => t + 1); };
  const complete = E.HANDOVER_SECTIONS.filter(s => { const r = h.sections[s.n] || {}; return r.prepared && r.inPack; }).length;
  return (
    <Section role={role} cap="editPostCompletion" label="Handover pack">
      <div className="phxb-panel">
        <h3>Completion handover — checklist and acknowledgement</h3>
        <div className="sub">The most consequential deliverable in the procedure. Gate GD10 cannot be signed until the handover is acknowledged in writing, the fee is received and the file is archived.</div>
        <div className="phxb-badge cyan" style={{ marginBottom: 12 }}>{complete} of {E.HANDOVER_SECTIONS.length} sections prepared and in the pack</div>
        <table className="phxb-table">
          <thead><tr><th>#</th><th>Section</th><th>Owner</th><th style={{ width: 80 }}>Prepared</th><th style={{ width: 80 }}>In pack</th><th style={{ width: 110 }}>In meeting</th></tr></thead>
          <tbody>
            {E.HANDOVER_SECTIONS.map(s => {
              const r = h.sections[s.n] || {};
              return (
                <tr key={s.n}>
                  <td style={{ fontFamily: 'var(--mono)' }}>{s.n}</td>
                  <td>{s.section}<div style={{ fontSize: 10.5, color: 'var(--muted-2)' }}>{s.content}</div></td>
                  <td style={{ fontSize: 11 }}>{s.owner}</td>
                  <td><input type="checkbox" checked={!!r.prepared} onChange={e => setSection(s.n, 'prepared', e.target.checked)} /></td>
                  <td><input type="checkbox" checked={!!r.inPack} onChange={e => setSection(s.n, 'inPack', e.target.checked)} /></td>
                  <td><input type="checkbox" checked={!!r.coveredInMeeting} onChange={e => setSection(s.n, 'coveredInMeeting', e.target.checked)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="phxb-panel">
        <h3>Handover record</h3>
        <div className="phxb-grid2">
          <TextField label="Handover meeting held — date" type="date" value={h.meetingDate} onChange={v => setMeta('meetingDate', v)} />
          <TextField label="Attended by (client side)" value={h.attendedClient} onChange={v => setMeta('attendedClient', v)} />
          <TextField label="Attended by (Phoenix)" value={h.attendedPhoenix} onChange={v => setMeta('attendedPhoenix', v)} />
          <TextField label="Pack issued — date" type="date" value={h.packIssuedDate} onChange={v => setMeta('packIssuedDate', v)} />
          <TextField label="Signed acknowledgement received — date" type="date" value={h.ackReceivedDate} onChange={v => setMeta('ackReceivedDate', v)} />
        </div>
        {!h.ackReceivedDate ? <div className="phxb-badge amber">No signed acknowledgement on file yet — GD10 cannot be signed without it</div> : <div className="phxb-badge ok">Acknowledgement received — boundary of the engagement is fixed</div>}
      </div>
    </Section>
  );
}

/* =========================== DOCUMENTS =========================== */
function DocumentsTab({ deal, dealId, role }) {
  const [tick, setTick] = React.useState(0);
  const [folder, setFolder] = React.useState(E.DOC_FOLDERS[0].key);
  const [docType, setDocType] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const docs = DB.getDocuments(dealId);
  const B = window.PhoenixBridging;
  const canUpload = B ? B.hasPerm(role, 'uploadDocument') : true;
  const canDelete = B ? B.hasPerm(role, 'deleteDocument') : true;
  const storageReady = !!(window.sb && window.sb.storage);

  async function onFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file || !canUpload) return;
    const type = docType.trim() || file.name.replace(/\.[^.]+$/, '');
    setBusy(true); setErr('');
    try {
      const version = DB.nextDocVersion(dealId, folder, type);
      const result = await window.PhoenixBridgingStorage.uploadDocument({ file, orgId: DB.load().org.id, dealRef: deal.dealRef, folder, docType: type, version });
      if (!result.ok) { setErr(result.error || 'Upload failed'); setBusy(false); return; }
      DB.addDocument(dealId, { folder, docType: type, fileName: file.name, mimeType: file.type, size: file.size, storagePath: result.storagePath || null, dataUrl: result.dataUrl || null, url: result.url || null, notes: '' });
      setDocType(''); setTick(t => t + 1);
    } catch (ex) { setErr(String(ex && ex.message || ex)); } finally { setBusy(false); }
  }
  function removeDoc(d) {
    if (!canDelete) return;
    if (!confirm('Delete ' + d.fileName + ' (v' + d.version + ')? This cannot be undone.')) return;
    window.PhoenixBridgingStorage.removeDocument({ storagePath: d.storagePath });
    DB.deleteDocument(dealId, d.id);
    setTick(t => t + 1);
  }
  const byFolder = {};
  docs.forEach(d => { (byFolder[d.folder] = byFolder[d.folder] || []).push(d); });

  return (
    <div className="phxb-panel">
      <h3>Document vault</h3>
      <div className="sub">
        Naming convention: {deal.dealRef}_DocType_v{'{n}'}_{new Date().toISOString().slice(0, 10)} — no "final". No drawdowns folder, because there are no drawdowns to file after the first.
        {' '}{storageReady ? <span className="phxb-badge ok" style={{ marginLeft: 4 }}>Supabase Storage connected</span> : <span className="phxb-badge amber" style={{ marginLeft: 4 }}>Local fallback storage — bucket not detected</span>}
      </div>
      {canUpload ? (
        <div className="phxb-grid2" style={{ marginBottom: 6 }}>
          <Field label="Folder"><select value={folder} onChange={e => setFolder(e.target.value)}>{E.DOC_FOLDERS.map(f => <option key={f.key} value={f.key}>{f.key}</option>)}</select></Field>
          <Field label="Document type"><input value={docType} onChange={e => setDocType(e.target.value)} placeholder="e.g. Appraisal — defaults to the file name" /></Field>
        </div>
      ) : <div className="phxb-badge grey" style={{ marginBottom: 10 }}>Read-only for {role} — uploading requires the "uploadDocument" permission</div>}
      {canUpload ? (
        <div style={{ marginBottom: 16 }}>
          <label className="phxb-btn primary" style={{ display: 'inline-flex', cursor: busy ? 'wait' : 'pointer', opacity: busy ? .6 : 1 }}>
            {busy ? 'Uploading…' : '+ Upload file'}<input type="file" style={{ display: 'none' }} disabled={busy} onChange={onFile} />
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

/* =========================== NOTES =========================== */
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

/* =========================== AUDIT TRAIL =========================== */
function AuditTab({ dealId }) {
  const log = DB.getAudit(dealId);
  return (
    <div className="phxb-panel">
      <h3>Audit trail</h3>
      {log.length === 0 ? <div className="phxb-empty">No audit events yet.</div> : (
        <table className="phxb-table">
          <thead><tr><th style={{ width: 160 }}>When</th><th>User</th><th>Action</th><th>Reason</th></tr></thead>
          <tbody>{log.map(e => (
            <tr key={e.id}>
              <td style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>{new Date(e.ts).toLocaleString('en-GB')}</td>
              <td>{e.user}</td><td>{e.action}</td><td style={{ color: 'var(--muted-2)' }}>{e.reason || ''}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  );
}

/* =========================== WORKSPACE SHELL =========================== */
const TABS = ['Overview', 'Eligibility', 'Appraisal & Stress', 'Stage Checklist & Gates', 'Information Pack', 'CP Schedule', 'Fees & Costs', 'Handover Pack', 'Documents', 'Notes', 'Audit Trail'];

function PhdDealWorkspace({ dealId, onBack, onOpenAccount }) {
  const [tick, setTick] = React.useState(0);
  const refresh = () => setTick(t => t + 1);
  const deal = DB.getDeal(dealId);
  const [tab, setTab] = React.useState('Overview');
  const tasks = React.useMemo(() => DB.listTasks(dealId), [dealId, tick]);
  const role = DB.currentUser().activeRole;

  if (!deal) return <div className="phxb-empty">Deal not found. <button className="phxb-btn" onClick={onBack}>← Back to pipeline</button></div>;

  const patch = (fields) => { DB.updateDeal(dealId, fields); refresh(); };

  return (
    <div>
      <DealHeader deal={deal} onBack={onBack} tasks={tasks} onOpenAccount={onOpenAccount} />
      <div className="phxb-tabs">{TABS.map(t => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab === 'Overview' && <OverviewTab deal={deal} patch={patch} role={role} />}
      {tab === 'Eligibility' && <EligibilityTab deal={deal} patch={patch} dealId={dealId} role={role} />}
      {tab === 'Appraisal & Stress' && <AppraisalStressTab dealId={dealId} role={role} />}
      {tab === 'Stage Checklist & Gates' && <TasksGatesTab deal={deal} dealId={dealId} tasks={tasks} refresh={refresh} role={role} />}
      {tab === 'Information Pack' && <InfoPackTab dealId={dealId} role={role} />}
      {tab === 'CP Schedule' && <CpTab dealId={dealId} role={role} />}
      {tab === 'Fees & Costs' && <FeesTab deal={deal} patch={patch} dealId={dealId} role={role} />}
      {tab === 'Handover Pack' && <HandoverTab dealId={dealId} role={role} />}
      {tab === 'Documents' && <DocumentsTab deal={deal} dealId={dealId} role={role} />}
      {tab === 'Notes' && <NotesTab dealId={dealId} />}
      {tab === 'Audit Trail' && <AuditTab dealId={dealId} />}
    </div>
  );
}

window.PhdDealWorkspace = PhdDealWorkspace;
})();
