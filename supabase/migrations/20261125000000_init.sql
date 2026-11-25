-- Initial schema. Source of truth for the database from here on: add new files, never edit this one once it has run on a real project.
-- (replica/schema.sql is the same file kept beside the design notes.)

-- Schema for the rent-collection clone (Supabase / Postgres 15+).
-- Money is bigint poisha (1 taka = 100 poisha). One currency per account (profiles.currency), so no per-row currency column.
-- Every user-owned table has user_id (default auth.uid()) and a composite foreign key (parent_id, user_id)
-- so a row can never point at another user's parent. Access rules: row level security, one policy per table.
-- Delete rules: the money chain uses NO ACTION on purpose. A tenant, bill or payment cannot be deleted out from
-- under the books, yet deleting the account (profiles -> cascade on user_id) still removes everything, because
-- NO ACTION is checked at the end of the statement, after the cascade has emptied the children.

create extension if not exists btree_gist;

create function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- 1. profiles (id = auth.users.id) ------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  language text not null default 'bn' check (language in ('bn', 'en')),
  currency text not null default 'BDT' check (currency ~ '^[A-Z]{3}$'),
  reminder_days_before smallint not null default 2 check (reminder_days_before between 0 and 28),
  primary_property_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;
revoke execute on function handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- 2. properties -------------------------------------------------------------------------------
create table properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  address text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index on properties (user_id);

alter table profiles add constraint profiles_primary_property_fk
  foreign key (primary_property_id, id) references properties (id, user_id)
  on delete set null (primary_property_id);

-- 3. units (rooms / flats). Occupied = has a tenant with moved_out_on is null (derived, not stored) --
create table units (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles (id) on delete cascade,
  property_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  floor text,
  default_rent bigint not null default 0 check (default_rent >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (property_id, user_id) references properties (id, user_id) on delete no action
);
create index on units (user_id);
create index on units (property_id);
create unique index units_name_per_property on units (property_id, name) where archived_at is null;

-- 4. tenants (one row = one tenancy; rental history = all rows of a unit) ---------------------
create table tenants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles (id) on delete cascade,
  unit_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  phone text,
  move_in_on date not null default current_date,
  moved_out_on date,
  monthly_rent bigint not null check (monthly_rent >= 0),
  monthly_utilities bigint not null default 0 check (monthly_utilities >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (unit_id, user_id) references units (id, user_id) on delete no action,
  constraint tenants_dates_ok check (moved_out_on is null or moved_out_on >= move_in_on)
);
create index on tenants (user_id);
create index on tenants (unit_id);
-- a flat has at most one current tenant
create unique index tenants_one_active_per_unit on tenants (unit_id) where moved_out_on is null;

-- 5. bills. One per tenant per period. The exclusion constraint is what stops a double "Create Bill" ----
create table bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles (id) on delete cascade,
  tenant_id uuid not null,
  unit_id uuid not null,
  period_start date not null,
  period_end date not null,
  base_rent bigint not null check (base_rent >= 0),
  utilities_total bigint not null default 0 check (utilities_total >= 0),
  total_due bigint generated always as (base_rent + utilities_total) stored,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (tenant_id, user_id) references tenants (id, user_id) on delete no action,
  foreign key (unit_id, user_id) references units (id, user_id) on delete no action,
  constraint bills_period_ok check (period_end >= period_start),
  constraint bills_no_overlap exclude using gist (
    tenant_id with =,
    daterange(period_start, period_end, '[]') with &&
  )
);
create index on bills (user_id, period_start);
create index on bills (tenant_id);
create index on bills (unit_id);

-- 6. bill_utilities (optional itemisation; the recon only saw a total, so this is a guess) ------
create table bill_utilities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles (id) on delete cascade,
  bill_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  amount bigint not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (bill_id, user_id) references bills (id, user_id) on delete cascade
);
create index on bill_utilities (user_id);
create index on bill_utilities (bill_id);

-- when items exist they are the source of truth for bills.utilities_total
create function bill_utilities_sync() returns trigger language plpgsql as $$
declare
  v_bill uuid := case tg_op when 'DELETE' then old.bill_id else new.bill_id end;
begin
  update bills
     set utilities_total = coalesce((select sum(amount) from bill_utilities where bill_id = v_bill), 0)
   where id = v_bill;
  return null;
end $$;
create trigger bill_utilities_sync after insert or update or delete on bill_utilities
  for each row execute function bill_utilities_sync();

