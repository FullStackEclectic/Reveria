create table plans (
    id uuid primary key default gen_random_uuid(),
    name varchar(100) not null,
    price_cents bigint not null default 0,
    monthly_credits bigint not null default 0,
    max_members integer not null default 1,
    storage_quota_bytes bigint not null default 0,
    features jsonb not null default '{}'::jsonb,
    enabled boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index plans_enabled_idx on plans(enabled);

create table orders (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    plan_id uuid not null references plans(id),
    amount_cents bigint not null default 0,
    payment_provider varchar(64) not null,
    status varchar(32) not null default 'pending',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index orders_workspace_status_idx on orders(workspace_id, status);

create table recharge_records (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    order_id uuid references orders(id) on delete set null,
    credits_added bigint not null,
    recharge_type varchar(32) not null,
    operator_id uuid references users(id) on delete set null,
    created_at timestamptz not null default now()
);

create index recharge_records_workspace_created_idx on recharge_records(workspace_id, created_at);

-- Seed default plans
insert into plans (id, name, price_cents, monthly_credits, max_members, storage_quota_bytes, features, enabled) values
('e6a39b4b-9e4a-4d22-8700-1c9f02931211', '免费版 (Free)', 0, 100, 2, 1073741824, '{"advanced_video": false, "private_model_key": false}'::jsonb, true),
('e6a39b4b-9e4a-4d22-8700-1c9f02931212', '标准版 (Standard)', 1900, 5000, 5, 10737418240, '{"advanced_video": true, "private_model_key": false}'::jsonb, true),
('e6a39b4b-9e4a-4d22-8700-1c9f02931213', '专业工作室版 (Pro Studio)', 4900, 20000, 20, 53687091200, '{"advanced_video": true, "private_model_key": true}'::jsonb, true);
