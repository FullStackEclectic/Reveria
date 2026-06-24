create extension if not exists pgcrypto;

create table users (
    id uuid primary key default gen_random_uuid(),
    email varchar(255) unique,
    phone varchar(32),
    display_name varchar(100) not null,
    avatar_url text,
    status varchar(32) not null default 'active',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index users_status_idx on users(status);

create table workspaces (
    id uuid primary key default gen_random_uuid(),
    name varchar(120) not null,
    owner_user_id uuid references users(id),
    plan_id uuid,
    credit_balance bigint not null default 0,
    storage_quota bigint not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table workspace_members (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    role varchar(32) not null,
    daily_credit_limit bigint,
    monthly_credit_limit bigint,
    status varchar(32) not null default 'active',
    joined_at timestamptz not null default now(),
    unique (workspace_id, user_id)
);

create index workspace_members_user_id_idx on workspace_members(user_id);
create index workspace_members_workspace_role_idx on workspace_members(workspace_id, role);

create table customers (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    name varchar(160) not null,
    industry varchar(100),
    contact_name varchar(100),
    contact_info jsonb not null default '{}'::jsonb,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index customers_workspace_id_idx on customers(workspace_id);
create index customers_workspace_name_idx on customers(workspace_id, name);

create table brand_kits (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    customer_id uuid references customers(id) on delete set null,
    name varchar(160) not null,
    logo_asset_id uuid,
    colors jsonb not null default '[]'::jsonb,
    fonts jsonb not null default '[]'::jsonb,
    tone_of_voice text,
    visual_keywords jsonb not null default '[]'::jsonb,
    forbidden_words jsonb not null default '[]'::jsonb,
    style_prompt text,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index brand_kits_workspace_id_idx on brand_kits(workspace_id);
create index brand_kits_customer_id_idx on brand_kits(customer_id);

create table projects (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    customer_id uuid references customers(id) on delete set null,
    brand_kit_id uuid references brand_kits(id) on delete set null,
    name varchar(180) not null,
    brief text,
    target_platforms jsonb not null default '[]'::jsonb,
    status varchar(32) not null default 'draft',
    budget_credits bigint,
    consumed_credits bigint not null default 0,
    due_at timestamptz,
    created_by uuid references users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index projects_workspace_status_idx on projects(workspace_id, status);
create index projects_customer_id_idx on projects(customer_id);
create index projects_brand_kit_id_idx on projects(brand_kit_id);

create table assets (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    project_id uuid references projects(id) on delete set null,
    customer_id uuid references customers(id) on delete set null,
    asset_type varchar(32) not null,
    source varchar(32) not null,
    file_url text,
    thumbnail_url text,
    metadata jsonb not null default '{}'::jsonb,
    created_by uuid references users(id) on delete set null,
    created_at timestamptz not null default now()
);

create index assets_workspace_type_idx on assets(workspace_id, asset_type);
create index assets_project_id_idx on assets(project_id);
create index assets_customer_id_idx on assets(customer_id);

create table providers (
    id uuid primary key default gen_random_uuid(),
    name varchar(120) not null,
    type varchar(64) not null,
    base_url text,
    encrypted_api_key text,
    region varchar(64),
    enabled boolean not null default false,
    priority integer not null default 100,
    timeout_ms integer,
    retry_policy jsonb not null default '{}'::jsonb,
    rate_limit jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index providers_enabled_idx on providers(enabled);

create table models (
    id uuid primary key default gen_random_uuid(),
    provider_id uuid not null references providers(id) on delete cascade,
    name varchar(160) not null,
    display_name varchar(160),
    capability jsonb not null default '[]'::jsonb,
    context_window integer,
    input_modalities jsonb not null default '[]'::jsonb,
    output_modalities jsonb not null default '[]'::jsonb,
    quality_tier varchar(32),
    cost_tier varchar(32),
    enabled boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (provider_id, name)
);

create index models_enabled_idx on models(enabled);

create table pricing_rules (
    id uuid primary key default gen_random_uuid(),
    name varchar(160) not null,
    task_type varchar(64),
    model_id uuid references models(id) on delete set null,
    unit varchar(64),
    cost_formula text,
    credit_formula text,
    min_credits bigint,
    max_credits bigint,
    enabled boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index pricing_rules_task_type_idx on pricing_rules(task_type);
create index pricing_rules_enabled_idx on pricing_rules(enabled);

create table workflow_templates (
    id uuid primary key default gen_random_uuid(),
    name varchar(160) not null,
    task_type varchar(64) not null,
    input_schema jsonb not null,
    output_schema jsonb not null default '{}'::jsonb,
    workflow_steps jsonb not null,
    default_model_route jsonb not null default '{}'::jsonb,
    pricing_rule_id uuid references pricing_rules(id) on delete set null,
    version integer not null default 1,
    enabled boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index workflow_templates_task_type_idx on workflow_templates(task_type);
create index workflow_templates_enabled_idx on workflow_templates(enabled);

create table generation_tasks (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    project_id uuid references projects(id) on delete set null,
    user_id uuid references users(id) on delete set null,
    task_type varchar(64) not null,
    template_id uuid references workflow_templates(id) on delete set null,
    template_version integer,
    input_payload jsonb not null,
    output_payload jsonb,
    selected_model varchar(160),
    provider_id uuid references providers(id) on delete set null,
    estimated_credits bigint not null default 0,
    frozen_credits bigint not null default 0,
    actual_credits bigint not null default 0,
    provider_cost_micro bigint,
    status varchar(32) not null default 'pending',
    error_code varchar(80),
    error_message text,
    idempotency_key varchar(120),
    created_at timestamptz not null default now(),
    started_at timestamptz,
    completed_at timestamptz,
    unique (workspace_id, user_id, idempotency_key)
);

create index generation_tasks_workspace_status_idx on generation_tasks(workspace_id, status);
create index generation_tasks_project_created_idx on generation_tasks(project_id, created_at);
create index generation_tasks_template_id_idx on generation_tasks(template_id);

create table credit_transactions (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    user_id uuid references users(id) on delete set null,
    project_id uuid references projects(id) on delete set null,
    task_id uuid references generation_tasks(id) on delete set null,
    transaction_type varchar(32) not null,
    amount bigint not null,
    balance_after bigint not null,
    reason text,
    operator_id uuid references users(id) on delete set null,
    created_at timestamptz not null default now()
);

create index credit_transactions_workspace_created_idx on credit_transactions(workspace_id, created_at);
create index credit_transactions_task_id_idx on credit_transactions(task_id);
create index credit_transactions_type_idx on credit_transactions(transaction_type);

create table audit_logs (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid references workspaces(id) on delete set null,
    operator_id uuid references users(id) on delete set null,
    action varchar(120) not null,
    target_type varchar(80),
    target_id uuid,
    before_snapshot jsonb,
    after_snapshot jsonb,
    ip inet,
    user_agent text,
    created_at timestamptz not null default now()
);

create index audit_logs_workspace_created_idx on audit_logs(workspace_id, created_at);
create index audit_logs_operator_created_idx on audit_logs(operator_id, created_at);
create index audit_logs_action_idx on audit_logs(action);
