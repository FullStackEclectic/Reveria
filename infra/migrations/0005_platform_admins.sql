alter table users
add column is_platform_admin boolean not null default false;

create index users_platform_admin_idx on users(is_platform_admin);
