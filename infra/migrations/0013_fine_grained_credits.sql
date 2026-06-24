-- Create gift credit batches table
create table gift_credit_batches (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    amount bigint not null,
    remaining_amount bigint not null,
    expired_at timestamptz not null,
    created_at timestamptz not null default now()
);

create index gift_credit_batches_workspace_expired_idx on gift_credit_batches(workspace_id, expired_at);

-- Alter workspaces
alter table workspaces add column refund_balance bigint not null default 0;

-- Alter credit_transactions
alter table credit_transactions add column gift_amount bigint not null default 0;
alter table credit_transactions add column recharge_amount bigint not null default 0;
alter table credit_transactions add column refund_amount bigint not null default 0;

-- Alter generation_tasks
alter table generation_tasks add column frozen_gift_credits bigint not null default 0;
alter table generation_tasks add column frozen_recharge_credits bigint not null default 0;
alter table generation_tasks add column frozen_refund_credits bigint not null default 0;

-- Backfill existing gift balances into batches (30 days validity)
insert into gift_credit_batches (workspace_id, amount, remaining_amount, expired_at)
select id, gift_balance, gift_balance, now() + interval '30 days'
from workspaces
where gift_balance > 0;
