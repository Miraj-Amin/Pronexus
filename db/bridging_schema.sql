-- ============================================================================
-- PHOENIX BRIDGING — Supabase / Postgres schema
-- Multi-tenant bridging brokerage deal management platform.
-- Mirrors the field groups and record shapes used by bridging-db.js so the
-- localStorage store can be swapped for Supabase without changing call sites.
--
-- Apply with: supabase db push   (or paste into the SQL editor)
-- Assumes Supabase auth.users exists; app users are mapped via bridging_users.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. TENANCY
-- ----------------------------------------------------------------------------
create table if not exists bridging_organisations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  created_at   timestamptz not null default now()
);

create table if not exists bridging_users (
  id             uuid primary key references auth.users(id) on delete cascade,
  organisation_id uuid not null references bridging_organisations(id) on delete cascade,
  full_name      text not null,
  email          text,
  roles          text[] not null default '{}',  -- 'Admin','Principal','Deal Lead','Analyst','Case Manager','Viewer','Client Portal User','External Introducer','External Solicitor','External Funder'
  created_at     timestamptz not null default now()
);
create index if not exists idx_bridging_users_org on bridging_users(organisation_id);

-- ----------------------------------------------------------------------------
-- 2. REFERENCE / ADMIN-CONFIGURABLE DATA (not hard-coded in the app)
-- ----------------------------------------------------------------------------
create table if not exists bridging_funder_parameters (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references bridging_organisations(id) on delete cascade,
  product          text not null,               -- 'Unregulated bridging' etc.
  day1_ltv         numeric,
  gross_ltv        numeric,
  ltc              numeric,
  indicative_pricing text,
  note             text,
  effective_from   date not null default current_date,
  created_at       timestamptz not null default now()
);

create table if not exists bridging_core_parameters (
  id                    uuid primary key default gen_random_uuid(),
  organisation_id       uuid not null references bridging_organisations(id) on delete cascade,
  min_loan              numeric not null default 250000,
  max_loan              numeric not null default 5000000,
  max_term_months       int not null default 18,
  cap_per_sqft_london   numeric not null default 1250,
  cap_per_sqft_other    numeric not null default 850,
  single_unit_house     numeric not null default 1500000,
  single_unit_flat      numeric not null default 950000,
  mixed_use_cap_pct     numeric not null default 0.25,
  min_profit_on_cost    numeric not null default 0.15,
  target_profit_on_cost numeric not null default 0.20,
  sponsor_equity_min_pct numeric not null default 0.10,
  borderline_band_pts   numeric not null default 2,
  updated_at            timestamptz not null default now()
);

create table if not exists bridging_reason_codes (
  code   text primary key,      -- '01'..'13'
  label  text not null
);
insert into bridging_reason_codes (code, label) values
 ('01','Outside funder criteria'), ('02','Adverse credit'), ('03','Valuation shortfall'),
 ('04','Exit not credible'), ('05','Client withdrew'), ('06','Lost on price'),
 ('07','Lost on speed'), ('08','Funder declined'), ('09','Acceptance fee not paid'),
 ('10','Legal or title defect'), ('11','Borrower experience insufficient'),
 ('12','Lapsed, no contact'), ('13','Regulated, outside remit')
on conflict (code) do nothing;

