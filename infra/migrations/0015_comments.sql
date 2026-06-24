-- Create project and task comments tables
create table project_comments (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references projects(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    content text not null,
    created_at timestamptz not null default now()
);

create table task_comments (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null references generation_tasks(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    content text not null,
    created_at timestamptz not null default now()
);

create index project_comments_project_id_idx on project_comments(project_id);
create index task_comments_task_id_idx on task_comments(task_id);