-- 7. payments ---------------------------------------------------------------------------------
create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles (id) on delete cascade,
  bill_id uuid not null,
  amount bigint not null check (amount > 0),
  paid_on date not null,
  -- Card and Nagad were seen in the receipt screenshot. The rest are the usual local methods (guess).
  method text not null check (method in ('cash', 'bank', 'card', 'bkash', 'nagad', 'rocket', 'cheque', 'other')),
  note text,
  client_request_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (bill_id, user_id) references bills (id, user_id) on delete no action,
  unique (user_id, client_request_id)
);
create index on payments (bill_id);
create index on payments (user_id, paid_on);

-- A bill can never be over-paid, even with two phones saving at once: the bill row is locked first.
create function payments_not_over() returns trigger language plpgsql as $$
declare
  v_due bigint;
  v_paid bigint;
begin
  -- a retry of a request that already succeeded: let the unique key (or ON CONFLICT DO NOTHING) answer it,
  -- otherwise a retry that follows a bill-completing payment would be reported as an overpayment
  if tg_op = 'INSERT' and new.client_request_id is not null
     and exists (select 1 from payments where user_id = new.user_id and client_request_id = new.client_request_id) then
    return new;
  end if;
  select total_due into v_due from bills where id = new.bill_id for update;
  select coalesce(sum(amount), 0) into v_paid from payments where bill_id = new.bill_id and id <> new.id;
  if v_paid + new.amount > v_due then
    raise exception 'payment exceeds the amount due' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger payments_not_over before insert or update of amount, bill_id on payments
  for each row execute function payments_not_over();

-- ...and a bill can not be edited below what has already been paid
create function bills_not_below_paid() returns trigger language plpgsql as $$
begin
  if (select coalesce(sum(amount), 0) from payments where bill_id = new.id) > new.base_rent + new.utilities_total then
    raise exception 'bill total is below the amount already paid' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger bills_not_below_paid before update of base_rent, utilities_total on bills
  for each row execute function bills_not_below_paid();

-- Status is derived, never stored. security_invoker makes row level security apply to the view.
create view bill_summary with (security_invoker = true) as
select
  b.*,
  coalesce(p.paid, 0)::bigint as paid_amount,
  (b.total_due - coalesce(p.paid, 0))::bigint as balance,
  case
    when coalesce(p.paid, 0) >= b.total_due then 'paid'
    when coalesce(p.paid, 0) = 0 then 'due'
    else 'partial'
  end as status
from bills b
left join lateral (select sum(amount) as paid from payments where bill_id = b.id) p on true;

-- 8. expenses (guess: nothing of the screen was seen) -------------------------------------------
create table expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles (id) on delete cascade,
  property_id uuid not null,
  title text not null check (length(trim(title)) > 0),
  amount bigint not null check (amount > 0),
  spent_on date not null,
  category text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (property_id, user_id) references properties (id, user_id) on delete no action
);
create index on expenses (user_id);
create index on expenses (property_id, spent_on);

-- 9. meetings. Upcoming / completed is derived from starts_at (a guess about the original) -----
create table meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles (id) on delete cascade,
  property_id uuid not null,
  title text not null check (length(trim(title)) > 0),
  starts_at timestamptz not null,
  location text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (property_id, user_id) references properties (id, user_id) on delete no action
);
create index on meetings (user_id);
create index on meetings (property_id, starts_at);

-- 10. meeting_members (join table: created_at only) -------------------------------------------
create table meeting_members (
  meeting_id uuid not null,
  tenant_id uuid not null,
  user_id uuid not null default auth.uid() references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (meeting_id, tenant_id),
  foreign key (meeting_id, user_id) references meetings (id, user_id) on delete cascade,
  foreign key (tenant_id, user_id) references tenants (id, user_id) on delete no action
);
create index on meeting_members (tenant_id);
create index on meeting_members (user_id);

-- updated_at on every table that has it ---------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles', 'properties', 'units', 'tenants', 'bills', 'bill_utilities',
                           'payments', 'expenses', 'meetings'] loop
    execute format('create trigger %I before update on %I for each row execute function set_updated_at()',
                   t || '_updated_at', t);
  end loop;
end $$;

-- row level security --------------------------------------------------------------------------
alter table profiles enable row level security;
create policy profiles_self on profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['properties', 'units', 'tenants', 'bills', 'bill_utilities', 'payments',
                           'expenses', 'meetings', 'meeting_members'] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_owner', t);
  end loop;
end $$;

-- functions the app calls (security invoker, so row level security still applies) -----------------

