-- Create workspace invitations table
create table workspace_invitations (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    email varchar(120) not null,
    role varchar(32) not null,
    token text not null,
    status varchar(32) not null default 'pending',
    invited_by uuid references users(id) on delete set null,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null
);

create index workspace_invitations_token_idx on workspace_invitations(token);
create index workspace_invitations_email_idx on workspace_invitations(email);
