/* ===========================================================================
   PHOENIX BRIDGING — business rules engine
   Derived from: Phoenix_Bridging_Brokerage_Procedure_v2.docx (Stage 0-7,
   gates, escalation triggers, funder parameters, tiers, adverse exclusions)
   and Phoenix_Bridging_Deal_Checklist_and_Tracker.xlsx (tracker fields,
   eligibility tests, KYC register, CP schedule, fees & costs, lists).

   Pure config + pure functions. No React, no persistence. Everything here
   is deliberately data-driven so it can move to admin-configurable rows in
   Supabase (funder_parameters, eligibility_tests, reason_codes...) without
   the UI/engine call sites changing shape.
   =========================================================================== */
(function (global) {

  // ---------------------------------------------------------------------
  // Stages
  // ---------------------------------------------------------------------
  const STAGES = [
    { n: 0, key: 'S0', label: 'Intake and registration', owner: 'Case Manager', sla: 'Same working day', gate: 'G0' },
    { n: 1, key: 'S1', label: 'Enquiry and eligibility screening', owner: 'Analyst / Deal Lead', sla: '24 hours', gate: 'G1' },
    { n: 2, key: 'S2', label: 'Mandate, terms and funder selection', owner: 'Deal Lead', sla: 'Terms out within 48 hours of screening', gate: 'G2' },
    { n: 3, key: 'S3', label: 'Packaging and credit submission', owner: 'Deal Lead / Case Manager', sla: '10 working days from full info + acceptance fee', gate: 'G3' },
    { n: 4, key: 'S4', label: 'Funder underwriting and offer', owner: 'Deal Lead', sla: 'Documents reviewed within 24 hours', gate: 'G4' },
    { n: 5, key: 'S5', label: 'Legal progression', owner: 'Case Manager / Deal Lead', sla: '48-hour chase cycle, daily file note', gate: 'G5' },
    { n: 6, key: 'S6', label: 'Drawdown and completion', owner: 'Deal Lead / Case Manager', sla: 'Within 2 working days of CoT', gate: 'G6' },
    { n: 7, key: 'S7', label: 'Post-completion and redemption watch', owner: 'Analyst / Case Manager', sla: 'Monthly, and at term minus 90 days', gate: 'G7' },
  ];

  const GATES = {
    G0: { stage: 0, label: 'Reference issued, folder created, tracker row live, regulated status confirmed', owner: 'Case Manager' },
    G1: { stage: 1, label: 'Metrics inside criteria, tier assigned, adverse screen clear or escalated, exit evidenced', owner: 'Deal Lead' },
    G2: { stage: 2, label: 'Mandate signed, funder selected in writing, acceptance fee received, valuation and legal quotes accepted', owner: 'Deal Lead' },
    G3: { stage: 3, label: 'Complete pack submitted, peer reviewed, nothing material undisclosed', owner: 'Deal Lead' },
    G4: { stage: 4, label: 'Offer accepted, documents reconciled to sanction, variances cleared, CP schedule live', owner: 'Deal Lead' },
    G5: { stage: 5, label: 'Every condition precedent satisfied and evidenced with a document reference', owner: 'Case Manager' },
    G6: { stage: 6, label: 'Funds drawn, security perfected, fee received, handover issued, folder indexed', owner: 'Case Manager' },
    G7: { stage: 7, label: 'Redemption received and discharge evidenced, or re-broked with outcome recorded', owner: 'Case Manager' },
  };

  // ---------------------------------------------------------------------
  // Stage task template — Stage 0 to Stage 7, exact refs from the checklist
  // workbook. `gate: true` marks the row that IS the gate for that stage.
  // ---------------------------------------------------------------------
  const TASK_TEMPLATE = [
    // Stage 0
    ['0.1', 0, 'Log the enquiry on the pipeline tracker and issue the deal reference PHX-BR-YY-NNN', 'Case Manager'],
    ['0.2', 0, 'Create the deal folder from the template — 01_Initial_Enquiry to 08_Checklist', 'Case Manager'],
    ['0.3', 0, 'Record the source, the introducer and whether an introducer fee share applies', 'Case Manager'],
    ['0.4', 0, "Confirm the facility is unregulated — no first charge over a borrower's primary residence; escalate any doubt before responding", 'Deal Lead'],
    ['0.5', 0, 'Acknowledge to the client the same working day and issue the initial information request', 'Deal Lead'],
    ['0.6', 0, 'GATE 0 — reference issued, folder created, tracker row live, regulated status confirmed', 'Case Manager', true],
    // Stage 1
    ['1.1', 1, 'Obtain the minimum information set: asset, loan required, term, purpose, exit, borrowing entity, principals', 'Analyst'],
    ['1.2', 1, 'Confirm the purpose is permitted — not debt restructuring or default recovery alone', 'Deal Lead'],
    ['1.3', 1, 'Run the loan calculator: gross loan, day 1 net advance, retained interest, fees, servicing basis', 'Analyst'],
    ['1.4', 1, 'Calculate day 1 LTV, gross LTV and LTC on the lower of value and purchase price', 'Analyst'],
    ['1.5', 1, "Complete every test on the Eligibility screen tab against the target funder's criteria", 'Analyst'],
    ['1.6', 1, 'Run the adverse credit screen across the borrower, all directors, all shareholders above 25% and every guarantor', 'Deal Lead'],
    ['1.7', 1, 'Assign the lending appetite tier and record the justification', 'Deal Lead'],
    ['1.8', 1, 'Identify every policy exception trigger and prepare the Deal Summary for funder pre-clearance where required', 'Deal Lead'],
    ['1.9', 1, 'Test the exit route and obtain the supporting evidence — agent appraisal, comparables, refinance indication', 'Analyst'],
    ['1.10', 1, 'Produce the Deal Summary and save to 01_Initial_Enquiry', 'Analyst'],
    ['1.11', 1, 'Where the tier is 4, decline in writing, close the tracker row and record the reason code', 'Deal Lead'],
    ['1.12', 1, 'GATE 1 — metrics inside criteria, tier assigned, adverse screen clear or escalated, exit evidenced', 'Deal Lead', true],
    // Stage 2
    ['2.1', 2, 'Issue Phoenix terms of business and the broker fee agreement; obtain signature before approaching any funder', 'Deal Lead'],
    ['2.2', 2, "Issue the privacy notice and record the client's consent to approach named funders", 'Case Manager'],
    ['2.3', 2, 'Build the funder shortlist — three where the deal permits — with the rationale for each', 'Deal Lead'],
    ['2.4', 2, 'Approach each shortlisted funder with the Deal Summary; log the date, contact and response for each', 'Deal Lead'],
    ['2.5', 2, 'Obtain written indicative terms or an AIP from each funder and save copies to 01_Initial_Enquiry', 'Case Manager'],
    ['2.6', 2, 'Prepare the funder comparison: rate, arrangement fee, exit fee, LTV, term, retentions, default position, total cost of borrowing', 'Analyst'],
    ['2.7', 2, "Present the comparison and the recommendation to the client; explain the basis of the recommendation", 'Deal Lead'],
    ['2.8', 2, "Obtain the client's selection in writing", 'Deal Lead'],
    ['2.9', 2, 'Confirm the acceptance or commitment fee amount and the payee; explain that it is payable to the funder and its refundability', 'Deal Lead'],
    ['2.10', 2, 'Chase the acceptance fee and initial forms if not received within 24 hours; record the position at 5 working days', 'Case Manager'],
    ['2.11', 2, 'Confirm the acceptance fee is received by the funder before any packaging begins', 'Case Manager'],
    ['2.12', 2, "Obtain valuation and legal quotes; secure the client's written acceptance of both", 'Case Manager'],
    ['2.13', 2, "Confirm the valuer is instructed through the funder's process", 'Case Manager'],
    ['2.14', 2, 'GATE 2 — mandate signed, funder selected in writing, acceptance fee confirmed received, quotes accepted', 'Deal Lead', true],
    // Stage 3
    ['3.1', 3, 'Issue the full underwriting requirements list to the client and the introducer', 'Deal Lead'],
    ['3.2', 3, 'Collect the completed loan application form', 'Case Manager'],
    ['3.3', 3, 'Collect a personal details form from every director and every shareholder above 25%', 'Case Manager'],
    ['3.4', 3, 'Collect the assets and liabilities statement for each principal and guarantor', 'Case Manager'],
    ['3.5', 3, 'Collect the full KYC and AML pack and pre-check it against the KYC pack tab before it goes to the funder', 'Case Manager'],
    ['3.6', 3, 'Conduct the client interview and file the record', 'Deal Lead'],
    ['3.7', 3, 'Obtain the site visit report where applicable', 'Analyst'],
    ['3.8', 3, 'Verify the source of the equity contribution and file the evidence', 'Analyst'],
    ['3.9', 3, 'Confirm the SPV and ownership chain, and obtain the corporate documents', 'Case Manager'],
    ['3.10', 3, 'Prepare the Phoenix submission pack: deal summary, borrower and asset narrative, metrics, exit analysis, comparable evidence, risks and mitigants', 'Analyst'],
    ['3.11', 3, 'Peer review the pack — arithmetic agrees to the model, every adverse finding and exception disclosed on its face', 'Deal Lead'],
    ['3.12', 3, 'Submit to the funder; log the submission date and open the decision clock', 'Deal Lead'],
    ['3.13', 3, 'Chase the decision at 24 hours; answer every credit query the same working day and version the response into the file', 'Case Manager'],
    ['3.14', 3, 'Save every version of the pack and the query schedule to 05_Credit_Memo', 'Case Manager'],
    ['3.15', 3, 'GATE 3 — complete pack submitted, nothing material undisclosed, queries logged', 'Deal Lead', true],
    // Stage 4
    ['4.1', 4, 'Track the valuation: instruction date, inspection date, report due, report received', 'Case Manager'],
    ['4.2', 4, 'Review the valuation on receipt — reported value, special assumptions, marketing period, any qualification', 'Analyst'],
    ['4.3', 4, 'Quantify any market value or open market value variance and its effect on the metrics', 'Analyst'],
    ['4.4', 4, 'Where the value is short, renegotiate the structure with the funder and re-present to the client in writing', 'Deal Lead'],
    ['4.5', 4, 'Where works are funded, track the QS or monitoring surveyor appointment and the cost plan review', 'Analyst'],
    ['4.6', 4, 'Obtain the credit decision in writing and log the sanctioned terms field by field', 'Deal Lead'],
    ['4.7', 4, 'Reconcile the sanctioned terms to the terms applied for; raise every variance with the funder in writing', 'Deal Lead'],
    ['4.8', 4, 'Explain the sanctioned terms and every condition to the client in writing before acceptance', 'Deal Lead'],
    ['4.9', 4, "Obtain the client's written acceptance of the offer", 'Deal Lead'],
    ['4.10', 4, 'Review the facility and security documents within 24 hours of receipt against the sanctioned terms', 'Deal Lead'],
    ['4.11', 4, 'Issue the borrower security pack explaining what is signed, by whom, in what order and by when', 'Case Manager'],
    ['4.12', 4, 'Log every condition precedent on the CP schedule with an owner and a due date', 'Case Manager'],
    ['4.13', 4, 'GATE 4 — offer accepted, documents reconciled to sanction, variances cleared, CP schedule live', 'Deal Lead', true],
    // Stage 5
    ['5.1', 5, "Confirm the funder's solicitors are instructed and the borrower's solicitors are engaged and funded on account", 'Case Manager'],
    ['5.2', 5, "Obtain both solicitors' contacts and agree the target completion date with all parties", 'Case Manager'],
    ['5.3', 5, 'Maintain the CP schedule as the single source of truth — owner, due date and evidence reference on every item', 'Case Manager'],
    ['5.4', 5, 'Chase every open item on a 48-hour cycle and log each chase', 'Case Manager'],
    ['5.5', 5, 'Post a file note daily while the case is in legals', 'Case Manager'],
    ['5.6', 5, "Escalate to the client in writing where the borrower's solicitor is unresponsive", 'Deal Lead'],
    ['5.7', 5, 'Review every legal memo; escalate material title, planning, security or priority issues to the funder without delay', 'Deal Lead'],
    ['5.8', 5, 'Confirm searches, buildings insurance, and any warranties or collateral warranties are in place', 'Case Manager'],
    ['5.9', 5, 'Confirm the execution formalities — who signs what, certification of ID, witnessing, board resolutions', 'Case Manager'],
    ['5.10', 5, 'Issue a written position update to the client and the introducer every week', 'Deal Lead'],
    ['5.11', 5, 'GATE 5 — every condition precedent satisfied and evidenced with a document reference', 'Deal Lead', true],
    // Stage 6
    ['6.1', 6, 'Confirm the report or certificate on title is received; review it and log every qualification and its mitigation', 'Deal Lead'],
    ['6.2', 6, "Obtain the valuer's post-report confirming comments where the funder requires them", 'Case Manager'],
    ['6.3', 6, 'Confirm the signed loan and security documentation is complete for every party', 'Case Manager'],
    ['6.4', 6, "Confirm the client's equity contribution is received and evidenced where required", 'Analyst'],
    ['6.5', 6, 'Agree the completion statement and funds flow — day 1 advance, retentions, fees, redemption figures, undertakings', 'Analyst'],
    ['6.6', 6, 'Submit the drawdown or final approval request to the funder', 'Deal Lead'],
    ['6.7', 6, 'Confirm the drawdown date, the payment reference and receipt of funds', 'Case Manager'],
    ['6.8', 6, "Confirm security registration and perfection with the funder's solicitors", 'Case Manager'],
    ['6.9', 6, 'Issue the Phoenix broker fee invoice and confirm receipt; settle any introducer share', 'Case Manager'],
    ['6.10', 6, 'Complete the final checklist, index the deal folder and archive', 'Case Manager'],
    ['6.11', 6, 'Issue the completion handover email — term, interest mechanism, retention release procedure, reporting, redemption date, contacts', 'Deal Lead'],
    ['6.12', 6, 'GATE 6 — funds drawn, security perfected, fee received, handover issued, file closed', 'Deal Lead', true],
    // Stage 7
    ['7.1', 7, 'Diarise the term end date and set the redemption watch at term minus 90 days', 'Case Manager'],
    ['7.2', 7, 'Review exit progress monthly against the exit assumed at underwriting', 'Analyst'],
    ['7.3', 7, 'Where works are funded, review the monitoring surveyor reports and any retention release request', 'Analyst'],
    ['7.4', 7, 'Test the exit at term minus 90 days and flag any deterioration to the client and the funder', 'Analyst'],
    ['7.5', 7, 'Prepare the refinance or extension approach early where the exit is at risk', 'Deal Lead'],
    ['7.6', 7, 'Confirm redemption and security discharge; write up the outcome and update the tracker', 'Case Manager'],
    ['7.7', 7, 'GATE 7 — redeemed and discharged, or re-broked, with the outcome recorded', 'Deal Lead', true],
  ].map(r => ({ ref: r[0], stage: r[1], title: r[2], owner: r[3], gate: !!r[4], required: true }));

  function tasksForStage(stage) { return TASK_TEMPLATE.filter(t => t.stage === stage); }
  function gateTaskForStage(stage) { return TASK_TEMPLATE.find(t => t.stage === stage && t.gate); }

  // ---------------------------------------------------------------------
  // Product parameters (Reference tab §8.1 / 8.2)
  // ---------------------------------------------------------------------
  const PRODUCTS = ['Unregulated bridging', 'Light refurbishment', 'Heavy refurbishment', 'Part-complete development'];

  const DEFAULT_PRODUCT_PARAMS = {
    'Unregulated bridging':        { day1Ltv: 0.75, grossLtv: 0.75, ltc: null, pricing: 'BBR + 450bps', note: 'Up to 75% LTV' },
    'Light refurbishment':         { day1Ltv: 0.75, grossLtv: 0.75, ltc: 0.90, pricing: 'BBR + 475bps', note: '70% LTGDV preferred' },
    'Heavy refurbishment':         { day1Ltv: 0.70, grossLtv: 0.70, ltc: 0.85, pricing: 'BBR + 500bps', note: 'Standard terms' },
    'Part-complete development':   { day1Ltv: 0.70, grossLtv: 0.65, ltc: 0.85, pricing: 'BBR + 525bps', note: 'Standard terms' },
  };

  const DEFAULT_CORE_PARAMS = {
    minLoan: 250000,
    maxLoan: 5000000,
    maxTermMonths: 18,
    capPerSqFtLondon: 1250,
    capPerSqFtOutsideLondon: 850,
    singleUnitHouse: 1500000,
    singleUnitFlat: 950000,
    mixedUseCommercialCapPct: 0.25,
    minProfitOnCost: 0.15,
    targetProfitOnCost: 0.20,
    sponsorEquityMinPct: 0.10,
    guaranteeOverrunPct: 0.25,
    borderlineBandPts: 2, // "inside criteria by less than 2 percentage points" -> escalate
  };
  // Back-compat aliases — existing call sites read these two names directly.
  // Prefer passing live params (from bridging-db.js's admin overrides) into
  // autoEligibilityVerdict(); these remain as the shipped defaults.
  const PRODUCT_PARAMS = DEFAULT_PRODUCT_PARAMS;
  const CORE_PARAMS = DEFAULT_CORE_PARAMS;

  // ---------------------------------------------------------------------
  // Eligibility tests — 23 tests, numbered exactly as the workbook.
  // `auto` tests are evaluated from deal fields where the data is numeric;
  // everything else is a manual Pass / Fail / N/A judgement recorded by the
  // Analyst, matching the workbook's "This deal / Within? / Evidence" columns.
  // ---------------------------------------------------------------------
  const ELIGIBILITY_TESTS = [
    { n: 1, key: 'productType', label: 'Product type', requirement: 'Bridging, light refurb, heavy refurb, part-complete development', auto: true },
    { n: 2, key: 'loanSize', label: 'Loan size', requirement: 'Minimum £250,000 — maximum £5,000,000', auto: true },
    { n: 3, key: 'term', label: 'Term', requirement: 'Maximum 18 months', auto: true },
    { n: 4, key: 'location', label: 'Property location', requirement: 'England and Wales only', auto: false },
    { n: 5, key: 'day1Ltv', label: 'Day 1 LTV', requirement: 'See product limit', auto: true },
    { n: 6, key: 'grossLtv', label: 'Gross LTV', requirement: 'See product limit', auto: true },
    { n: 7, key: 'ltc', label: 'LTC (where works funded)', requirement: 'See product limit', auto: true },
    { n: 8, key: 'basisOfAdvance', label: 'Basis of advance', requirement: 'Lower of market value and purchase price. No below-market-value lending', auto: false },
    { n: 9, key: 'capPerSqFt', label: 'Cap value per sq ft', requirement: '£1,250 London / £850 outside London', auto: false },
    { n: 10, key: 'singleUnitValue', label: 'Single unit value', requirement: '£1,500,000 house / £950,000 flat', auto: false },
    { n: 11, key: 'mixedUse', label: 'Mixed use', requirement: 'Commercial element not more than 25% of security value, underwritten vacant possession', auto: false },
    { n: 12, key: 'planning', label: 'Planning', requirement: 'Valid consent for the proposed scheme. Judicial review period expired or insured', auto: false },
    { n: 13, key: 'epc', label: 'EPC', requirement: 'New build minimum B. Refurbishment minimum C', auto: false },
    { n: 14, key: 'assetClass', label: 'Asset class permitted', requirement: 'Not yield-based: no HMO, holiday let, BTR or MFH valuation basis', auto: false },
    { n: 15, key: 'dueDiligence', label: 'Adverse due diligence', requirement: 'No adverse environmental, flooding, planning or building regulation finding', auto: false },
    { n: 16, key: 'experience', label: 'Borrower experience', requirement: 'Requisite experience for the type and scale of the scheme', auto: false },
    { n: 17, key: 'exitRoute', label: 'Exit route', requirement: 'Credible sale or refinance, evidenced before drawdown', auto: false },
    { n: 18, key: 'purpose', label: 'Purpose permitted', requirement: 'Not debt restructuring or default recovery only. Exit bridging acceptable on proven sales', auto: false },
    { n: 19, key: 'structure', label: 'Borrowing structure', requirement: 'Corporate borrower. Not personal name, trust or partnership', auto: false },
    { n: 20, key: 'security', label: 'Security', requirement: 'First legal charge available and unencumbered, or priority agreed', auto: false },
    { n: 21, key: 'guarantees', label: 'Guarantees', requirement: 'Cost overrun guarantee where applicable plus 25% of loan amount available', auto: false },
    { n: 22, key: 'sponsorEquity', label: 'Sponsor equity', requirement: 'Minimum 10% sponsor cash equity where second charge or mezzanine is involved', auto: false },
    { n: 23, key: 'profitOnCost', label: 'Profit on cost', requirement: 'Minimum 15%, target 20%, where a development profit applies', auto: false },
  ];

  const ADVERSE_CATEGORIES = [
    { key: 'A1', label: 'Any CCJ over £1,000 unsatisfied within the last 24 months' },
    { key: 'A2', label: 'Conviction for a serious offence' },
    { key: 'A3', label: 'CVA or IVA unsatisfied within the last 12 months' },
    { key: 'A4', label: 'Active liquidation proceedings' },
    { key: 'A5', label: 'Undischarged bankruptcy within the last 12 months, disclosed or not' },
    { key: 'A6', label: 'Disqualified director' },
    { key: 'A7', label: 'Adverse CIFAS data, or receivership, administration, winding-up petition or liquidation within 24 months, including associated companies' },
    { key: 'A8', label: 'Material arrears on any existing loan or mortgage facility' },
  ];
  const ADVERSE_APPLIES_TO = 'Borrower, all directors, shareholders above 25%, all guarantors';

  const EXCEPTION_TRIGGERS = [
    { key: 'E1', label: 'Policy exception of any nature' },
    { key: 'E2', label: 'Complex ownership structure — multiple layers, offshore entities, trusts' },
    { key: 'E3', label: 'Loan amount above the agreed threshold with the funder' },
    { key: 'E4', label: 'Adverse credit history or adverse news against any party' },
    { key: 'E5', label: 'Concentration risk by sector, geography or borrower' },
    { key: 'E6', label: 'Weak or incomplete assets and liabilities statement' },
    { key: 'E7', label: 'Value materially below the figure assumed at screening' },
    { key: 'E8', label: 'Change of exit route after terms were issued' },
  ];

  const TIERS = [
    { key: 'Tier 1 — strong', label: 'Tier 1 — strong appetite', action: 'Proceed. Confirm any pricing flexibility with the funder before quoting.' },
    { key: 'Tier 2 — balanced', label: 'Tier 2 — balanced appetite', action: 'Proceed at standard pricing.' },
    { key: 'Tier 3 — very limited', label: 'Tier 3 — very limited appetite', action: 'Escalate the Deal Summary and obtain funder pre-clearance before terms are sought.' },
    { key: 'Tier 4 — decline', label: 'Tier 4 — decline', action: 'Decline in writing. Close the tracker row with a reason code. Do not seek terms.' },
  ];

  const REASON_CODES = [
    { code: '01', label: 'Outside funder criteria' },
    { code: '02', label: 'Adverse credit' },
    { code: '03', label: 'Valuation shortfall' },
    { code: '04', label: 'Exit not credible' },
    { code: '05', label: 'Client withdrew' },
    { code: '06', label: 'Lost on price' },
    { code: '07', label: 'Lost on speed' },
    { code: '08', label: 'Funder declined' },
    { code: '09', label: 'Acceptance fee not paid' },
    { code: '10', label: 'Legal or title defect' },
    { code: '11', label: 'Borrower experience insufficient' },
    { code: '12', label: 'Lapsed, no contact' },
    { code: '13', label: 'Regulated, outside remit' },
  ];

  const STATUSES = [
    'Enquiry', 'Screening', 'Terms out', 'Terms accepted', 'Packaged / submitted',
    'Funder underwriting', 'Offer issued', 'In legals', 'Completed', 'Redeemed', 'Not proceeding',
  ];
  const PIPELINE_BUCKET = {
    'Enquiry': 'Unqualified', 'Screening': 'Unqualified',
    'Terms out': 'Qualified, unmandated',
    'Terms accepted': 'Weighted pipeline', 'Packaged / submitted': 'Weighted pipeline', 'Funder underwriting': 'Weighted pipeline',
    'Offer issued': 'Committed pipeline', 'In legals': 'Committed pipeline',
    'Completed': 'Completion', 'Redeemed': 'Closed', 'Not proceeding': 'Excluded',
  };

  const KYC_ITEMS = [
    ['K1', 'Proof of identity', 'Each individual', 'Valid passport or government-issued photo ID'],
    ['K2', 'Proof of address', 'Each individual', 'Utility bill or bank statement, dated within 3 months'],
    ['K3', 'Personal details form', 'Each director and 25%+ shareholder', 'Fully completed and signed'],
    ['K4', 'Assets and liabilities statement', 'Each principal and guarantor', 'Completed on the standard template, signed and dated'],
    ['K5', 'Bank statements', 'Each individual and the entity', '3 to 6 months, most recent within 1 month'],
    ['K6', 'Source of funds evidence', 'Whoever provides the equity', 'Documented trail for the equity contribution'],
    ['K7', 'Certificate of incorporation', 'Borrowing entity', 'Companies House copy'],
    ['K8', 'Articles of association', 'Borrowing entity', 'Current adopted articles'],
    ['K9', 'Register of directors and shareholders', 'Borrowing entity', 'Current, with the ownership chain to ultimate beneficial owner'],
    ['K10', 'Group structure chart', 'Where the borrower sits in a group', 'Showing every layer to ultimate beneficial owner'],
    ['K11', 'Loan application form', 'Borrowing entity', "The funder's form, fully completed and signed"],
    ['K12', 'Sanctions and PEP screening', 'Every party', 'Screened and result filed, re-run before completion'],
    ['K13', 'Adverse credit searches', 'Every party', 'Searches on all eight exclusion categories'],
    ['K14', 'Client interview record', 'Borrower principals', 'Conducted by Phoenix and filed'],
    ['K15', 'Site visit report', 'Security property', 'Where applicable, prior to drawdown'],
    ['K16', 'Experience schedule', 'Borrower principals', 'Completed schemes with addresses, values and dates'],
    ['K17', 'Exit evidence', 'Client', 'Agent appraisal, comparables or refinance indication'],
    ['K18', 'Buildings insurance', 'Security property', 'In place at completion, funder noted as interested party'],
    ['K19', 'Phoenix terms of business', 'Client', 'Signed before any funder is approached'],
    ['K20', 'Privacy notice and consent', 'Client', 'Issued, and consent to approach named funders recorded'],
  ].map(r => ({ ref: r[0], document: r[1], requiredFrom: r[2], requirement: r[3] }));

  const FEE_ROWS = [
    ['F1', 'Acceptance / commitment fee', 'Funder', 'Client', 'On acceptance of terms, before packaging', 'As quoted'],
    ['F2', 'Valuation fee', 'Valuer', 'Client', 'On instruction', 'At cost, no mark-up'],
    ['F3', 'Monitoring surveyor fee', 'QS / MS', 'Client', 'On instruction, where works funded', 'At cost, no mark-up'],
    ['F4', 'Funder legal costs — undertaking', "Funder's solicitors", 'Client', 'On instruction, on undertaking', 'At cost, no mark-up'],
    ['F5', 'Borrower legal costs', "Borrower's solicitors", 'Client', 'As agreed with the solicitor', 'Direct to solicitor'],
    ['F6', 'Search and disbursement costs', 'Solicitors', 'Client', 'During legals', 'At cost'],
    ['F7', 'Arrangement fee', 'Funder', 'Client', 'Deducted at drawdown', '% of gross facility'],
    ['F8', 'Exit fee', 'Funder', 'Client', 'On redemption', '% of gross or of value'],
    ['F9', 'Retained interest', 'Funder', 'Client', 'Retained from the gross facility', 'Months retained x rate'],
    ['F10', 'Phoenix broker fee', 'Phoenix', 'Client', 'On drawdown', '% of gross facility or fixed'],
    ['F11', 'Introducer share', 'Introducer', 'Phoenix', 'On receipt of the Phoenix fee', '% of the Phoenix fee'],
    ['F12', 'Phoenix abort cost recovery', 'Phoenix', 'Client', 'Where the deal aborts after packaging', 'As set out in the terms of business'],
  ].map(r => ({ ref: r[0], item: r[1], payableTo: r[2], payableBy: r[3], when: r[4], basis: r[5] }));

  const ESCALATION_TRIGGERS = [
    'Any doubt that the facility falls outside the unregulated perimeter',
    'Any adverse credit finding on a borrower, director, shareholder above 25% or guarantor',
    "Any metric outside the funder's criteria, or inside by less than two percentage points",
    'Reported value below the assumed value by more than 5%, or any material valuation qualification',
    "Any Tier 3 assignment, and any request to seek pricing below the funder's standard margin",
    'Any conditions precedent item open beyond ten working days, or any legal issue that changes the security position',
    'Any change to the exit route after terms were issued, at any stage including post-completion',
    'Any client instruction to withhold or soften a material fact in a submission',
    'Any funder query that cannot be answered from the file',
  ];

  const SLA_ITEMS = [
    { key: 'ack', label: 'Acknowledgement and information request', measuredFrom: 'Enquiry received', targetHours: 8 },
    { key: 'eligibility', label: 'Eligibility position', measuredFrom: 'Minimum information set received', targetHours: 24 },
    { key: 'terms', label: 'Indicative terms presented', measuredFrom: 'Screening completed and mandate signed', targetHours: 48 },
    { key: 'submission', label: 'Submission to the funder', measuredFrom: 'Full information and acceptance fee received', targetHours: 240 },
    { key: 'creditquery', label: 'Credit queries answered', measuredFrom: 'Query received', targetHours: 8 },
    { key: 'docreview', label: 'Facility and security documents reviewed', measuredFrom: 'Documents received', targetHours: 24 },
    { key: 'solchase', label: 'Solicitor chase cycle', measuredFrom: 'Legal instruction', targetHours: 48, recurring: true },
    { key: 'clientupdate', label: 'Written position update to client and introducer', measuredFrom: 'Legal instruction', targetHours: 168, recurring: true },
    { key: 'drawdown', label: 'Drawdown coordinated', measuredFrom: 'Certificate of title received', targetHours: 48 },
    { key: 'facilityreview', label: 'Facility reviewed monthly', measuredFrom: 'Completion', targetHours: 720, recurring: true },
  ];

  const DOC_FOLDERS = [
    ['01_Initial_Enquiry', 'Enquiry correspondence, information requests, Deal Summary, funder approaches and indicative terms'],
    ['02_KYC_AML', 'Identity and entity documents, KYC/AML pack, sanctions and PEP screening, adverse credit searches'],
    ['03_Application', 'Application form, personal details forms, assets and liabilities statements'],
    ['04_Valuation', 'Instruction, RICS report, Phoenix review and variance note'],
    ['05_Credit_Memo', 'All versions of the submission pack, credit queries and responses'],
    ['06_Legal', 'Facility and security documents, CP evidence, legal correspondence'],
    ['07_Drawdown', 'Report or certificate on title, completion statement, drawdown confirmation'],
    ['08_Checklist', 'The checklist workbook, gate sign-off sheet, SLA log'],
  ].map(r => ({ key: r[0], contents: r[1] }));

  // ---------------------------------------------------------------------
  // Reference generator — PHX-BR-YY-NNN sequential by receipt year
  // ---------------------------------------------------------------------
  function nextDealRef(existingDeals, year) {
    const yy = String(year != null ? year : new Date().getFullYear()).slice(-2);
    const prefix = 'PHX-BR-' + yy + '-';
    let max = 0;
    (existingDeals || []).forEach(d => {
      if (d.dealRef && d.dealRef.indexOf(prefix) === 0) {
        const n = parseInt(d.dealRef.slice(prefix.length), 10);
        if (!isNaN(n) && n > max) max = n;
      }
    });
    return prefix + String(max + 1).padStart(3, '0');
  }

  // ---------------------------------------------------------------------
  // Calculated metrics
  // ---------------------------------------------------------------------
  function num(v) { const n = parseFloat(v); return isFinite(n) ? n : null; }

  function lowerOfValueAndPrice(deal) {
    const v = num(deal.securityValue), p = num(deal.purchasePrice);
    if (v == null && p == null) return null;
    if (v == null) return p;
    if (p == null) return v;
    return Math.min(v, p);
  }

  function calcMetrics(deal) {
    const basis = lowerOfValueAndPrice(deal);
    const day1 = num(deal.day1Advance);
    const gross = num(deal.grossFacility);
    const tpc = num(deal.totalProjectCost);
    const day1Ltv = basis && day1 != null ? day1 / basis : (basis && gross != null ? gross / basis : null);
    const grossLtv = basis && gross != null ? gross / basis : null;
    const ltc = tpc && gross != null ? gross / tpc : null;

    const daysBetween = (a, b) => {
      if (!a || !b) return null;
      const d1 = new Date(a), d2 = new Date(b);
      if (isNaN(d1) || isNaN(d2)) return null;
      return Math.round((d2 - d1) / 86400000);
    };

    return {
      basisValue: basis,
      day1Ltv, grossLtv, ltc,
      daysEnquiryToCompletion: daysBetween(deal.dateReceived, deal.actualCompletion),
      daysToRedemption: daysBetween(deal.actualCompletion, deal.termEndDate),
      valueVariancePct: (deal.assumedValueAtScreening && deal.reportedValue)
        ? (num(deal.reportedValue) - num(deal.assumedValueAtScreening)) / num(deal.assumedValueAtScreening) : null,
    };
  }

  function pctOrDash(n) { return n == null ? '—' : (n * 100).toFixed(1) + '%'; }
  function money(n) {
    if (n == null || n === '' || isNaN(n)) return '—';
    return '£' + Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 });
  }
  function ukDate(s) {
    if (!s) return '—';
    const d = new Date(s);
    if (isNaN(d)) return String(s);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr); if (isNaN(d)) return null;
    return Math.round((d - new Date()) / 86400000);
  }

  // ---------------------------------------------------------------------
  // Eligibility evaluation for the three "auto" numeric tests. Everything
  // else is a manual verdict the Analyst records (matches the workbook,
  // which is manually judged apart from the metric cells).
  // ---------------------------------------------------------------------
  function autoEligibilityVerdict(test, deal, metrics, productParamsLive, coreParamsLive) {
    const allParams = productParamsLive || PRODUCT_PARAMS;
    const core = coreParamsLive || CORE_PARAMS;
    const params = allParams[deal.product] || {};
    switch (test.key) {
      case 'productType':
        return PRODUCTS.indexOf(deal.product) >= 0
          ? { verdict: 'Pass', note: deal.product || '' }
          : { verdict: 'Fail', note: 'Product type not set or not permitted' };
      case 'loanSize': {
        const g = num(deal.grossFacility);
        if (g == null) return { verdict: 'N/A', note: 'Gross facility not entered' };
        const ok = g >= core.minLoan && g <= core.maxLoan;
        return { verdict: ok ? 'Pass' : 'Fail', note: money(g) };
      }
      case 'term': {
        const t = num(deal.termMonths);
        if (t == null) return { verdict: 'N/A', note: '' };
        return { verdict: t <= core.maxTermMonths ? 'Pass' : 'Fail', note: t + ' months' };
      }
      case 'day1Ltv': {
        if (metrics.day1Ltv == null || params.day1Ltv == null) return { verdict: 'N/A', note: '' };
        const limit = params.day1Ltv;
        const borderline = metrics.day1Ltv <= limit && (limit - metrics.day1Ltv) * 100 < core.borderlineBandPts;
        return {
          verdict: metrics.day1Ltv > limit ? 'Fail' : (borderline ? 'Borderline' : 'Pass'),
          note: pctOrDash(metrics.day1Ltv) + ' vs ' + pctOrDash(limit) + ' limit',
        };
      }
      case 'grossLtv': {
        if (metrics.grossLtv == null || params.grossLtv == null) return { verdict: 'N/A', note: '' };
        const limit = params.grossLtv;
        const borderline = metrics.grossLtv <= limit && (limit - metrics.grossLtv) * 100 < core.borderlineBandPts;
        return {
          verdict: metrics.grossLtv > limit ? 'Fail' : (borderline ? 'Borderline' : 'Pass'),
          note: pctOrDash(metrics.grossLtv) + ' vs ' + pctOrDash(limit) + ' limit',
        };
      }
      case 'ltc': {
        if (params.ltc == null) return { verdict: 'N/A', note: 'Not applicable to this product' };
        if (metrics.ltc == null) return { verdict: 'N/A', note: '' };
        const limit = params.ltc;
        const borderline = metrics.ltc <= limit && (limit - metrics.ltc) * 100 < core.borderlineBandPts;
        return {
          verdict: metrics.ltc > limit ? 'Fail' : (borderline ? 'Borderline' : 'Pass'),
          note: pctOrDash(metrics.ltc) + ' vs ' + pctOrDash(limit) + ' limit',
        };
      }
      default:
        return { verdict: 'N/A', note: '' };
    }
  }

  // ---------------------------------------------------------------------
  // Tier suggestion — heuristic from the Tier profile descriptions.
  // Always advisory: the Deal Lead makes and records the final call.
  // ---------------------------------------------------------------------
  function suggestTier(deal, adverseFound, exceptionsPresentCount) {
    if (adverseFound) return 'Tier 4 — decline';
    if (deal.borrowingStructure === 'Personal name' || deal.borrowingStructure === 'Trust' || deal.borrowingStructure === 'Partnership') return 'Tier 4 — decline';
    const exp = deal.borrowerExperience; // 'Experienced' | 'Some' | 'First-time' | 'First-time, supported'
    if (exp === 'Experienced' && deal.professionalTeam === 'Yes') return 'Tier 1 — strong';
    if (exp === 'Some' || exp === 'First-time, supported') return 'Tier 2 — balanced';
    if (exp === 'First-time' || exceptionsPresentCount > 0) return 'Tier 3 — very limited';
    return 'Tier 2 — balanced';
  }

  // ---------------------------------------------------------------------
  // Gate enforcement
  // ---------------------------------------------------------------------
  function gateReadiness(stage, tasks) {
    const stageTasks = tasks.filter(t => t.stage === stage && !t.gate);
    const required = stageTasks.filter(t => t.required !== false);
    const outstanding = required.filter(t => t.status !== 'Complete' && t.status !== 'Waived' && t.status !== 'Not applicable');
    return {
      total: required.length,
      outstanding,
      ready: outstanding.length === 0,
    };
  }

  // ---------------------------------------------------------------------
  // Roles & permissions
  // ---------------------------------------------------------------------
  const ROLES = ['Admin', 'Principal', 'Deal Lead', 'Analyst', 'Case Manager', 'Viewer', 'Client Portal User', 'External Introducer', 'External Solicitor', 'External Funder'];

  // Capability matrix. `true` = allowed. Anything not listed for a role
  // defaults to false. Admin/Principal are given every capability so new
  // capabilities added later are safe-by-default for the senior roles.
  const CAPABILITIES = [
    'editOverview', 'editEligibility', 'editTasks', 'passGate', 'waiveTask',
    'editKyc', 'editFunder', 'editValuation', 'editCp', 'satisfyCp',
    'editFees', 'markFeeReceived', 'addNote', 'uploadDocument', 'deleteDocument',
    'editAdminParams', 'viewAudit', 'editPostCompletion', 'setOutcomeNotProceeding',
    'inviteClientPortal', 'viewMi',
  ];
  const PERMISSIONS = {
    'Admin':        { all: true },
    'Principal':    { all: true },
    'Deal Lead':    { editOverview: 1, editEligibility: 1, editTasks: 1, passGate: 1, editFunder: 1, editValuation: 1, editCp: 1, addNote: 1, uploadDocument: 1, editPostCompletion: 1, setOutcomeNotProceeding: 1, viewAudit: 1, viewMi: 1, inviteClientPortal: 1 },
    'Analyst':      { editEligibility: 1, editTasks: 1, editValuation: 1, addNote: 1, uploadDocument: 1, editPostCompletion: 1, viewAudit: 1, viewMi: 1 },
    'Case Manager': { editOverview: 1, editTasks: 1, editKyc: 1, editCp: 1, satisfyCp: 1, editFees: 1, markFeeReceived: 1, editFunder: 1, addNote: 1, uploadDocument: 1, deleteDocument: 1, viewAudit: 1, viewMi: 1, inviteClientPortal: 1 },
    'Viewer':       { viewAudit: 1, viewMi: 1 },
    'Client Portal User': {},        // handled entirely by the separate portal surface, not the deal workspace
    'External Introducer': {},
    'External Solicitor': {},
    'External Funder': {},
  };
  function hasPerm(role, capability) {
    const p = PERMISSIONS[role];
    if (!p) return false;
    if (p.all) return true;
    return !!p[capability];
  }
  // Waivers require senior approval — deliberately not in any role's map
  // above except via `all`, so only Admin/Principal can grant one.
  function canWaive(role) { return hasPerm(role, 'all') || role === 'Admin' || role === 'Principal'; }

  // ---------------------------------------------------------------------
  // SLA engine — due-at computation per commitment, from deal/task timestamps
  // ---------------------------------------------------------------------
  function addHours(iso, hours) {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d)) return null;
    return new Date(d.getTime() + hours * 3600000);
  }
  // Maps each SLA_ITEMS key to the deal/task timestamp it's measured from,
  // and whether it's "satisfied" (met) once a later timestamp exists.
  function slaStatusForDeal(deal, tasks) {
    const gateDate = (ref) => { const t = (tasks || []).find(x => x.ref === ref); return t && t.doneDate ? t.doneDate : null; };
    const rows = [
      { key: 'ack', from: deal.dateReceived, metWhen: gateDate('0.5') },
      { key: 'eligibility', from: gateDate('1.1'), metWhen: gateDate('1.12') },
      { key: 'terms', from: gateDate('1.12'), metWhen: deal.termsIssued },
      { key: 'submission', from: deal.acceptanceFeePaidDate, metWhen: deal.submittedToFunder },
      { key: 'docreview', from: deal.offerIssued, metWhen: gateDate('4.10') },
      { key: 'drawdown', from: gateDate('6.1'), metWhen: deal.actualCompletion },
      { key: 'facilityreview', from: deal.actualCompletion, metWhen: null, recurringFrom: deal.actualCompletion },
    ];
    const now = new Date();
    return rows.map(r => {
      const def = SLA_ITEMS.find(s => s.key === r.key);
      if (!def || !r.from) return { key: r.key, label: def ? def.label : r.key, status: 'not started', dueAt: null, hoursRemaining: null };
      const dueAt = addHours(r.from, def.targetHours);
      if (r.metWhen) {
        const metDate = new Date(r.metWhen);
        const met = dueAt && metDate <= dueAt;
        return { key: r.key, label: def.label, status: met ? 'met' : 'missed', dueAt, metAt: metDate };
      }
      const hoursRemaining = dueAt ? (dueAt - now) / 3600000 : null;
      return {
        key: r.key, label: def.label, dueAt,
        status: hoursRemaining == null ? 'not started' : hoursRemaining < 0 ? 'breached' : hoursRemaining < 4 ? 'due soon' : 'on track',
        hoursRemaining,
      };
    });
  }

  // ---------------------------------------------------------------------
  // NOTE: development finance (ground-up, part-complete, heavy refurb-as-
  // development, land with planning) is NOT a sub-process of Bridging.
  // It is Phoenix's separate placement-broker line — its own D0-D10
  // stages, its own GD0-GD10 gates, its own PHX-DV-YY-NNN reference series,
  // its own reason codes and statuses — implemented in development-engine.js
  // / development-db.js / development-deal.jsx, per
  // Phoenix_Development_Finance_Brokerage_Procedure_v2.docx. An earlier
  // version of this file guessed at an 11-stage "Ground-up development"
  // sub-process bolted onto a Bridging deal; that was wrong and has been
  // removed now the real procedure is available. Deals needing development
  // finance should be created in the Development Finance module directly.
  // ---------------------------------------------------------------------

  // ---------------------------------------------------------------------
  // export
  // ---------------------------------------------------------------------
  global.PhoenixBridging = {
    STAGES, GATES, TASK_TEMPLATE, tasksForStage, gateTaskForStage,
    PRODUCTS, PRODUCT_PARAMS, CORE_PARAMS, DEFAULT_PRODUCT_PARAMS, DEFAULT_CORE_PARAMS,
    ELIGIBILITY_TESTS, ADVERSE_CATEGORIES, ADVERSE_APPLIES_TO, EXCEPTION_TRIGGERS,
    TIERS, REASON_CODES, STATUSES, PIPELINE_BUCKET,
    KYC_ITEMS, FEE_ROWS, ESCALATION_TRIGGERS, SLA_ITEMS, DOC_FOLDERS,
    ROLES, CAPABILITIES, PERMISSIONS, hasPerm, canWaive,
    nextDealRef, lowerOfValueAndPrice, calcMetrics, autoEligibilityVerdict, suggestTier, gateReadiness, slaStatusForDeal,
    fmt: { pct: pctOrDash, money, date: ukDate, daysUntil },
  };

})(window);