-- ----------------------------------------------------------------------------
-- 3. CORE DEAL ENTITY
-- ----------------------------------------------------------------------------
create table if not exists bridging_deals (
  id                    uuid primary key default gen_random_uuid(),
  organisation_id       uuid not null references bridging_organisations(id) on delete cascade,
  deal_ref              text not null,             -- PHX-BR-YY-NNN, unique per org
  date_received         date not null default current_date,
  source                text,
  introducer            text,
  introducer_share_applies boolean not null default false,
  deal_lead_id          uuid references bridging_users(id),
  analyst_id            uuid references bridging_users(id),
  case_manager_id       uuid references bridging_users(id),
  current_stage         int not null default 0 check (current_stage between 0 and 7),
  deal_status           text not null default 'Enquiry',

  -- client & asset
  borrowing_entity      text,
  company_number        text,
  principals            text,
  guarantors            text,
  security_address      text,
  tenure                text,
  asset_type            text,
  product_type          text,
  regulated_status      text default 'No — confirmed unregulated',

  -- facility & metrics (LTV/LTC computed in the app layer / a view, not stored redundantly)
  security_value        numeric,
  purchase_price        numeric,
  gross_facility         numeric,
  day1_advance           numeric,
  works_retention_facility numeric,
  total_project_cost     numeric,
  term_months             int,
  rate                    numeric,
  arrangement_fee         numeric,
  exit_fee                numeric,
  exit_route              text,
  exit_evidence_held      boolean default false,

  -- funder
  funders_approached      text,
  selected_funder          text,
  appetite_tier             text,
  policy_exception_flagged boolean default false,
  adverse_flag              boolean default false,
  acceptance_fee             numeric,
  acceptance_fee_paid_date   date,
  valuer                      text,
  monitoring_surveyor         text,
  funder_solicitor             text,
  borrower_solicitor           text,

  -- key dates
  terms_issued            date,
  terms_accepted           date,
  submitted_to_funder       date,
  credit_decision_received  date,
  offer_issued               date,
  legals_instructed           date,
  target_completion            date,
  actual_completion             date,
  term_end_date                  date,
  redemption_date                 date,

  -- commercials
  terms_of_business_signed  boolean default false,
  broker_fee_basis           text,
  broker_fee                  numeric,
  fee_invoiced_date             date,
  fee_received_date              date,
  introducer_share                text,

  -- outcome
  outcome                text,
  reason_code             text references bridging_reason_codes(code),
  notes                    text,

  -- workflow surface (denormalised for the dashboard header; recomputed on write)
  last_gate_passed          text,
  next_action                 text,
  next_action_owner            text,
  next_action_due               date,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (organisation_id, deal_ref)
);
create index if not exists idx_deals_org on bridging_deals(organisation_id);
create index if not exists idx_deals_status on bridging_deals(organisation_id, deal_status);
create index if not exists idx_deals_stage on bridging_deals(organisation_id, current_stage);

-- ----------------------------------------------------------------------------
-- 4. STAGE TASKS, GATES
-- ----------------------------------------------------------------------------
create table if not exists bridging_stage_tasks (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid not null references bridging_deals(id) on delete cascade,
  ref           text not null,          -- '0.1','1.12'...
  stage         int not null,
  title         text not null,
  owner         text,
  required      boolean not null default true,
  is_gate       boolean not null default false,
  status        text not null default 'Not started', -- Not started/In progress/Complete/Waived/Blocked/Not applicable
  target_date   date,
  done_date     date,
  evidence_ref  text,
  notes         text,
  waiver_reason text,
  waiver_approver text,
  created_at    timestamptz not null default now(),
  unique (deal_id, ref)
);
create index if not exists idx_tasks_deal on bridging_stage_tasks(deal_id);

create table if not exists bridging_gate_signoffs (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid not null references bridging_deals(id) on delete cascade,
  gate_key      text not null,          -- 'G0'..'G7'
  passed        boolean not null default false,
  owner         text,
  signed_by     text,
  date_passed   date,
  evidence_ref  text,
  created_at    timestamptz not null default now(),
  unique (deal_id, gate_key)
);

-- ----------------------------------------------------------------------------
-- 5. ELIGIBILITY, ADVERSE CREDIT, POLICY EXCEPTIONS, TIER
-- ----------------------------------------------------------------------------
create table if not exists bridging_eligibility_tests (
  id           uuid primary key default gen_random_uuid(),
  deal_id      uuid not null references bridging_deals(id) on delete cascade,
  test_no      int not null,
  test_key     text not null,
  verdict      text,   -- Pass/Fail/Borderline/N/A
  note         text,
  unique (deal_id, test_key)
);

