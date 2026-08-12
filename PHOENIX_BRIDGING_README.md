# Phoenix Bridging — deal management platform

Implementation of `Phoenix_Bridging_Brokerage_Procedure_v2.docx` and
`Phoenix_Bridging_Deal_Checklist_and_Tracker.xlsx` as a workflow-driven SaaS
module inside the existing Pronexus repo. Built as **MVP1 + MVP2**, with the
schema and architecture designed so MVP3–MVP5 slot in without rework.

## 1. What I found in the existing codebase

The repo is a single-page app: `index.html` loads React 18 + Babel-standalone
from CDN, then a chain of `<script type="text/babel" src="....jsx">` files
that each compile in their **own Babel-standalone scope** — top-level
declarations in one file are not visible in another; cross-file references
go through `window.X`. `app.jsx` is the shell: it holds a `view` state
(`'portfolio' | 'crm'`, now also `'bridging'`) driven by a `?view=` query
param, and switches between the appraisal Portfolio, the CRM (`crm.jsx` →
`window.CRMApp`), and now Bridging. `db.js` / `supabaseClient.js` give the
appraisal side its Supabase-backed persistence pattern; `engine.js` is that
side's pure calculation engine. I followed the same three-layer shape
(engine → db → UI) for Bridging rather than introducing a new pattern.

Two pre-existing static files, `Phoenix Hub.html` and `Phoenix Operating &
Deployment Manual.html`, are unrelated marketing/reference decks for the
*appraisal* product (also internally branded "Phoenix") — not the bridging
brokerage. I left them untouched; they're linked from the portfolio topbar
and out of scope here.

**Nothing existing was rewritten.** The Bridging module is additive: new
files, two small edits to `app.jsx` (a nav button, a view branch) and one to
`index.html` (script/style tags). The appraisal and CRM modules are
unchanged.

## 2. Files changed / added

```
index.html                 +4 lines: bridging.css link, bridging-engine.js /
                            bridging-db.js script tags, 3 babel script tags
app.jsx                    +6 lines: 'bridging' as a valid ?view=, a
                            "Bridging" nav button, a view=='bridging' branch
                            that mounts <window.PhoenixBridgingApp/>

bridging-engine.js          NEW — pure business rules (stages, gates, task
                            template, product parameters, eligibility tests,
                            adverse/exception/tier config, calculations)
bridging-db.js               NEW — data layer, localStorage today, shaped
                            1:1 to the Supabase schema below
bridging.css                  NEW — styles, namespaced .phxb, reuses the
                            app's existing CSS variables
bridging-dashboard.jsx         NEW — Pipeline Dashboard (kanban/table, filters,
                            search, summary cards, new-enquiry modal)
bridging-deal.jsx               NEW — Deal Workspace, 12 tabs
bridging-app.jsx                  NEW — module shell (dashboard ↔ workspace),
                            own error boundary

db/bridging_schema.sql             NEW — Supabase/Postgres migration: full
                            schema + RLS for MVP1–MVP5
PHOENIX_BRIDGING_README.md          NEW — this file
```

No tables in `db/schema.sql` (the appraisal schema) were touched. The
bridging schema uses a distinct `bridging_` table prefix so the two products
can share one Supabase project without collision if that's ever wanted.

## 3. Architecture summary

```
bridging-engine.js   pure functions + config (no React, no I/O)
        │            STAGES, GATES, TASK_TEMPLATE (89 tasks across Stage 0–7),
        │            PRODUCT_PARAMS, ELIGIBILITY_TESTS (23), ADVERSE_CATEGORIES (8),
        │            EXCEPTION_TRIGGERS (8), TIERS (4), REASON_CODES (13),
        │            KYC_ITEMS (20), FEE_ROWS (12), calcMetrics(), nextDealRef(),
        │            autoEligibilityVerdict(), suggestTier(), gateReadiness()
        ▼
bridging-db.js       data layer — CRUD + audit logging, localStorage-backed
        │            today. Every write goes through here so audit logging
        │            is centralised, not scattered through the UI.
        ▼
bridging-dashboard.jsx / bridging-deal.jsx   UI, read/write via bridging-db.js
        ▼
bridging-app.jsx     shell mounted from app.jsx's view router
```

This mirrors the appraisal side's `engine.js → db.js → *.jsx` shape
deliberately, so a developer already familiar with this repo recognises the
pattern immediately.

## 4. Route / page structure

There's no server-side router (static GitHub Pages SPA), so "routes" are the
existing `?view=` convention plus in-module state:

- `?view=bridging` → `PhoenixBridgingApp`
  - default: `PhxDashboard` (pipeline)
  - `openDealId` set → `PhxDealWorkspace` (deal detail), with its own tab
    state (`Overview | Eligibility | Tasks & Gates | Documents | KYC/AML |
    Funder Selection | Valuation | CP Schedule | Fees & Costs | Notes |
    Post-completion | Audit Trail`)

If/when this becomes a real Next.js app (see §9), this maps directly onto:
```
/bridging                          → pipeline dashboard
/bridging/deals/[dealId]           → deal workspace, tab as ?tab= or a segment
/bridging/deals/[dealId]/[tab]
```

## 5. Component structure

```
PhoenixBridgingApp (shell, error boundary)
 ├─ PhxDashboard
 │   ├─ PhxBadges          (risk/status chips, shared logic with header)
 │   └─ NewDealModal
 └─ PhxDealWorkspace
     ├─ DealHeader          (ref, borrower, stage, status, next action, badges)
     ├─ OverviewTab          (Identification / Client&Asset / Facility&Metrics /
     │                        Key dates / Commercials / Outcome)
     ├─ EligibilityTab        (23 tests, adverse exclusions, exception triggers,
     │                        tier assignment + suggestion)
     ├─ TasksGatesTab          (per-stage task list, gate bar, GateModal, WaiveModal)
     ├─ DocumentsTab            (folder structure, naming rule — MVP3 for upload)
     ├─ KycTab                   (20-item register, completion counter)
     ├─ FunderTab                 (shortlist, comparison, selection)
     ├─ ValuationTab                (instruction→report tracking, variance escalation)
     ├─ CpTab                       (CP schedule, overdue/>10-day escalation)
     ├─ FeesTab                     (12 fee rows, client/funder/Phoenix totals)
     ├─ NotesTab                     (communications log)
     ├─ PostCompletionTab             (redemption watch, exit confidence)
     └─ AuditTab                      (audit trail)
```