-- One tap, one transaction: a bill for every tenant of the property whose tenancy overlaps the period.
-- Running it twice creates nothing new (the exclusion constraint skips what exists).
create function create_bills(p_property_id uuid, p_period_start date, p_period_end date)
returns table (created_count int, skipped_count int)
language plpgsql as $$
declare
  v_created int;
  v_eligible int;
begin
  if p_period_end < p_period_start then
    raise exception 'period_end is before period_start' using errcode = '22023';
  end if;

  with eligible as (
    select t.id as tenant_id, t.unit_id, t.monthly_rent, t.monthly_utilities
    from tenants t
    join units u on u.id = t.unit_id
    where u.property_id = p_property_id
      and t.move_in_on <= p_period_end
      and (t.moved_out_on is null or t.moved_out_on >= p_period_start)
  ), ins as (
    insert into bills (tenant_id, unit_id, period_start, period_end, base_rent, utilities_total)
    select tenant_id, unit_id, p_period_start, p_period_end, monthly_rent, monthly_utilities from eligible
    on conflict do nothing
    returning 1
  )
  select (select count(*) from ins), (select count(*) from eligible) into v_created, v_eligible;

  return query select v_created, v_eligible - v_created;
end $$;

-- Home dashboard and the monthly report. collected = payments received in the month (by paid_on);
-- billed / due = bills whose period starts in the month. outstanding = everything still unpaid on the
-- property, whatever month it was billed (this is what the home "Due" card shows, so an old unpaid bill is never hidden).
create function month_summary(p_property_id uuid, p_month date)
returns table (collected_amount bigint, billed_amount bigint, due_amount bigint, expense_amount bigint,
               paid_bills int, unpaid_bills int, outstanding_amount bigint, outstanding_bills int)
language sql stable as $$
  with r as (
    select date_trunc('month', p_month)::date as m_start,
           (date_trunc('month', p_month) + interval '1 month')::date as m_end
  ), bs as (
    select s.*
    from bill_summary s
    join units u on u.id = s.unit_id, r
    where u.property_id = p_property_id and s.period_start >= r.m_start and s.period_start < r.m_end
  ), ob as (
    select s.*
    from bill_summary s
    join units u on u.id = s.unit_id
    where u.property_id = p_property_id and s.status <> 'paid'
  )
  select
    coalesce((select sum(p.amount)
              from payments p
              join bills b on b.id = p.bill_id
              join units u on u.id = b.unit_id, r
              where u.property_id = p_property_id and p.paid_on >= r.m_start and p.paid_on < r.m_end), 0)::bigint,
    coalesce((select sum(total_due) from bs), 0)::bigint,
    coalesce((select sum(balance) from bs), 0)::bigint,
    coalesce((select sum(x.amount) from expenses x, r
              where x.property_id = p_property_id and x.spent_on >= r.m_start and x.spent_on < r.m_end), 0)::bigint,
    (select count(*) from bs where status = 'paid')::int,
    (select count(*) from bs where status <> 'paid')::int,
    coalesce((select sum(balance) from ob), 0)::bigint,
    (select count(*) from ob)::int
$$;

-- Annual report: one row per month.
create function year_summary(p_property_id uuid, p_year int)
returns table (month date, collected_amount bigint, billed_amount bigint, expense_amount bigint)
language sql stable as $$
  select
    g::date,
    coalesce((select sum(p.amount)
              from payments p
              join bills b on b.id = p.bill_id
              join units u on u.id = b.unit_id
              where u.property_id = p_property_id
                and p.paid_on >= g and p.paid_on < g + interval '1 month'), 0)::bigint,
    coalesce((select sum(b.total_due)
              from bills b
              join units u on u.id = b.unit_id
              where u.property_id = p_property_id
                and b.period_start >= g and b.period_start < g + interval '1 month'), 0)::bigint,
    coalesce((select sum(x.amount)
              from expenses x
              where x.property_id = p_property_id
                and x.spent_on >= g and x.spent_on < g + interval '1 month'), 0)::bigint
  from generate_series(make_date(p_year, 1, 1)::timestamp, make_date(p_year, 12, 1)::timestamp, interval '1 month') g
$$;

-- the signed-in app may call these; anonymous may not
revoke execute on function create_bills(uuid, date, date), month_summary(uuid, date), year_summary(uuid, int)
  from public, anon;
grant execute on function create_bills(uuid, date, date), month_summary(uuid, date), year_summary(uuid, int)
  to authenticated;