create table if not exists bridging_adverse_credit_checks (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid not null references bridging_deals(id) on delete cascade,
  category_key  text not null,  -- 'A1'..'A8'
  found         boolean not null default false,
  cleared       boolean not null default false,
  detail        text,
  unique (deal_id, category_key)
);

create table if not exists bridging_policy_exceptions (
  id             uuid primary key default gen_random_uuid(),
  deal_id        uuid not null references bridging_deals(id) on delete cascade,
  trigger_key    text not null,  -- 'E1'..'E8'
  present        boolean not null default false,
  date_raised    date,
  funder_response text,
  note            text,
  unique (deal_id, trigger_key)
);

create table if not exists bridging_appetite_tiers (
  id                uuid primary key default gen_random_uuid(),
  deal_id           uuid not null references bridging_deals(id) on delete cascade,
  tier              text,
  justification     text,
  screening_outcome text,   -- Proceed to Stage 2 / Decline and close / Escalate for pre-clearance
  screened_by       text,
  screened_date     date,
  unique (deal_id)
);

-- ----------------------------------------------------------------------------
-- 6. KYC / AML REGISTER
-- ----------------------------------------------------------------------------
create table if not exists bridging_kyc_items (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid not null references bridging_deals(id) on delete cascade,
  item_ref      text not null,  -- 'K1'..'K20'
  received      boolean not null default false,
  date_received date,
  expiry        date,
  certified     boolean not null default false,
  evidence_ref  text,
  notes         text,
  unique (deal_id, item_ref)
);

