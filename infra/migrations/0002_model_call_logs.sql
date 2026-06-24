create table model_call_logs (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid references workspaces(id) on delete set null,
    task_id uuid references generation_tasks(id) on delete set null,
    provider_id uuid references providers(id) on delete set null,
    model_id uuid references models(id) on delete set null,
    provider_name varchar(120),
    model_name varchar(160),
    call_type varchar(64) not null,
    status varchar(32) not null,
    latency_ms integer,
    input_tokens integer,
    output_tokens integer,
    provider_cost_micro bigint,
    error_message text,
    created_at timestamptz not null default now()
);

create index model_call_logs_created_idx on model_call_logs(created_at);
create index model_call_logs_provider_model_idx on model_call_logs(provider_id, model_id);
create index model_call_logs_status_idx on model_call_logs(status);
create index model_call_logs_task_id_idx on model_call_logs(task_id);
