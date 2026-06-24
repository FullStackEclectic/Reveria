-- Create project shares table and alter project comments for client portal
create table project_shares (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references projects(id) on delete cascade,
    token varchar(128) unique not null,
    created_by uuid references users(id) on delete set null,
    created_at timestamptz not null default now(),
    expires_at timestamptz,
    status varchar(32) not null default 'active'
);

create index project_shares_token_idx on project_shares(token);

-- Make user_id nullable in project_comments to allow client comments
alter table project_comments alter column user_id drop not null;
alter table project_comments add column client_name varchar(80);
