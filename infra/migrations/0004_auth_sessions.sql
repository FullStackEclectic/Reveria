create table auth_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    token_hash varchar(128) not null unique,
    label varchar(120),
    expires_at timestamptz not null,
    revoked_at timestamptz,
    created_at timestamptz not null default now(),
    last_used_at timestamptz
);

create index auth_sessions_user_id_idx on auth_sessions(user_id);
create index auth_sessions_expires_idx on auth_sessions(expires_at);
