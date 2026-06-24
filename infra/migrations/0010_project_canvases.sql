create table project_canvases (
    project_id uuid primary key references projects(id) on delete cascade,
    workspace_id uuid not null references workspaces(id) on delete cascade,
    canvas jsonb not null default '{"version":1,"items":[]}'::jsonb,
    updated_by uuid references users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index project_canvases_workspace_idx on project_canvases(workspace_id);
