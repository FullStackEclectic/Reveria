-- Migrate workspaces
alter table workspaces add column gift_balance bigint not null default 0;
alter table workspaces add column recharge_balance bigint not null default 0;

-- Backfill existing balances
update workspaces set gift_balance = credit_balance;

-- Migrate providers
alter table providers add column consecutive_failures integer not null default 0;

-- Migrate generation_tasks
alter table generation_tasks add column routing_strategy varchar(32) not null default 'latency_first';