Every tab is a sibling, not nested state — switching tabs never remounts the
header, and each tab reads/writes the shared deal record via `bridging-db.js`
so edits in one tab (e.g. selecting a funder) are visible immediately in
another (Overview's `selectedFunder`) and in the header badges.

## 6. Service / business logic layer

All business rules live in `bridging-engine.js`, not scattered in components:

- **Reference generation** — `nextDealRef()`: `PHX-BR-YY-NNN`, sequential by
  receipt year, computed from existing refs (no separate counter table to
  get out of sync).
- **Metrics** — `calcMetrics()`: lower-of-value-and-price, Day 1 LTV, Gross
  LTV, LTC, days-enquiry-to-completion, days-to-redemption, value variance —
  all derived, never separately stored/edited fields (single source of truth).
- **Eligibility** — `autoEligibilityVerdict()` computes tests 1 (product), 2
  (loan size), 3 (term), 5 (Day 1 LTV), 6 (Gross LTV), 7 (LTC) directly from
  deal fields and `PRODUCT_PARAMS`; the remaining 17 are manual
  Pass/Fail/Borderline/N/A judgements recorded by the Analyst, exactly as in
  the workbook (most eligibility criteria — planning, EPC, asset class,
  borrower experience — are not numeric and shouldn't be pretend-automated).
- **Borderline detection** — any LTV/LTC test within `CORE_PARAMS.
  borderlineBandPts` (2 points) of its limit is flagged `Borderline`, which
  the procedure requires to be escalated exactly like a metric outside
  criteria.
- **Tier suggestion** — `suggestTier()` is a heuristic starting point, never
  the final word: the Deal Lead always records the tier and justification
  themselves on the Eligibility tab.
- **Gate readiness** — `gateReadiness(stage, tasks)` returns the stage's
  outstanding required tasks; the UI disables "Pass gate" until this is
  empty. See §7.

## 7. Gate enforcement logic

Implemented in `bridging-engine.js` (`gateReadiness`) + `bridging-db.js`
(`passGate`, `waiveTask`) + `TasksGatesTab`:

1. Each stage's tasks are generated from `TASK_TEMPLATE` when a deal is
   created (`seedTasksFor`), refs matching the workbook exactly (`0.1`…`7.7`).
2. `gateReadiness(stage, tasks)` filters that stage's **required, non-gate**
   tasks and returns any not in `Complete | Waived | Not applicable`.
3. The gate bar renders **blocked** (red) while outstanding tasks exist,
   listing them by ref, and **ready** (green) once they're clear — the "Pass
   gate" button is `disabled` until then, so a gate literally cannot be
   passed from the UI while requirements are outstanding.
4. Passing a gate (`DB.passGate`) requires owner / signed-by / evidence
   (`GateModal`), stamps the date, advances `deal.stage` and
   `deal.lastGatePassed`, and writes an audit entry — matching Appendix A's
   "signed and dated, not felt to be substantially met."
5. **Waivers** (`DB.waiveTask` / `WaiveModal`) require a reason and an
   approver before a task can be marked `Waived` and therefore stop blocking
   its gate — this is the only path around a required task, and it's logged.
6. This is intentionally client-side enforcement today (no DB constraint
   stops a `current_stage` update in Postgres). For production, add a
   Postgres trigger on `bridging_deals` that checks
   `bridging_gate_signoffs` before allowing `current_stage` to advance — noted
   as a TODO in the schema and worth doing before this handles real deals.

## 8. Eligibility calculation logic

See §6 for the split between auto/manual tests. Specifics:

- **Basis of advance**: `lowerOfValueAndPrice()` — funders lend on the lower
  of security value and purchase price; this single function feeds every
  LTV/LTC calculation, so there's one place the "no BMV lending" rule lives.
- **Day 1 / Gross LTV / LTC**: computed against `PRODUCT_PARAMS[deal.
  product]`, which holds the exact August-2026 limits from §8.1 of the
  procedure (e.g. Light refurbishment: 75% / 75% / 90% / BBR+475bps). These
  are hard-coded in the JS engine today but map 1:1 onto
  `bridging_funder_parameters`, an admin-editable table in the schema — the
  intent (per the brief) is these become editable, not re-hard-coded per
  change.
- **Adverse credit**: 8 categories (`A1`–`A8`), applied per the procedure to
  "borrower, all directors, shareholders above 25%, all guarantors." Any
  `found && !cleared` sets `deal.adverseFlag = 'Yes'`, which the header,
  dashboard badges and Tier suggestion all read from — one flag, one source.
- **Policy exceptions**: 8 triggers (`E1`–`E8`); any `present` sets
  `deal.policyExceptionFlagged = 'Yes'`.
- **Tier**: `TIERS` config carries the exact profile/action text from §8.3.
  `Tier 4` renders a red "decline in writing" badge as a nudge, but does not
  hard-block the UI — the procedure asks for a documented decision, not a
  system override of one.

## 9. Audit logging approach

Every mutating call in `bridging-db.js` (`updateDeal`, `updateTask`,
`passGate`, `waiveTask`, `setEligibility`, CP/fee/funder/valuation/note/
escalation writes) appends to `store.audit[dealId]` via a single internal
`audit()` helper — so there's one code path, not one per feature, and it
can't be forgotten in a new mutation without deliberately skipping it. Each
entry carries `{ user, timestamp, action, before, after, reason }`, matching
the brief's audit log field list. The Audit Trail tab reads this directly;
nothing is derived or reconstructed.

In the Supabase version, `bridging_audit_logs` takes over this role
server-side (so a client can't silently skip writing one), and a
`bridging_status_history` table + trigger captures stage/status transitions
automatically for the Stage Velocity / Conversion MI in MVP5.

## 10. Permissions / RLS approach

`bridging_users.roles` is a text array (`Admin, Principal, Deal Lead,
Analyst, Case Manager, Viewer, Client Portal User, External Introducer,
External Solicitor, External Funder`), matching the brief's role list.

- **Tenant isolation**: every tenant-owned table either carries
  `organisation_id` directly (`bridging_deals`, parameter tables) or is
  scoped via its parent `deal_id` (everything else). `bridging_current_org()`
  is a `security definer`-free helper reading the caller's own org from
  `bridging_users`; every RLS policy filters through it. No cross-tenant read
  or write is possible without going through this function.
- **Role-gated actions**: `gate_signoff_role_gate` is included as a worked
  example — inserting into `bridging_gate_signoffs` requires the caller to
  hold `Admin`, `Principal`, `Deal Lead` or `Case Manager` on that deal's
  organisation. The same pattern (join `bridging_users` on `auth.uid()`,
  check `roles`) should be replicated for: waivers (Principal/Admin only,
  per "waivers require senior approval"), `Not proceeding` outcome writes,
  and fee-received confirmation.
- **Shared reference data**: `bridging_reason_codes` (and any similar future
  lookup table, e.g. a global product-type list) is not tenant-scoped, so it
  doesn't get the `organisation_id`/`deal_id` isolation policy — but RLS is
  still enabled on it, with a `select`-only policy for authenticated users
  and no insert/update/delete policy, so it's readable by every signed-in
  user and writable only via a migration or the service role. Any new
  non-tenant table should follow this pattern rather than being left with
  RLS off.
- **Client Portal / external users**: modelled via
  `bridging_client_portal_invites` (token-based, deal-scoped) — a
  `Client Portal User` role should get a *separate, much narrower* RLS
  policy set (their own deal's KYC upload + selected status fields only),
  not the general org-isolation policy. Not yet built — flagged for MVP3
  alongside the upload portal.
- **Deal Lead / Case Manager same-person rule**: enforced today as a soft
  warning badge in `OverviewTab` (not a hard block, since the brief allows
  an explicit override) — a proper implementation would be a Postgres
  `CHECK`/trigger with an `override_confirmed` column.

## 11. MVP sequence — status

**MVP1 — Core Deal Workflow: done.**
Create deal, auto-generated reference, pipeline dashboard (kanban + table,
filters, search, summary cards), deal workspace overview, Stage 0–7 task
checklist, gate enforcement (with waivers), status changes, full audit log.

**MVP2 — Eligibility and Metrics: done.**
Deal metrics (LTV/LTC, live-calculated), funder parameter table (in-engine,
schema-ready to move to admin-editable rows), 23-test eligibility screen,
tier assignment with suggestion, adverse credit flags, policy exceptions.

**MVP3 — Documents, KYC and CPs: partially done.**
KYC register (20 items, completion counter) ✅. CP schedule (add/track,
evidence-required-to-satisfy, overdue / >10-day escalation badges) ✅.
Document *vault* is scaffolded (folder structure, naming convention shown)
but real upload/versioning/evidence-linking is not built — `bridging_documents`
table is ready; needs Supabase Storage wiring + an upload UI.

**MVP4 — Fees, Funder Selection and Valuation: done.**
Fees and costs tracker (12 rows, client/funder/Phoenix totals). Funder
shortlist/comparison with selection (drives `deal.selectedFunder`).
Valuation tracking with automatic >5% variance escalation badge.

**MVP5 — SLA, MI and AI: not built, scaffolded.**
`SLA_ITEMS` and `ESCALATION_TRIGGERS` exist in the engine and
`bridging_sla_events` / `bridging_escalations` tables exist in the schema,
but there's no due-date computation engine or MI dashboards wired up yet,
and no AI features (summary generator, credit pack generator, risk
detection, client update drafts). These are the natural next slice — the
schema and audit trail underneath them are already in place, which is the
point of building it this way round.

## 12. Assumptions made

- **Single organisation, demo auth.** The module runs against a single
  hard-coded `org_phoenix` / demo user in the localStorage layer — it
  reuses whatever Supabase auth session the appraisal app already has,
  rather than adding a second login. Real multi-org support arrives with
  the Supabase swap (§13).
- **Funder parameters are engine constants, not yet admin-editable rows** —
  functionally correct (matches §8.1 exactly) but a Principal can't change
  a limit without a code deploy yet. The schema table exists; only the UI
  to edit it is missing.
- **Document vault is metadata-only** — no file storage wired up (no
  network/Storage access in this environment to test against). Folder
  structure, naming convention and linkage points are real; uploading a
  file is not.
- **Tier suggestion is a starting point, not a decision engine** — Tier 3/4
  do not block the workflow; they surface strongly (red/amber badges,
  "decline in writing" prompt) because the brief is explicit that Phoenix,
  not the system, makes and records the credit judgement.
- **SLA due-dates are not yet computed against real elapsed time per item**
  — `SLA_ITEMS` defines the commitments (§Appendix B) but the dashboard's
  "SLA breach" badge today is a simple `nextActionDue` comparison, not a
  per-SLA-commitment clock. Proper SLA event generation is MVP5 work.

## 13. Manual setup required

**To use it today:** nothing — it's a static addition to the existing GitHub
Pages deployment. Open the app, click **Bridging** in the portfolio topbar
(or visit `?view=bridging`), and it seeds two demo deals from localStorage
on first load (`PhoenixBridgingDB.resetDemo()` in the console clears it).

**To move onto Supabase (recommended before real deals go in):**
1. Run `db/bridging_schema.sql` against the same Supabase project as the
   appraisal app (or a fresh one — table names are namespaced `bridging_`
   so either works).
2. Insert a `bridging_organisations` row and a `bridging_users` row per
   real user (linked to their existing `auth.users.id`), with `roles` set.
3. Insert `bridging_funder_parameters` rows (a commented seed block using
   the exact §8.1 figures is at the bottom of the schema file — uncomment
   and fill in the org id).
4. Replace `bridging-db.js`'s internals with Supabase calls. Because every
   method (`newDeal`, `updateDeal`, `updateTask`, `passGate`...) already
   matches a table/action 1:1, this is a mechanical rewrite of function
   bodies, not a redesign — no UI component needs to change.
5. Add the role-gated RLS policies noted in §10 beyond the one worked
   example.

## 14. How to test the workflow

1. Open the app → **Bridging** → you land on the Pipeline Dashboard with
   two seeded deals (one at Stage 3 with G0–G2 already passed, one fresh at
   Stage 1 Screening).
2. Click **+ New enquiry**, fill in borrower/product/loan size → creates a
   deal, issues `PHX-BR-26-003`, seeds Stage 0–7 tasks and opens the
   workspace.
3. **Tasks & Gates tab**: tick tasks to `Complete` — watch the Stage 0
   progress bar fill and the **Pass gate** button on the G0 bar go from
   disabled/red to enabled/green only once every required task is done.
   Try passing it before that (button stays disabled) — try waiving a task
   instead (needs reason + approver) and see it count towards readiness.
4. Pass G0 → `deal.stage` advances to 1, header's "Last gate" updates,
   dashboard reflects the new stage.
5. **Eligibility tab**: set Gross facility / Term / product on Overview,
   come back — tests 1/2/3/5/6/7 auto-verdict. Set Gross facility above
   £5m → test 2 flips to Fail. Set Day 1 LTV within 2 points of the
   product limit → Borderline badge appears. Tick an adverse category →
   `deal.adverseFlag` flips to Yes and the header badge appears immediately.
6. **CP Schedule**: add a condition with a due date in the past → "overdue"
   / ">10 working days" badges appear; try marking it Satisfied with no
   evidence — the DB layer silently refuses (evidence required to satisfy,
   mirroring the Postgres `CHECK` constraint in the schema).
7. **Audit Trail tab**: every action above appears here, oldest last,
   attributed to the demo user.

## 15. What remains to be built next

- Admin UI for `bridging_funder_parameters` / `bridging_core_parameters` — **done** (`admin-app.jsx`, "Funder Parameters" in the sidebar, gated to Admin/Principal, with an org-level change log and a reset-to-defaults control).
- SLA due-date engine and the MI dashboards — **done** (`mi-app.jsx`, "MI & Reporting" in the sidebar): Pipeline, SLA Performance (live, using the `slaStatusForDeal` engine function), Conversion Funnel and Stage Velocity (both driven by a new `statusHistory` event log recorded on every stage/status change — see `recordStatusHistory` in both DB layers), Stage Distribution, Gate Blockers, Reason Code Analysis, and Funder Performance (Bridging only — Development's multi-layer structuring doesn't reduce to a single "funder" the same way, so that panel correctly shows nothing there rather than a misleading number).
- Client Portal — **done** (`portal-app.jsx`, reached via `?portal=TOKEN`, bypassing the internal Supabase auth entirely). Shows a plain-English stage timeline and an upload area for outstanding KYC (Bridging) or information-pack (Development) items; deliberately excludes fees, funder terms, internal notes and gate controls. Invites are issued from the KYC / Information Pack tab in each deal workspace and land the client straight on their own deal.
- Full role-based UI gating — **done** across every editable tab in both modules (Bridging's Funder/Valuation/CP/Fees/Post-completion tabs were the last ones still open; they're now wrapped in the same `Section` permission gate as the rest).
- Document upload/versioning, Ground-up development's separate process, CRM↔deal linking, and the persistent navigation shell — all done in earlier passes (see above).

**Still open:**
- The Client Portal's "narrower RLS policy set" is implemented as a UI-side boundary (the portal component simply never reads or renders restricted fields) rather than as real Postgres RLS — that still needs writing once this moves off localStorage onto the actual Supabase schema. `db/bridging_schema.sql` already has the `bridging_client_portal_invites` table and a placeholder policy shape to extend.
- `statusHistory` is recorded from this point forward for every deal; it does not retroactively reconstruct history for stage changes that happened before this feature existed, so Conversion/Stage Velocity will read thin until deals move through a few more stages under the new tracking.
- No real multi-user auth — the role switchers in Bridging, Development, and Admin are independent per-module demo pickers, not a single logged-in identity with one role. Worth unifying once this sits on Supabase auth with real per-user role assignment.
- No browser smoke-test has been run against the built app — the checks in this and earlier passes are static (bracket/paren balance across every file) rather than a live click-through.