-- ----------------------------------------------------------------------------
-- 7. CP SCHEDULE
-- ----------------------------------------------------------------------------
create table if not exists bridging_cp_items (
  id             uuid primary key default gen_random_uuid(),
  deal_id        uuid not null references bridging_deals(id) on delete cascade,
  condition_text text not null,
  category       text,
  owner          text,
  due_date       date,
  status         text not null default 'Not started', -- Not started/In progress/Satisfied/Waived/Blocked
  date_satisfied date,
  evidence_ref   text,
  notes          text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_cp_deal on bridging_cp_items(deal_id);
-- business rule: a CP cannot be marked Satisfied without an evidence reference
alter table bridging_cp_items
  add constraint chk_cp_evidence_on_satisfied
  check (status <> 'Satisfied' or (evidence_ref is not null and length(trim(evidence_ref)) > 0));

-- ----------------------------------------------------------------------------
-- 8. FEES AND COSTS
-- ----------------------------------------------------------------------------
create table if not exists bridging_fees_costs (
  id           uuid primary key default gen_random_uuid(),
  deal_id      uuid not null references bridging_deals(id) on delete cascade,
  item_ref     text not null,  -- 'F1'..'F12'
  amount       numeric,
  invoiced     boolean not null default false,
  received     boolean not null default false,
  notes        text,
  unique (deal_id, item_ref)
);

-- ----------------------------------------------------------------------------
-- 9. FUNDER SELECTION
-- ----------------------------------------------------------------------------
create table if not exists bridging_funder_approaches (
  id                    uuid primary key default gen_random_uuid(),
  deal_id               uuid not null references bridging_deals(id) on delete cascade,
  funder                text not null,
  contact               text,
  date_approached       date,
  response              text,
  rate                  text,
  arrangement_fee       text,
  exit_fee              text,
  ltv                   text,
  term                  text,
  retentions            text,
  default_position      text,
  acceptance_fee        text,
  legal_valuation_costs text,
  total_cost            text,
  notes                 text,
  selected              boolean not null default false,
  created_at            timestamptz not null default now()
);
create index if not exists idx_funder_approach_deal on bridging_funder_approaches(deal_id);

-- ----------------------------------------------------------------------------
-- 10. VALUATION / UNDERWRITING
-- ----------------------------------------------------------------------------
create table if not exists bridging_valuation_records (
  id                     uuid primary key default gen_random_uuid(),
  deal_id                uuid not null references bridging_deals(id) on delete cascade,
  valuer                 text,
  instruction_date       date,
  inspection_date        date,
  report_due             date,
  report_received        date,
  assumed_value          numeric,
  reported_value         numeric,
  special_assumptions    text,
  marketing_period       text,
  qualifications         text,
  renegotiation_record   text,
  client_representation  text,
  unique (deal_id)
);

-- ----------------------------------------------------------------------------
-- 11. COMMUNICATIONS / NOTES
-- ----------------------------------------------------------------------------
create table if not exists bridging_communications (
  id         uuid primary key default gen_random_uuid(),
  deal_id    uuid not null references bridging_deals(id) on delete cascade,
  author_id  uuid references bridging_users(id),
  author_name text,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_comms_deal on bridging_communications(deal_id);

-- ----------------------------------------------------------------------------
-- 12. SLA EVENTS & ESCALATIONS
-- ----------------------------------------------------------------------------
create table if not exists bridging_sla_events (
  id           uuid primary key default gen_random_uuid(),
  deal_id      uuid not null references bridging_deals(id) on delete cascade,
  sla_key      text not null,
  due_at       timestamptz,
  met          boolean,
  breach_reason text,
  owner        text,
  created_at   timestamptz not null default now()
);

create table if not exists bridging_escalations (
  id              uuid primary key default gen_random_uuid(),
  deal_id         uuid not null references bridging_deals(id) on delete cascade,
  trigger_text    text not null,
  stage           int,
  owner           text,
  raised_date     date not null default current_date,
  raised_to       text,
  status          text not null default 'Open',
  resolution      text,
  resolution_date date,
  evidence_ref    text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_escalations_deal on bridging_escalations(deal_id);

-- ----------------------------------------------------------------------------
-- 13. DOCUMENTS (vault)
-- ----------------------------------------------------------------------------
create table if not exists bridging_documents (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid not null references bridging_deals(id) on delete cascade,
  folder        text not null,   -- '01_Initial_Enquiry'..'08_Checklist'
  doc_type      text,
  storage_path  text,            -- Supabase Storage object path
  version       int not null default 1,
  file_date     date,
  linked_stage  int,
  linked_task_ref text,
  linked_gate   text,
  linked_cp_id  uuid references bridging_cp_items(id),
  linked_kyc_ref text,
  notes         text,
  uploaded_by   uuid references bridging_users(id),
  created_at    timestamptz not null default now()
);
create index if not exists idx_documents_deal on bridging_documents(deal_id);

-- ----------------------------------------------------------------------------
-- 14. POST-COMPLETION / REDEMPTION WATCH
-- ----------------------------------------------------------------------------
create table if not exists bridging_post_completion (
  id                      uuid primary key default gen_random_uuid(),
  deal_id                 uuid not null references bridging_deals(id) on delete cascade,
  redemption_watch_date   date,
  exit_status             text,   -- On track/Delayed/At risk
  exit_confidence         text,   -- Strong/Adequate/Weak/At risk
  retention_balance       numeric,
  last_review             date,
  refinance_opportunity   text,
  discharge_evidence      text,
  unique (deal_id)
);

-- ----------------------------------------------------------------------------
-- 15. AUDIT LOG
-- ----------------------------------------------------------------------------
create table if not exists bridging_audit_logs (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid references bridging_deals(id) on delete cascade,
  organisation_id uuid not null references bridging_organisations(id) on delete cascade,
  user_id     uuid references bridging_users(id),
  user_name   text,
  action      text not null,
  before_value jsonb,
  after_value  jsonb,
  reason      text,
  linked_evidence text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_deal on bridging_audit_logs(deal_id);
create index if not exists idx_audit_org on bridging_audit_logs(organisation_id);

-- ----------------------------------------------------------------------------
-- 16. STATUS HISTORY (for stage-velocity / conversion MI)
-- ----------------------------------------------------------------------------
create table if not exists bridging_status_history (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid not null references bridging_deals(id) on delete cascade,
  from_status text,
  to_status   text not null,
  from_stage  int,
  to_stage    int,
  changed_at  timestamptz not null default now(),
  changed_by  text
);

-- ----------------------------------------------------------------------------
-- 17. CLIENT PORTAL INVITES
-- ----------------------------------------------------------------------------
create table if not exists bridging_client_portal_invites (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid not null references bridging_deals(id) on delete cascade,
  email       text not null,
  token       text not null unique default encode(gen_random_bytes(18), 'hex'),
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- Every tenant-owned table is scoped to organisation_id, either directly or
-- via its parent deal. A user can only see rows in their own organisation.
-- ============================================================================
alter table bridging_organisations enable row level security;
alter table bridging_users enable row level security;
alter table bridging_deals enable row level security;
alter table bridging_stage_tasks enable row level security;
alter table bridging_gate_signoffs enable row level security;
alter table bridging_eligibility_tests enable row level security;
alter table bridging_adverse_credit_checks enable row level security;
alter table bridging_policy_exceptions enable row level security;
alter table bridging_appetite_tiers enable row level security;
alter table bridging_kyc_items enable row level security;
alter table bridging_cp_items enable row level security;
alter table bridging_fees_costs enable row level security;
alter table bridging_funder_approaches enable row level security;
alter table bridging_valuation_records enable row level security;
alter table bridging_communications enable row level security;
alter table bridging_sla_events enable row level security;
alter table bridging_escalations enable row level security;
alter table bridging_documents enable row level security;
alter table bridging_post_completion enable row level security;
alter table bridging_audit_logs enable row level security;
alter table bridging_status_history enable row level security;
alter table bridging_client_portal_invites enable row level security;
alter table bridging_funder_parameters enable row level security;
alter table bridging_core_parameters enable row level security;
alter table bridging_reason_codes enable row level security;

-- helper: organisation of the calling user
create or replace function bridging_current_org() returns uuid
language sql stable as $$
  select organisation_id from bridging_users where id = auth.uid()
$$;

create policy org_isolation_orgs on bridging_organisations
  for all using (id = bridging_current_org());

create policy org_isolation_users on bridging_users
  for all using (organisation_id = bridging_current_org());

create policy org_isolation_deals on bridging_deals
  for all using (organisation_id = bridging_current_org())
  with check (organisation_id = bridging_current_org());

create policy org_isolation_params_funder on bridging_funder_parameters
  for all using (organisation_id = bridging_current_org());
create policy org_isolation_params_core on bridging_core_parameters
  for all using (organisation_id = bridging_current_org());

-- bridging_reason_codes is shared, non-tenant reference data (the 13 fixed
-- "Not proceeding" codes) — every signed-in user may read it, but only a
-- migration / the service role may write to it, so there is deliberately
-- no insert/update/delete policy: those default-deny under RLS.
create policy read_reason_codes on bridging_reason_codes
  for select using (auth.role() = 'authenticated');

-- child tables: scoped via their parent deal's organisation
create policy org_isolation_tasks on bridging_stage_tasks
  for all using (deal_id in (select id from bridging_deals where organisation_id = bridging_current_org()));
create policy org_isolation_gates on bridging_gate_signoffs
  for all using (deal_id in (select id from bridging_deals where organisation_id = bridging_current_org()));
create policy org_isolation_elig on bridging_eligibility_tests
  for all using (deal_id in (select id from bridging_deals where organisation_id = bridging_current_org()));
create policy org_isolation_adverse on bridging_adverse_credit_checks
  for all using (deal_id in (select id from bridging_deals where organisation_id = bridging_current_org()));
create policy org_isolation_exceptions on bridging_policy_exceptions
  for all using (deal_id in (select id from bridging_deals where organisation_id = bridging_current_org()));
create policy org_isolation_tiers on bridging_appetite_tiers
  for all using (deal_id in (select id from bridging_deals where organisation_id = bridging_current_org()));
create policy org_isolation_kyc on bridging_kyc_items
  for all using (deal_id in (select id from bridging_deals where organisation_id = bridging_current_org()));
create policy org_isolation_cp on bridging_cp_items
  for all using (deal_id in (select id from bridging_deals where organisation_id = bridging_current_org()));
create policy org_isolation_fees on bridging_fees_costs
  for all using (deal_id in (select id from bridging_deals where organisation_id = bridging_current_org()));
create policy org_isolation_funderapp on bridging_funder_approaches
  for all using (deal_id in (select id from bridging_deals where organisation_id = bridging_current_org()));
create policy org_isolation_valuation on bridging_valuation_records
  for all using (deal_id in (select id from bridging_deals where organisation_id = bridging_current_org()));
create policy org_isolation_comms on bridging_communications
  for all using (deal_id in (select id from bridging_deals where organisation_id = bridging_current_org()));
create policy org_isolation_sla on bridging_sla_events
  for all using (deal_id in (select id from bridging_deals where organisation_id = bridging_current_org()));
create policy org_isolation_escalations on bridging_escalations
  for all using (deal_id in (select id from bridging_deals where organisation_id = bridging_current_org()));
create policy org_isolation_documents on bridging_documents
  for all using (deal_id in (select id from bridging_deals where organisation_id = bridging_current_org()));
create policy org_isolation_postcompletion on bridging_post_completion
  for all using (deal_id in (select id from bridging_deals where organisation_id = bridging_current_org()));
create policy org_isolation_statushistory on bridging_status_history
  for all using (deal_id in (select id from bridging_deals where organisation_id = bridging_current_org()));
create policy org_isolation_portalinvites on bridging_client_portal_invites
  for all using (deal_id in (select id from bridging_deals where organisation_id = bridging_current_org()));

create policy org_isolation_audit on bridging_audit_logs
  for all using (organisation_id = bridging_current_org());

-- Role-gated write policies (examples — extend per the Permissions model in
-- the README). Gate sign-off, for instance, should be restricted further:
create policy gate_signoff_role_gate on bridging_gate_signoffs
  for insert with check (
    deal_id in (
      select d.id from bridging_deals d
      join bridging_users u on u.organisation_id = d.organisation_id and u.id = auth.uid()
      where 'Admin' = any(u.roles) or 'Principal' = any(u.roles) or 'Deal Lead' = any(u.roles) or 'Case Manager' = any(u.roles)
    )
  );

-- ============================================================================
-- TRIGGERS: updated_at maintenance + status_history capture
-- ============================================================================
create or replace function bridging_touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_deals_touch before update on bridging_deals
  for each row execute function bridging_touch_updated_at();

create or replace function bridging_capture_status_history() returns trigger language plpgsql as $$
begin
  if (old.deal_status is distinct from new.deal_status) or (old.current_stage is distinct from new.current_stage) then
    insert into bridging_status_history (deal_id, from_status, to_status, from_stage, to_stage, changed_by)
    values (new.id, old.deal_status, new.deal_status, old.current_stage, new.current_stage, current_setting('request.jwt.claim.email', true));
  end if;
  return new;
end; $$;

create trigger trg_deals_status_history after update on bridging_deals
  for each row execute function bridging_capture_status_history();

-- ============================================================================
-- SEED: default funder parameters (Reference tab §8.1, August 2026)
-- Replace organisation_id below with the real org id after bridging_organisations insert.
-- ============================================================================
-- insert into bridging_funder_parameters (organisation_id, product, day1_ltv, gross_ltv, ltc, indicative_pricing, note) values
--  ('<org-id>', 'Unregulated bridging', 0.75, 0.75, null, 'BBR + 450bps', 'Up to 75% LTV'),
--  ('<org-id>', 'Light refurbishment', 0.75, 0.75, 0.90, 'BBR + 475bps', '70% LTGDV preferred'),
--  ('<org-id>', 'Heavy refurbishment', 0.70, 0.70, 0.85, 'BBR + 500bps', 'Standard terms'),
--  ('<org-id>', 'Part-complete development', 0.70, 0.65, 0.85, 'BBR + 525bps', 'Standard terms'),
--  ('<org-id>', 'Ground-up development', 0.55, 0.65, 0.85, 'BBR + 525bps', '65% day 1 in Greater London and the South East');
