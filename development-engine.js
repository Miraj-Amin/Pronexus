/* ===========================================================================
   PHOENIX DEVELOPMENT FINANCE — business rules engine
   Derived from Phoenix_Development_Finance_Brokerage_Procedure_v2.docx
   (D0-D10, GD0-GD10 gates, escalation triggers, funder parameters, tiers,
   adverse exclusions) and Phoenix_Development_Finance_Checklist_and_Tracker_v2.xlsx
   (tracker fields, eligibility tests, information pack register, CP schedule,
   handover pack, fees and costs, lists).

   This is a SEPARATE brokerage line from Bridging, not a sub-process of it —
   own D0 intake, own reference series (PHX-DV-YY-NNN), own gates, own reason
   codes, own statuses, own roles (Development Analyst + Financial Analyst
   split). Development Finance covers Ground-up development, Part-complete
   development, Heavy refurbishment (drawn against works) and Land with
   planning. Bridging and single-advance facilities — including Light
   refurbishment — stay on the Bridging brokerage procedure.

   Pure config + pure functions, mirroring bridging-engine.js's shape so the
   two modules are easy to maintain side by side.
   =========================================================================== */
(function (global) {

  // ---------------------------------------------------------------------
  // Stages — D0 to D10
  // ---------------------------------------------------------------------
  const STAGES = [
    { n: 0, key: 'D0', label: 'Intake and registration', owner: 'Case Manager', sla: 'Same working day', gate: 'GD0' },
    { n: 1, key: 'D1', label: 'Application and pre-screening', owner: 'Deal Lead', sla: '48 hours', gate: 'GD1' },
    { n: 2, key: 'D2', label: 'Information pack collection', owner: 'Development Analyst / Case Manager', sla: '10 working days', gate: 'GD2' },
    { n: 3, key: 'D3', label: 'Feasibility and viability analysis', owner: 'Development Analyst', sla: '5 working days from GD2', gate: 'GD3' },
    { n: 4, key: 'D4', label: 'Borrower and contractor credit review', owner: 'Development Analyst / Financial Analyst', sla: '5 working days', gate: 'GD4' },
    { n: 5, key: 'D5', label: 'Appraisal and financial modelling', owner: 'Financial Analyst', sla: '5 working days', gate: 'GD5' },
    { n: 6, key: 'D6', label: 'Mandate, structuring and funder selection', owner: 'Deal Lead', sla: 'Terms within 10 working days', gate: 'GD6' },
    { n: 7, key: 'D7', label: 'Security and legal due diligence', owner: 'Deal Lead / Development Analyst', sla: "Managed to the funder's timetable", gate: 'GD7' },
    { n: 8, key: 'D8', label: 'Credit submission and committee', owner: 'Deal Lead', sla: 'Pack out within 5 working days of GD7', gate: 'GD8' },
    { n: 9, key: 'D9', label: 'Credit approval and offer', owner: 'Deal Lead', sla: 'Documents reviewed within 48 hours', gate: 'GD9' },
    { n: 10, key: 'D10', label: 'Closing, first drawdown and handover', owner: 'Deal Lead / Case Manager', sla: 'Within 5 working days of COT', gate: 'GD10' },
  ];

  const GATES = {
    GD0: { stage: 0, label: 'Reference issued, folder created, tracker row live, perimeter confirmed', owner: 'Case Manager' },
    GD1: { stage: 1, label: 'Indicative leverage inside criteria, tier assigned, adverse screen clear, planning confirmed', owner: 'Deal Lead' },
    GD2: { stage: 2, label: 'Information pack complete against the register, or every gap explained with a mitigation', owner: 'Development Analyst' },
    GD3: { stage: 3, label: 'Viability confirmed at the stress case, not only the base case', owner: 'Development Analyst' },
    GD4: { stage: 4, label: 'Borrower experience, liquidity and guarantees cleared; contractor due diligence cleared', owner: 'Development Analyst / Financial Analyst' },
    GD5: { stage: 5, label: 'Appraisal signed off, peak debt fixed, model reconciles to the scheme narrative', owner: 'Financial Analyst' },
    GD6: { stage: 6, label: 'Mandate signed with the scope boundary stated, structure agreed, funder selected in writing for every layer, commitment fee received, professional quotes accepted', owner: 'Deal Lead' },
    GD7: { stage: 7, label: 'Valuation, monitoring surveyor report and legal due diligence received and cleared, findings quantified', owner: 'Deal Lead' },
    GD8: { stage: 8, label: 'Complete pack submitted, nothing material undisclosed, conditions anticipated', owner: 'Deal Lead' },
    GD9: { stage: 9, label: 'Offer accepted, documents reconciled to sanction, every variance corrected or accepted in writing, CP schedule live, client demonstrably understands the mechanics', owner: 'Deal Lead' },
    GD10: { stage: 10, label: 'Every CP satisfied and evidenced, equity injected and evidenced, first drawdown released, handover pack delivered and acknowledged in writing, fee received, file archived', owner: 'Deal Lead / Case Manager' },
  };

  // ---------------------------------------------------------------------
  // Stage task template — D0 to D10, 143 tasks, exact refs from the
  // checklist workbook. `gate: true` marks the row that IS the gate.
  // ---------------------------------------------------------------------
  const TASK_TEMPLATE = [
    // D0
    ['0.1', 0, 'Log the enquiry on the pipeline tracker and issue the deal reference PHX-DV-YY-NNN', 'Case Manager'],
    ['0.2', 0, 'Create the twelve-folder structure and drop in a copy of this workbook as 11_Checklist', 'Case Manager'],
    ['0.3', 0, 'Record the source, the introducer and whether an introducer fee share applies', 'Case Manager'],
    ['0.4', 0, "Confirm the facility is unregulated — no first charge over a borrower's primary residence; escalate any doubt", 'Deal Lead'],
    ['0.5', 0, 'Acknowledge the same working day and issue the full information request list', 'Deal Lead'],
    ['0.6', 0, 'GATE GD0 — reference issued, folder created, tracker row live, perimeter confirmed', 'Case Manager', true],
    // D1
    ['1.1', 1, 'Obtain the scheme summary: overview, GDV, cost estimate, programme, borrower and equity position', 'Deal Lead'],
    ['1.2', 1, 'Review location, scheme type and whether it matches local demand and comparable evidence', 'Development Analyst'],
    ['1.3', 1, 'Confirm valid planning consent is in place for the proposed scheme; record the reference and date', 'Development Analyst'],
    ['1.4', 1, 'Confirm any judicial review period has expired or is adequately insured', 'Development Analyst'],
    ['1.5', 1, "Calculate indicative LTV, LTC and LTGDV from the client's own figures and mark them unverified", 'Financial Analyst'],
    ['1.6', 1, "Test indicative leverage against the funder panel's development parameters", 'Financial Analyst'],
    ['1.7', 1, 'Assess borrower experience against schemes of this specific type and scale', 'Development Analyst'],
    ['1.8', 1, 'Assign the appetite tier and record the justification', 'Deal Lead'],
    ['1.9', 1, 'Run the adverse credit screen on the borrower, all directors, all shareholders above 25% and every guarantor', 'Deal Lead'],
    ['1.10', 1, 'Identify every policy exception trigger and prepare the deal summary for funder pre-clearance where required', 'Deal Lead'],
    ['1.11', 1, 'Take a first view on the exit and whether the sales or letting assumption is plausible', 'Development Analyst'],
    ['1.12', 1, 'Where the tier is 4, decline in writing, close the tracker row and record the reason code', 'Deal Lead'],
    ['1.13', 1, 'GATE GD1 — indicative leverage inside criteria, tier assigned, adverse screen clear, planning confirmed', 'Deal Lead', true],
    // D2
    ['2.1', 2, 'Issue the three-stream information request and agree a delivery timetable with the client', 'Development Analyst'],
    ['2.2', 2, 'Collect planning consent, decision notice, officer report and the conditions schedule', 'Case Manager'],
    ['2.3', 2, 'Collect the approved drawings, unit mix and areas schedule, and the specification', 'Case Manager'],
    ['2.4', 2, 'Collect the build programme and milestone schedule', 'Case Manager'],
    ['2.5', 2, 'Collect the detailed cost plan, tender documents or contractor quotations, and the building contract form', 'Case Manager'],
    ['2.6', 2, 'Collect ground investigation, contamination and utilities and statutory services information', 'Development Analyst'],
    ['2.7', 2, 'Collect the S106 agreement, CIL notices and the schedule of pre-commencement obligations', 'Development Analyst'],
    ['2.8', 2, 'Collect any existing RICS valuation, market analysis and comparable evidence', 'Financial Analyst'],
    ['2.9', 2, 'Collect the sales or letting strategy, agent details, target buyers and exit timing', 'Development Analyst'],
    ['2.10', 2, 'Collect the company and SPV structure to ultimate beneficial owner', 'Case Manager'],
    ['2.11', 2, 'Collect the developer CV and the completed scheme schedule with addresses, values and dates', 'Case Manager'],
    ['2.12', 2, 'Collect full financials and assets and liabilities statements for every principal and guarantor', 'Case Manager'],
    ['2.13', 2, 'Collect equity source evidence and confirm whether the contribution is cash or deemed', 'Financial Analyst'],
    ['2.14', 2, 'Collect the full KYC and AML pack and pre-check it before it goes to any funder', 'Case Manager'],
    ['2.15', 2, 'Chase every outstanding item on a 48-hour cycle and log each chase', 'Case Manager'],
    ['2.16', 2, 'Write a gap note for anything that cannot be produced, with what stands in its place', 'Development Analyst'],
    ['2.17', 2, 'GATE GD2 — pack complete against the register, or every gap explained with a mitigation', 'Development Analyst', true],
    // D3
    ['3.1', 3, 'Verify GDV independently against comparable evidence rather than the client or agent figure', 'Development Analyst'],
    ['3.2', 3, 'Test average and unit values against the cap value and single unit value limits', 'Financial Analyst'],
    ['3.3', 3, 'Run GDV sensitivity at minus 5% and minus 10% against viability', 'Financial Analyst'],
    ['3.4', 3, 'Benchmark the cost plan on a rate per square foot and per unit basis against comparable schemes', 'Development Analyst'],
    ['3.5', 3, 'Identify the high-risk cost categories: groundworks, substructure, utilities, abnormals, facade, provisional sums', 'Development Analyst'],
    ['3.6', 3, "Test the contingency percentage against the funder's minimum and against scheme complexity", 'Development Analyst'],
    ['3.7', 3, "Assess programme realism against the contractor's track record on schemes of this scale", 'Development Analyst'],
    ['3.8', 3, 'Consider seasonal, supply chain and procurement risk and any long-lead items', 'Development Analyst'],
    ['3.9', 3, 'Model sales absorption against local transaction volumes and establish the margin of safety on rate and price', 'Financial Analyst'],
    ['3.10', 3, 'Where the exit is a refinance, test investment yield, rental evidence and lender appetite for the completed asset', 'Financial Analyst'],
    ['3.11', 3, 'Write the viability conclusion at base and stress cases and complete the Appraisal and stress tab', 'Development Analyst'],
    ['3.12', 3, 'GATE GD3 — viability confirmed at the stress case; profit on cost survives GDV minus 10%', 'Development Analyst', true],
    // D4
    ['4.1', 4, "Verify the developer's completed scheme schedule and assess experience of this type and scale specifically", 'Development Analyst'],
    ['4.2', 4, 'Assess the professional team and whether reliance can be obtained from each member', 'Development Analyst'],
    ['4.3', 4, "Obtain the contractor's filed accounts and assess turnover against this contract value", 'Development Analyst'],
    ['4.4', 4, "Review the contractor's current order book, insurances and policy limits", 'Development Analyst'],
    ['4.5', 4, 'Confirm what warranties and collateral warranties the contractor and design team can provide', 'Development Analyst'],
    ['4.6', 4, 'Run adverse searches on the contractor and its directors — filings, judgments, disqualifications', 'Deal Lead'],
    ['4.7', 4, 'Quantify borrower liquidity and capacity to absorb an overrun beyond the contingency', 'Financial Analyst'],
    ['4.8', 4, 'Review personal guarantees available, net asset position and any supporting security', 'Deal Lead'],
    ['4.9', 4, 'Verify the equity contribution, its source and its timing', 'Financial Analyst'],
    ['4.10', 4, 'GATE GD4 — borrower experience, liquidity and guarantees cleared; contractor due diligence cleared', 'Deal Lead', true],
    // D5
    ['5.1', 5, 'Build the appraisal: land and acquisition, construction, fees, contingency, statutory, finance', 'Financial Analyst'],
    ['5.2', 5, 'Build the monthly cashflow with the drawdown profile and establish peak debt', 'Financial Analyst'],
    ['5.3', 5, 'Capitalise interest and fees correctly and confirm the finance cost line reconciles to the cashflow', 'Financial Analyst'],
    ['5.4', 5, 'Produce LTC, LTGDV, day 1 leverage, peak gearing and interest cover', 'Financial Analyst'],
    ['5.5', 5, 'Produce developer profit on cost and on GDV, and the lender risk premium', 'Financial Analyst'],
    ['5.6', 5, 'Run the full stress pack: GDV fall, cost inflation, programme delay, absorption slowdown, and combinations', 'Financial Analyst'],
    ['5.7', 5, 'Produce the monthly and annualised cashflow and the brief and detailed appraisal summaries', 'Financial Analyst'],
    ['5.8', 5, "Reconcile the appraisal line by line to the Development Analyst's cost and programme view; document any difference resolved", 'Financial Analyst'],
    ['5.9', 5, 'GATE GD5 — appraisal signed off, peak debt fixed, model reconciles to the scheme narrative', 'Financial Analyst', true],
    // D6
    ['6.1', 6, 'Issue the Phoenix engagement letter and fee agreement; obtain signature before approaching any funder', 'Deal Lead'],
    ['6.2', 6, 'Issue the privacy notice and record consent to approach the named funders', 'Case Manager'],
    ['6.3', 6, 'Establish the structure required: senior alone, senior plus stretch, mezzanine or equity', 'Deal Lead'],
    ['6.4', 6, 'Model the effect of each structuring option on developer profit, not only on headline rate', 'Financial Analyst'],
    ['6.5', 6, 'Present the structuring options to the client and record the discussion', 'Deal Lead'],
    ['6.6', 6, 'Build the senior funder shortlist — three where the deal permits — each screened against its own criteria', 'Deal Lead'],
    ['6.7', 6, 'Build a separate shortlist for any junior layer', 'Deal Lead'],
    ['6.8', 6, 'Approach each funder with the scheme summary and appraisal extract; log date, contact and response', 'Deal Lead'],
    ['6.9', 6, 'Obtain written indicative terms or heads of terms from each funder and file them', 'Case Manager'],
    ['6.10', 6, 'Prepare the like-for-like comparison: margin, reference rate, fees, non-utilisation, day 1 advance, LTC, LTGDV, drawdown mechanics, release conditions, monitoring cost, default position, total finance cost', 'Financial Analyst'],
    ['6.11', 6, 'Present the comparison and the recommendation and explain the basis for it', 'Deal Lead'],
    ['6.12', 6, "Obtain the client's selection in writing for every layer", 'Deal Lead'],
    ['6.13', 6, 'Confirm the commitment fee, the payee and its refundability, and explain both to the client', 'Deal Lead'],
    ['6.14', 6, "Obtain valuation, monitoring surveyor and legal quotes with the client's written acceptance", 'Case Manager'],
    ['6.15', 6, 'Confirm the commitment fee is received before any due diligence is instructed', 'Case Manager'],
    ['6.16', 6, 'GATE GD6 — mandate signed, structure agreed, funder selected in writing, fees paid, quotes accepted', 'Deal Lead', true],
    // D7
    ['7.1', 7, 'Confirm the RICS valuation is instructed on existing use, residual and GDV bases; track to receipt', 'Case Manager'],
    ['7.2', 7, 'Review the valuation on receipt; quantify variance to the appraisal and write the commentary', 'Financial Analyst'],
    ['7.3', 7, 'Confirm the monitoring surveyor is appointed and track the initial report', 'Development Analyst'],
    ['7.4', 7, 'Review the MS initial report on cost plan adequacy, programme, contract form, contingency and drawdown mechanism', 'Development Analyst'],
    ['7.5', 7, 'Where the MS challenges the cost plan or contingency, re-appraise and re-present before submission', 'Financial Analyst'],
    ['7.6', 7, "Confirm the funder's solicitors are instructed and track the title report", 'Case Manager'],
    ['7.7', 7, 'Obtain and review environmental, contamination and ground condition reports', 'Development Analyst'],
    ['7.8', 7, 'Confirm the utilities and statutory services position and any diversion or connection cost', 'Development Analyst'],
    ['7.9', 7, 'Review planning proofing, the S106 schedule and the CIL position with trigger points and pre-commencement obligations', 'Development Analyst'],
    ['7.10', 7, 'Verify warranties, collateral warranties, design team professional indemnity cover and works insurance', 'Development Analyst'],
    ['7.11', 7, 'Escalate every finding that changes cost, programme, value or security, and reflect it in the appraisal', 'Deal Lead'],
    ['7.12', 7, 'GATE GD7 — valuation, MS report and legal due diligence received and cleared, findings quantified', 'Deal Lead', true],
    // D8
    ['8.1', 8, 'Draft the executive summary and the recommendation', 'Deal Lead'],
    ['8.2', 8, 'Draft the scheme, location and planning sections', 'Development Analyst'],
    ['8.3', 8, 'Include the appraisal at base and stress cases with the sensitivity results', 'Financial Analyst'],
    ['8.4', 8, "Include the cost plan with the monitoring surveyor's view stated alongside the client's figures", 'Development Analyst'],
    ['8.5', 8, 'Include the programme, milestones and the delay risk assessment', 'Development Analyst'],
    ['8.6', 8, 'Include borrower and contractor due diligence in full, adverse findings on the face of the pack', 'Deal Lead'],
    ['8.7', 8, 'Include the exit strategy with comparable evidence and the absorption assumption', 'Development Analyst'],
    ['8.8', 8, 'Draft the full risk analysis with every risk paired to a mitigant', 'Deal Lead'],
    ['8.9', 8, 'Set out the proposed structure, drawdown mechanism and release conditions', 'Deal Lead'],
    ['8.10', 8, 'Anticipate and draft every condition precedent and ongoing monitoring condition', 'Deal Lead'],
    ['8.11', 8, 'Peer review: appraisal agrees to model, narrative agrees to appraisal, nothing material undisclosed', 'Financial Analyst'],
    ['8.12', 8, 'Submit, log the submission, and answer every credit query the same working day with versions filed', 'Deal Lead'],
    ['8.13', 8, 'GATE GD8 — complete pack submitted, nothing undisclosed, conditions anticipated', 'Deal Lead', true],
    // D9
    ['9.1', 9, 'Log the sanctioned terms field by field against the terms applied for', 'Deal Lead'],
    ['9.2', 9, 'Raise every variance with the funder in writing before anything is signed', 'Deal Lead'],
    ['9.3', 9, 'Review the term sheet or heads of terms and the facility and security documents within 48 hours', 'Deal Lead'],
    ['9.4', 9, 'Check the operating covenants specifically: equity-first, MS sign-off before each drawdown, cost to complete covenant, contingency draw approval, sales release and minimum price, longstop and extension, default and cure', 'Deal Lead'],
    ['9.5', 9, 'Explain every operating covenant to the client in writing with the practical consequence stated', 'Deal Lead'],
    ['9.6', 9, "Obtain the client's written acceptance of the offer", 'Deal Lead'],
    ['9.7', 9, 'Issue the borrower security pack with the signing sequence and certification requirements', 'Case Manager'],
    ['9.8', 9, 'Log every condition precedent on the CP schedule with an owner and a due date', 'Case Manager'],
    ['9.9', 9, 'GATE GD9 — offer accepted, documents reconciled, client demonstrably understands the mechanics', 'Deal Lead', true],
    // D10
    ['10.1', 10, 'Drive the CP schedule to completion, chasing every open item on a 48-hour cycle', 'Case Manager'],
    ['10.2', 10, 'Post a file note daily while the case is in legals', 'Case Manager'],
    ['10.3', 10, 'Confirm legal documentation complete and executed by every party', 'Case Manager'],
    ['10.4', 10, 'Confirm security perfection and registration of every charge and debenture', 'Case Manager'],
    ['10.5', 10, 'Confirm the initial valuation and monitoring surveyor sign-off are in place', 'Development Analyst'],
    ['10.6', 10, "Verify the borrower's equity injection is received and evidenced before the first drawdown", 'Financial Analyst'],
    ['10.7', 10, 'Confirm S106 and CIL pre-commencement obligations are discharged, paid or reserved', 'Development Analyst'],
    ['10.8', 10, 'Agree the completion statement and funds flow; confirm the client understands the net figure received', 'Financial Analyst'],
    ['10.9', 10, 'Coordinate the first drawdown and confirm receipt', 'Case Manager'],
    ['10.10', 10, 'Prepare the completion handover pack in full — see the Handover pack tab', 'Deal Lead'],
    ['10.11', 10, 'Hold the handover meeting and walk the client through the drawdown mechanism and a worked example month', 'Deal Lead'],
    ['10.12', 10, "Obtain the client's signed handover acknowledgement fixing the boundary of the engagement", 'Deal Lead'],
    ['10.13', 10, 'Issue the Phoenix fee invoice, confirm receipt and settle any introducer share', 'Case Manager'],
    ['10.14', 10, 'Complete the final checklist, index the deal folder and archive it', 'Case Manager'],
    ['10.15', 10, 'Set a single diary note for a future business development conversation, with no service obligation attached', 'Deal Lead'],
    ['10.16', 10, 'GATE GD10 — drawn, handover acknowledged in writing, fee received, file archived', 'Deal Lead', true],
  ].map(r => ({ ref: r[0], stage: r[1], title: r[2], owner: r[3], gate: !!r[4], required: true }));

  function gateTaskForStage(stage) { return TASK_TEMPLATE.find(t => t.stage === stage && t.gate); }

  // ---------------------------------------------------------------------
  // Products & parameters (Reference tab — August 2026)
  // ---------------------------------------------------------------------
  const PRODUCTS = ['Ground-up development', 'Part-complete development', 'Heavy refurbishment', 'Land with planning'];

  const DEFAULT_PRODUCT_PARAMS = {
    'Ground-up development':      { day1Ltv: 0.55, grossLtv: 0.65, ltc: 0.85, pricing: 'BBR + 525bps', note: '65% day 1 in Greater London and Home Counties' },
    'Part-complete development':  { day1Ltv: 0.70, grossLtv: 0.65, ltc: 0.85, pricing: 'BBR + 525bps', note: 'Standard terms' },
    'Heavy refurbishment':        { day1Ltv: 0.70, grossLtv: 0.70, ltc: 0.85, pricing: 'BBR + 500bps', note: 'Standard terms' },
    'Land with planning':         { day1Ltv: 0.50, grossLtv: null, ltc: null, pricing: 'BBR + 600bps', note: 'Tier 3 only; against purchase price' },
  };
  const DEFAULT_CORE_PARAMS = {
    minFacility: 250000,
    maxFacility: 5000000,
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
    borderlineBandPts: 2,
    referenceRate: 0.0425, // Bank of England base rate, update when it moves — used by the delay stress case
  };

  // ---------------------------------------------------------------------
  // Eligibility — 28 tests, numbered exactly as the workbook.
  // ---------------------------------------------------------------------
  const ELIGIBILITY_TESTS = [
    { n: 1, key: 'productType', label: 'Product type', requirement: 'Ground-up, part-complete, heavy refurbishment or land with planning', auto: true },
    { n: 2, key: 'facilitySize', label: 'Facility size', requirement: 'Minimum £250,000 — maximum £5,000,000', auto: true },
    { n: 3, key: 'facilityTerm', label: 'Facility term', requirement: 'Maximum 18 months, covering build plus sales period', auto: true },
    { n: 4, key: 'location', label: 'Location', requirement: 'England and Wales only', auto: false },
    { n: 5, key: 'planningConsent', label: 'Planning consent', requirement: 'Valid consent for the proposed scheme; JR expired or insured', auto: false },
    { n: 6, key: 's106Identified', label: 'S106 and CIL identified', requirement: 'Obligations, amounts and trigger points known before terms are sought', auto: false },
    { n: 7, key: 'day1Ltv', label: 'Day 1 LTV against land', requirement: 'See product limit', auto: true },
    { n: 8, key: 'ltc', label: 'LTC', requirement: 'See product limit', auto: true },
    { n: 9, key: 'ltgdv', label: 'LTGDV', requirement: 'See product limit', auto: true },
    { n: 10, key: 'basisOfLandAdvance', label: 'Basis of land advance', requirement: 'Lower of market value and purchase price. No below-market-value lending', auto: false },
    { n: 11, key: 'profitOnCostBase', label: 'Profit on cost — base case', requirement: 'Minimum 15%, target 20%', auto: true },
    { n: 12, key: 'profitOnCostStress', label: 'Profit on cost — GDV minus 10%', requirement: 'Must remain positive and ideally above 10%', auto: true },
    { n: 13, key: 'structureCloses', label: 'Funding structure closes', requirement: 'Sources must at least equal total development cost', auto: false },
    { n: 14, key: 'contingency', label: 'Contingency', requirement: "At or above the funder minimum percentage of construction cost", auto: false },
    { n: 15, key: 'capPerSqFt', label: 'Cap value per sq ft', requirement: '£1,250 London / £850 outside London', auto: false },
    { n: 16, key: 'singleUnitValue', label: 'Single unit value', requirement: '£1,500,000 house / £950,000 flat', auto: false },
    { n: 17, key: 'mixedUse', label: 'Mixed use', requirement: 'Commercial element not more than 25% of security value, vacant possession basis', auto: false },
    { n: 18, key: 'epc', label: 'EPC', requirement: 'New build minimum B; refurbishment minimum C', auto: false },
    { n: 19, key: 'assetClass', label: 'Asset class permitted', requirement: 'Not yield-based: no HMO, holiday let, BTR or MFH valuation basis', auto: false },
    { n: 20, key: 'pricePoint', label: 'Price point', requirement: 'Units must not set a new unproven price point for the area', auto: false },
    { n: 21, key: 'borrowerExperience', label: 'Borrower experience', requirement: 'Requisite experience for this type and scale specifically', auto: false },
    { n: 22, key: 'contractorCapacity', label: 'Contractor capacity', requirement: 'Contract value proportionate to contractor turnover; insurances and warranties available', auto: false },
    { n: 23, key: 'equityPosition', label: 'Equity position', requirement: 'Sponsor cash equity confirmed; minimum 10% where mezzanine or second charge is involved', auto: false },
    { n: 24, key: 'guarantees', label: 'Guarantees', requirement: 'Full cost overrun guarantee plus 25% of the loan amount available', auto: false },
    { n: 25, key: 'security', label: 'Security', requirement: 'First legal charge available over the whole site; debenture available', auto: false },
    { n: 26, key: 'groundEnvironmental', label: 'Ground and environmental', requirement: 'No adverse finding; abnormals identified and priced', auto: false },
    { n: 27, key: 'exitRoute', label: 'Exit route', requirement: 'Credible sale or refinance with comparable support', auto: false },
    { n: 28, key: 'borrowingStructure', label: 'Borrowing structure', requirement: 'Corporate SPV. Not personal name, trust or partnership', auto: false },
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
  const ADVERSE_APPLIES_TO = 'Borrower, all directors, shareholders above 25%, all guarantors, and the main contractor';

  const EXCEPTION_TRIGGERS = [
    { key: 'E1', label: 'Policy exception of any nature' },
    { key: 'E2', label: 'Complex ownership structure — multiple layers, offshore entities, trusts' },
    { key: 'E3', label: 'Facility above the agreed threshold with the funder' },
    { key: 'E4', label: 'Adverse credit history or adverse news against any party, including the contractor' },
    { key: 'E5', label: 'Concentration risk by sector, geography, borrower or contractor' },
    { key: 'E6', label: 'Weak or incomplete assets and liabilities statement' },
    { key: 'E7', label: 'Profit on cost below 15% at the base case' },
    { key: 'E8', label: "Contingency below the funder's minimum percentage of construction cost" },
    { key: 'E9', label: "Contract value large relative to the contractor's turnover" },
    { key: 'E10', label: 'S106 or CIL obligation identified after terms were issued' },
    { key: 'E11', label: 'Verified GDV materially below the figure assumed at pre-screening' },
    { key: 'E12', label: 'Monitoring surveyor challenge to the cost plan, programme or contingency' },
    { key: 'E13', label: 'Change of exit route or sales strategy after terms were issued' },
  ];

  const TIERS = [
    { key: 'Tier 1 — strong', label: 'Tier 1 — strong appetite', action: 'Proceed. Confirm any pricing flexibility with the funder before quoting.' },
    { key: 'Tier 2 — balanced', label: 'Tier 2 — balanced appetite', action: 'Proceed at standard pricing. The baseline for every quote.' },
    { key: 'Tier 3 — very limited', label: 'Tier 3 — very limited appetite', action: 'Pre-clear with the funder before terms are sought. Reduced leverage, pricing premium, documented justification.' },
    { key: 'Tier 4 — decline', label: 'Tier 4 — decline', action: 'Decline in writing. Close with the reason code and notify client and introducer.' },
  ];

  const REASON_CODES = [
    { code: '01', label: 'Outside funder criteria' },
    { code: '02', label: 'Adverse credit' },
    { code: '03', label: 'Valuation or GDV shortfall' },
    { code: '04', label: 'Cost plan gap' },
    { code: '05', label: 'Profit on cost below threshold' },
    { code: '06', label: 'Structure would not close' },
    { code: '07', label: 'Exit not credible' },
    { code: '08', label: 'Client withdrew' },
    { code: '09', label: 'Lost on price' },
    { code: '10', label: 'Lost on speed' },
    { code: '11', label: 'Funder declined' },
    { code: '12', label: 'Information pack never completed' },
    { code: '13', label: 'Commitment fee not paid' },
    { code: '14', label: 'Contractor due diligence failed' },
    { code: '15', label: 'Planning or S106 defect' },
    { code: '16', label: 'Legal or title defect' },
    { code: '17', label: 'Borrower experience insufficient' },
    { code: '18', label: 'Lapsed, no contact' },
    { code: '19', label: 'Regulated, outside remit' },
  ];

  const STATUSES = [
    'Enquiry', 'Screening', 'Information gathering', 'Appraisal', 'Structuring', 'Terms accepted',
    'Due diligence', 'At committee', 'Credit approved', 'In legals', 'Completed and handed over', 'Not proceeding',
  ];
  const PIPELINE_BUCKET = {
    'Enquiry': 'Unqualified', 'Screening': 'Unqualified', 'Information gathering': 'Unqualified',
    'Appraisal': 'Qualified, unmandated', 'Structuring': 'Qualified, unmandated',
    'Terms accepted': 'Weighted pipeline', 'Due diligence': 'Weighted pipeline', 'At committee': 'Weighted pipeline',
    'Credit approved': 'Committed pipeline', 'In legals': 'Committed pipeline',
    'Completed and handed over': 'Completion', 'Not proceeding': 'Excluded',
  };

  // Information pack register — three streams (Development / Commercial / Borrower)
  const INFO_PACK_ITEMS = [
    [1, 'Development', 'Planning consent and decision notice', 'Confirms the scheme is consented and what was consented'],
    [2, 'Development', 'Officer report', 'Explains how the consent was reached and what was contentious'],
    [3, 'Development', 'Conditions schedule and discharge status', 'Pre-commencement conditions are a drawdown blocker'],
    [4, 'Development', 'S106 agreement', 'Obligations, trigger points and amounts affect cashflow'],
    [5, 'Development', 'CIL liability notice and payment schedule', 'Payable at commencement; a funded cost line'],
    [6, 'Development', 'Approved drawings', 'Confirms what is being built matches the appraisal'],
    [7, 'Development', 'Unit mix and areas schedule', 'The basis for GDV and value per sq ft'],
    [8, 'Development', 'Specification', 'Drives cost per sq ft and the value assumption'],
    [9, 'Development', 'Build programme and milestone schedule', 'The basis for the interest budget and the longstop'],
    [10, 'Development', 'Detailed cost plan', 'The single most scrutinised document in the submission'],
    [11, 'Development', 'Tender documents or contractor quotations', 'Evidence the cost plan is priced, not estimated'],
    [12, 'Development', 'Building contract form and terms', 'Determines who carries cost and delay risk'],
    [13, 'Development', 'Ground investigation report', 'Groundworks are the commonest source of abnormal cost'],
    [14, 'Development', 'Utilities and statutory services position', 'Connection and diversion costs are routinely omitted'],
    [15, 'Development', 'Contamination and environmental reports', 'A funder condition and a potential cost line'],
    [16, 'Development', 'Design team appointments and PI cover', 'Reliance and warranties depend on these'],
    [17, 'Commercial', 'RICS valuation, if already held', 'Existing use, residual and GDV bases'],
    [18, 'Commercial', 'Market analysis', 'Supports the demand assumption'],
    [19, 'Commercial', 'Comparable evidence — sales', 'The basis for verifying GDV independently'],
    [20, 'Commercial', 'Comparable evidence — rents and yields', 'Needed where the exit is a refinance'],
    [21, 'Commercial', 'Sales or letting strategy', 'Absorption rate and pricing strategy'],
    [22, 'Borrower', 'Company and SPV structure to ultimate beneficial owner', 'Confirms who Phoenix and the funder are dealing with'],
    [23, 'Borrower', 'Developer CV and completed scheme schedule', 'The primary evidence of relevant experience'],
    [24, 'Borrower', 'Full financials and A&L statements — every principal and guarantor', 'Liquidity and overrun capacity'],
    [25, 'Borrower', 'Equity source evidence', 'Confirms whether the contribution is cash or deemed'],
    [26, 'Borrower', 'Full KYC and AML pack', 'Pre-checked by Phoenix before it goes to any funder'],
  ].map(r => ({ n: r[0], stream: r[1], item: r[2], whyNeeded: r[3] }));

  const FEE_ROWS = [
    ['F1', 'Commitment fee', 'Senior', 'To drawdown', 'Funder', 'Client', 'On acceptance of terms, before DD is instructed', 'As quoted'],
    ['F2', 'RICS valuation fee', '—', 'To drawdown', 'Valuer', 'Client', 'On instruction', 'At cost, no mark-up'],
    ['F3', 'Monitoring surveyor — initial report', '—', 'To drawdown', 'MS', 'Client', 'On appointment', 'At cost, no mark-up'],
    ['F4', 'Funder legal costs — undertaking', 'Senior', 'To drawdown', "Funder's solicitors", 'Client', 'On instruction, on undertaking', 'At cost, no mark-up'],
    ['F5', 'Borrower legal costs', '—', 'To drawdown', "Borrower's solicitors", 'Client', 'As agreed with the solicitor', 'Direct to solicitor'],
    ['F6', 'Searches and disbursements', '—', 'To drawdown', 'Solicitors', 'Client', 'During legals', 'At cost'],
    ['F7', 'Technical reports — ground, environmental', '—', 'To drawdown', 'Consultants', 'Client', 'During due diligence', 'At cost'],
    ['F8', 'Senior arrangement fee', 'Senior', 'To drawdown', 'Funder', 'Client', 'Deducted at first drawdown', '% of facility'],
    ['F9', 'Junior arrangement fee', 'Mezzanine', 'To drawdown', 'Junior funder', 'Client', 'At drawdown of the junior layer', '% of junior facility'],
    ['F10', 'Phoenix arrangement fee', '—', 'To drawdown', 'Phoenix', 'Client', 'On first drawdown', '% of total facility or fixed'],
    ['F11', 'Phoenix junior layer fee', 'Mezzanine', 'To drawdown', 'Phoenix', 'Client', 'On drawdown of the junior layer', '% of junior facility'],
    ['F12', 'Introducer share', '—', 'To drawdown', 'Introducer', 'Phoenix', 'On receipt of the Phoenix fee', '% of the Phoenix fee'],
    ['F13', 'Phoenix abort cost recovery', '—', 'If aborted', 'Phoenix', 'Client', 'Where the deal aborts after DD is instructed', 'Per the engagement letter'],
    ['F14', 'Monitoring surveyor — monthly fee', '—', 'Through the build', 'MS', 'Client', 'Each drawdown cycle, for the whole build', 'At cost, per visit'],
    ['F15', 'Capitalised interest — senior', 'Senior', 'Through the build', 'Funder', 'Client', 'Rolled into the facility', 'Margin + reference rate'],
    ['F16', 'Non-utilisation fee', 'Senior', 'Through the build', 'Funder', 'Client', 'On undrawn commitment', '% pa on undrawn'],
    ['F17', 'Junior coupon or profit share', 'Mezzanine', 'Through the build', 'Junior funder', 'Client', 'Accrues through the build', 'Rate or share of profit'],
    ['F18', 'Senior exit fee', 'Senior', 'At redemption', 'Funder', 'Client', 'On redemption', '% of facility or of GDV'],
    ['F19', "Quantity surveyor / employer's agent", '—', 'Through the build', "Client's consultants", 'Client', 'Through the build, if appointed', "Client's own appointment"],
  ].map(r => ({ ref: r[0], item: r[1], layer: r[2], phase: r[3], payableTo: r[4], payableBy: r[5], when: r[6], basis: r[7] }));

  const HANDOVER_SECTIONS = [
    [1, 'Facility summary', 'Facility amount by layer, margin and reference rate, all fees, term, longstop, day one advance drawn, balance available', 'Financial Analyst'],
    [2, 'The drawdown mechanism', "Exactly how a drawdown works: funder cut-off day, documents required each cycle, who submits what, the monitoring surveyor's role in certification, typical time from application to release", 'Deal Lead'],
    [3, 'Monthly obligations calendar', 'A worked example month showing what the client and contractor must produce and by when, counted back from the cut-off', 'Deal Lead'],
    [4, 'Cost to complete', "What the covenant requires, how the funder tests it, and why the client must restate it every month", 'Financial Analyst'],
    [5, 'Contingency and variations', 'How a contingency draw is requested and approved, and who approves it', 'Development Analyst'],
    [6, 'Release and repayment', 'Sales release calculations, minimum release prices, partial repayment mechanics, and what happens at term', 'Financial Analyst'],
    [7, 'Reporting obligations', 'Every report, certificate and notice the facility agreement requires, with frequency and recipient', 'Deal Lead'],
    [8, 'Covenants and default', 'The operating covenants in plain terms, the cure provisions, and the events constituting default', 'Deal Lead'],
    [9, 'Contact directory', "Named contacts with direct lines: funder, funder's solicitors, valuer, monitoring surveyor, client's solicitors", 'Case Manager'],
    [10, 'Scope statement', 'Plain statement that the Phoenix engagement is complete, what now sits with the client and funder, and that Phoenix can be re-engaged on a separate written basis', 'Deal Lead'],
    [11, 'Document index', 'Index of the archived deal folder and confirmation of what the client holds copies of', 'Case Manager'],
    [12, 'Insurance and warranties', 'Confirmation of what is in place at drawdown and what the client must maintain', 'Development Analyst'],
  ].map(r => ({ n: r[0], section: r[1], content: r[2], owner: r[3] }));

  const DOC_FOLDERS = [
    ['01_Initial_Enquiry', 'Enquiry correspondence, scheme summary, information request, pre-screen note, tier assignment, engagement letter'],
    ['02_KYC_AML', 'Identity and entity documents, ownership chain to UBO, adverse searches, sanctions and PEP screening, interview record'],
    ['03_Application', 'Application forms, personal details forms, A&L statements, developer CV and scheme schedule, contractor due diligence'],
    ['04_Planning', 'Consent, decision notice, officer report, drawings list, conditions schedule, S106, CIL notices, discharges'],
    ['05_Design_and_Cost', 'Drawings, unit mix and areas, specification, cost plan, tender documents, contractor proposals, building contract'],
    ['06_Programme', 'Build programme, milestone schedule, procurement schedule, revised programmes'],
    ['07_Valuation_and_QS', 'Valuation instruction and report, Phoenix commentary, variance notes, MS appointment and initial report'],
    ['08_Appraisal_and_Model', 'All appraisal and cashflow versions, stress pack, peak debt statement, summaries, reconciliation record'],
    ['09_Credit_Submission', 'All submission pack versions, peer review record, credit query schedule, sanctioned terms log, variance schedule'],
    ['10_Legal_and_Completion', 'Facility and security documents, reconciliation note, CP schedule, title report, legal memos, completion statement, funds flow, drawdown confirmation, handover pack and signed acknowledgement'],
    ['11_Checklist', 'This workbook, gate sign-off sheet, fee invoice and receipt, archive index'],
  ].map(r => ({ key: r[0], contents: r[1] }));

  const ESCALATION_TRIGGERS = [
    'Any doubt that the facility falls outside the unregulated perimeter',
    'Any adverse credit finding on a borrower, director, shareholder above 25%, guarantor or the main contractor',
    "Verified GDV below the client's figure by more than 5%, or benchmarked cost above the client's cost plan by more than 5%",
    'Profit on cost falling below 15% at the base case, or below zero at GDV minus 10%',
    "A contract value that is a large proportion of the contractor's turnover",
    'A monitoring surveyor who challenges the cost plan, the programme or the contingency',
    'A section 106 or CIL obligation not identified before terms were sought',
    'A funding structure that does not close at the base case, or closes only on deemed rather than cash equity',
    'Any change to the exit route or the sales strategy after terms were issued',
    'Any client instruction to withhold or soften a material fact in a submission',
    'Any indication at GD9 or GD10 that the client does not understand the drawdown mechanics they will be operating alone',
    'Any request after completion for Phoenix to assist with a drawdown, a monitoring matter or an exit — treat as a new engagement, in writing, or decline',
  ];

  const SLA_ITEMS = [
    { key: 'ack', label: 'Acknowledgement and information request', measuredFrom: 'Enquiry received', targetHours: 8 },
    { key: 'prescreen', label: 'Pre-screen position', measuredFrom: 'Scheme summary received', targetHours: 48 },
    { key: 'packchase', label: 'Information pack chased', measuredFrom: 'Pre-screen passed', targetHours: 48, recurring: true },
    { key: 'feasibility', label: 'Feasibility and viability conclusion', measuredFrom: 'Information pack complete', targetHours: 120 },
    { key: 'appraisal', label: 'Appraisal signed off', measuredFrom: 'Feasibility concluded', targetHours: 120 },
    { key: 'terms', label: 'Structuring options and terms presented', measuredFrom: 'Appraisal signed off and mandate signed', targetHours: 240 },
    { key: 'submission', label: 'Credit submission', measuredFrom: 'Due diligence cleared', targetHours: 120 },
    { key: 'creditquery', label: 'Credit queries answered', measuredFrom: 'Query received', targetHours: 8 },
    { key: 'docreview', label: 'Facility and security documents reviewed', measuredFrom: 'Documents received', targetHours: 48 },
    { key: 'cpchase', label: 'Conditions precedent chased', measuredFrom: 'Legal instruction', targetHours: 48, recurring: true },
    { key: 'drawdown', label: 'Drawdown coordinated', measuredFrom: 'Certificate of title received', targetHours: 120 },
    { key: 'feeinvoice', label: 'Fee invoiced', measuredFrom: 'First drawdown released', targetHours: 24 },
  ];

  // ---------------------------------------------------------------------
  // Reference generator — PHX-DV-YY-NNN sequential by receipt year
  // ---------------------------------------------------------------------
  function nextDealRef(existingDeals, year) {
    const yy = String(year != null ? year : new Date().getFullYear()).slice(-2);
    const prefix = 'PHX-DV-' + yy + '-';
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
  // Calculations
  // ---------------------------------------------------------------------
  function num(v) { const n = parseFloat(v); return isFinite(n) ? n : null; }

  function calcMetrics(deal) {
    const gdv = num(deal.gdvVerified) != null ? num(deal.gdvVerified) : num(deal.gdvClient);
    const cost = num(deal.totalCost);
    const senior = num(deal.seniorFacility);
    const mezz = num(deal.mezzanineFacility);
    const equity = num(deal.clientEquity);
    const peakDebt = num(deal.peakDebt) != null ? num(deal.peakDebt) : (senior != null || mezz != null ? (senior || 0) + (mezz || 0) : null);
    const landValue = num(deal.landValue) != null ? num(deal.landValue) : num(deal.purchasePrice);

    const day1Ltv = (peakDebt != null && landValue) ? peakDebt / landValue : null;
    const ltc = (peakDebt != null && cost) ? peakDebt / cost : null;
    const ltgdv = (peakDebt != null && gdv) ? peakDebt / gdv : null;
    const profit = (gdv != null && cost != null) ? gdv - cost : null;
    const profitOnCost = (profit != null && cost) ? profit / cost : null;
    const gdvStress = gdv != null ? gdv * 0.9 : null;
    const profitOnCostStress = (gdvStress != null && cost) ? (gdvStress - cost) / cost : null;
    const structureCloses = (senior != null || mezz != null || equity != null) && cost != null
      ? ((senior || 0) + (mezz || 0) + (equity || 0)) >= cost : null;
    const gdvVariance = (num(deal.gdvClient) && num(deal.gdvVerified)) ? (num(deal.gdvVerified) - num(deal.gdvClient)) / num(deal.gdvClient) : null;

    const daysBetween = (a, b) => {
      if (!a || !b) return null;
      const d1 = new Date(a), d2 = new Date(b);
      if (isNaN(d1) || isNaN(d2)) return null;
      return Math.round((d2 - d1) / 86400000);
    };

    return {
      gdv, cost, peakDebt, day1Ltv, ltc, ltgdv, profit, profitOnCost, profitOnCostStress, structureCloses, gdvVariance,
      daysD0ToFeeReceived: daysBetween(deal.dateReceived, deal.feeReceivedDate),
      daysEnquiryToCompletion: daysBetween(deal.dateReceived, deal.actualCompletion),
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
  // Eligibility auto-verdicts — tests 1, 2, 3, 7, 8, 9, 11, 12 are
  // computed from deal fields; the rest are manual Pass/Fail/Borderline/N/A
  // judgements, exactly as in the workbook.
  // ---------------------------------------------------------------------
  function autoEligibilityVerdict(test, deal, metrics, productParamsLive, coreParamsLive) {
    const allParams = productParamsLive || DEFAULT_PRODUCT_PARAMS;
    const core = coreParamsLive || DEFAULT_CORE_PARAMS;
    const params = allParams[deal.product] || {};
    switch (test.key) {
      case 'productType':
        return PRODUCTS.indexOf(deal.product) >= 0
          ? { verdict: 'Pass', note: deal.product || '' }
          : { verdict: 'Fail', note: 'Product type not set or not permitted for development finance' };
      case 'facilitySize': {
        const g = num(deal.seniorFacility) != null ? (num(deal.seniorFacility) + (num(deal.mezzanineFacility) || 0)) : metrics.peakDebt;
        if (g == null) return { verdict: 'N/A', note: 'Facility not entered' };
        const ok = g >= core.minFacility && g <= core.maxFacility;
        return { verdict: ok ? 'Pass' : 'Fail', note: money(g) };
      }
      case 'facilityTerm': {
        const t = num(deal.termMonths);
        if (t == null) return { verdict: 'N/A', note: '' };
        return { verdict: t <= core.maxTermMonths ? 'Pass' : 'Fail', note: t + ' months' };
      }
      case 'day1Ltv': {
        if (metrics.day1Ltv == null || params.day1Ltv == null) return { verdict: 'N/A', note: '' };
        const limit = params.day1Ltv;
        const borderline = metrics.day1Ltv <= limit && (limit - metrics.day1Ltv) * 100 < core.borderlineBandPts;
        return { verdict: metrics.day1Ltv > limit ? 'Fail' : (borderline ? 'Borderline' : 'Pass'), note: pctOrDash(metrics.day1Ltv) + ' vs ' + pctOrDash(limit) + ' limit' };
      }
      case 'ltc': {
        if (params.ltc == null) return { verdict: 'N/A', note: 'Not applicable to this product' };
        if (metrics.ltc == null) return { verdict: 'N/A', note: '' };
        const limit = params.ltc;
        const borderline = metrics.ltc <= limit && (limit - metrics.ltc) * 100 < core.borderlineBandPts;
        return { verdict: metrics.ltc > limit ? 'Fail' : (borderline ? 'Borderline' : 'Pass'), note: pctOrDash(metrics.ltc) + ' vs ' + pctOrDash(limit) + ' limit' };
      }
      case 'ltgdv': {
        if (params.grossLtv == null) return { verdict: 'N/A', note: 'Not applicable to this product' };
        if (metrics.ltgdv == null) return { verdict: 'N/A', note: '' };
        const limit = params.grossLtv;
        const borderline = metrics.ltgdv <= limit && (limit - metrics.ltgdv) * 100 < core.borderlineBandPts;
        return { verdict: metrics.ltgdv > limit ? 'Fail' : (borderline ? 'Borderline' : 'Pass'), note: pctOrDash(metrics.ltgdv) + ' vs ' + pctOrDash(limit) + ' limit' };
      }
      case 'profitOnCostBase': {
        if (metrics.profitOnCost == null) return { verdict: 'N/A', note: '' };
        return { verdict: metrics.profitOnCost < core.minProfitOnCost ? 'Fail' : (metrics.profitOnCost < core.targetProfitOnCost ? 'Borderline' : 'Pass'), note: pctOrDash(metrics.profitOnCost) };
      }
      case 'profitOnCostStress': {
        if (metrics.profitOnCostStress == null) return { verdict: 'N/A', note: '' };
        return { verdict: metrics.profitOnCostStress <= 0 ? 'Fail' : (metrics.profitOnCostStress < 0.10 ? 'Borderline' : 'Pass'), note: pctOrDash(metrics.profitOnCostStress) + ' at GDV −10%' };
      }
      default:
        return { verdict: 'N/A', note: '' };
    }
  }

  function suggestTier(deal, adverseFound, exceptionsPresentCount) {
    if (adverseFound) return 'Tier 4 — decline';
    if (deal.borrowingStructure === 'Personal name' || deal.borrowingStructure === 'Trust' || deal.borrowingStructure === 'Partnership') return 'Tier 4 — decline';
    const exp = deal.borrowerExperience;
    if (exp === 'Experienced' && deal.professionalTeam === 'Yes') return 'Tier 1 — strong';
    if (exp === 'Some' || exp === 'First-time, supported') return 'Tier 2 — balanced';
    if (exp === 'First-time' || exceptionsPresentCount > 0) return 'Tier 3 — very limited';
    return 'Tier 2 — balanced';
  }

  function gateReadiness(stage, tasks) {
    const stageTasks = tasks.filter(t => t.stage === stage && !t.gate);
    const required = stageTasks.filter(t => t.required !== false);
    const outstanding = required.filter(t => t.status !== 'Complete' && t.status !== 'Waived' && t.status !== 'Not applicable');
    return { total: required.length, outstanding, ready: outstanding.length === 0 };
  }

  global.PhoenixDevelopment = {
    STAGES, GATES, TASK_TEMPLATE, gateTaskForStage,
    PRODUCTS, DEFAULT_PRODUCT_PARAMS, DEFAULT_CORE_PARAMS,
    ELIGIBILITY_TESTS, ADVERSE_CATEGORIES, ADVERSE_APPLIES_TO, EXCEPTION_TRIGGERS,
    TIERS, REASON_CODES, STATUSES, PIPELINE_BUCKET,
    INFO_PACK_ITEMS, FEE_ROWS, HANDOVER_SECTIONS, ESCALATION_TRIGGERS, SLA_ITEMS, DOC_FOLDERS,
    nextDealRef, calcMetrics, autoEligibilityVerdict, suggestTier, gateReadiness,
    fmt: { pct: pctOrDash, money, date: ukDate, daysUntil },
  };

})(window);
